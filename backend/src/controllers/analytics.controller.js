import { prisma } from '../config/db.js';

function summarizeStatusCounts(grouped) {
  const counts = { PRESENT: 0, ABSENT: 0, LATE: 0 };
  for (const g of grouped) counts[g.status] = g._count._all;
  const total = counts.PRESENT + counts.ABSENT + counts.LATE;
  const attendanceRate = total ? Math.round((counts.PRESENT / total) * 1000) / 10 : null;
  return { counts, total, attendanceRate };
}

/**
 * GET /api/admin/analytics/attendance-overview?departmentId=&courseId=&from=&to=
 * Institution-wide (or filtered) attendance totals: present/absent/late
 * counts and the overall attendance rate (%). All filters optional.
 */
export async function attendanceOverview(req, res) {
  const institutionId = req.user.institutionId;
  const { departmentId, courseId, from, to } = req.query;

  try {
    const where = {
      student: {
        institutionId,
        ...(departmentId && { departmentId }),
        ...(courseId && { courseId }),
      },
    };
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to);
    }

    const grouped = await prisma.attendance.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    });

    res.json(summarizeStatusCounts(grouped));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch attendance overview' });
  }
}

/**
 * GET /api/admin/analytics/attendance-by-department?from=&to=
 * Per-department attendance breakdown, for a department comparison view.
 * One query per department (institutions have a handful, not thousands —
 * fine for an analytics endpoint, not meant to be called on a hot path).
 */
export async function attendanceByDepartment(req, res) {
  const institutionId = req.user.institutionId;
  const { from, to } = req.query;

  try {
    const departments = await prisma.department.findMany({
      where: { institutionId },
      select: { id: true, name: true, code: true },
    });

    const dateFilter = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) dateFilter.lte = new Date(to);

    const results = await Promise.all(
      departments.map(async (department) => {
        const grouped = await prisma.attendance.groupBy({
          by: ['status'],
          where: {
            student: { departmentId: department.id },
            ...((from || to) && { date: dateFilter }),
          },
          _count: { _all: true },
        });
        return { department, ...summarizeStatusCounts(grouped) };
      })
    );

    res.json({ departments: results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch attendance by department' });
  }
}

/**
 * GET /api/admin/analytics/attendance-trend?months=6
 * Monthly institution-wide attendance rate per department, for the last
 * `months` calendar months (default 6, max 12) including the current one.
 * Buckets every Attendance record in range by (calendar month, department)
 * in memory rather than a raw SQL date_trunc — institutions are small, so
 * this stays cheap and keeps the query portable.
 * Response: { months: [{ key: '2026-04', label: 'Apr' }, ...],
 *             departments: [{ code, name }, ...],
 *             data: [{ month: 'Apr', CSE: 82.4, ECE: 79.1 }, ...] }
 * A department's value for a month is null if it has no attendance
 * records that month (so the line breaks instead of implying a real 0%).
 */
export async function attendanceTrend(req, res) {
  const institutionId = req.user.institutionId;
  const months = Math.min(12, Math.max(1, parseInt(req.query.months, 10) || 6));

  try {
    const departments = await prisma.department.findMany({
      where: { institutionId },
      select: { id: true, name: true, code: true },
      orderBy: { code: 'asc' },
    });

    const now = new Date();
    const rangeStart = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

    const monthBuckets = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthBuckets.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: d.toLocaleString('en-US', { month: 'short' }),
      });
    }

    const records = await prisma.attendance.findMany({
      where: {
        student: { institutionId },
        date: { gte: rangeStart },
      },
      select: { date: true, status: true, student: { select: { departmentId: true } } },
    });

    // monthKey -> departmentId -> { present, total }
    const buckets = new Map();
    for (const r of records) {
      const monthKey = `${r.date.getFullYear()}-${String(r.date.getMonth() + 1).padStart(2, '0')}`;
      if (!buckets.has(monthKey)) buckets.set(monthKey, new Map());
      const deptMap = buckets.get(monthKey);
      const deptId = r.student.departmentId;
      const entry = deptMap.get(deptId) || { present: 0, total: 0 };
      entry.total += 1;
      if (r.status === 'PRESENT') entry.present += 1;
      deptMap.set(deptId, entry);
    }

    const data = monthBuckets.map(({ key, label }) => {
      const row = { month: label };
      const deptMap = buckets.get(key);
      for (const dept of departments) {
        const entry = deptMap?.get(dept.id);
        row[dept.code] = entry && entry.total ? Math.round((entry.present / entry.total) * 1000) / 10 : null;
      }
      return row;
    });

    res.json({
      months: monthBuckets,
      departments: departments.map((d) => ({ code: d.code, name: d.name })),
      data,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch attendance trend' });
  }
}

