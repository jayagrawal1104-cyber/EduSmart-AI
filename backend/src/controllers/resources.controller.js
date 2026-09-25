import fs from 'fs';
import path from 'path';
import { Parser as CsvParser } from 'json2csv';
import { prisma } from '../config/db.js';
import { logAction } from '../utils/audit.js';
import { toPublicUrl } from '../utils/fileStorage.js';

const STORAGE_QUOTA_BYTES = 50 * 1024 * 1024 * 1024; // 50 GB, matches the UI's "of 50 GB"

function serialize(r) {
  return {
    id: r.id,
    title: r.title,
    subject: r.subject,
    department: r.department?.name || null,
    departmentId: r.departmentId,
    uploadedBy: r.uploadedByLabel,
    date: r.createdAt,
    size: r.fileSizeBytes,
    downloads: r.downloads,
    type: r.type,
    status: r.status,
    fileUrl: r.fileUrl,
  };
}

/**
 * GET /api/admin/resources?type=&status=&departmentId=
 * Lists resources for the admin's institution. All filters optional.
 */
export async function listResources(req, res) {
  const institutionId = req.user.institutionId;
  const { type, status, departmentId } = req.query;

  try {
    const where = { institutionId };
    if (type) where.type = String(type).toUpperCase();
    if (status) where.status = String(status).toUpperCase();
    if (departmentId) where.departmentId = departmentId;

    const resources = await prisma.resource.findMany({
      where,
      include: { department: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ resources: resources.map(serialize) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch resources' });
  }
}

/**
 * GET /api/admin/resources/summary
 * Storage usage + storage-by-department + most-downloaded, for the
 * dashboard cards at the top of the Resources page.
 */
export async function resourcesSummary(req, res) {
  const institutionId = req.user.institutionId;

  try {
    const [totalCount, totalSizeAgg, byDept, topDownloaded, pendingCount] = await Promise.all([
      prisma.resource.count({ where: { institutionId, status: 'APPROVED' } }),
      prisma.resource.aggregate({ where: { institutionId }, _sum: { fileSizeBytes: true } }),
      prisma.resource.groupBy({
        by: ['departmentId'],
        where: { institutionId },
        _sum: { fileSizeBytes: true },
      }),
      prisma.resource.findMany({
        where: { institutionId, status: 'APPROVED' },
        orderBy: { downloads: 'desc' },
        take: 3,
        include: { department: { select: { name: true } } },
      }),
      prisma.resource.count({ where: { institutionId, status: 'PENDING' } }),
    ]);

    const departments = await prisma.department.findMany({
      where: { institutionId, id: { in: byDept.map((d) => d.departmentId) } },
      select: { id: true, name: true },
    });
    const deptNameById = Object.fromEntries(departments.map((d) => [d.id, d.name]));

    const usedBytes = totalSizeAgg._sum.fileSizeBytes || 0;

    res.json({
      totalResources: totalCount,
      pendingCount,
      usedBytes,
      quotaBytes: STORAGE_QUOTA_BYTES,
      usedPercent: Number(((usedBytes / STORAGE_QUOTA_BYTES) * 100).toFixed(1)),
      storageByDepartment: byDept.map((d) => ({
        department: deptNameById[d.departmentId] || 'Unknown',
        bytes: d._sum.fileSizeBytes || 0,
      })),
      topDownloaded: topDownloaded.map(serialize),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to compute resource summary' });
  }
}

/**
 * POST /api/admin/resources  (multipart/form-data, field name "file")
 * body fields: title, subject, departmentId, type
 * Admin-uploaded resources are auto-approved, matching the mock data where
 * "uploadedBy: 'Admin'" rows are already Approved.
 */
export async function uploadResource(req, res) {
  const institutionId = req.user.institutionId;
  const { title, subject, departmentId, type } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: 'A file is required (field name "file")' });
  }
  if (!title || !subject || !departmentId || !type) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: 'title, subject, departmentId and type are required' });
  }

  try {
    const department = await prisma.department.findFirst({ where: { id: departmentId, institutionId } });
    if (!department) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: 'departmentId is not valid for this institution' });
    }

    const resource = await prisma.resource.create({
      data: {
        institutionId,
        departmentId,
        title,
        subject,
        type: String(type).toUpperCase(),
        status: 'APPROVED',
        fileUrl: toPublicUrl(req.file.path),
        fileName: req.file.originalname,
        fileSizeBytes: req.file.size,
        uploadedByLabel: req.user.name || 'Admin',
        uploadedByRole: 'admin',
        uploadedByAdminId: req.user.id,
        reviewedAt: new Date(),
      },
      include: { department: { select: { name: true } } },
    });

    await logAction(req, { action: `Uploaded resource "${title}"`, module: 'Resources' });
    res.status(201).json({ resource: serialize(resource) });
  } catch (err) {
    console.error(err);
    fs.unlink(req.file.path, () => {});
    res.status(500).json({ error: 'Failed to upload resource' });
  }
}

