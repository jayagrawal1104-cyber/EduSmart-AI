import { prisma } from '../config/db.js';
import { isValidDescriptor, matchDescriptors } from '../utils/faceMatch.js';

const MAX_FACES_PER_SCAN = 60;

/**
 * GET /api/student/face/status
 * Whether the signed-in student has set up Face ID yet.
 */
export async function getFaceStatus(req, res) {
  try {
    const student = await prisma.student.findUnique({
      where: { id: req.user.id },
      select: { faceEnrolledAt: true },
    });
    if (!student) return res.status(404).json({ error: 'Student not found' });
    res.json({ enrolled: !!student.faceEnrolledAt, enrolledAt: student.faceEnrolledAt });
  } catch (err) {
    console.error('Failed to load face status:', err);
    res.status(500).json({ error: 'Failed to load Face ID status' });
  }
}

/**
 * POST /api/student/face/enroll
 * body: { descriptor: number[128] }
 * The descriptor is computed entirely in the browser (face-api.js) from a
 * webcam capture — the backend only ever receives the numeric vector, never
 * the photo itself.
 */
export async function enrollFace(req, res) {
  const { descriptor } = req.body || {};
  if (!isValidDescriptor(descriptor)) {
    return res.status(400).json({ error: 'A valid 128-length face descriptor is required. Make sure exactly one face was in frame.' });
  }

  try {
    await prisma.student.update({
      where: { id: req.user.id },
      data: { faceDescriptor: JSON.stringify(descriptor), faceEnrolledAt: new Date() },
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to enroll face:', err);
    res.status(500).json({ error: 'Failed to save Face ID' });
  }
}

/**
 * DELETE /api/student/face/enroll
 * Lets a student clear their Face ID and re-enroll from scratch.
 */
export async function deleteFaceEnrollment(req, res) {
  try {
    await prisma.student.update({
      where: { id: req.user.id },
      data: { faceDescriptor: null, faceEnrolledAt: null },
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to clear face enrollment:', err);
    res.status(500).json({ error: 'Failed to remove Face ID' });
  }
}

/**
 * POST /api/faculty/attendance/face-recognize
 * body: { section: string, descriptors: number[][] }
 * descriptors are extracted client-side from a single camera frame (one
 * entry per face face-api.js detected). Matches each against the enrolled
 * students in that section (scoped to this faculty's institution) and
 * returns studentIds to mark PRESENT — students who aren't enrolled in
 * Face ID, or whose face wasn't matched, are left for the faculty to mark
 * manually, same as today.
 */
export async function recognizeFaces(req, res) {
  const { section, descriptors } = req.body || {};
  if (!section || !Array.isArray(descriptors) || descriptors.length === 0) {
    return res.status(400).json({ error: 'section and a non-empty descriptors array are required' });
  }
  if (descriptors.length > MAX_FACES_PER_SCAN) {
    return res.status(400).json({ error: `Too many faces in one scan (max ${MAX_FACES_PER_SCAN})` });
  }
  if (!descriptors.every(isValidDescriptor)) {
    return res.status(400).json({ error: 'Every descriptor must be a valid 128-length array' });
  }

  try {
    const enrolledStudents = await prisma.student.findMany({
      where: {
        institutionId: req.user.institutionId,
        section,
        faceDescriptor: { not: null },
      },
      select: { id: true, name: true, rollId: true, faceDescriptor: true },
    });

    const roster = enrolledStudents.map((s) => ({
      studentId: s.id,
      descriptor: JSON.parse(s.faceDescriptor),
    }));

    const { matches, unmatched } = matchDescriptors(descriptors, roster);
    const byId = new Map(enrolledStudents.map((s) => [s.id, s]));

    res.json({
      matched: matches.map((m) => ({
        studentId: m.studentId,
        name: byId.get(m.studentId)?.name,
        rollId: byId.get(m.studentId)?.rollId,
        distance: Number(m.distance.toFixed(3)),
      })),
      // Faces detected in frame that didn't match anyone in the section
      // confidently enough. distance is the closest enrolled face found,
      // purely so the UI can show a "how close" indicator — null if no
      // student in this section has Face ID enrolled at all.
      unmatched: unmatched.map((u) => ({
        distance: u.distance === null ? null : Number(u.distance.toFixed(3)),
      })),
      facesDetected: descriptors.length,
      enrolledInSection: roster.length,
    });
  } catch (err) {
    console.error('Face recognition failed:', err);
    res.status(500).json({ error: 'Failed to recognize faces' });
  }
}