/**
 * GET /api/admin/analytics/attendance-heatmap?weeks=4
 * Attendance rate by (ISO week, weekday Mon-Fri) for the last `weeks`
 * calendar weeks (default 4, max 8). Weekends are excluded since classes
 * don't run then in this system's data model.
 * Response: [{ week: 'Week 1', mon: 88, tue: 85, wed: null, thu: 87, fri: 79 }, ...]
 * (oldest week first). A day is null if there's no attendance data for it.
 */
export async function attendanceHeatmap(req, res) {
  const institutionId = req.user.institutionId;
  const weeks = Math.min(8, Math.max(1, parseInt(req.query.weeks, 10) || 4));

  try {
    const now = new Date();
    // Start of the current week (Monday), then step back (weeks - 1) more weeks.
    const dayOfWeek = now.getDay(); // 0=Sun..6=Sat
    const daysSinceMonday = (dayOfWeek + 6) % 7;
    const currentWeekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMonday);
    const rangeStart = new Date(currentWeekStart);
    rangeStart.setDate(rangeStart.getDate() - 7 * (weeks - 1));

    const records = await prisma.attendance.findMany({
      where: {
        student: { institutionId },
        date: { gte: rangeStart },
      },
      select: { date: true, status: true },
    });

    const dayKeys = ['mon', 'tue', 'wed', 'thu', 'fri'];
    const buckets = []; // index 0..weeks-1, each { mon:{present,total}, ... }
    for (let i = 0; i < weeks; i++) buckets.push({ mon: { present: 0, total: 0 }, tue: { present: 0, total: 0 }, wed: { present: 0, total: 0 }, thu: { present: 0, total: 0 }, fri: { present: 0, total: 0 } });

    for (const r of records) {
      const diffDays = Math.floor((r.date - rangeStart) / (1000 * 60 * 60 * 24));
      const weekIndex = Math.floor(diffDays / 7);
      if (weekIndex < 0 || weekIndex >= weeks) continue;
      const jsDay = r.date.getDay(); // 0=Sun..6=Sat
      const dayIndex = jsDay - 1; // Mon=0..Fri=4
      if (dayIndex < 0 || dayIndex > 4) continue;
      const key = dayKeys[dayIndex];
      buckets[weekIndex][key].total += 1;
      if (r.status === 'PRESENT') buckets[weekIndex][key].present += 1;
    }

    const result = buckets.map((week, i) => {
      const row = { week: `Week ${i + 1}` };
      for (const key of dayKeys) {
        const { present, total } = week[key];
        row[key] = total ? Math.round((present / total) * 1000) / 10 : null;
      }
      return row;
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch attendance heatmap' });
  }
}

/**
 * GET /api/admin/analytics/performance-trend?months=6
 * Institution-wide monthly trend of three series: average PerformanceRecord
 * score, attendance rate, and assignment completion rate. Bucketed by
 * calendar month in memory (see attendanceTrend above for why). A series
 * value is null for a month with no underlying records, so the line breaks
 * instead of implying a real 0.
 */
export async function performanceTrend(req, res) {
  const institutionId = req.user.institutionId;
  const months = Math.min(12, Math.max(1, parseInt(req.query.months, 10) || 6));

  try {
    const now = new Date();
    const rangeStart = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
    const monthKeyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    const monthBuckets = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthBuckets.push({ key: monthKeyOf(d), label: d.toLocaleString('en-US', { month: 'short' }) });
    }

    const [perfRecords, attendanceRecords, assignments] = await Promise.all([
      prisma.performanceRecord.findMany({
        where: { student: { institutionId }, recordedAt: { gte: rangeStart } },
        select: { score: true, recordedAt: true },
      }),
      prisma.attendance.findMany({
        where: { student: { institutionId }, date: { gte: rangeStart } },
        select: { status: true, date: true },
      }),
      prisma.assignment.findMany({
        where: { faculty: { institutionId }, dueDate: { gte: rangeStart } },
        select: { dueDate: true, submissions: { select: { status: true } } },
      }),
    ]);

    const scoreBuckets = new Map(); // monthKey -> { sum, count }
    for (const r of perfRecords) {
      const key = monthKeyOf(r.recordedAt);
      const e = scoreBuckets.get(key) || { sum: 0, count: 0 };
      e.sum += r.score;
      e.count += 1;
      scoreBuckets.set(key, e);
    }

    const attendanceBuckets = new Map(); // monthKey -> { present, total }
    for (const r of attendanceRecords) {
      const key = monthKeyOf(r.date);
      const e = attendanceBuckets.get(key) || { present: 0, total: 0 };
      e.total += 1;
      if (r.status === 'PRESENT') e.present += 1;
      attendanceBuckets.set(key, e);
    }

    const assignmentBuckets = new Map(); // monthKey -> { done, total }
    for (const a of assignments) {
      const key = monthKeyOf(a.dueDate);
      const e = assignmentBuckets.get(key) || { done: 0, total: 0 };
      e.total += a.submissions.length;
      e.done += a.submissions.filter((s) => s.status !== 'PENDING').length;
      assignmentBuckets.set(key, e);
    }

    const data = monthBuckets.map(({ key, label }) => {
      const s = scoreBuckets.get(key);
      const a = attendanceBuckets.get(key);
      const asg = assignmentBuckets.get(key);
      return {
        month: label,
        score: s && s.count ? Math.round((s.sum / s.count) * 10) / 10 : null,
        attendance: a && a.total ? Math.round((a.present / a.total) * 1000) / 10 : null,
        assignments: asg && asg.total ? Math.round((asg.done / asg.total) * 1000) / 10 : null,
      };
    });

    res.json({ months: monthBuckets, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch performance trend' });
  }
}

/**
 * GET /api/admin/analytics/subject-performance?limit=8
 * Average PerformanceRecord score per subject (the free-text `subject`
 * field on PerformanceRecord), institution-wide, highest first.
 */
export async function subjectPerformance(req, res) {
  const institutionId = req.user.institutionId;
  const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 8));

  try {
    const grouped = await prisma.performanceRecord.groupBy({
      by: ['subject'],
      where: { student: { institutionId } },
      _avg: { score: true },
      _count: { _all: true },
    });

    const data = grouped
      .map((g) => ({ subject: g.subject, score: Math.round((g._avg.score ?? 0) * 10) / 10, recordCount: g._count._all }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    res.json({ data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch subject performance' });
  }
}

/**
 * GET /api/admin/analytics/student-risk?limit=5
 * Per-student risk, combining attendance rate and average performance
 * score (60/40 weight — attendance is the stronger leading indicator).
 * combinedScore = 0.6 * attendanceRate + 0.4 * avgPerformance, banded into
 * Low (>=75) / Medium (60-74) / High (<60). Students with neither
 * attendance nor performance records on file are excluded — there's
 * nothing to base a score on.
 * Response: { students: [...every scored student, worst first...],
 *             riskCounts: { Low, Medium, High },
 *             topPerformers: [...top `limit` by avgPerformance...],
 *             lowPerformers: [...bottom `limit` by avgPerformance...] }
 */
export async function studentRisk(req, res) {
  const institutionId = req.user.institutionId;
  const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 5));

  try {
    const [attendanceGrouped, performanceGrouped, students] = await Promise.all([
      prisma.attendance.groupBy({
        by: ['studentId', 'status'],
        where: { student: { institutionId, status: 'ACTIVE' } },
        _count: { _all: true },
      }),
      prisma.performanceRecord.groupBy({
        by: ['studentId'],
        where: { student: { institutionId, status: 'ACTIVE' } },
        _avg: { score: true },
      }),
      prisma.student.findMany({
        where: { institutionId, status: 'ACTIVE' },
        select: { id: true, name: true, email: true, department: { select: { name: true, code: true } } },
      }),
    ]);

    const attendanceByStudent = new Map();
    for (const row of attendanceGrouped) {
      const e = attendanceByStudent.get(row.studentId) || { PRESENT: 0, ABSENT: 0, LATE: 0 };
      e[row.status] = row._count._all;
      attendanceByStudent.set(row.studentId, e);
    }
    const perfByStudent = new Map(performanceGrouped.map((g) => [g.studentId, g._avg.score]));
    const studentById = new Map(students.map((s) => [s.id, s]));

    const scored = [];
    for (const student of students) {
      const counts = attendanceByStudent.get(student.id);
      const total = counts ? counts.PRESENT + counts.ABSENT + counts.LATE : 0;
      const attendanceRate = total ? Math.round((counts.PRESENT / total) * 1000) / 10 : null;
      const avgPerformanceRaw = perfByStudent.get(student.id);
      const avgPerformance = avgPerformanceRaw != null ? Math.round(avgPerformanceRaw * 10) / 10 : null;

      if (attendanceRate === null && avgPerformance === null) continue; // nothing to score

      // Missing one side of the pair: score on the available side alone
      // rather than dragging the combined score down with an assumed 0.
      let combinedScore;
      if (attendanceRate !== null && avgPerformance !== null) {
        combinedScore = 0.6 * attendanceRate + 0.4 * avgPerformance;
      } else {
        combinedScore = attendanceRate !== null ? attendanceRate : avgPerformance;
      }
      combinedScore = Math.round(combinedScore * 10) / 10;

      const risk = combinedScore < 60 ? 'High' : combinedScore < 75 ? 'Medium' : 'Low';

      scored.push({
        student: { id: student.id, name: student.name, email: student.email, department: student.department },
        attendanceRate,
        avgPerformance,
        combinedScore,
        risk,
      });
    }

    scored.sort((a, b) => a.combinedScore - b.combinedScore);

    const riskCounts = { Low: 0, Medium: 0, High: 0 };
    for (const s of scored) riskCounts[s.risk] += 1;

    const withPerformance = scored.filter((s) => s.avgPerformance !== null);
    const topPerformers = [...withPerformance].sort((a, b) => b.avgPerformance - a.avgPerformance).slice(0, limit);
    const lowPerformers = [...withPerformance].sort((a, b) => a.avgPerformance - b.avgPerformance).slice(0, limit);

    res.json({ students: scored, riskCounts, topPerformers, lowPerformers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch student risk' });
  }
}

/**
 * GET /api/admin/analytics/faculty-workload
 * Real composite workload index per active faculty member, built from four
 * signals (per Jay's spec — no fabricated "engagement score"):
 *   1. weeklyHours     — sum of TimetableSlot durations (their timetable)
 *   2. classesPerWeek  — count of TimetableSlot rows
 *   3. attendanceBacklog — how many of their Subjects have gone >5 days
 *      without an Attendance record being marked (or have none at all)
 *   4. gradingBacklog  — count of Submissions on their Assignments still
 *      sitting at SUBMITTED (turned in, not yet graded)
 * Each raw signal is normalized against the institution's own max for that
 * signal (0-100), then combined as a weighted average:
 *   35% hours + 25% classes + 20% attendance backlog + 20% grading backlog.
 * This is relative to this institution's own faculty, not an absolute
 * external standard — it's built to answer "who's most loaded compared to
 * their peers here," which is what the admin UI uses it for.
 */
export async function facultyWorkload(req, res) {
  const institutionId = req.user.institutionId;
  const STALE_DAYS = 5;

  try {
    const facultyList = await prisma.faculty.findMany({
      where: { institutionId, status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        designation: true,
        department: { select: { name: true, code: true } },
        timetableSlots: { select: { startTime: true, endTime: true } },
        subjects: { select: { id: true } },
        assignments: { select: { submissions: { select: { status: true } } } },
      },
    });

    const subjectIds = facultyList.flatMap((f) => f.subjects.map((s) => s.id));
    const lastAttendanceBySubject = new Map();
    if (subjectIds.length) {
      const latest = await prisma.attendance.groupBy({
        by: ['subjectId'],
        where: { subjectId: { in: subjectIds } },
        _max: { date: true },
      });
      for (const row of latest) lastAttendanceBySubject.set(row.subjectId, row._max.date);
    }

    const now = new Date();
    const toMinutes = (t) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };

    const raw = facultyList.map((f) => {
      const weeklyHours =
        Math.round(
          f.timetableSlots.reduce((sum, s) => sum + Math.max(0, toMinutes(s.endTime) - toMinutes(s.startTime)), 0) / 6
        ) / 10; // minutes -> hours, 1 decimal
      const classesPerWeek = f.timetableSlots.length;

      let attendanceBacklog = 0;
      for (const subj of f.subjects) {
        const lastDate = lastAttendanceBySubject.get(subj.id);
        if (!lastDate || (now - new Date(lastDate)) / (1000 * 60 * 60 * 24) > STALE_DAYS) attendanceBacklog += 1;
      }

      const gradingBacklog = f.assignments.reduce(
        (sum, a) => sum + a.submissions.filter((s) => s.status === 'SUBMITTED').length,
        0
      );

      return {
        id: f.id,
        name: f.name,
        designation: f.designation,
        department: f.department,
        weeklyHours,
        classesPerWeek,
        attendanceBacklog,
        gradingBacklog,
      };
    });

    const maxOf = (key) => Math.max(1, ...raw.map((r) => r[key]));
    const maxHours = maxOf('weeklyHours');
    const maxClasses = maxOf('classesPerWeek');
    const maxAttendance = maxOf('attendanceBacklog');
    const maxGrading = maxOf('gradingBacklog');

    const data = raw
      .map((r) => {
        const hoursScore = (r.weeklyHours / maxHours) * 100;
        const classesScore = (r.classesPerWeek / maxClasses) * 100;
        const attendanceScore = (r.attendanceBacklog / maxAttendance) * 100;
        const gradingScore = (r.gradingBacklog / maxGrading) * 100;
        const workloadIndex = Math.round(0.35 * hoursScore + 0.25 * classesScore + 0.2 * attendanceScore + 0.2 * gradingScore);
        return { ...r, workloadIndex };
      })
      .sort((a, b) => b.workloadIndex - a.workloadIndex);

    const avgIndex = data.length ? Math.round(data.reduce((s, f) => s + f.workloadIndex, 0) / data.length) : 0;
    const highWorkload = data.filter((f) => f.workloadIndex >= 75).length;
    const lowUtilization = data.filter((f) => f.workloadIndex < 30).length;

    res.json({ faculty: data, avgIndex, highWorkload, lowUtilization, count: data.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch faculty workload' });
  }
}

/**
 * GET /api/admin/analytics/performance-overview?departmentId=&courseId=&subject=
 * Average/min/max score across PerformanceRecord entries matching the
 * filters. All filters optional; `subject` is an exact match on the
 * free-text subject field on PerformanceRecord.
 */
export async function performanceOverview(req, res) {
  const institutionId = req.user.institutionId;
  const { departmentId, courseId, subject } = req.query;

  try {
    const agg = await prisma.performanceRecord.aggregate({
      where: {
        student: {
          institutionId,
          ...(departmentId && { departmentId }),
          ...(courseId && { courseId }),
        },
        ...(subject && { subject }),
      },
      _avg: { score: true },
      _min: { score: true },
      _max: { score: true },
      _count: { _all: true },
    });

    res.json({
      recordCount: agg._count._all,
      averageScore: agg._avg.score !== null ? Math.round(agg._avg.score * 10) / 10 : null,
      minScore: agg._min.score,
      maxScore: agg._max.score,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch performance overview' });
  }
}

/**
 * GET /api/admin/analytics/at-risk-students?threshold=75&departmentId=&courseId=&limit=50
 * Flags active students whose attendance rate falls below `threshold`
 * percent (default 75). This is the real version of the "risk" field the
 * old mock UI showed — computed from actual Attendance records instead of
 * faked, so it only covers students who have attendance data on file.
 * Sorted worst-attendance-first, capped at `limit` (default 50, max 200).
 */
export async function atRiskStudents(req, res) {
  const institutionId = req.user.institutionId;
  const { departmentId, courseId } = req.query;
  const threshold = req.query.threshold !== undefined ? Number(req.query.threshold) : 75;
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));

  if (Number.isNaN(threshold) || threshold < 0 || threshold > 100) {
    return res.status(400).json({ error: 'threshold must be a number between 0 and 100' });
  }

  try {
    const grouped = await prisma.attendance.groupBy({
      by: ['studentId', 'status'],
      where: {
        student: {
          institutionId,
          status: 'ACTIVE',
          ...(departmentId && { departmentId }),
          ...(courseId && { courseId }),
        },
      },
      _count: { _all: true },
    });

    const byStudent = new Map();
    for (const row of grouped) {
      const entry = byStudent.get(row.studentId) || { PRESENT: 0, ABSENT: 0, LATE: 0 };
      entry[row.status] = row._count._all;
      byStudent.set(row.studentId, entry);
    }

    const flagged = [];
    for (const [studentId, counts] of byStudent) {
      const total = counts.PRESENT + counts.ABSENT + counts.LATE;
      if (!total) continue;
      const rate = Math.round((counts.PRESENT / total) * 1000) / 10;
      if (rate < threshold) {
        flagged.push({ studentId, attendanceRate: rate, ...counts, total });
      }
    }
    flagged.sort((a, b) => a.attendanceRate - b.attendanceRate);
    const page = flagged.slice(0, limit);

    const students = await prisma.student.findMany({
      where: { id: { in: page.map((p) => p.studentId) } },
      select: {
        id: true,
        name: true,
        email: true,
        rollId: true,
        year: true,
        section: true,
        department: { select: { id: true, name: true, code: true } },
        course: { select: { id: true, name: true, code: true } },
      },
    });
    const studentById = new Map(students.map((s) => [s.id, s]));

    const results = page
      .map((p) => ({ student: studentById.get(p.studentId), ...p }))
      .filter((r) => r.student);

    // `total` is every student below the threshold; `count` is how many are
    // actually returned in this page (capped at `limit`). A dashboard KPI
    // wants `total` — a list view wants both.
    res.json({ threshold, total: flagged.length, count: results.length, students: results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch at-risk students' });
  }
}