import { prisma } from '../config/db.js';

const MAX_MESSAGE_LENGTH = 4000;
const MAX_HISTORY_MESSAGES = 12;
const GEMINI_TIMEOUT_MS = 30000;

function cleanMessage(value) {
  return typeof value === 'string' ? value.trim().slice(0, MAX_MESSAGE_LENGTH) : '';
}

function safeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history.slice(-MAX_HISTORY_MESSAGES).map((item) => {
    const text = cleanMessage(item?.content);
    if (!text) return null;
    return { role: item.role === 'assistant' ? 'model' : 'user', parts: [{ text }] };
  }).filter(Boolean);
}

/** GET /api/student/ai/courses — subjects are read from the student's timetable. */
export async function getCourses(req, res) {
  try {
    const student = await prisma.student.findUnique({
      where: { id: req.user.id },
      include: { course: true, department: true },
    });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const slots = await prisma.timetableSlot.findMany({
      where: { section: student.section, faculty: { institutionId: student.institutionId } },
      include: { faculty: { select: { name: true } } },
      orderBy: { subjectName: 'asc' },
    });
    const bySubject = new Map();
    for (const slot of slots) {
      if (!bySubject.has(slot.subjectName)) {
        bySubject.set(slot.subjectName, { id: slot.subjectName, name: slot.subjectName, faculty: slot.faculty.name });
      }
    }

    res.json({
      student: { course: student.course.name, department: student.department.name, year: student.year, section: student.section },
      courses: Array.from(bySubject.values()),
    });
  } catch (err) {
    console.error('Failed to load AI study subjects:', err);
    res.status(500).json({ error: 'Failed to load your enrolled subjects' });
  }
}

/** POST /api/student/ai/chat — Gemini key stays on the server. */
export async function chat(req, res) {
  const message = cleanMessage(req.body?.message);
  const subject = cleanMessage(req.body?.subject);
  if (!message) return res.status(400).json({ error: 'A message is required' });
  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({ error: 'The AI assistant is not configured yet. Ask an administrator to add GEMINI_API_KEY to the backend environment.' });
  }

  try {
    const student = await prisma.student.findUnique({
      where: { id: req.user.id },
      include: { course: true, department: true },
    });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const subjects = await prisma.timetableSlot.findMany({
      where: { section: student.section, faculty: { institutionId: student.institutionId } },
      distinct: ['subjectName'],
      select: { subjectName: true },
    });
    const enrolledSubjects = subjects.map((item) => item.subjectName);
    const selectedSubject = subject && enrolledSubjects.includes(subject) ? subject : null;
    const context = [
      `Student programme: ${student.course.name}.`,
      `Department: ${student.department.name}; year ${student.year}; section ${student.section}.`,
      selectedSubject ? `Selected subject: ${selectedSubject}.` : 'No subject is selected.',
      enrolledSubjects.length ? `Enrolled timetable subjects: ${enrolledSubjects.join(', ')}.` : '',
    ].filter(Boolean).join(' ');

    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), GEMINI_TIMEOUT_MS);
    let response;
    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(process.env.GEMINI_MODEL || 'gemini-2.0-flash')}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
          signal: abortController.signal,
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: `You are EduSmart, a concise, supportive study assistant. Use this verified portal context: ${context} Help with learning, revision, examples, and practice questions. Do not claim you accessed lectures, uploaded files, grades, or sources unless they appear in the context. State uncertainty clearly.` }] },
            contents: [...safeHistory(req.body?.history), { role: 'user', parts: [{ text: message }] }],
            generationConfig: { temperature: 0.4, maxOutputTokens: 1200 },
          }),
        }
      );
    } finally {
      clearTimeout(timeout);
    }

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      console.error('Gemini request failed:', response.status, payload?.error?.message || 'unknown error');
      return res.status(502).json({ error: 'The AI assistant could not answer right now. Please try again.' });
    }
    const reply = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim();
    if (!reply) return res.status(502).json({ error: 'The AI assistant returned an empty response. Please try again.' });

    res.json({ reply, subject: selectedSubject, model: process.env.GEMINI_MODEL || 'gemini-2.0-flash' });
  } catch (err) {
    if (err.name === 'AbortError') return res.status(504).json({ error: 'The AI assistant took too long to respond. Please try again.' });
    console.error('AI chat failed:', err);
    res.status(500).json({ error: 'Failed to send message to the AI assistant' });
  }
}
