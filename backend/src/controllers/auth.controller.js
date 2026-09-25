import bcrypt from 'bcryptjs';
import { prisma } from '../config/db.js';
import { signToken } from '../utils/jwt.js';
import { isValidDescriptor } from '../utils/faceMatch.js';

const SALT_ROUNDS = 10;

function generateInstituteCode(name) {
  const prefix = (name || 'EDU').replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase() || 'EDU';
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `EDU-${prefix}${Math.floor(Math.random() * 9) + 1}-${random}`;
}

/**
 * POST /api/auth/institute-creation
 * Creates a new Institution plus its first Admin account.
 * body: { institutionName, adminName, adminEmail, password, type?, address?,
 *         state?, email?, phone?, website?, accreditation?, establishedYear? }
 * The profile fields (type/address/state/email/phone/website) are optional —
 * they're the "Institution Details" step of the signup wizard and can also
 * be filled in later from the AdminInstitution page.
 */
export async function createInstitute(req, res) {
  const {
    institutionName, adminName, adminEmail, password,
    type, address, state, email, phone, website, accreditation, establishedYear,
  } = req.body;

  if (!institutionName || !adminName || !adminEmail || !password) {
    return res.status(400).json({ error: 'institutionName, adminName, adminEmail and password are required' });
  }

  let establishedYearNum;
  if (establishedYear !== undefined && establishedYear !== null && establishedYear !== '') {
    establishedYearNum = Number(establishedYear);
    if (!Number.isInteger(establishedYearNum)) {
      return res.status(400).json({ error: 'establishedYear must be a whole number' });
    }
  }

  try {
    const code = generateInstituteCode(institutionName);
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const institution = await prisma.institution.create({
      data: {
        name: institutionName,
        code,
        status: 'TRIAL',
        type: type || undefined,
        address: address || undefined,
        state: state || undefined,
        email: email || undefined,
        phone: phone || undefined,
        website: website || undefined,
        accreditation: accreditation || undefined,
        establishedYear: establishedYearNum,
        admins: {
          create: {
            name: adminName,
            email: adminEmail,
            passwordHash,
          },
        },
      },
      include: { admins: true },
    });

    const admin = institution.admins[0];
    const token = signToken({
      id: admin.id,
      role: 'admin',
      institutionId: institution.id,
      email: admin.email,
      name: admin.name,
    });

    res.status(201).json({
      token,
      institution: { id: institution.id, name: institution.name, code: institution.code },
      admin: { id: admin.id, name: admin.name, email: admin.email },
    });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'That email or institution code is already in use' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to create institution' });
  }
}

/**
 * GET /api/auth/institute/:code
 * Public lookup used by the "Join an Institution" flow to confirm a code
 * is real before showing the registration form. Deliberately returns only
 * non-sensitive fields — no admin/student/faculty data.
 */
