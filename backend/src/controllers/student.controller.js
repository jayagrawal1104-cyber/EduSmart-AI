import bcrypt from 'bcryptjs';
import { prisma } from '../config/db.js';
import { logAction } from '../utils/audit.js';

// req.user is set by requireAuth: { id, role: 'student', institutionId, email, name }

const ATTENDANCE_THRESHOLD = 75;

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function toDateOnly(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function titleCase(str) {
  if (!str) return str;
  return str.charAt(0) + str.slice(1).toLowerCase();
}

function monthKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key) {
  const [year, month] = key.split('-');
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleString('en-US', { month: 'short' });
}

/**
 * GET /api/student/dashboard
 * Summary numbers for the student's landing page.
 */
export async function getDashboard(req, res) {
  const studentId = req.user.id;

  try {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { department: true, course: true },
    });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const [attendanceRecords, submissions, performanceRecords] = await Promise.all([
      prisma.attendance.findMany({ where: { studentId } }),
      prisma.submission.findMany({ where: { studentId }, include: { assignment: true } }),
      prisma.performanceRecord.findMany({ where: { studentId }, orderBy: { recordedAt: 'desc' }, take: 10 }),
    ]);

    const totalMarked = attendanceRecords.length;
    const present = attendanceRecords.filter((a) => a.status === 'PRESENT').length;
    const attendancePct = totalMarked ? Math.round((present / totalMarked) * 100) : null;

    const pendingAssignments = submissions.filter((s) => s.status === 'PENDING' || s.status === 'LATE').length;
    const avgPerformance = performanceRecords.length
      ? Math.round(performanceRecords.reduce((sum, r) => sum + r.score, 0) / performanceRecords.length)
      : null;

    res.json({
      student: {
        id: student.id,
        name: student.name,
        department: student.department.name,
        course: student.course.name,
        year: student.year,
        section: student.section,
      },
      stats: {
        attendancePct,
        pendingAssignments,
        avgPerformance,
      },
      recentPerformance: performanceRecords,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
}

/**
 * GET /api/student/attendance
 * Returns raw records (for the calendar view), a per-subject breakdown (with
 * the teaching faculty and how many more classes are needed to clear the
 * 75% threshold), and overall present/absent/late counts.
 */
export async function getAttendance(req, res) {
  try {
    const records = await prisma.attendance.findMany({
      where: { studentId: req.user.id },
      include: { subject: { include: { faculty: true } } },
      orderBy: { date: 'desc' },
    });

    const bySubject = {};
    for (const r of records) {
      const key = r.subject.id;
      bySubject[key] = bySubject[key] || {
        subject: r.subject.name,
        faculty: r.subject.faculty.name,
        attended: 0,
        total: 0,
      };
      bySubject[key].total += 1;
      if (r.status === 'PRESENT') bySubject[key].attended += 1;
    }

    const summary = Object.values(bySubject).map((s) => {
      const percentage = s.total ? Math.round((s.attended / s.total) * 100) : 0;
      const classesNeeded =
        percentage < ATTENDANCE_THRESHOLD
          ? Math.max(0, Math.ceil((ATTENDANCE_THRESHOLD * s.total - s.attended * 100) / (100 - ATTENDANCE_THRESHOLD)))
          : 0;
      return { ...s, percentage, threshold: ATTENDANCE_THRESHOLD, classesNeeded };
    });

    const totalMarked = records.length;
    const presentCount = records.filter((r) => r.status === 'PRESENT').length;
    const lateCount = records.filter((r) => r.status === 'LATE').length;
    const absentCount = records.filter((r) => r.status === 'ABSENT').length;
    const overallPct = totalMarked ? Math.round((presentCount / totalMarked) * 100) : 0;

    const now = new Date();
    const absencesThisMonth = records.filter(
      (r) =>
        r.status === 'ABSENT' &&
        new Date(r.date).getMonth() === now.getMonth() &&
        new Date(r.date).getFullYear() === now.getFullYear()
    ).length;

    res.json({
      records: records.map((r) => ({
        date: toDateOnly(r.date),
        subject: r.subject.name,
        status: r.status.toLowerCase(),
      })),
      summary,
      overall: {
        percentage: overallPct,
        present: presentCount,
        late: lateCount,
        absent: absentCount,
        total: totalMarked,
        absencesThisMonth,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load attendance' });
  }
}

/**
 * GET /api/student/assignments
 */
export async function getAssignments(req, res) {
  try {
    const submissions = await prisma.submission.findMany({
      where: { studentId: req.user.id },
      include: { assignment: { include: { subject: true, faculty: true } } },
      orderBy: { assignment: { dueDate: 'asc' } },
    });

    res.json({
      assignments: submissions.map((s) => ({
        id: s.assignment.id,
        title: s.assignment.title,
        subject: s.assignment.subject.name,
        faculty: s.assignment.faculty.name,
        dueDate: toDateOnly(s.assignment.dueDate),
        totalMarks: s.assignment.totalMarks,
        description: s.assignment.description,
        status: titleCase(s.status),
        marks: s.marks ?? undefined,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load assignments' });
  }
}

/**
 * GET /api/student/performance
 * Returns raw records plus derived aggregates the frontend charts need:
 * per-subject averages, a month-by-month trend (performance score +
 * assignment completion score), and simple strengths/improvements lists.
 */
export async function getPerformance(req, res) {
  try {
    const [records, submissions, attendanceRecords] = await Promise.all([
      prisma.performanceRecord.findMany({
        where: { studentId: req.user.id },
        orderBy: { recordedAt: 'asc' },
      }),
      prisma.submission.findMany({
        where: { studentId: req.user.id },
        include: { assignment: true },
      }),
      prisma.attendance.findMany({ where: { studentId: req.user.id } }),
    ]);

    // Per-subject average score
    const bySubject = {};
    for (const r of records) {
      bySubject[r.subject] = bySubject[r.subject] || { subject: r.subject, total: 0, count: 0 };
      bySubject[r.subject].total += r.score;
      bySubject[r.subject].count += 1;
    }
    const subjectPerformance = Object.values(bySubject).map((s) => ({
      subject: s.subject,
      score: Math.round(s.total / s.count),
    }));

    // Monthly trend: avg performance score + avg assignment score (graded submissions) per month
    const perfByMonth = {};
    for (const r of records) {
      const key = monthKey(r.recordedAt);
      perfByMonth[key] = perfByMonth[key] || { total: 0, count: 0 };
      perfByMonth[key].total += r.score;
      perfByMonth[key].count += 1;
    }
    const gradedSubmissions = submissions.filter((s) => s.marks != null && s.submittedAt);
    const assignByMonth = {};
    for (const s of gradedSubmissions) {
      const key = monthKey(s.submittedAt);
      assignByMonth[key] = assignByMonth[key] || { total: 0, count: 0 };
      assignByMonth[key].total += Math.round((s.marks / s.assignment.totalMarks) * 100);
      assignByMonth[key].count += 1;
    }
    const allMonths = Array.from(new Set([...Object.keys(perfByMonth), ...Object.keys(assignByMonth)])).sort();
    const performanceTrend = allMonths.map((key) => ({
      month: monthLabel(key),
      score: perfByMonth[key] ? Math.round(perfByMonth[key].total / perfByMonth[key].count) : null,
      assignments: assignByMonth[key] ? Math.round(assignByMonth[key].total / assignByMonth[key].count) : null,
    }));

    const overallScore = records.length
      ? Math.round(records.reduce((sum, r) => sum + r.score, 0) / records.length)
      : null;

    const sorted = [...subjectPerformance].sort((a, b) => b.score - a.score);
    const strengths = sorted.slice(0, 3);
    const improvements = sorted.filter((s) => s.score < 80).slice(-3);

    // Supporting metrics for the hero card
    const totalMarked = attendanceRecords.length;
    const presentCount = attendanceRecords.filter((a) => a.status === 'PRESENT').length;
    const attendancePct = totalMarked ? Math.round((presentCount / totalMarked) * 100) : null;
    const gradedOrSubmitted = submissions.filter((s) => s.status === 'GRADED' || s.status === 'SUBMITTED').length;
    const assignmentCompletionPct = submissions.length
      ? Math.round((gradedOrSubmitted / submissions.length) * 100)
      : null;
    const testAvgPct = gradedSubmissions.length
      ? Math.round(
          gradedSubmissions.reduce((sum, s) => sum + (s.marks / s.assignment.totalMarks) * 100, 0) /
            gradedSubmissions.length
        )
      : null;

    res.json({
      records,
      subjectPerformance,
      performanceTrend,
      overallScore,
      strengths,
      improvements,
      metrics: {
        attendancePct,
        assignmentCompletionPct,
        testAvgPct,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load performance' });
  }
}

/**
 * GET /api/student/timetable
 * Built from the timetable slots of every faculty teaching this student's
 * course. Scoped by the student's course (not just section) because Smart
 * Generate builds one shared weekly timetable per course with no section on
 * each slot — a manually-added slot can still target one specific section
 * via its optional `section` field, in which case only that section sees it.
 */
export async function getTimetable(req, res) {
  try {
    const student = await prisma.student.findUnique({ where: { id: req.user.id } });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const slots = await prisma.timetableSlot.findMany({
      where: {
        faculty: { courseId: student.courseId, institutionId: student.institutionId },
        OR: [{ section: student.section }, { section: null }],
      },
      include: { faculty: true },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

    res.json({
      slots: slots.map((s) => ({
        dayOfWeek: s.dayOfWeek,
        day: DAY_NAMES[s.dayOfWeek],
        time: `${s.startTime} - ${s.endTime}`,
        subject: s.subjectName,
        faculty: s.faculty.name,
        room: s.room,
        type: s.type || 'Lecture',
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load timetable' });
  }
}

const RESOURCE_CATEGORY_LABEL = {
  SYLLABUS: 'Syllabus',
  NOTES: 'Notes',
  VIDEO: 'Videos',
  QUESTION_PAPER: 'Previous Year Papers',
  REFERENCE: 'Reference Materials',
};

function formatFileSize(bytes) {
  if (!bytes) return null;
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function fileFormatFromName(fileName) {
  const ext = (fileName || '').split('.').pop()?.toUpperCase();
  return ext || 'FILE';
}

/**
 * GET /api/student/resources
 * Approved resources uploaded for the student's department.
 */
export async function getResources(req, res) {
  try {
    const student = await prisma.student.findUnique({ where: { id: req.user.id } });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const resources = await prisma.resource.findMany({
      where: {
        institutionId: req.user.institutionId,
        departmentId: student.departmentId,
        status: 'APPROVED',
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      resources: resources.map((r) => ({
        id: r.id,
        title: r.title,
        subject: r.subject,
        uploadedBy: r.uploadedByLabel,
        date: toDateOnly(r.createdAt),
        size: formatFileSize(r.fileSizeBytes),
        type: r.type === 'VIDEO' ? 'Video' : fileFormatFromName(r.fileName),
        category: RESOURCE_CATEGORY_LABEL[r.type] || r.type,
        fileUrl: r.fileUrl,
        downloads: r.downloads,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load resources' });
  }
}

/**
 * POST /api/student/resources/:id/download
 * Increments the download counter (student-side equivalent of the admin
 * registerDownload endpoint, which is locked to requireRole('admin')).
 */
export async function registerResourceDownload(req, res) {
  const { id } = req.params;

  try {
    const resource = await prisma.resource.findFirst({
      where: { id, institutionId: req.user.institutionId, status: 'APPROVED' },
    });
    if (!resource) return res.status(404).json({ error: 'Resource not found' });

    const updated = await prisma.resource.update({
      where: { id },
      data: { downloads: { increment: 1 } },
    });

    res.json({ downloads: updated.downloads });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to register download' });
  }
}

/**
 * GET /api/student/notices
 */
export async function getNotices(req, res) {
  try {
    const student = await prisma.student.findUnique({ where: { id: req.user.id } });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const notices = await prisma.notice.findMany({
      where: {
        institutionId: req.user.institutionId,
        OR: [
          { audience: 'All' },
          { audience: 'All Students' },
          { audience: 'All Students & Faculty' },
        ],
      },
      include: { admin: true },
      orderBy: { publishDate: 'desc' },
    });

    res.json({
      notices: notices.map((n) => ({
        id: n.id,
        title: n.title,
        description: n.description,
        category: n.category,
        priority: titleCase(n.priority),
        author: n.admin?.name || 'Institution',
        publishDate: toDateOnly(n.publishDate),
        audience: n.audience,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load notices' });
  }
}

/**
 * GET /api/student/profile
 */
export async function getProfile(req, res) {
  try {
    const student = await prisma.student.findUnique({
      where: { id: req.user.id },
      include: { department: true, course: true },
    });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const { passwordHash, ...safeStudent } = student;
    res.json({ profile: safeStudent });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load profile' });
  }
}

/**
 * PUT /api/student/profile
 * body: any subset of { name, email, password }
 */
export async function updateProfile(req, res) {
  const { name, email, password } = req.body;
  const data = {};
  if (name) data.name = name;
  if (email) data.email = email;
  if (password) data.passwordHash = await bcrypt.hash(password, 10);

  try {
    const updated = await prisma.student.update({
      where: { id: req.user.id },
      data,
    });
    const { passwordHash, ...safeStudent } = updated;
    res.json({ profile: safeStudent });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'That email is already in use' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
}

const PERIODIC_TEST_TYPE_LABELS = {
  UNIT_TEST: 'Unit Test',
  CLASS_TEST: 'Class Test',
  MID_SEMESTER: 'Mid-Semester',
  QUIZ: 'Quiz',
};

function subjectCode(name) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function scoreGrade(pct) {
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B+';
  if (pct >= 60) return 'B';
  if (pct >= 50) return 'C';
  return 'D';
}

/**
 * GET /api/student/periodic-tests
 * Unit tests, class tests, mid-semesters and quizzes for the student's
 * section. A test is "Upcoming" until its date passes; past tests are
 * "Completed" unless the student has no result recorded (or was marked
 * missed), in which case they're surfaced as missed.
 *
 * NOTE: there's no faculty/admin-facing endpoint yet to create
 * PeriodicTest/PeriodicTestResult rows (same gap as Assignment/Submission
 * creation) — this only reads what's already in the database.
 */
export async function getPeriodicTests(req, res) {
  try {
    const student = await prisma.student.findUnique({ where: { id: req.user.id } });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const tests = await prisma.periodicTest.findMany({
      where: { section: student.section },
      include: { subject: true },
      orderBy: { date: 'desc' },
    });

    const testIds = tests.map((t) => t.id);
    const [myResults, allResults] = await Promise.all([
      prisma.periodicTestResult.findMany({ where: { testId: { in: testIds }, studentId: req.user.id } }),
      prisma.periodicTestResult.findMany({ where: { testId: { in: testIds } } }),
    ]);

    const myResultByTest = new Map(myResults.map((r) => [r.testId, r]));
    const averageByTest = {};
    for (const testId of testIds) {
      const scored = allResults.filter((r) => r.testId === testId && !r.missed && r.marksObtained != null);
      averageByTest[testId] = scored.length
        ? Math.round((scored.reduce((sum, r) => sum + r.marksObtained, 0) / scored.length) * 10) / 10
        : null;
    }

    const now = new Date();
    const payload = tests.map((t) => {
      const isUpcoming = t.date > now;
      const result = myResultByTest.get(t.id);
      const missed = !isUpcoming && (!result || result.missed || result.marksObtained == null);
      const pct = result && !missed ? Math.round((result.marksObtained / t.totalMarks) * 100) : null;

      return {
        id: t.id,
        title: t.title,
        subject: t.subject.name,
        code: subjectCode(t.subject.name),
        type: PERIODIC_TEST_TYPE_LABELS[t.type] || t.type,
        date: toDateOnly(t.date),
        status: isUpcoming ? 'Upcoming' : 'Completed',
        totalMarks: t.totalMarks,
        marksObtained: isUpcoming ? undefined : result?.marksObtained ?? 0,
        grade: isUpcoming || missed ? '-' : scoreGrade(pct),
        classAverage: isUpcoming ? undefined : averageByTest[t.id],
        missed: isUpcoming ? undefined : missed,
        syllabus: isUpcoming ? t.syllabus : undefined,
        venue: isUpcoming ? t.venue : undefined,
        time: isUpcoming ? t.time : undefined,
      };
    });

    res.json({ tests: payload });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load periodic tests' });
  }
}

/**
 * GET /api/student/feedback/faculty-options
 * Faculty this student can leave feedback for, derived from the timetable
 * (there's no student-facing faculty list endpoint, and the admin one is
 * locked to requireRole('admin')). Grouped by faculty with the distinct
 * subjects they teach this student's section.
 */
export async function getFacultyOptions(req, res) {
  try {
    const student = await prisma.student.findUnique({ where: { id: req.user.id } });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const slots = await prisma.timetableSlot.findMany({
      where: { section: student.section },
      include: { faculty: true },
    });

    const byFaculty = {};
    for (const s of slots) {
      byFaculty[s.facultyId] = byFaculty[s.facultyId] || { id: s.facultyId, name: s.faculty.name, subjects: new Set() };
      byFaculty[s.facultyId].subjects.add(s.subjectName);
    }

    res.json({
      faculty: Object.values(byFaculty).map((f) => ({
        id: f.id,
        name: f.name,
        subjects: Array.from(f.subjects),
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load faculty options' });
  }
}

/**
 * GET /api/student/feedback
 * This student's own past submissions, newest first. studentId stays set
 * even for anonymous feedback (so the student can still see their own
 * history) — the `anonymous` flag is what admin-facing views use to hide
 * the student's identity, not a null studentId.
 */
export async function getMyFeedback(req, res) {
  try {
    const feedback = await prisma.feedback.findMany({
      where: { studentId: req.user.id },
      include: { faculty: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      feedback: feedback.map((f) => ({
        id: f.id,
        target: f.faculty?.name || f.subject,
        subject: f.subject,
        date: toDateOnly(f.createdAt),
        anonymous: f.anonymous,
        rating: f.rating,
        message: f.message,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load feedback history' });
  }
}

/**
 * POST /api/student/feedback
 * body: { facultyId?, subject, message, rating, anonymous }
 */
export async function submitFeedback(req, res) {
  const { facultyId, subject, message, rating, anonymous } = req.body;
  if (!subject || !message) {
    return res.status(400).json({ error: 'subject and message are required' });
  }

  try {
    if (facultyId) {
      const faculty = await prisma.faculty.findFirst({
        where: { id: facultyId, institutionId: req.user.institutionId },
      });
      if (!faculty) return res.status(404).json({ error: 'Faculty not found' });
    }

    const feedback = await prisma.feedback.create({
      data: {
        studentId: req.user.id,
        facultyId: facultyId || undefined,
        subject,
        message,
        rating,
        anonymous: Boolean(anonymous),
      },
    });
    res.status(201).json({ feedback });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
}
const SALT_ROUNDS = 10;

const SETTINGS_DEFAULTS = {
  notifyEmail: true,
  notifyPush: true,
  notifyAssignments: true,
  notifyAttendance: true,
  notifyNotices: false,
  theme: 'light',
  language: 'en',
  twoFactorEnabled: false,
};

const SETTINGS_WRITABLE_KEYS = Object.keys(SETTINGS_DEFAULTS);

/** Fetches (or lazily creates) the one settings row for a student. */
async function getOrCreateStudentSettings(studentId) {
  const existing = await prisma.studentSettings.findUnique({ where: { studentId } });
  if (existing) return existing;
  return prisma.studentSettings.create({ data: { studentId, ...SETTINGS_DEFAULTS } });
}

/**
 * GET /api/student/settings
 */
export async function getSettings(req, res) {
  try {
    const settings = await getOrCreateStudentSettings(req.user.id);
    res.json({ settings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
}

/**
 * PATCH /api/student/settings
 * body: any subset of { notifyEmail, notifyPush, notifyAssignments,
 *   notifyAttendance, notifyNotices, theme, language, twoFactorEnabled }
 */
export async function updateSettings(req, res) {
  const studentId = req.user.id;

  const data = {};
  for (const key of SETTINGS_WRITABLE_KEYS) {
    if (req.body[key] !== undefined) data[key] = req.body[key];
  }
  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: 'No recognized settings fields in request body' });
  }

  try {
    await getOrCreateStudentSettings(studentId); // ensures a row exists to update
    const settings = await prisma.studentSettings.update({ where: { studentId }, data });
    res.json({ settings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
}

/**
 * POST /api/student/settings/change-password
 * body: { currentPassword, newPassword }
 */
export async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  const studentId = req.user.id;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword and newPassword are required' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'newPassword must be at least 8 characters' });
  }

  try {
    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student || !(await bcrypt.compare(currentPassword, student.passwordHash))) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await prisma.student.update({ where: { id: studentId }, data: { passwordHash } });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to change password' });
  }
}

/**
 * POST /api/student/settings/sign-out-all-devices
 * Bumps sessionsInvalidatedAt so every JWT issued before now is rejected by
 * requireAuth on the next request (see auth.middleware.js) — including the
 * one making this call, so the frontend should treat the response as a
 * forced logout.
 */
export async function signOutAllDevices(req, res) {
  try {
    await prisma.student.update({
      where: { id: req.user.id },
      data: { sessionsInvalidatedAt: new Date() },
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to sign out other devices' });
  }
}

/**
 * POST /api/student/settings/request-deactivation
 * There's no deactivation-request/ticket model, and a student can't flip
 * their own `status` (only admin's student-update endpoint can). This writes
 * an audit log entry so the request is at least visible to the institution's
 * admin in their Security/Audit log — it does not change student.status or
 * notify anyone directly. Worth a proper request queue if this needs to be
 * more than "on the record".
 */
export async function requestDeactivation(req, res) {
  try {
    await logAction(req, { action: 'Requested account deactivation', module: 'Settings' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to submit deactivation request' });
  }
}