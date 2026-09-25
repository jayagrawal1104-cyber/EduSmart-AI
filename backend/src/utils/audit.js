import { prisma } from '../config/db.js';

/**
 * Writes one row to AuditLog. Call this after a mutation succeeds, right
 * before you send the response — awaited, but never lets a logging failure
 * take down the request (a mutation that succeeded should still return 200
 * even if the audit write itself fails; we just log the failure instead).
 *
 * @param {import('express').Request} req - needs req.user (from requireAuth)
 * @param {{ action: string, module?: string, status?: 'Success'|'Failed' }} entry
 *   action: short human-readable description, e.g. "Deleted faculty" or
 *           "Approved join request for jane@school.edu"
 *   module: the admin section it happened in, e.g. "Departments", "Faculty",
 *           "Students", "Courses", "Join Requests"
 */
export async function logAction(req, { action, module, status = 'Success' }) {
  const user = req.user;
  if (!user?.institutionId) return; // nothing to attribute this to

  try {
    await prisma.auditLog.create({
      data: {
        institutionId: user.institutionId,
        userLabel: user.name || user.email || user.id || 'Unknown',
        role: user.role || 'unknown',
        action,
        module: module || null,
        status,
        ipAddress: req.ip || null,
        device: req.headers['user-agent'] || null,
      },
    });
  } catch (err) {
    // Audit logging is best-effort — never throw out of here.
    console.error('Failed to write audit log:', err);
  }
}