/**
 * POST /api/admin/resources/:id/approve
 */
export async function approveResource(req, res) {
  const { id } = req.params;
  const institutionId = req.user.institutionId;

  try {
    const resource = await prisma.resource.findFirst({ where: { id, institutionId } });
    if (!resource) return res.status(404).json({ error: 'Resource not found' });

    const updated = await prisma.resource.update({
      where: { id },
      data: { status: 'APPROVED', reviewedAt: new Date() },
      include: { department: { select: { name: true } } },
    });

    await logAction(req, { action: `Approved resource "${resource.title}"`, module: 'Resources' });
    res.json({ resource: serialize(updated) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to approve resource' });
  }
}

/**
 * POST /api/admin/resources/:id/reject
 */
export async function rejectResource(req, res) {
  const { id } = req.params;
  const institutionId = req.user.institutionId;

  try {
    const resource = await prisma.resource.findFirst({ where: { id, institutionId } });
    if (!resource) return res.status(404).json({ error: 'Resource not found' });

    const updated = await prisma.resource.update({
      where: { id },
      data: { status: 'REJECTED', reviewedAt: new Date() },
      include: { department: { select: { name: true } } },
    });

    await logAction(req, { action: `Rejected resource "${resource.title}"`, module: 'Resources' });
    res.json({ resource: serialize(updated) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to reject resource' });
  }
}

/**
 * POST /api/admin/resources/:id/download
 * Increments the download counter (called when the admin/faculty/student
 * actually opens the fileUrl) and returns the current count.
 */
export async function registerDownload(req, res) {
  const { id } = req.params;
  const institutionId = req.user.institutionId;

  try {
    const resource = await prisma.resource.findFirst({ where: { id, institutionId } });
    if (!resource) return res.status(404).json({ error: 'Resource not found' });

    const updated = await prisma.resource.update({
      where: { id },
      data: { downloads: { increment: 1 } },
    });

    res.json({ downloads: updated.downloads });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to register download' });
  }
}

/**
 * DELETE /api/admin/resources/:id
 * Also deletes the underlying file from disk.
 */
export async function deleteResource(req, res) {
  const { id } = req.params;
  const institutionId = req.user.institutionId;

  try {
    const resource = await prisma.resource.findFirst({ where: { id, institutionId } });
    if (!resource) return res.status(404).json({ error: 'Resource not found' });

    await prisma.resource.delete({ where: { id } });

    // Best-effort: the DB row is the source of truth, so a failed unlink
    // (already-missing file, permissions, etc.) shouldn't fail the request.
    const absolutePath = path.join(process.cwd(), resource.fileUrl.replace(/^\//, ''));
    fs.unlink(absolutePath, () => {});

    await logAction(req, { action: `Deleted resource "${resource.title}"`, module: 'Resources' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete resource' });
  }
}

/**
 * DELETE /api/admin/resources  body: { ids: string[] }
 * Backs the "Delete Selected" bulk action.
 */
export async function bulkDeleteResources(req, res) {
  const institutionId = req.user.institutionId;
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids must be a non-empty array' });
  }

  try {
    const resources = await prisma.resource.findMany({ where: { id: { in: ids }, institutionId } });
    await prisma.resource.deleteMany({ where: { id: { in: resources.map((r) => r.id) }, institutionId } });

    for (const resource of resources) {
      const absolutePath = path.join(process.cwd(), resource.fileUrl.replace(/^\//, ''));
      fs.unlink(absolutePath, () => {});
    }

    await logAction(req, { action: `Deleted ${resources.length} resource(s) in bulk`, module: 'Resources' });
    res.json({ deleted: resources.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete resources' });
  }
}

/**
 * GET /api/admin/resources/export
 * Backs the "Export List" button — returns a CSV of the current resource
 * list (respects the same type/status/departmentId filters as listResources).
 */
export async function exportResourcesCsv(req, res) {
  const institutionId = req.user.institutionId;
  const { type, status, departmentId } = req.query;

  try {
    const where = { institutionId };
    if (type) where.type = String(type).toUpperCase();
    if (status) where.status = String(status).toUpperCase();
    if (departmentId) where.departmentId = departmentId;

    const resources = await prisma.resource.findMany({
      where,
      include: { department: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const rows = resources.map((r) => ({
      Title: r.title,
      Subject: r.subject,
      Department: r.department?.name || '',
      'Uploaded By': r.uploadedByLabel,
      Date: r.createdAt.toISOString().slice(0, 10),
      'Size (bytes)': r.fileSizeBytes,
      Downloads: r.downloads,
      Type: r.type,
      Status: r.status,
    }));

    const csv = new CsvParser().parse(rows);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="resources.csv"');
    res.send(csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to export resources' });
  }
}
