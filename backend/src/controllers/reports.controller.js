import fs from 'fs';
import { Parser as CsvParser } from 'json2csv';
import { prisma } from '../config/db.js';
import { logAction } from '../utils/audit.js';
import { ensureUploadDir, toPublicUrl, humanFileSize } from '../utils/fileStorage.js';

const REPORT_TITLES = {
  ATTENDANCE: 'Attendance Report',
  PERFORMANCE: 'Performance Report',
  ASSIGNMENT: 'Assignment Report',
  WORKLOAD: 'Faculty Workload Report',
  RISK: 'Academic Risk Report',
  DEPARTMENT: 'Department Report',
  FEEDBACK: 'Feedback Summary',
};

// Each builder returns an array of plain objects — one row per record —
// which json2csv turns into the report file. Real Prisma queries only,
// no synthetic numbers.
const ROW_BUILDERS = {
  async ATTENDANCE(institutionId) {
    const records = await prisma.attendance.findMany({
      where: { student: { institutionId } },
      include: { student: { select: { name: true, rollId: true, department: { select: { name: true } } } }, subject: { select: { name: true } } },
      orderBy: { date: 'desc' },
      take: 5000,
    });
    return records.map((r) => ({
      Date: r.date.toISOString().slice(0, 10),
      Student: r.student.name,
      'Roll ID': r.student.rollId || '',
      Department: r.student.department?.name || '',
      Subject: r.subject.name,
      Status: r.status,
    }));
  },

  async PERFORMANCE(institutionId) {
    const records = await prisma.performanceRecord.findMany({
      where: { student: { institutionId } },
      include: { student: { select: { name: true, rollId: true, department: { select: { name: true } } } } },
      orderBy: { recordedAt: 'desc' },
      take: 5000,
    });
    return records.map((r) => ({
      Date: r.recordedAt.toISOString().slice(0, 10),
      Student: r.student.name,
      'Roll ID': r.student.rollId || '',
      Department: r.student.department?.name || '',
      Subject: r.subject,
      Score: r.score,
    }));
  },

  async ASSIGNMENT(institutionId) {
    const assignments = await prisma.assignment.findMany({
      where: { faculty: { institutionId } },
      include: {
        faculty: { select: { name: true } },
        subject: { select: { name: true } },
        submissions: { select: { status: true, marks: true } },
      },
      orderBy: { dueDate: 'desc' },
      take: 2000,
    });
    return assignments.map((a) => {
      const submitted = a.submissions.filter((s) => s.status !== 'PENDING').length;
      const graded = a.submissions.filter((s) => s.marks !== null);
      const avg = graded.length ? graded.reduce((sum, s) => sum + s.marks, 0) / graded.length : null;
      return {
        Title: a.title,
        Faculty: a.faculty.name,
        Subject: a.subject.name,
        'Due Date': a.dueDate.toISOString().slice(0, 10),
        Submitted: submitted,
        Total: a.submissions.length,
        'Completion %': a.submissions.length ? Math.round((submitted / a.submissions.length) * 100) : 0,
        'Avg Score': avg !== null ? Math.round(avg * 10) / 10 : '',
      };
    });
  },

  async WORKLOAD(institutionId) {
    const faculty = await prisma.faculty.findMany({
      where: { institutionId },
      include: {
        department: { select: { name: true } },
        timetableSlots: true,
        subjects: { include: { _count: { select: { assignments: true } } } },
      },
    });
    return faculty.map((f) => ({
      Faculty: f.name,
      Department: f.department?.name || '',
      Designation: f.designation || '',
      'Weekly Classes': f.timetableSlots.length,
      'Subjects Taught': f.subjects.length,
      'Assignments Created': f.subjects.reduce((sum, s) => sum + s._count.assignments, 0),
    }));
  },

  async RISK(institutionId) {
    const students = await prisma.student.findMany({
      where: { institutionId, status: 'ACTIVE' },
      include: {
        department: { select: { name: true } },
        attendance: { select: { status: true } },
      },
    });
    return students
      .map((s) => {
        const total = s.attendance.length;
        const present = s.attendance.filter((a) => a.status === 'PRESENT').length;
        const rate = total ? Math.round((present / total) * 1000) / 10 : null;
        return { s, rate, total };
      })
      .filter((r) => r.total > 0 && r.rate < 75)
      .sort((a, b) => a.rate - b.rate)
      .map(({ s, rate }) => ({
        Student: s.name,
        'Roll ID': s.rollId || '',
        Department: s.department?.name || '',
        Year: s.year,
        Section: s.section,
        'Attendance Rate %': rate,
      }));
  },

  async DEPARTMENT(institutionId) {
    const departments = await prisma.department.findMany({
      where: { institutionId },
      include: {
        students: { select: { id: true } },
        faculty: { select: { id: true } },
        courses: { select: { id: true } },
      },
    });
    const rows = [];
    for (const d of departments) {
      const attendance = await prisma.attendance.groupBy({
        by: ['status'],
        where: { student: { departmentId: d.id } },
        _count: { _all: true },
      });
      const counts = { PRESENT: 0, ABSENT: 0, LATE: 0 };
      for (const g of attendance) counts[g.status] = g._count._all;
      const total = counts.PRESENT + counts.ABSENT + counts.LATE;
      rows.push({
        Department: d.name,
        Students: d.students.length,
        Faculty: d.faculty.length,
        Courses: d.courses.length,
        'Attendance Rate %': total ? Math.round((counts.PRESENT / total) * 1000) / 10 : '',
      });
    }
    return rows;
  },

  async FEEDBACK(institutionId) {
    const feedback = await prisma.feedback.findMany({
      where: { OR: [{ student: { institutionId } }, { faculty: { institutionId } }] },
      include: { student: { select: { name: true } }, faculty: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 2000,
    });
    return feedback.map((f) => ({
      Date: f.createdAt.toISOString().slice(0, 10),
      From: f.student?.name || f.faculty?.name || 'Unknown',
      Subject: f.subject,
      Rating: f.rating ?? '',
      Message: f.message,
    }));
  },
};

/**
 * POST /api/admin/reports/generate
 * body: { type: 'ATTENDANCE'|'PERFORMANCE'|'ASSIGNMENT'|'WORKLOAD'|'RISK'|'DEPARTMENT'|'FEEDBACK', format: 'PDF'|'CSV'|'Excel' }
 *
 * `format` is stored as the label the user picked, but the file generated is
 * always CSV — wiring real PDF/Excel export is separate follow-up work, not
 * covered here since this endpoint's job is to replace the fake 2.2s
 * setTimeout with a report built from real data.
 */
export async function generateReport(req, res) {
  const institutionId = req.user.institutionId;
  const { type, format = 'CSV' } = req.body;

  const key = String(type || '').toUpperCase();
  if (!ROW_BUILDERS[key]) {
    return res.status(400).json({ error: `type must be one of ${Object.keys(ROW_BUILDERS).join(', ')}` });
  }

  try {
    const rows = await ROW_BUILDERS[key](institutionId);
    const csv = rows.length ? new CsvParser().parse(rows) : 'No data available for this report yet\n';

    const dir = ensureUploadDir(`reports/${institutionId}`);
    const fileName = `${key.toLowerCase()}-${Date.now()}.csv`;
    const filePath = `${dir}/${fileName}`;
    fs.writeFileSync(filePath, csv);
    const fileSizeBytes = fs.statSync(filePath).size;

    const monthLabel = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
    const report = await prisma.generatedReport.create({
      data: {
        institutionId,
        type: key,
        title: `${REPORT_TITLES[key]} — ${monthLabel}`,
        format,
        fileUrl: toPublicUrl(filePath),
        fileSizeBytes,
        generatedByLabel: req.user.name || 'Admin',
      },
    });

    await logAction(req, { action: `Generated ${REPORT_TITLES[key]}`, module: 'Reports' });
    res.status(201).json({
      report: {
        id: report.id,
        title: report.title,
        type: report.type,
        format: report.format,
        fileUrl: report.fileUrl,
        size: humanFileSize(report.fileSizeBytes),
        generatedAt: report.createdAt,
        generatedBy: report.generatedByLabel,
      },
      rowCount: rows.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
}

/**
 * GET /api/admin/reports/recent?limit=10
 * Backs the "Recent Reports" list — real previously-generated reports,
 * newest first.
 */
export async function listRecentReports(req, res) {
  const institutionId = req.user.institutionId;
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));

  try {
    const reports = await prisma.generatedReport.findMany({
      where: { institutionId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    res.json({
      reports: reports.map((r) => ({
        id: r.id,
        title: r.title,
        type: r.type,
        format: r.format,
        fileUrl: r.fileUrl,
        size: humanFileSize(r.fileSizeBytes),
        generatedAt: r.createdAt,
        generatedBy: r.generatedByLabel,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch recent reports' });
  }
}

/**
 * DELETE /api/admin/reports/:id
 */
export async function deleteReport(req, res) {
  const { id } = req.params;
  const institutionId = req.user.institutionId;

  try {
    const report = await prisma.generatedReport.findFirst({ where: { id, institutionId } });
    if (!report) return res.status(404).json({ error: 'Report not found' });

    await prisma.generatedReport.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete report' });
  }
}