export async function lookupInstitute(req, res) {
  const { code } = req.params;

  try {
    const institution = await prisma.institution.findUnique({
      where: { code: (code || '').toUpperCase() },
      select: { id: true, name: true, code: true, status: true },
    });

    if (!institution || institution.status === 'SUSPENDED') {
      return res.status(404).json({ error: 'No institution found for that code' });
    }

    res.json({ institution: { name: institution.name, code: institution.code } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lookup failed' });
  }
}

/**
 * GET /api/auth/institute/:code/departments
 * Public — powers the Department dropdown on the join form so applicants can
 * only pick departments the institution's admin has actually created.
 */
export async function listInstituteDepartments(req, res) {
  const { code } = req.params;

  try {
    const institution = await prisma.institution.findUnique({ where: { code: (code || '').toUpperCase() } });
    if (!institution || institution.status === 'SUSPENDED') {
      return res.status(404).json({ error: 'No institution found for that code' });
    }

    const departments = await prisma.department.findMany({
      where: { institutionId: institution.id },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });

    res.json({ departments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
}

/**
 * GET /api/auth/institute/:code/courses?departmentId=...
 * Public — powers the Course dropdown on the faculty join form. Same
 * admin-created-only guarantee as listInstituteDepartments.
 */
export async function listInstituteCourses(req, res) {
  const { code } = req.params;
  const { departmentId } = req.query;

  try {
    const institution = await prisma.institution.findUnique({ where: { code: (code || '').toUpperCase() } });
    if (!institution || institution.status === 'SUSPENDED') {
      return res.status(404).json({ error: 'No institution found for that code' });
    }

    const where = { institutionId: institution.id };
    if (departmentId) where.departmentId = departmentId;

    const courses = await prisma.course.findMany({
      where,
      orderBy: { name: 'asc' },
      select: { id: true, name: true, departmentId: true },
    });

    res.json({ courses });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
}

/**
 * POST /api/auth/admin-login
 * body: { instituteCode, email, password }
 */
export async function adminLogin(req, res) {
  const { instituteCode, email, password } = req.body;

  if (!instituteCode || !email || !password) {
    return res.status(400).json({ error: 'instituteCode, email and password are required' });
  }

  try {
    const institution = await prisma.institution.findUnique({ where: { code: instituteCode.toUpperCase() } });
    if (!institution) {
      return res.status(404).json({ error: 'Institution not found for that code' });
    }

    const admin = await prisma.admin.findUnique({
      where: { institutionId_email: { institutionId: institution.id, email } },
    });
    if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = signToken({
      id: admin.id,
      role: 'admin',
      institutionId: institution.id,
      email: admin.email,
      name: admin.name,
    });

    res.json({
      token,
      admin: { id: admin.id, name: admin.name, email: admin.email },
      institution: { id: institution.id, name: institution.name, code: institution.code },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
}

/**
 * POST /api/auth/faculty-login
 * body: { instituteCode, email, password }
 */
export async function facultyLogin(req, res) {
  await loginMember(req, res, 'faculty', prisma.faculty);
}

/**
 * POST /api/auth/student-login
 * body: { instituteCode, email, password }
 */
export async function studentLogin(req, res) {
  await loginMember(req, res, 'student', prisma.student);
}

async function loginMember(req, res, role, model) {
  const { instituteCode, email, password } = req.body;

  if (!instituteCode || !email || !password) {
    return res.status(400).json({ error: 'instituteCode, email and password are required' });
  }

  try {
    const institution = await prisma.institution.findUnique({ where: { code: instituteCode.toUpperCase() } });
    if (!institution) {
      return res.status(404).json({ error: 'Institution not found for that code' });
    }

    const member = await model.findFirst({
      where: { institutionId: institution.id, email },
    });
    if (!member || !(await bcrypt.compare(password, member.passwordHash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = signToken({
      id: member.id,
      role,
      institutionId: institution.id,
      email: member.email,
      name: member.name,
    });

    res.json({
      token,
      [role]: { id: member.id, name: member.name, email: member.email },
      institution: { id: institution.id, name: institution.name, code: institution.code },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
}

/**
 * POST /api/auth/superadmin-login
 * body: { email, password }
 * Platform-level login, not scoped to any institution.
 */
export async function superAdminLogin(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  try {
    const superAdmin = await prisma.superAdmin.findUnique({ where: { email } });
    if (!superAdmin || !(await bcrypt.compare(password, superAdmin.passwordHash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = signToken({
      id: superAdmin.id,
      role: 'superadmin',
      email: superAdmin.email,
      name: superAdmin.name,
    });

    res.json({ token, superAdmin: { id: superAdmin.id, name: superAdmin.name, email: superAdmin.email } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
}

/**
 * POST /api/auth/join-institution
 * body: { instituteCode, name, email, role, department, rollId, password,
 *         faceDescriptor?, courseId?, subjects? }
 *
 * Creates a pending JoinRequest for an admin to later approve/reject. The
 * password is hashed and stored on the request itself so that, on approval,
 * the real Student/Faculty account can be created with the password the
 * person originally chose (no separate "set a password" step needed later).
 *
 * For student join requests, faceDescriptor is the 128-length Face ID
 * vector produced client-side by the 8-pose guided capture on the join
 * form (see FaceIdCapture.jsx) — required so Smart Attendance works from
 * day one. It's stored on the request and copied onto the real Student
 * row when an admin approves it (see approveJoinRequest).
 *
 * For faculty join requests, courseId is the course (fetched from
 * GET /api/auth/institute/:code/courses, so always one an admin actually
 * created) they belong to, and subjects is a free-text, comma-separated
 * list of what they teach — typed by the faculty member themselves. Both
 * are copied onto the real Faculty row (and turned into Subject rows) when
 * an admin approves the request; see approveJoinRequest.
 *
 * For student join requests, courseId is required — students pick the
 * admin-created class/course they're joining directly on the form (same
 * dropdown source as faculty), so they land in that course with its
 * faculty from day one instead of the admin assigning one later.
 */
export async function joinInstitution(req, res) {
  const { instituteCode, name, email, role, department, rollId, password, faceDescriptor, courseId, subjects } = req.body;

  if (!instituteCode || !name || !email || !role || !password) {
    return res.status(400).json({ error: 'instituteCode, name, email, role and password are required' });
  }

  if (role === 'student' && !isValidDescriptor(faceDescriptor)) {
    return res.status(400).json({ error: 'Face ID capture is required to join as a student. Please complete all 8 capture steps.' });
  }

  if (role === 'student' && !courseId) {
    return res.status(400).json({ error: 'Please select a course.' });
  }

  try {
    const institution = await prisma.institution.findUnique({ where: { code: instituteCode.toUpperCase() } });
    if (!institution) {
      return res.status(404).json({ error: 'Institution not found for that code' });
    }

    // If a student or faculty applicant picked a course, make sure it's a
    // real course belonging to this institution — never trust an id from
    // the client blindly.
    let validCourseId = null;
    if ((role === 'faculty' || role === 'student') && courseId) {
      const course = await prisma.course.findFirst({ where: { id: courseId, institutionId: institution.id } });
      if (!course) {
        return res.status(400).json({ error: 'Selected course is not valid for this institution' });
      }
      validCourseId = course.id;
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const joinRequest = await prisma.joinRequest.create({
      data: {
        institutionId: institution.id,
        name,
        email,
        role,
        department,
        rollId,
        courseId: validCourseId,
        subjects: role === 'faculty' && subjects ? String(subjects).trim() : null,
        passwordHash,
        faceDescriptor: role === 'student' ? JSON.stringify(faceDescriptor) : null,
      },
    });

    // Never send the password hash back to the client.
    const { passwordHash: _omit, ...safeJoinRequest } = joinRequest;

    res.status(201).json({ joinRequest: safeJoinRequest });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to submit join request' });
  }
}