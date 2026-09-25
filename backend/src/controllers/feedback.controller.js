import { prisma } from '../config/db.js';
import { logAction } from '../utils/audit.js';

/**
 * Strips the student's identity from a feedback row when it was submitted
 * anonymously — otherwise the "Submit Anonymously" toggle on the student
 * side would be cosmetic only, since `student` is still attached for the
 * student's own "My Previous Feedback" list.
 */
function maskAnonymous(feedback) {
  if (!feedback.anonymous || !feedback.student) return feedback;
  return { ...feedback, student: null };
}

/**
 * GET /api/admin/feedback?studentId=&facultyId=&subject=&minRating=&from=&to=
 * Lists feedback for the admin's institution, newest first. Feedback rows
 * can come from a student or a faculty member (never both), so we scope by
 * either relation pointing at this institution.
 */
export async function listFeedback(req, res) {
  const institutionId = req.user.institutionId;
  const { studentId, facultyId, subject, minRating, from, to } = req.query;

  try {
    const where = {
      OR: [{ student: { institutionId } }, { faculty: { institutionId } }],
      ...(studentId && { studentId }),
      ...(facultyId && { facultyId }),
      ...(subject && { subject }),
      ...(minRating !== undefined && { rating: { gte: Number(minRating) } }),
    };
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const feedback = await prisma.feedback.findMany({
      where,
      include: {
        student: { select: { id: true, name: true, email: true } },
        faculty: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ feedback: feedback.map(maskAnonymous) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
}

/**
 * GET /api/admin/feedback/:id
 */
export async function getFeedback(req, res) {
  const { id } = req.params;
  const institutionId = req.user.institutionId;

  try {
    const feedback = await prisma.feedback.findFirst({
      where: { id, OR: [{ student: { institutionId } }, { faculty: { institutionId } }] },
      include: {
        student: { select: { id: true, name: true, email: true } },
        faculty: { select: { id: true, name: true, email: true } },
      },
    });
    if (!feedback) {
      return res.status(404).json({ error: 'Feedback not found' });
    }
    res.json({ feedback: maskAnonymous(feedback) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
}

/**
 * DELETE /api/admin/feedback/:id
 * The Feedback model has no status/reviewed field to update, so the only
 * meaningful admin mutation right now is removal (e.g. spam, duplicates).
 */
export async function deleteFeedback(req, res) {
  const { id } = req.params;
  const institutionId = req.user.institutionId;

  try {
    const existing = await prisma.feedback.findFirst({
      where: { id, OR: [{ student: { institutionId } }, { faculty: { institutionId } }] },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Feedback not found' });
    }

    await prisma.feedback.delete({ where: { id } });

    await logAction(req, { action: `Deleted feedback "${existing.subject}"`, module: 'Feedback' });

    res.json({ message: 'Feedback deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete feedback' });
  }
}