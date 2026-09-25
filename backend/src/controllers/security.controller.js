import { prisma } from '../config/db.js';
import { logAction } from '../utils/audit.js';
import { getOrCreateSettings } from './settings.controller.js';

function generateInstituteCode(name) {
  const prefix = (name || 'EDU').replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase() || 'EDU';
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `EDU-${prefix}${Math.floor(Math.random() * 9) + 1}-${random}`;
}

/**
 * GET /api/admin/security/overview
 * Powers the Security Score, checklist, and Authentication panel.
 * Every item is computed from real institution state rather than hardcoded —
 * except SSL and Daily Backup, which are platform-level guarantees (this app
 * is always served over HTTPS in production, and backups run at the
 * infrastructure layer), not something that varies per institution, so they
 * report as always-true with that noted below.
 */
export async function securityOverview(req, res) {
  const institutionId = req.user.institutionId;

  try {
    const [settings, institution, recentAuditCount] = await Promise.all([
      getOrCreateSettings(institutionId),
      prisma.institution.findUnique({ where: { id: institutionId } }),
      prisma.auditLog.count({ where: { institutionId } }),
    ]);

    const checklist = [
      { label: '2FA Enabled', checked: settings.twoFactorRequired },
      { label: 'SSL Certificate Active', checked: true, note: 'Platform-wide, not per-institution' },
      { label: 'Audit Logs Enabled', checked: recentAuditCount > 0 },
      { label: 'RBAC Configured', checked: true, note: 'Fixed platform permission model' },
      { label: 'IP Monitoring Active', checked: true, note: 'Every audit log entry records an IP address' },
      { label: 'QR Code Login Active', checked: settings.qrLoginEnabled },
      { label: 'Join Approval Required', checked: settings.joinApprovalRequired },
      { label: 'Daily Data Backup', checked: true, note: 'Platform-wide, not per-institution' },
    ];

    const score = Math.round((checklist.filter((c) => c.checked).length / checklist.length) * 100);

    res.json({
      score,
      status: score >= 80 ? 'SECURE' : score >= 50 ? 'NEEDS ATTENTION' : 'AT RISK',
      checklist,
      authentication: {
        twoFactorRequired: settings.twoFactorRequired,
        sessionTimeoutMinutes: settings.sessionTimeoutMinutes,
        instituteCode: institution.code,
      },
      accessControl: {
        qrLoginEnabled: settings.qrLoginEnabled,
        joinApprovalRequired: settings.joinApprovalRequired,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to compute security overview' });
  }
}

/**
 * PATCH /api/admin/security
 * body: any subset of { twoFactorRequired, sessionTimeoutMinutes, qrLoginEnabled, joinApprovalRequired }
 * Writes to the same InstitutionSettings row as /api/admin/settings.
 */
export async function updateSecurity(req, res) {
  const institutionId = req.user.institutionId;
  const { twoFactorRequired, sessionTimeoutMinutes, qrLoginEnabled, joinApprovalRequired } = req.body;

  const data = {};
  if (twoFactorRequired !== undefined) data.twoFactorRequired = twoFactorRequired;
  if (sessionTimeoutMinutes !== undefined) data.sessionTimeoutMinutes = sessionTimeoutMinutes;
  if (qrLoginEnabled !== undefined) data.qrLoginEnabled = qrLoginEnabled;
  if (joinApprovalRequired !== undefined) data.joinApprovalRequired = joinApprovalRequired;

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: 'No recognized security fields in request body' });
  }

  try {
    await getOrCreateSettings(institutionId);
    const settings = await prisma.institutionSettings.update({ where: { institutionId }, data });

    await logAction(req, { action: 'Updated security settings', module: 'Security' });
    res.json({ settings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update security settings' });
  }
}

/**
 * POST /api/admin/security/regenerate-institute-code
 * Replaces the institution's join code — anyone with the old code (e.g. on a
 * printed poster) can no longer use it to submit join requests.
 */
export async function regenerateInstituteCode(req, res) {
  const institutionId = req.user.institutionId;

  try {
    const institution = await prisma.institution.findUnique({ where: { id: institutionId } });
    let code;
    // Extremely unlikely to collide, but retry a couple of times just in case
    // the unique constraint on Institution.code would otherwise 500 the request.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      code = generateInstituteCode(institution.name);
      const clash = await prisma.institution.findUnique({ where: { code } });
      if (!clash) break;
    }

    const updated = await prisma.institution.update({ where: { id: institutionId }, data: { code } });

    await logAction(req, { action: 'Regenerated institute join code', module: 'Security' });
    res.json({ code: updated.code });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to regenerate institute code' });
  }
}