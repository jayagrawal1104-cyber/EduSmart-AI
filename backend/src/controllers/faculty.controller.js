import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/db.js';
import { logAction } from '../utils/audit.js';
import { toPublicUrl } from '../utils/fileStorage.js';

// req.user is set by requireAuth: { id, role: 'faculty', institutionId, email, name }

function toDateOnly(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function titleCase(str) {
  if (!str) return str;
  return str.charAt(0) + str.slice(1).toLowerCase();
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function avg(nums) {
  if (!nums.length) return null;
  return Math.round((nums.reduce((s, n) => s + n, 0) / nums.length) * 10) / 10;
}

/**
 * Given this subject+section's timetable slots, finds the soonest upcoming
 * one (today if its start time hasn't passed yet, otherwise wrapping to next
 * week) and returns a small display-ready summary, or null if unscheduled.
 */
function nextUpcomingSlot(slots) {
  if (!slots.length) return null;
  const now = new Date();
  const nowDay = now.getDay();
  const nowTime = now.toTimeString().slice(0, 5);

  let best = null;
  let bestOffset = Infinity;
  for (const slot of slots) {
    let dayOffset = (slot.dayOfWeek - nowDay + 7) % 7;
    if (dayOffset === 0 && slot.startTime <= nowTime) dayOffset = 7;
    if (dayOffset < bestOffset || (dayOffset === bestOffset && slot.startTime < best.startTime)) {
      bestOffset = dayOffset;
      best = slot;
    }
  }
  if (!best) return null;
  return { day: DAY_LABELS[best.dayOfWeek], time: `${best.startTime} – ${best.endTime}`, room: best.room || null };
}

/**
 * GET /api/faculty/dashboard
 * Summary numbers for the faculty landing page: subjects taught, distinct
 * students across those subjects, submissions awaiting grading, and average
 * attendance across everything this faculty has marked.
 */
export async function getDashboard(req, res) {
  const facultyId = req.user.id;

  try {
    const [subjects, assignments, attendanceRecords] = await Promise.all([
      prisma.subject.findMany({ where: { facultyId } }),
      prisma.assignment.findMany({ where: { facultyId }, include: { submissions: true } }),
      prisma.attendance.findMany({ where: { markedById: facultyId } }),
    ]);

    const subjectIds = subjects.map((s) => s.id);
    const attendanceByStudent = new Set(attendanceRecords.map((a) => a.studentId));
    const submissionStudents = new Set(assignments.flatMap((a) => a.submissions.map((s) => s.studentId)));
    const totalStudents = new Set([...attendanceByStudent, ...submissionStudents]).size;

    const pendingGrading = assignments.reduce(
      (sum, a) => sum + a.submissions.filter((s) => s.status === 'SUBMITTED').length,
      0
    );

    const totalMarked = attendanceRecords.length;
    const present = attendanceRecords.filter((a) => a.status === 'PRESENT').length;
    const avgAttendance = totalMarked ? Math.round((present / totalMarked) * 100) : null;

    res.json({
      stats: {
        subjectsTaught: subjects.length,
        totalStudents,
        pendingGrading,
        avgAttendance,
      },
      subjects: subjects.map((s) => ({ id: s.id, name: s.name })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
}

/**
 * GET /api/faculty/classes
 * The subjects this faculty teaches. "Total students" per class is everyone
 * who joined the same department + course as this faculty on the join
 * form — the class they actually enrolled into — not a raw section-letter
 * match. Classes are still cross-referenced against timetable slots to
 * surface which sections they actually meet (for the schedule/attendance
 * breakdown); a subject with no matching timetable slot still comes back
 * (section: null) so it's not silently hidden.
 */
export async function getMyClasses(req, res) {
  const facultyId = req.user.id;

  try {
    const [subjects, slots, faculty] = await Promise.all([
      prisma.subject.findMany({ where: { facultyId } }),
      prisma.timetableSlot.findMany({ where: { facultyId } }),
      prisma.faculty.findUnique({ where: { id: facultyId }, include: { department: true } }),
    ]);

    // "Total students" for every class this faculty teaches is everyone who
    // joined the same department + course as this faculty — i.e. the class
    // they actually enrolled into on the join form, not just whoever happens
    // to share a section letter institution-wide. Same for every subject:
    // a faculty member's students are the same roster across all the
    // subjects they teach in that course, so this is computed once.
    const studentWhere = { institutionId: req.user.institutionId, departmentId: faculty.departmentId };
    if (faculty.courseId) studentWhere.courseId = faculty.courseId;
    const studentCount = await prisma.student.count({ where: studentWhere });

    // Real sections this faculty actually has students in, independent of
    // whether a timetable has been set up — Attendance still needs to work
    // for a subject with no timetable slot yet.
    const enrolledSections = await prisma.student.findMany({
      where: studentWhere,
      select: { section: true },
      distinct: ['section'],
    });
    const enrolledSectionNames = enrolledSections.map((s) => s.section).filter(Boolean);

    const sectionsByName = {};
    for (const slot of slots) {
      if (!slot.section) continue;
      sectionsByName[slot.subjectName] = sectionsByName[slot.subjectName] || new Set();
      sectionsByName[slot.subjectName].add(slot.section);
    }

    // One "class" per subject+section this faculty teaches. Prefer the
    // sections their timetable actually meets (so Period can be shown);
    // fall back to every section they have real enrolled students in when
    // no timetable slot exists yet for that subject, so the subject still
    // shows up in Attendance instead of being silently hidden.
    const pairs = [];
    for (const subject of subjects) {
      const sections = sectionsByName[subject.name];
      if (sections && sections.size) {
        for (const section of sections) pairs.push({ subject, section });
      } else if (enrolledSectionNames.length) {
        for (const section of enrolledSectionNames) pairs.push({ subject, section });
      } else {
        pairs.push({ subject, section: null });
      }
    }

    const classes = await Promise.all(
      pairs.map(async ({ subject, section }) => {
        const [attendanceRecords, assignments] = await Promise.all([
          prisma.attendance.findMany({
            where: { subjectId: subject.id, ...(section ? { student: { section } } : {}) },
          }),
          prisma.assignment.findMany({
            where: { subjectId: subject.id },
            include: { submissions: { include: { student: true } } },
          }),
        ]);

        const totalMarked = attendanceRecords.length;
        const present = attendanceRecords.filter((a) => a.status === 'PRESENT').length;
        const attendancePct = totalMarked ? Math.round((present / totalMarked) * 100) : null;

        const relevantSubmissions = assignments.flatMap((a) =>
          a.submissions.filter((s) => !section || s.student.section === section)
        );
        const completed = relevantSubmissions.filter((s) => s.status !== 'PENDING').length;
        const assignmentCompletionPct = relevantSubmissions.length
          ? Math.round((completed / relevantSubmissions.length) * 100)
          : null;

        // A slot with no section tagged (e.g. from Smart Generate, which
        // builds one shared timetable per course) applies to every section
        // of this class — only a slot explicitly tagged to a *different*
        // section should be excluded here.
        const relevantSlots = slots.filter(
          (s) => s.subjectName === subject.name && (!section || !s.section || s.section === section)
        );

        return {
          subjectId: subject.id,
          subject: subject.name,
          section,
          department: faculty?.department?.name ?? null,
          // Real weekly timetable slots for this exact subject+section, so
          // the frontend can show "which period is this on a given date"
          // without us inventing a period number that doesn't exist in the
          // data model.
          slots: relevantSlots.map((s) => ({
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
            room: s.room || null,
          })),
          students: studentCount,
          attendancePct,
          assignmentCompletionPct,
          nextClass: nextUpcomingSlot(relevantSlots),
        };
      })
    );

    res.json({ classes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load classes' });
  }
}

/**
 * GET /api/faculty/attendance/roster?subjectId=&section=&date=YYYY-MM-DD
 * Students in a section plus their attendance status for that subject/date,
 * if already marked — lets the mark-attendance UI pre-fill and show who's
 * still pending.
 */
export async function getAttendanceRoster(req, res) {
  const { subjectId, section, date } = req.query;
  if (!subjectId || !section || !date) {
    return res.status(400).json({ error: 'subjectId, section and date are required' });
  }

  try {
    const subject = await prisma.subject.findFirst({ where: { id: subjectId, facultyId: req.user.id } });
    if (!subject) return res.status(404).json({ error: 'Subject not found for this faculty' });

    const [students, existing] = await Promise.all([
      prisma.student.findMany({
        where: { institutionId: req.user.institutionId, section },
        orderBy: { name: 'asc' },
      }),
      prisma.attendance.findMany({
        where: { subjectId, date: new Date(date) },
      }),
    ]);

    const statusByStudent = new Map(existing.map((a) => [a.studentId, a.status]));

    res.json({
      students: students.map((s) => ({
        id: s.id,
        name: s.name,
        rollId: s.rollId,
        status: statusByStudent.get(s.id) || null,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load roster' });
  }
}

/**
 * POST /api/faculty/attendance
 * body: { subjectId, date, section, records: [{ studentId, status }] }
 * status is one of PRESENT | ABSENT | LATE. Upserts so re-marking the same
 * subject/date overwrites rather than duplicating (matches the
 * @@unique([studentId, subjectId, date]) constraint on Attendance).
 */
export async function markAttendance(req, res) {
  const { subjectId, date, records } = req.body;
  if (!subjectId || !date || !Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: 'subjectId, date and a non-empty records array are required' });
  }

  try {
    const subject = await prisma.subject.findFirst({ where: { id: subjectId, facultyId: req.user.id } });
    if (!subject) return res.status(404).json({ error: 'Subject not found for this faculty' });

    const parsedDate = new Date(date);
    await prisma.$transaction(
      records.map((r) =>
        prisma.attendance.upsert({
          where: { studentId_subjectId_date: { studentId: r.studentId, subjectId, date: parsedDate } },
          update: { status: r.status, markedById: req.user.id },
          create: {
            studentId: r.studentId,
            subjectId,
            date: parsedDate,
            status: r.status,
            markedById: req.user.id,
          },
        })
      )
    );

    res.json({ success: true, count: records.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to mark attendance' });
  }
}

/**
 * GET /api/faculty/assignments
 * This faculty's assignments with submission-progress counts.
 */
export async function listAssignments(req, res) {
  try {
    const assignments = await prisma.assignment.findMany({
      where: { facultyId: req.user.id },
      include: { subject: true, submissions: true },
      orderBy: { dueDate: 'desc' },
    });

    res.json({
      assignments: assignments.map((a) => ({
        id: a.id,
        title: a.title,
        subject: a.subject.name,
        description: a.description,
        totalMarks: a.totalMarks,
        dueDate: toDateOnly(a.dueDate),
        submittedCount: a.submissions.filter((s) => s.status !== 'PENDING').length,
        gradedCount: a.submissions.filter((s) => s.status === 'GRADED').length,
        totalStudents: a.submissions.length,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load assignments' });
  }
}

/**
 * POST /api/faculty/assignments
 * body: { subjectId, title, description, totalMarks, dueDate, section }
 * Creates the assignment and a PENDING Submission row for every student in
 * `section` (mirroring how a real gradebook works) — without this, students
 * in that section would never see the assignment on their own /assignments
 * endpoint, which only reads existing Submission rows.
 */
export async function createAssignment(req, res) {
  const { subjectId, title, description, totalMarks, dueDate, section } = req.body;
  if (!subjectId || !title || !totalMarks || !dueDate || !section) {
    return res.status(400).json({ error: 'subjectId, title, totalMarks, dueDate and section are required' });
  }

  try {
    const subject = await prisma.subject.findFirst({ where: { id: subjectId, facultyId: req.user.id } });
    if (!subject) return res.status(404).json({ error: 'Subject not found for this faculty' });

    const students = await prisma.student.findMany({
      where: { institutionId: req.user.institutionId, section },
    });

    const assignment = await prisma.assignment.create({
      data: {
        facultyId: req.user.id,
        subjectId,
        title,
        description,
        totalMarks: Number(totalMarks),
        dueDate: new Date(dueDate),
        submissions: {
          create: students.map((s) => ({ studentId: s.id, status: 'PENDING' })),
        },
      },
      include: { submissions: true },
    });

    res.status(201).json({ assignment, studentsEnrolled: students.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create assignment' });
  }
}

/**
 * GET /api/faculty/assignments/:id/submissions
 */
export async function listSubmissions(req, res) {
  try {
    const assignment = await prisma.assignment.findFirst({
      where: { id: req.params.id, facultyId: req.user.id },
      include: { submissions: { include: { student: true } } },
    });
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });

    res.json({
      submissions: assignment.submissions.map((s) => ({
        id: s.id,
        studentId: s.studentId,
        studentName: s.student.name,
        status: s.status,
        marks: s.marks,
        submittedAt: s.submittedAt ? toDateOnly(s.submittedAt) : null,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load submissions' });
  }
}

/**
 * PATCH /api/faculty/submissions/:id
 * body: { marks }
 * Grades a single submission. Only allowed on submissions belonging to an
 * assignment this faculty owns.
 */
export async function gradeSubmission(req, res) {
  const { marks } = req.body;
  if (marks == null) return res.status(400).json({ error: 'marks is required' });

  try {
    const submission = await prisma.submission.findFirst({
      where: { id: req.params.id },
      include: { assignment: true },
    });
    if (!submission || submission.assignment.facultyId !== req.user.id) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    const updated = await prisma.submission.update({
      where: { id: req.params.id },
      data: { marks: Number(marks), status: 'GRADED' },
    });

    res.json({ submission: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to grade submission' });
  }
}

/**
 * GET /api/faculty/periodic-tests
 */
export async function listPeriodicTests(req, res) {
  try {
    const tests = await prisma.periodicTest.findMany({
      where: { facultyId: req.user.id },
      include: { subject: true, results: true },
      orderBy: { date: 'desc' },
    });

    res.json({
      tests: tests.map((t) => ({
        id: t.id,
        title: t.title,
        subject: t.subject.name,
        type: t.type,
        section: t.section,
        totalMarks: t.totalMarks,
        date: toDateOnly(t.date),
        recordedCount: t.results.filter((r) => r.marksObtained != null || r.missed).length,
        totalStudents: t.results.length,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load periodic tests' });
  }
}

/**
 * POST /api/faculty/periodic-tests
 * body: { subjectId, title, type, totalMarks, date, time, venue, syllabus, section }
 * type is one of UNIT_TEST | CLASS_TEST | MID_SEMESTER | QUIZ.
 * Creates a placeholder PeriodicTestResult (no marks yet) for every student
 * in `section`, same reasoning as createAssignment above.
 */
export async function createPeriodicTest(req, res) {
  const { subjectId, title, type, totalMarks, date, time, venue, syllabus, section } = req.body;
  if (!subjectId || !title || !type || !totalMarks || !date || !section) {
    return res.status(400).json({ error: 'subjectId, title, type, totalMarks, date and section are required' });
  }

  try {
    const subject = await prisma.subject.findFirst({ where: { id: subjectId, facultyId: req.user.id } });
    if (!subject) return res.status(404).json({ error: 'Subject not found for this faculty' });

    const students = await prisma.student.findMany({
      where: { institutionId: req.user.institutionId, section },
    });

    const test = await prisma.periodicTest.create({
      data: {
        facultyId: req.user.id,
        subjectId,
        title,
        type,
        totalMarks: Number(totalMarks),
        date: new Date(date),
        time,
        venue,
        syllabus,
        section,
        results: {
          create: students.map((s) => ({ studentId: s.id })),
        },
      },
      include: { results: true },
    });

    res.status(201).json({ test, studentsEnrolled: students.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create periodic test' });
  }
}

/**
 * PATCH /api/faculty/periodic-tests/:id/results
 * body: { results: [{ studentId, marksObtained, missed }] }
 * Bulk-records marks for a test this faculty owns.
 */
export async function recordPeriodicTestResults(req, res) {
  const { results } = req.body;
  if (!Array.isArray(results) || results.length === 0) {
    return res.status(400).json({ error: 'A non-empty results array is required' });
  }

  try {
    const test = await prisma.periodicTest.findFirst({ where: { id: req.params.id, facultyId: req.user.id } });
    if (!test) return res.status(404).json({ error: 'Periodic test not found' });

    await prisma.$transaction(
      results.map((r) =>
        prisma.periodicTestResult.update({
          where: { testId_studentId: { testId: req.params.id, studentId: r.studentId } },
          data: {
            marksObtained: r.missed ? null : Number(r.marksObtained),
            missed: Boolean(r.missed),
          },
        })
      )
    );

    res.json({ success: true, count: results.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to record results' });
  }
}

/**
 * GET /api/faculty/timetable
 */
export async function getTimetable(req, res) {
  try {
    const slots = await prisma.timetableSlot.findMany({
      where: { facultyId: req.user.id },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

    res.json({
      slots: slots.map((s) => ({
        id: s.id,
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        subject: s.subjectName,
        room: s.room,
        section: s.section,
        type: s.type || 'Lecture',
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load timetable' });
  }
}

/**
 * GET /api/faculty/performance?subjectId=&section=
 * Per-student performance for a subject this faculty teaches: attendance %,
 * average assignment score %, average periodic-test score %, a simple risk
 * flag, and a trend derived from the order of graded assignment
 * submissions. Built entirely from Attendance/Submission/PeriodicTestResult
 * rows — no separate "performance" table is used, so a student with no
 * graded work yet just shows nulls rather than a fake score.
 *
 * The roster is everyone who joined this faculty's department + course (the
 * same course-based scoping getMyClasses uses) — no timetable slot/section
 * is required for this to work. `section` is optional and, when the class
 * meets one specific section per the timetable, narrows the roster further
 * to just that section.
 */
export async function getStudentPerformance(req, res) {
  const { subjectId, section } = req.query;
  if (!subjectId) {
    return res.status(400).json({ error: 'subjectId is required' });
  }

  try {
    const [subject, faculty] = await Promise.all([
      prisma.subject.findFirst({ where: { id: subjectId, facultyId: req.user.id } }),
      prisma.faculty.findUnique({ where: { id: req.user.id } }),
    ]);
    if (!subject) return res.status(404).json({ error: 'Subject not found for this faculty' });

    const studentWhere = { institutionId: req.user.institutionId, departmentId: faculty.departmentId };
    if (faculty.courseId) studentWhere.courseId = faculty.courseId;
    if (section) studentWhere.section = section;

    const students = await prisma.student.findMany({ where: studentWhere, orderBy: { name: 'asc' } });
    const studentIds = students.map((s) => s.id);

    const [attendanceRecords, submissions, testResults] = await Promise.all([
      prisma.attendance.findMany({ where: { subjectId, studentId: { in: studentIds } } }),
      prisma.submission.findMany({
        where: { assignment: { subjectId }, studentId: { in: studentIds } },
        include: { assignment: true },
        orderBy: { submittedAt: 'asc' },
      }),
      prisma.periodicTestResult.findMany({
        where: { test: { subjectId }, studentId: { in: studentIds } },
        include: { test: true },
      }),
    ]);

    const rows = students.map((student) => {
      const myAttendance = attendanceRecords.filter((a) => a.studentId === student.id);
      const totalMarked = myAttendance.length;
      const present = myAttendance.filter((a) => a.status === 'PRESENT').length;
      const attendancePct = totalMarked ? Math.round((present / totalMarked) * 100) : null;

      const mySubmissions = submissions.filter((s) => s.studentId === student.id);
      const gradedSubmissions = mySubmissions.filter((s) => s.marks != null);
      const assignmentPct = gradedSubmissions.length
        ? Math.round(
            gradedSubmissions.reduce((sum, s) => sum + (s.marks / s.assignment.totalMarks) * 100, 0) /
              gradedSubmissions.length
          )
        : null;

      const myResults = testResults.filter((r) => r.studentId === student.id && r.marksObtained != null);
      const testPct = myResults.length
        ? Math.round(
            myResults.reduce((sum, r) => sum + (r.marksObtained / r.test.totalMarks) * 100, 0) / myResults.length
          )
        : null;

      const componentScores = [assignmentPct, testPct].filter((v) => v != null);
      const overallPct = componentScores.length
        ? Math.round(componentScores.reduce((a, b) => a + b, 0) / componentScores.length)
        : null;

      // Trend: last graded assignment score vs the average of the earlier
      // ones (submissions are pre-sorted by submittedAt). Needs at least 2
      // graded submissions to say anything meaningful.
      let trend = 'neutral';
      if (gradedSubmissions.length >= 2) {
        const scores = gradedSubmissions.map((s) => (s.marks / s.assignment.totalMarks) * 100);
        const latest = scores[scores.length - 1];
        const priorAvg = scores.slice(0, -1).reduce((a, b) => a + b, 0) / (scores.length - 1);
        if (latest - priorAvg > 3) trend = 'up';
        else if (priorAvg - latest > 3) trend = 'down';
      }

      let risk = 'Low';
      if ((attendancePct != null && attendancePct < 60) || (overallPct != null && overallPct < 40)) {
        risk = 'High';
      } else if ((attendancePct != null && attendancePct < 75) || (overallPct != null && overallPct < 60)) {
        risk = 'Medium';
      }

      return {
        id: student.id,
        name: student.name,
        rollId: student.rollId,
        attendancePct,
        assignmentPct,
        testPct,
        overallPct,
        risk,
        trend,
      };
    });

    const withScore = rows.filter((r) => r.overallPct != null);
    const summary = {
      classAverage: withScore.length
        ? Math.round(withScore.reduce((sum, r) => sum + r.overallPct, 0) / withScore.length)
        : null,
      highest: withScore.length ? Math.max(...withScore.map((r) => r.overallPct)) : null,
      lowest: withScore.length ? Math.min(...withScore.map((r) => r.overallPct)) : null,
      passRate: withScore.length
        ? Math.round((withScore.filter((r) => r.overallPct >= 50).length / withScore.length) * 100)
        : null,
    };

    res.json({ subject: subject.name, section, students: rows, summary });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load student performance' });
  }
}

/**
 * GET /api/faculty/notices
 * Institution notices addressed to faculty (audience "All Faculty" or "All").
 * Faculty can't author their own notices yet — the Notice model only has an
 * optional adminId, not a facultyId, so that would need a schema change
 * first (mirroring how adminId works today).
 */
export async function getNotices(req, res) {
  try {
    const notices = await prisma.notice.findMany({
      where: {
        institutionId: req.user.institutionId,
        audience: { in: ['All Faculty', 'All'] },
      },
      include: { admin: { select: { id: true, name: true } } },
      orderBy: { publishDate: 'desc' },
    });

    res.json({
      notices: notices.map((n) => ({
        id: n.id,
        title: n.title,
        description: n.description,
        category: n.category,
        priority: titleCase(n.priority),
        audience: n.audience,
        author: n.admin?.name || 'Institution',
        publishDate: toDateOnly(n.publishDate),
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load notices' });
  }
}

const ACTIVITY_ICONS = {
  attendance: 'CheckSquare',
  assignment: 'ClipboardList',
  resource: 'Upload',
  periodicTest: 'ClipboardList',
};

/**
 * GET /api/faculty/profile
 * Everything the FacultyProfile page renders: identity/bio fields, teaching
 * summary stats, a merged recent-activity feed, and certifications.
 */
export async function getProfile(req, res) {
  const facultyId = req.user.id;

  try {
    const faculty = await prisma.faculty.findUnique({
      where: { id: facultyId },
      include: { department: true, certifications: { orderBy: { year: 'desc' } } },
    });
    if (!faculty) return res.status(404).json({ error: 'Faculty not found' });

    const [subjects, slots, attendanceRecords, assignments, resources, periodicTests] = await Promise.all([
      prisma.subject.findMany({ where: { facultyId } }),
      prisma.timetableSlot.findMany({ where: { facultyId } }),
      prisma.attendance.findMany({ where: { markedById: facultyId }, orderBy: { markedAt: 'desc' }, take: 5 }),
      prisma.assignment.findMany({
        where: { facultyId },
        include: { subject: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.resource.findMany({
        where: { uploadedByFacultyId: facultyId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.periodicTest.findMany({
        where: { facultyId },
        include: { subject: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    // Distinct subject+section pairs this faculty actually meets, same
    // definition getMyClasses uses, to keep the "Classes" stat consistent.
    const sectionsByName = {};
    for (const slot of slots) {
      if (!slot.section) continue;
      sectionsByName[slot.subjectName] = sectionsByName[slot.subjectName] || new Set();
      sectionsByName[slot.subjectName].add(slot.section);
    }
    let classCount = 0;
    const allSections = new Set();
    for (const subject of subjects) {
      const sections = sectionsByName[subject.name];
      if (sections && sections.size) {
        classCount += sections.size;
        for (const s of sections) allSections.add(s);
      } else {
        classCount += 1;
      }
    }
    const studentCount = allSections.size
      ? await prisma.student.count({
          where: { institutionId: req.user.institutionId, section: { in: [...allSections] } },
        })
      : 0;

    const weeklyMinutes = slots.reduce((sum, s) => {
      const [sh, sm] = s.startTime.split(':').map(Number);
      const [eh, em] = s.endTime.split(':').map(Number);
      return sum + Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
    }, 0);

    const activity = [
      ...attendanceRecords.map((a) => ({
        type: 'attendance',
        text: `Marked attendance — ${toDateOnly(a.date)}`,
        at: a.markedAt,
      })),
      ...assignments.map((a) => ({
        type: 'assignment',
        text: `Created assignment: ${a.title} (${a.subject.name})`,
        at: a.createdAt,
      })),
      ...resources.map((r) => ({
        type: 'resource',
        text: `Uploaded resource: ${r.title}`,
        at: r.createdAt,
      })),
      ...periodicTests.map((t) => ({
        type: 'periodicTest',
        text: `Created ${titleCase(t.type).replace('_', ' ')}: ${t.title} (${t.subject.name})`,
        at: t.createdAt,
      })),
    ]
      .sort((a, b) => new Date(b.at) - new Date(a.at))
      .slice(0, 5)
      .map((a) => ({ icon: ACTIVITY_ICONS[a.type], text: a.text, time: a.at }));

    const { passwordHash, ...safeFaculty } = faculty;

    res.json({
      profile: {
        ...safeFaculty,
        department: faculty.department?.name ?? null,
      },
      stats: {
        classes: classCount,
        students: studentCount,
        subjects: subjects.length,
        teachingHoursPerWeek: Math.round((weeklyMinutes / 60) * 10) / 10,
      },
      activity,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load profile' });
  }
}

/**
 * PUT /api/faculty/profile
 * body: any subset of { name, email, phone, qualifications, specialization, officeHours, officeRoom }
 */
export async function updateProfile(req, res) {
  const { name, email, phone, qualifications, specialization, officeHours, officeRoom } = req.body;
  const data = {};
  if (name) data.name = name;
  if (email) data.email = email;
  if (phone !== undefined) data.phone = phone;
  if (qualifications !== undefined) data.qualifications = qualifications;
  if (specialization !== undefined) data.specialization = specialization;
  if (officeHours !== undefined) data.officeHours = officeHours;
  if (officeRoom !== undefined) data.officeRoom = officeRoom;

  try {
    const updated = await prisma.faculty.update({
      where: { id: req.user.id },
      data,
      include: { department: true },
    });
    const { passwordHash, ...safeFaculty } = updated;
    res.json({ profile: { ...safeFaculty, department: updated.department?.name ?? null } });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'That email is already in use' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
}

/**
 * GET /api/faculty/feedback
 * Aggregated student feedback for this faculty. Always treats every entry
 * as anonymous on this side — the privacy notice on the page promises
 * responses are "never attributed to any specific person", so student
 * identity is never included here even for feedback the student submitted
 * non-anonymously (that flag only governs what admin-facing views show).
 *
 * The mock this replaced also had an "AI Summary" plus per-dimension
 * ratings (Clarity/Knowledge/Engagement/Responsiveness) — the schema only
 * stores one overall `rating` per submission, and generating a real summary
 * needs an actual LLM call. Both are left out here rather than faked; happy
 * to scope either as a follow-up.
 */
export async function getFeedback(req, res) {
  const facultyId = req.user.id;

  try {
    const entries = await prisma.feedback.findMany({
      where: { facultyId },
      orderBy: { createdAt: 'desc' },
    });

    const rated = entries.filter((f) => f.rating != null);
    const now = new Date();
    const thisMonthRated = rated.filter((f) => {
      const d = new Date(f.createdAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });

    const starDist = [5, 4, 3, 2, 1].map((stars) => ({
      stars,
      pct: rated.length ? Math.round((rated.filter((f) => f.rating === stars).length / rated.length) * 100) : 0,
    }));

    // Last 6 calendar months including the current one, oldest first.
    const trend = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthRated = rated.filter((f) => {
        const fd = new Date(f.createdAt);
        return fd.getMonth() === d.getMonth() && fd.getFullYear() === d.getFullYear();
      });
      trend.push({ month: MONTH_LABELS[d.getMonth()], rating: avg(monthRated.map((f) => f.rating)) });
    }

    const bySubject = {};
    for (const f of entries) {
      bySubject[f.subject] = bySubject[f.subject] || [];
      bySubject[f.subject].push(f);
    }
    const subjects = Object.entries(bySubject)
      .map(([name, list]) => ({
        name,
        avgRating: avg(list.filter((f) => f.rating != null).map((f) => f.rating)),
        count: list.length,
        feedback: list.map((f) => ({
          id: f.id,
          rating: f.rating,
          message: f.message,
          date: toDateOnly(f.createdAt),
        })),
      }))
      .sort((a, b) => b.count - a.count);

    res.json({
      stats: {
        overallRating: avg(rated.map((f) => f.rating)),
        totalReviews: entries.length,
        thisMonthAvg: avg(thisMonthRated.map((f) => f.rating)),
        mostReviewedSubject: subjects[0]?.name ?? null,
      },
      starDist,
      trend,
      subjects,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load feedback' });
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

function serializeResource(r) {
  return {
    id: r.id,
    title: r.title,
    subject: r.subject,
    description: r.description,
    category: RESOURCE_CATEGORY_LABEL[r.type] || r.type,
    format: r.type === 'VIDEO' ? 'Video' : fileFormatFromName(r.fileName),
    size: formatFileSize(r.fileSizeBytes),
    uploadDate: toDateOnly(r.createdAt),
    downloads: r.downloads,
    status: r.status,
    fileUrl: r.fileUrl,
  };
}

/**
 * GET /api/faculty/resources
 * This faculty's own uploads, every status — unlike the student view (which
 * only sees APPROVED), faculty need to see their PENDING/REJECTED ones too.
 */
export async function getResources(req, res) {
  try {
    const [resources, subjects] = await Promise.all([
      prisma.resource.findMany({ where: { uploadedByFacultyId: req.user.id }, orderBy: { createdAt: 'desc' } }),
      prisma.subject.findMany({ where: { facultyId: req.user.id } }),
    ]);
    res.json({
      resources: resources.map(serializeResource),
      subjects: subjects.map((s) => s.name),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load resources' });
  }
}

/**
 * POST /api/faculty/resources  (multipart/form-data, field name "file")
 * body fields: title, subject, type, description?
 * Unlike admin uploads (auto-approved), faculty uploads start PENDING and
 * need an admin to approve them via the existing admin Resources page.
 * departmentId is taken from the faculty's own record, not client-supplied.
 */
export async function uploadResource(req, res) {
  const { title, subject, type, description } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: 'A file is required (field name "file")' });
  }
  if (!title || !subject || !type) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: 'title, subject and type are required' });
  }

  try {
    const faculty = await prisma.faculty.findUnique({ where: { id: req.user.id } });
    if (!faculty) {
      fs.unlink(req.file.path, () => {});
      return res.status(404).json({ error: 'Faculty not found' });
    }

    const resource = await prisma.resource.create({
      data: {
        institutionId: req.user.institutionId,
        departmentId: faculty.departmentId,
        title,
        subject,
        description: description || null,
        type: String(type).toUpperCase(),
        status: 'PENDING',
        fileUrl: toPublicUrl(req.file.path),
        fileName: req.file.originalname,
        fileSizeBytes: req.file.size,
        uploadedByLabel: req.user.name || 'Faculty',
        uploadedByRole: 'faculty',
        uploadedByFacultyId: req.user.id,
      },
    });

    await logAction(req, { action: `Uploaded resource "${title}" (pending approval)`, module: 'Resources' });
    res.status(201).json({ resource: serializeResource(resource) });
  } catch (err) {
    console.error(err);
    fs.unlink(req.file.path, () => {});
    res.status(500).json({ error: 'Failed to upload resource' });
  }
}

/**
 * DELETE /api/faculty/resources/:id
 * Faculty can only delete their own uploads.
 */
export async function deleteResource(req, res) {
  const { id } = req.params;

  try {
    const resource = await prisma.resource.findFirst({ where: { id, uploadedByFacultyId: req.user.id } });
    if (!resource) return res.status(404).json({ error: 'Resource not found' });

    await prisma.resource.delete({ where: { id } });

    const absolutePath = path.join(process.cwd(), resource.fileUrl.replace(/^\//, ''));
    fs.unlink(absolutePath, () => {});

    await logAction(req, { action: `Deleted resource "${resource.title}"`, module: 'Resources' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete resource' });
  }
}
// ---------------------------------------------------------------------------
// Settings (FacultySettings page)
// ---------------------------------------------------------------------------
const SALT_ROUNDS = 10;

const SETTINGS_DEFAULTS = {
  notifyEmail: true,
  notifyPush: true,
  notifyAssignmentSubmissions: true,
  notifyAttendanceReminders: true,
  notifyLowAttendanceAlerts: true,
  notifyStudentFeedback: false,
  notifyNotices: true,
  attendanceMethod: 'manual',
  defaultGradeScale: 'percentage',
  autoReminders: true,
  shareGradesWithStudents: true,
  theme: 'light',
  language: 'en',
  landingPage: 'faculty/dashboard',
  twoFactorEnabled: false,
};

const SETTINGS_WRITABLE_KEYS = Object.keys(SETTINGS_DEFAULTS);

/** Fetches (or lazily creates) the one settings row for a faculty member. */
async function getOrCreateFacultySettings(facultyId) {
  const existing = await prisma.facultySettings.findUnique({ where: { facultyId } });
  if (existing) return existing;
  return prisma.facultySettings.create({ data: { facultyId, ...SETTINGS_DEFAULTS } });
}

/**
 * GET /api/faculty/settings
 */
export async function getSettings(req, res) {
  try {
    const settings = await getOrCreateFacultySettings(req.user.id);
    res.json({ settings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
}

/**
 * PATCH /api/faculty/settings
 * body: any subset of the SETTINGS_DEFAULTS keys above.
 */
export async function updateSettings(req, res) {
  const facultyId = req.user.id;

  const data = {};
  for (const key of SETTINGS_WRITABLE_KEYS) {
    if (req.body[key] !== undefined) data[key] = req.body[key];
  }
  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: 'No recognized settings fields in request body' });
  }

  try {
    await getOrCreateFacultySettings(facultyId); // ensures a row exists to update
    const settings = await prisma.facultySettings.update({ where: { facultyId }, data });
    res.json({ settings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
}

/**
 * POST /api/faculty/settings/change-password
 * body: { currentPassword, newPassword }
 */
export async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  const facultyId = req.user.id;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword and newPassword are required' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'newPassword must be at least 8 characters' });
  }

  try {
    const faculty = await prisma.faculty.findUnique({ where: { id: facultyId } });
    if (!faculty || !(await bcrypt.compare(currentPassword, faculty.passwordHash))) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await prisma.faculty.update({ where: { id: facultyId }, data: { passwordHash } });

    await logAction(req, { action: 'Changed account password', module: 'Settings' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to change password' });
  }
}

/**
 * POST /api/faculty/settings/sign-out-all-devices
 * Bumps sessionsInvalidatedAt so every JWT issued before now is rejected by
 * requireAuth on the next request (see auth.middleware.js) — including the
 * one making this call, so the frontend should treat the response as a
 * forced logout.
 */
export async function signOutAllDevices(req, res) {
  try {
    await prisma.faculty.update({
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
 * POST /api/faculty/settings/request-deactivation
 * There's no deactivation-request/ticket model, and a faculty member can't
 * flip their own `status` (only admin's faculty-update endpoint can). This
 * writes an audit log entry so the request is at least visible to the
 * institution's admin in their Security/Audit log — it does not change
 * faculty.status or notify anyone directly.
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

// ---------------------------------------------------------------------------
// Workload (FacultyWorkload page)
// ---------------------------------------------------------------------------
const RECOMMENDED_MAX_WEEKLY_HOURS = 28; // display benchmark; not institution-configurable yet

function timeToMinutes(hhmm) {
  const [h, m] = String(hhmm || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * GET /api/faculty/workload
 * Builds a workload snapshot from real scheduling/grading data instead of a
 * fixed mock. Teaching hours, active classes, and the weekly distribution
 * chart are computed directly from TimetableSlot rows. Evaluation, lesson
 * planning, student support, and administrative hours have no dedicated
 * time-tracking model in the schema, so they're estimated from the closest
 * available proxy (pending grading counts, saved lesson plans, feedback
 * volume, resource uploads) — each is commented inline below.
 */
export async function getWorkload(req, res) {
  const facultyId = req.user.id;
  try {
    const faculty = await prisma.faculty.findUnique({ where: { id: facultyId } });
    if (!faculty) return res.status(404).json({ error: 'Faculty not found' });

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [slots, subjects, assignments, periodicTests, lessonPlansRecent, totalLessonPlans, feedbackRecent, resourcesRecent, attendanceRecent] = await Promise.all([
      prisma.timetableSlot.findMany({ where: { facultyId } }),
      prisma.subject.findMany({ where: { facultyId } }),
      prisma.assignment.findMany({ where: { facultyId }, include: { submissions: true } }),
      prisma.periodicTest.findMany({ where: { facultyId }, include: { results: true } }),
      prisma.lessonPlan.findMany({ where: { facultyId, createdAt: { gte: oneWeekAgo } } }),
      prisma.lessonPlan.count({ where: { facultyId } }),
      prisma.feedback.findMany({ where: { facultyId, createdAt: { gte: oneMonthAgo } } }),
      prisma.resource.findMany({ where: { uploadedByFacultyId: facultyId, createdAt: { gte: oneWeekAgo } } }),
      prisma.attendance.findMany({ where: { markedById: facultyId, date: { gte: oneMonthAgo } } }),
    ]);

    // --- Teaching hours: real, computed from the weekly timetable ---
    const hoursByDay = new Map(); // dayOfWeek (0=Sun..6=Sat) -> hours
    const hoursBySubject = new Map(); // "Subject Sec X" -> hours, used for the recommendation text
    for (const slot of slots) {
      const hours = Math.max(0, timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime)) / 60;
      hoursByDay.set(slot.dayOfWeek, (hoursByDay.get(slot.dayOfWeek) || 0) + hours);
      const label = `${slot.subjectName}${slot.section ? ` Sec ${slot.section}` : ''}`;
      hoursBySubject.set(label, (hoursBySubject.get(label) || 0) + hours);
    }
    const teachingHours = Math.round([...hoursByDay.values()].reduce((a, b) => a + b, 0) * 10) / 10;
    const weeklyDistribution = [1, 2, 3, 4, 5, 6].map((dow) => ({
      day: DAY_LABELS[dow],
      hours: Math.round((hoursByDay.get(dow) || 0) * 10) / 10,
    }));
    const activeClasses = new Set(slots.map((s) => `${s.subjectName}::${s.section || ''}`)).size;

    // --- Evaluation backlog: real counts, estimated minutes-per-item ---
    const ungradedSubmissions = assignments.reduce(
      (sum, a) => sum + a.submissions.filter((s) => s.status === 'SUBMITTED').length,
      0
    );
    const ungradedTestResults = periodicTests.reduce(
      (sum, t) => sum + t.results.filter((r) => !r.missed && r.marksObtained == null).length,
      0
    );
    // Estimate: ~12 min to grade a submission, ~4 min to enter one test score.
    const evaluationHours = Math.round(((ungradedSubmissions * 12 + ungradedTestResults * 4) / 60) * 10) / 10;

    // --- Lesson planning: real count of plans saved this week, fixed estimate per plan ---
    const lessonPlanningHours = Math.round(lessonPlansRecent.length * 1.5 * 10) / 10;

    // --- Student support: proxy from feedback received this month + whether office hours are set ---
    const studentSupportHours = Math.round(((feedbackRecent.length * 0.5) + (faculty.officeHours ? 2 : 0)) * 10) / 10;

    // --- Administrative: proxy from resources uploaded this week + any attendance admin this month ---
    const administrativeHours = Math.round(Math.min(6, (resourcesRecent.length * 0.5) + (attendanceRecent.length > 0 ? 1 : 0)) * 10) / 10;

    const totalHours = Math.round((teachingHours + evaluationHours + lessonPlanningHours + studentSupportHours + administrativeHours) * 10) / 10;
    const capacityUsedPct = Math.round((totalHours / RECOMMENDED_MAX_WEEKLY_HOURS) * 100);
    const workloadIndex = Math.min(100, capacityUsedPct);

    const workloadBreakdown = [
      { activity: 'Teaching Hours', hours: teachingHours },
      { activity: 'Evaluation Hours', hours: evaluationHours },
      { activity: 'Lesson Planning', hours: lessonPlanningHours },
      { activity: 'Student Support', hours: studentSupportHours },
      { activity: 'Administrative', hours: administrativeHours },
    ];

    // --- Academic engagement index: real ratios where a proxy exists ---
    const gradedSubmissions = assignments.reduce(
      (sum, a) => sum + a.submissions.filter((s) => s.status === 'GRADED').length,
      0
    );
    const totalSubmissions = assignments.reduce((sum, a) => sum + a.submissions.length, 0);
    const assignmentsPct = totalSubmissions ? Math.round((gradedSubmissions / totalSubmissions) * 100) : 100;

    const EXPECTED_PLANS_PER_SUBJECT = 4; // rough syllabus-coverage assumption; no unit-tracking model exists
    const lessonPlansPct = subjects.length
      ? Math.min(100, Math.round((totalLessonPlans / (subjects.length * EXPECTED_PLANS_PER_SUBJECT)) * 100))
      : 0;

    const attendanceDaysMarked = new Set(attendanceRecent.map((a) => toDateOnly(a.date))).size;
    const expectedTeachingDaysPerMonth = new Set(slots.map((s) => s.dayOfWeek)).size * 4; // ~4 occurrences/weekday/month
    const classesConductedPct = expectedTeachingDaysPerMonth
      ? Math.min(100, Math.round((attendanceDaysMarked / expectedTeachingDaysPerMonth) * 100))
      : 0;

    // No dedicated "doubt session" model exists; feedback volume is the closest available engagement signal.
    const doubtSessionsPct = Math.min(100, feedbackRecent.length * 15);
    const resourcesPct = Math.min(100, resourcesRecent.length * 10);

    const engagementData = [
      { metric: 'Classes Conducted', value: classesConductedPct },
      { metric: 'Lesson Plans', value: lessonPlansPct },
      { metric: 'Assignments', value: assignmentsPct },
      { metric: 'Doubt Sessions', value: doubtSessionsPct },
      { metric: 'Resources', value: resourcesPct },
    ];
    const radarData = [
      { metric: 'Classes', value: classesConductedPct, fullMark: 100 },
      { metric: 'Plans', value: lessonPlansPct, fullMark: 100 },
      { metric: 'Evaluation', value: assignmentsPct, fullMark: 100 },
      { metric: 'Support', value: doubtSessionsPct, fullMark: 100 },
      { metric: 'Resources', value: resourcesPct, fullMark: 100 },
    ];
    const engagementIndex = Math.round(engagementData.reduce((sum, e) => sum + e.value, 0) / engagementData.length);

    // --- Rule-based recommendation (deterministic from the numbers above — no ML/LLM call) ---
    const overloaded = totalHours > RECOMMENDED_MAX_WEEKLY_HOURS;
    const topSubjectEntry = [...hoursBySubject.entries()].sort((a, b) => b[1] - a[1])[0];
    const workloadInsight = {
      id: `WL-${facultyId.slice(-6)}`,
      title: overloaded ? 'Potential workload imbalance detected' : 'Workload is within a healthy range',
      description: overloaded
        ? `${faculty.name} is currently managing ${activeClasses} class${activeClasses === 1 ? '' : 'es'} — total weekly load is ${totalHours}h against a recommended max of ${RECOMMENDED_MAX_WEEKLY_HOURS}h.`
        : `${faculty.name}'s total weekly load is ${totalHours}h, within the recommended max of ${RECOMMENDED_MAX_WEEKLY_HOURS}h.`,
      type: overloaded ? 'warning' : 'success',
      data: [
        `Current load: ${totalHours} hours/week (recommended: ≤${RECOMMENDED_MAX_WEEKLY_HOURS})`,
        `Teaching hours: ${teachingHours}/week (${totalHours ? Math.round((teachingHours / totalHours) * 100) : 0}% of workload)`,
        `Pending grading: ${ungradedSubmissions} submission${ungradedSubmissions === 1 ? '' : 's'}, ${ungradedTestResults} test result${ungradedTestResults === 1 ? '' : 's'}`,
        `Active classes: ${activeClasses}`,
      ],
      recommendation: overloaded
        ? `Consider redistributing the ${topSubjectEntry ? topSubjectEntry[0] : 'highest-load'} slot to another faculty member to bring weekly load closer to ${RECOMMENDED_MAX_WEEKLY_HOURS}h.`
        : 'No redistribution needed at current load levels.',
      action: 'Request Redistribution',
      confidence: Math.min(95, 60 + Math.min(20, activeClasses * 2) + Math.min(15, ungradedSubmissions)),
    };

    res.json({
      facultyName: faculty.name,
      totalHours,
      recommendedMaxHours: RECOMMENDED_MAX_WEEKLY_HOURS,
      capacityUsedPct,
      workloadIndex,
      activeClasses,
      workloadBreakdown,
      weeklyDistribution,
      engagementData,
      radarData,
      engagementIndex,
      workloadInsight,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load workload data' });
  }
}

// ---------------------------------------------------------------------------
// Lesson Planner (LessonPlanner page)
// ---------------------------------------------------------------------------
const GEMINI_LESSON_TIMEOUT_MS = 30000;

/**
 * POST /api/faculty/lesson-plans/generate
 * Gemini key stays on the server — same pattern as the student AI Study
 * Assistant (study-assistant.controller.js). Returns the generated plan
 * without persisting it; the frontend's "Save" button persists separately
 * via POST /faculty/lesson-plans.
 */
export async function generateLessonPlan(req, res) {
  const { course, subject, unit, topic, numClasses, duration, objectives } = req.body || {};
  if (!topic || !String(topic).trim()) {
    return res.status(400).json({ error: 'A topic is required' });
  }
  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({ error: 'The AI lesson planner is not configured yet. Ask an administrator to add GEMINI_API_KEY to the backend environment.' });
  }

  const prompt = [
    'Create a structured lesson plan for a college class.',
    `Course: ${course || 'N/A'}. Subject code: ${subject || 'N/A'}. Unit: ${unit || 'N/A'}.`,
    `Topic: ${topic}. Number of classes: ${numClasses || 1}. Duration per class: ${duration || 60} minutes.`,
    `Learning objectives provided by the instructor: ${objectives || 'None provided — infer reasonable objectives from the topic.'}`,
    'Respond with ONLY a JSON array (no markdown fences, no commentary) of exactly these 8 sections, in this order, each as {"id": string, "title": string, "content": string[]}:',
    'objectives (Learning Objectives), introduction (Introduction — include a duration in the title, e.g. "Introduction (15 min)"), concepts (Core Concepts, with duration), examples (Examples & Demonstrations, with duration), activity (Class Activity, with duration), assessment (Assessment), homework (Homework / Assignment), resources (Resources & References).',
    'Each section\'s "content" should be 3-6 concise bullet points specific to the given topic and course. Durations across introduction/concepts/examples/activity should roughly sum to the class duration.',
  ].join('\n');

  try {
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), GEMINI_LESSON_TIMEOUT_MS);
    let response;
    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(process.env.GEMINI_MODEL || 'gemini-2.0-flash')}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
          signal: abortController.signal,
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.5, maxOutputTokens: 2000, responseMimeType: 'application/json' },
          }),
        }
      );
    } finally {
      clearTimeout(timeout);
    }

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      console.error('Gemini lesson-plan request failed:', response.status, payload?.error?.message || 'unknown error');
      return res.status(502).json({ error: 'The AI lesson planner could not generate a plan right now. Please try again.' });
    }
    const rawText = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim();
    if (!rawText) return res.status(502).json({ error: 'The AI lesson planner returned an empty response. Please try again.' });

    let sections;
    try {
      sections = JSON.parse(rawText);
    } catch {
      return res.status(502).json({ error: 'The AI lesson planner returned an unexpected format. Please try again.' });
    }
    if (!Array.isArray(sections) || sections.length === 0) {
      return res.status(502).json({ error: 'The AI lesson planner returned an unexpected format. Please try again.' });
    }

    res.json({ plan: sections, model: process.env.GEMINI_MODEL || 'gemini-2.0-flash' });
  } catch (err) {
    if (err.name === 'AbortError') return res.status(504).json({ error: 'The AI lesson planner took too long to respond. Please try again.' });
    console.error('Lesson plan generation failed:', err);
    res.status(500).json({ error: 'Failed to generate lesson plan' });
  }
}

/**
 * GET /api/faculty/lesson-plans
 * Lists this faculty member's saved lesson plans, newest first.
 */
export async function listLessonPlans(req, res) {
  try {
    const plans = await prisma.lessonPlan.findMany({
      where: { facultyId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json({
      lessonPlans: plans.map((p) => ({
        id: p.id,
        subjectName: p.subjectName,
        topic: p.topic,
        content: JSON.parse(p.content),
        scheduledFor: p.scheduledFor,
        createdAt: p.createdAt,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load saved lesson plans' });
  }
}

/**
 * POST /api/faculty/lesson-plans
 * Persists a generated (and possibly edited) plan. `sections`/`form` are
 * stored together as JSON text in LessonPlan.content.
 */
export async function saveLessonPlan(req, res) {
  const { subjectName, topic, sections, form, scheduledFor } = req.body || {};
  if (!topic || !Array.isArray(sections)) {
    return res.status(400).json({ error: 'topic and sections are required' });
  }

  try {
    const lessonPlan = await prisma.lessonPlan.create({
      data: {
        facultyId: req.user.id,
        subjectName: subjectName || 'General',
        topic,
        content: JSON.stringify({ form: form || {}, sections }),
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
      },
    });
    await logAction(req, { action: `Saved lesson plan "${topic}"`, module: 'Lesson Planner' });
    res.status(201).json({
      lessonPlan: {
        id: lessonPlan.id,
        subjectName: lessonPlan.subjectName,
        topic: lessonPlan.topic,
        content: JSON.parse(lessonPlan.content),
        scheduledFor: lessonPlan.scheduledFor,
        createdAt: lessonPlan.createdAt,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save lesson plan' });
  }
} 