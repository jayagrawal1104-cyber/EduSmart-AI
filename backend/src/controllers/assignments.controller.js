import { prisma } from '../config/db.js';

function toDateOnly(date) {
  return new Date(date).toISOString().slice(0, 10);
}

/** Start (Monday, 00:00) of the ISO week containing `date`. */
function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day; // shift back to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * GET /api/admin/assignments-overview?departmentId=&facultyId=
 * Institution-wide assignment tracking for the AdminAssignments page:
 * summary stats, the per-assignment table, and a 6-week completion trend.
 * Every assignment's `total` is the number of Submission rows it has (one
 * PENDING row is created per enrolled student when a faculty member creates
 * an assignment — see faculty.controller.js createAssignment), so this
 * reads straight from real Assignment/Submission data, no separate
 * "enrollment" table needed.
 *
 * There is no plagiarism/similarity-detection system wired into this
 * codebase (it would need a real text-similarity engine, e.g. comparing
 * submitted files), so unlike the old mock UI this endpoint does not
 * fabricate "AI similarity alerts" — the frontend shows an honest empty
 * state for that section instead.
 */
export async function getAssignmentsOverview(req, res) {
  const institutionId = req.user.institutionId;
  const { departmentId, facultyId } = req.query;

  try {
    const assignments = await prisma.assignment.findMany({
      where: {
        faculty: {
          institutionId,
          ...(departmentId && { departmentId }),
          ...(facultyId && { id: facultyId }),
        },
      },
      include: {
        subject: true,
        faculty: { include: { department: true } },
        submissions: true,
      },
      orderBy: { dueDate: 'desc' },
    });

    // --- Per-assignment table rows ---
    const rows = assignments.map((a) => {
      const total = a.submissions.length;
      const submitted = a.submissions.filter((s) => s.status !== 'PENDING').length;
      const graded = a.submissions.filter((s) => s.status === 'GRADED' && s.marks != null);
      const avgScorePct = graded.length
        ? Math.round((graded.reduce((sum, s) => sum + s.marks / a.totalMarks, 0) / graded.length) * 100)
        : null;
      return {
        id: a.id,
        title: a.title,
        subject: a.subject.name,
        faculty: a.faculty.name,
        facultyId: a.facultyId,
        department: a.faculty.department?.name || 'Unassigned',
        departmentId: a.faculty.departmentId,
        dueDate: toDateOnly(a.dueDate),
        submitted,
        total,
        avgScore: avgScorePct,
        completion: total ? Math.round((submitted / total) * 100) : 0,
      };
    });

    // --- Institution-wide summary stats ---
    const allSubmissions = assignments.flatMap((a) => a.submissions.map((s) => ({ ...s, totalMarks: a.totalMarks })));
    const totalAssignments = assignments.length;
    const nonPending = allSubmissions.filter((s) => s.status !== 'PENDING');
    const submissionRatePct = allSubmissions.length ? Math.round((nonPending.length / allSubmissions.length) * 100) : null;
    const lateCount = allSubmissions.filter((s) => s.status === 'LATE').length;
    const lateSubmissionPct = allSubmissions.length ? Math.round((lateCount / allSubmissions.length) * 100) : null;
    const graded = allSubmissions.filter((s) => s.status === 'GRADED' && s.marks != null);
    const avgScorePct = graded.length
      ? Math.round((graded.reduce((sum, s) => sum + s.marks / s.totalMarks, 0) / graded.length) * 100)
      : null;

    // Trend: compare the last 30 days of due dates against the 30 days before that.
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    function periodStats(from, to) {
      const subs = assignments
        .filter((a) => a.dueDate >= from && a.dueDate < to)
        .flatMap((a) => a.submissions.map((s) => ({ ...s, totalMarks: a.totalMarks })));
      if (!subs.length) return null;
      const done = subs.filter((s) => s.status !== 'PENDING');
      const gradedSubs = subs.filter((s) => s.status === 'GRADED' && s.marks != null);
      return {
        submissionRate: Math.round((done.length / subs.length) * 100),
        avgScore: gradedSubs.length
          ? Math.round((gradedSubs.reduce((sum, s) => sum + s.marks / s.totalMarks, 0) / gradedSubs.length) * 100)
          : null,
      };
    }
    const recent = periodStats(thirtyDaysAgo, now);
    const prior = periodStats(sixtyDaysAgo, thirtyDaysAgo);
    const submissionRateTrend = recent && prior
      ? { value: Math.abs(recent.submissionRate - prior.submissionRate), direction: recent.submissionRate >= prior.submissionRate ? 'up' : 'down' }
      : null;
    const avgScoreTrend = recent?.avgScore != null && prior?.avgScore != null
      ? { value: Math.abs(recent.avgScore - prior.avgScore), direction: recent.avgScore >= prior.avgScore ? 'up' : 'down' }
      : null;

    // --- 6-week completion trend, bucketed by the Monday of each assignment's due-date week ---
    const buckets = new Map(); // weekStartISO -> { submitted, total, label }
    for (const a of assignments) {
      const weekStart = startOfWeek(a.dueDate);
      const key = weekStart.toISOString();
      if (!buckets.has(key)) {
        buckets.set(key, {
          label: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          submitted: 0,
          total: 0,
          sortKey: weekStart.getTime(),
        });
      }
      const bucket = buckets.get(key);
      bucket.total += a.submissions.length;
      bucket.submitted += a.submissions.filter((s) => s.status !== 'PENDING').length;
    }
    const completionTrend = [...buckets.values()]
      .sort((a, b) => a.sortKey - b.sortKey)
      .slice(-6)
      .map((b) => ({ week: b.label, completion: b.total ? Math.round((b.submitted / b.total) * 100) : 0 }));

    res.json({
      stats: {
        totalAssignments,
        submissionRatePct,
        lateSubmissionPct,
        avgScorePct,
        submissionRateTrend,
        avgScoreTrend,
      },
      assignments: rows,
      completionTrend,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load assignment overview' });
  }
}