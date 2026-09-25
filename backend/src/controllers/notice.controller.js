import { prisma } from '../config/db.js';
import { logAction } from '../utils/audit.js';

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'];

/**
 * GET /api/admin/notices?category=&priority=&audience=&active=true
 * Lists notices for the admin's institution, newest first.
 * - active=true filters to notices with no expiryDate or expiryDate in the future.
 */
export async function listNotices(req, res) {
  const institutionId = req.user.institutionId;
  const { category, priority, audience, active } = req.query;

  try {
    const where = { institutionId };
    if (category) where.category = category;
    if (priority) where.priority = String(priority).toUpperCase();
    if (audience) where.audience = audience;
    if (active === 'true') {
      where.OR = [{ expiryDate: null }, { expiryDate: { gte: new Date() } }];
    }

    const notices = await prisma.notice.findMany({
      where,
      orderBy: { publishDate: 'desc' },
      include: { admin: { select: { id: true, name: true } } },
    });

    res.json({ notices });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch notices' });
  }
}

/**
 * GET /api/admin/notices/:id
 */
export async function getNotice(req, res) {
  const { id } = req.params;
  const institutionId = req.user.institutionId;

  try {
    const notice = await prisma.notice.findFirst({
      where: { id, institutionId },
      include: { admin: { select: { id: true, name: true } } },
    });
    if (!notice) {
      return res.status(404).json({ error: 'Notice not found' });
    }
    res.json({ notice });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch notice' });
  }
}

/**
 * POST /api/admin/notices
 * body: { title, description, category, audience, priority?, expiryDate? }
 * priority defaults to MEDIUM. adminId is taken from the logged-in admin.
 */
export async function createNotice(req, res) {
  const institutionId = req.user.institutionId;
  const adminId = req.user.id;
  const { title, description, category, audience, priority, expiryDate } = req.body;

  if (!title || !description || !category || !audience) {
    return res.status(400).json({ error: 'title, description, category and audience are required' });
  }
  if (priority && !PRIORITIES.includes(String(priority).toUpperCase())) {
    return res.status(400).json({ error: `priority must be one of ${PRIORITIES.join(', ')}` });
  }

  try {
    const notice = await prisma.notice.create({
      data: {
        institutionId,
        adminId,
        title,
        description,
        category,
        audience,
        priority: priority ? String(priority).toUpperCase() : undefined,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
      },
      include: { admin: { select: { id: true, name: true } } },
    });

    await logAction(req, { action: `Published notice "${notice.title}" (${notice.audience})`, module: 'Notices' });

    res.status(201).json({ notice });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create notice' });
  }
}

/**
 * PATCH /api/admin/notices/:id
 * body: { title?, description?, category?, audience?, priority?, expiryDate? }
 * Pass expiryDate: null to clear an existing expiry.
 */
export async function updateNotice(req, res) {
  const { id } = req.params;
  const institutionId = req.user.institutionId;
  const { title, description, category, audience, priority, expiryDate } = req.body;

  if (priority && !PRIORITIES.includes(String(priority).toUpperCase())) {
    return res.status(400).json({ error: `priority must be one of ${PRIORITIES.join(', ')}` });
  }

  try {
    const existing = await prisma.notice.findFirst({ where: { id, institutionId } });
    if (!existing) {
      return res.status(404).json({ error: 'Notice not found' });
    }

    const notice = await prisma.notice.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(category !== undefined && { category }),
        ...(audience !== undefined && { audience }),
        ...(priority !== undefined && { priority: String(priority).toUpperCase() }),
        ...(expiryDate !== undefined && { expiryDate: expiryDate ? new Date(expiryDate) : null }),
      },
      include: { admin: { select: { id: true, name: true } } },
    });

    await logAction(req, { action: `Updated notice "${notice.title}"`, module: 'Notices' });

    res.json({ notice });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update notice' });
  }
}

/**
 * DELETE /api/admin/notices/:id
 */
export async function deleteNotice(req, res) {
  const { id } = req.params;
  const institutionId = req.user.institutionId;

  try {
    const existing = await prisma.notice.findFirst({ where: { id, institutionId } });
    if (!existing) {
      return res.status(404).json({ error: 'Notice not found' });
    }

    await prisma.notice.delete({ where: { id } });

    await logAction(req, { action: `Deleted notice "${existing.title}"`, module: 'Notices' });

    res.json({ message: 'Notice deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete notice' });
  }
}