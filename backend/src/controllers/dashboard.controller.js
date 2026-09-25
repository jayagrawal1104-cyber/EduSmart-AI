import { prisma } from '../config/db.js';

/**
 * GET /api/admin/dashboard
 * Landing-page summary for the admin portal: headline counts, a 30-day
 * attendance snapshot, overall performance average, and the most recent
 * notices and audit activity. Mirrors the shape of the student portal's
 * getDashboard, but for institution-wide numbers instead of one student's.
 */
export async function getDashboard(req, res) {
  const institutionId = req.user.institutionId;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  try {
    const [
      studentCount,
      facultyCount,
      departmentCount,
      courseCount,
      pendingJoinRequests,
      attendanceGrouped,
      performanceAgg,
      recentNotices,
      recentAuditLogs,
    ] = await Promise.all([
      prisma.student.count({ where: { institutionId, status: 'ACTIVE' } }),
      prisma.faculty.count({ where: { institutionId, status: 'ACTIVE' } }),
      prisma.department.count({ where: { institutionId } }),
      prisma.course.count({ where: { institutionId } }),
      prisma.joinRequest.count({ where: { institutionId, status: 'PENDING' } }),
      prisma.attendance.groupBy({
        by: ['status'],
        where: { student: { institutionId }, date: { gte: thirtyDaysAgo } },
        _count: { _all: true },
      }),
      prisma.performanceRecord.aggregate({
        where: { student: { institutionId } },
        _avg: { score: true },
      }),
      prisma.notice.findMany({
        where: { institutionId },
        orderBy: { publishDate: 'desc' },
        take: 5,
      }),
      prisma.auditLog.findMany({
        where: { institutionId },
        orderBy: { timestamp: 'desc' },
        take: 5,
      }),
    ]);

    const attendanceCounts = { PRESENT: 0, ABSENT: 0, LATE: 0 };
    for (const g of attendanceGrouped) attendanceCounts[g.status] = g._count._all;
    const attendanceTotal = attendanceCounts.PRESENT + attendanceCounts.ABSENT + attendanceCounts.LATE;
    const attendanceRate30d = attendanceTotal
      ? Math.round((attendanceCounts.PRESENT / attendanceTotal) * 1000) / 10
      : null;

    res.json({
      counts: {
        students: studentCount,
        faculty: facultyCount,
        departments: departmentCount,
        courses: courseCount,
        pendingJoinRequests,
      },
      attendance30d: { ...attendanceCounts, total: attendanceTotal, rate: attendanceRate30d },
      averagePerformance:
        performanceAgg._avg.score !== null ? Math.round(performanceAgg._avg.score * 10) / 10 : null,
      recentNotices,
      recentActivity: recentAuditLogs,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load admin dashboard' });
  }
}