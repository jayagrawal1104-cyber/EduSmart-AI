import { prisma } from '../config/db.js';
import { logAction } from '../utils/audit.js';

// Only these fields are editable from the AdminInstitution profile form.
// name/code/status/id are shown but managed elsewhere (Security Center owns
// code regeneration; SuperAdmin owns status).
const WRITABLE_KEYS = [
  'name',
  'type',
  'address',
  'state',
  'email',
  'phone',
  'website',
  'accreditation',
  'establishedYear',
];

/**
 * GET /api/admin/institution
 * Full profile for the AdminInstitution page: institution fields plus live
 * counts (departments/courses/students/faculty) for the stat cards.
 */
export async function getInstitutionProfile(req, res) {
  const institutionId = req.user.institutionId;

  try {
    const [institution, departmentCount, courseCount, studentCount, facultyCount] = await Promise.all([
      prisma.institution.findUnique({ where: { id: institutionId } }),
      prisma.department.count({ where: { institutionId } }),
      prisma.course.count({ where: { institutionId } }),
      prisma.student.count({ where: { institutionId, status: 'ACTIVE' } }),
      prisma.faculty.count({ where: { institutionId, status: 'ACTIVE' } }),
    ]);

    if (!institution) {
      return res.status(404).json({ error: 'Institution not found' });
    }

    res.json({
      institution,
      counts: {
        departments: departmentCount,
        courses: courseCount,
        students: studentCount,
        faculty: facultyCount,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load institution profile' });
  }
}

/**
 * PATCH /api/admin/institution
 * body: any subset of WRITABLE_KEYS. Institute code/QR are not editable here —
 * see security.controller.js's regenerateInstituteCode for that flow.
 */
export async function updateInstitutionProfile(req, res) {
  const institutionId = req.user.institutionId;

  const data = {};
  for (const key of WRITABLE_KEYS) {
    if (req.body[key] !== undefined) data[key] = req.body[key];
  }
  if (data.establishedYear !== undefined && data.establishedYear !== null) {
    const year = Number(data.establishedYear);
    if (!Number.isInteger(year)) {
      return res.status(400).json({ error: 'establishedYear must be a whole number' });
    }
    data.establishedYear = year;
  }
  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: 'No recognized institution fields in request body' });
  }

  try {
    const institution = await prisma.institution.update({ where: { id: institutionId }, data });
    await logAction(req, { action: 'Updated institution profile', module: 'Institution' });
    res.json({ institution });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update institution profile' });
  }
}