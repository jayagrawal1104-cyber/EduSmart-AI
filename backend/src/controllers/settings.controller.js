import bcrypt from 'bcryptjs';
import fs from 'fs';
import { prisma } from '../config/db.js';
import { logAction } from '../utils/audit.js';
import { ensureUploadDir, toPublicUrl } from '../utils/fileStorage.js';

const SALT_ROUNDS = 10;

const DEFAULTS = {
  academicYear: '2026',
  defaultGradeScale: 'percentage',
  attendanceThreshold: 75,
  landingPage: 'admin/dashboard',
  notifyEmail: true,
  notifyPush: true,
  notifyJoinRequests: true,
  notifyLowAttendance: true,
  notifyAtRiskFlags: true,
  notifyWorkloadAlerts: true,
  notifyWeeklyDigest: true,
  theme: 'light',
  language: 'en',
  timezone: 'ist',
  twoFactorRequired: false,
  sessionTimeoutMinutes: 30,
  qrLoginEnabled: true,
  joinApprovalRequired: true,
};

/**
 * Fetches (or lazily creates) the one settings row for an institution.
 * Exported so security.controller.js can reuse it.
 */
export async function getOrCreateSettings(institutionId) {
  const existing = await prisma.institutionSettings.findUnique({ where: { institutionId } });
  if (existing) return existing;
  return prisma.institutionSettings.create({ data: { institutionId, ...DEFAULTS } });
}

/**
 * GET /api/admin/settings
 */
export async function getSettings(req, res) {
  try {
    const settings = await getOrCreateSettings(req.user.institutionId);
    res.json({ settings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
}

// Only these keys are writable via this endpoint — twoFactorRequired,
// sessionTimeoutMinutes, qrLoginEnabled and joinApprovalRequired are also
// exposed here (AdminSettings) and via security.controller.js (SecurityCenter);
// both read/write the same InstitutionSettings row, so either page reflects
// the other's changes immediately.
const WRITABLE_KEYS = Object.keys(DEFAULTS);

/**
 * PATCH /api/admin/settings
 * body: any subset of the settings fields, e.g. { theme: 'dark', notifyEmail: false }
 */
export async function updateSettings(req, res) {
  const institutionId = req.user.institutionId;

  const data = {};
  for (const key of WRITABLE_KEYS) {
    if (req.body[key] !== undefined) data[key] = req.body[key];
  }
  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: 'No recognized settings fields in request body' });
  }

  try {
    await getOrCreateSettings(institutionId); // ensures a row exists to upsert against
    const settings = await prisma.institutionSettings.update({
      where: { institutionId },
      data,
    });

    await logAction(req, { action: 'Updated institution settings', module: 'Settings' });
    res.json({ settings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
}

/**
 * POST /api/admin/settings/change-password
 * body: { currentPassword, newPassword }
 */
export async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  const adminId = req.user.id;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword and newPassword are required' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'newPassword must be at least 8 characters' });
  }

  try {
    const admin = await prisma.admin.findUnique({ where: { id: adminId } });
    if (!admin || !(await bcrypt.compare(currentPassword, admin.passwordHash))) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await prisma.admin.update({ where: { id: adminId }, data: { passwordHash } });

    await logAction(req, { action: 'Changed account password', module: 'Settings' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to change password' });
  }
}

/**
 * POST /api/admin/settings/sign-out-all-devices
 * Bumps sessionsInvalidatedAt so every JWT issued before now is rejected by
 * requireAuth on the next request (see auth.middleware.js) — including the
 * one making this call, so the frontend should treat the response as a
 * forced logout.
 */
export async function signOutAllDevices(req, res) {
  try {
    await prisma.admin.update({
      where: { id: req.user.id },
      data: { sessionsInvalidatedAt: new Date() },
    });
    await logAction(req, { action: 'Signed out of all devices', module: 'Settings' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to sign out other devices' });
  }
}

/**
 * POST /api/admin/settings/export-institution-data
 * Builds a JSON snapshot of the institution's students, faculty, departments,
 * courses and notices, writes it to disk, and returns a download URL.
 * Synchronous — fine at campus scale; move to a background job if an
 * institution's data grows large enough for this to time out.
 */
export async function exportInstitutionData(req, res) {
  const institutionId = req.user.institutionId;

  try {
    const [institution, departments, courses, faculty, students, notices] = await Promise.all([
      prisma.institution.findUnique({ where: { id: institutionId } }),
      prisma.department.findMany({ where: { institutionId } }),
      prisma.course.findMany({ where: { institutionId } }),
      prisma.faculty.findMany({
        where: { institutionId },
        select: { id: true, name: true, email: true, designation: true, departmentId: true, status: true, joinedDate: true },
      }),
      prisma.student.findMany({
        where: { institutionId },
        select: { id: true, name: true, email: true, rollId: true, year: true, section: true, departmentId: true, courseId: true, status: true, enrolledDate: true },
      }),
      prisma.notice.findMany({ where: { institutionId } }),
    ]);

    const payload = {
      exportedAt: new Date().toISOString(),
      institution: { id: institution.id, name: institution.name, code: institution.code, status: institution.status },
      departments,
      courses,
      faculty,
      students,
      notices,
    };

    const dir = ensureUploadDir(`exports/${institutionId}`);
    const fileName = `institution-export-${Date.now()}.json`;
    const filePath = `${dir}/${fileName}`;
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));

    await logAction(req, { action: 'Requested institution data export', module: 'Settings' });
    res.json({ fileUrl: toPublicUrl(filePath), fileName });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to export institution data' });
  }
}
