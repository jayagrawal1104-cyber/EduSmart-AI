import { prisma } from '../config/db.js';
import { logAction } from '../utils/audit.js';

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/; // "HH:MM", 24-hour

function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Confirms the faculty member belongs to the calling admin's institution.
 * Returns the faculty row (with departmentId) or null.
 */
async function getFacultyInInstitution(facultyId, institutionId) {
  return prisma.faculty.findFirst({ where: { id: facultyId, institutionId } });
}

/**
 * Checks a proposed slot against three kinds of clash: this faculty
 * member's own existing slots (same day, overlapping time), any other
 * faculty member's slots in the same room at an overlapping time (a real
 * scheduling bug, not just a faculty-side conflict), and — when courseId
 * is given — any other slot already on this same class at an overlapping
 * time with the same section (or no section on either side), since a
 * class can't be in two lectures at once unless they're genuinely
 * different sections meeting in parallel. Excludes `excludeId` so updates
 * can compare against everything except themselves.
 */
async function findConflicts({ facultyId, courseId, section, dayOfWeek, startTime, endTime, room, excludeId }) {
  const startMin = timeToMinutes(startTime);
  const endMin = timeToMinutes(endTime);
  const sectionValue = section || null;

  const candidates = await prisma.timetableSlot.findMany({
    where: {
      dayOfWeek,
      ...(excludeId && { id: { not: excludeId } }),
      OR: [
        { facultyId },
        ...(room ? [{ room }] : []),
        ...(courseId ? [{ faculty: { courseId }, section: sectionValue }] : []),
      ],
    },
    include: { faculty: { select: { id: true, name: true } } },
  });

  return candidates.filter((slot) =>
    rangesOverlap(startMin, endMin, timeToMinutes(slot.startTime), timeToMinutes(slot.endTime))
  );
}

/**
 * GET /api/admin/timetable?facultyId=&departmentId=&courseId=&dayOfWeek=
 * Lists timetable slots for the admin's institution. `dayOfWeek` is 0-6
 * (0=Sunday). Sorted by day, then start time. `courseId` returns the
 * combined weekly timetable for that whole class — every slot taught by
 * any faculty member belonging to that course, not just one faculty
 * member's own slots — which is how the admin Timetable page now builds
 * a class's schedule.
 */
export async function listTimetableSlots(req, res) {
  const institutionId = req.user.institutionId;
  const { facultyId, departmentId, courseId, dayOfWeek } = req.query;

  try {
    const where = {
      faculty: {
        institutionId,
        ...(departmentId && { departmentId }),
        ...(courseId && { courseId }),
      },
      ...(facultyId && { facultyId }),
      ...(dayOfWeek !== undefined && { dayOfWeek: Number(dayOfWeek) }),
    };

    const slots = await prisma.timetableSlot.findMany({
      where,
      include: { faculty: { select: { id: true, name: true, departmentId: true } } },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

    res.json({ slots });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch timetable slots' });
  }
}

/**
 * GET /api/admin/timetable/:id
 */
export async function getTimetableSlot(req, res) {
  const { id } = req.params;
  const institutionId = req.user.institutionId;

  try {
    const slot = await prisma.timetableSlot.findFirst({
      where: { id, faculty: { institutionId } },
      include: { faculty: { select: { id: true, name: true, departmentId: true } } },
    });
    if (!slot) {
      return res.status(404).json({ error: 'Timetable slot not found' });
    }
    res.json({ slot });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch timetable slot' });
  }
}

/**
 * POST /api/admin/timetable
 * body: { facultyId, dayOfWeek (0-6), startTime ("HH:MM"), endTime ("HH:MM"),
 *         subjectName, room?, section?, type? ("Lecture" | "Tutorial" | "Lab") }
 * Rejects overlapping slots for the same faculty member, and — when a room
 * is given — overlapping slots for anyone else already booked in that room.
 */
const SESSION_TYPES = ['Lecture', 'Tutorial', 'Lab', 'Sports', 'Library'];

export async function createTimetableSlot(req, res) {
  const institutionId = req.user.institutionId;
  const { facultyId, dayOfWeek, startTime, endTime, subjectName, room, section, type } = req.body;

  if (facultyId === undefined || dayOfWeek === undefined || !startTime || !endTime || !subjectName) {
    return res.status(400).json({ error: 'facultyId, dayOfWeek, startTime, endTime and subjectName are required' });
  }
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    return res.status(400).json({ error: 'dayOfWeek must be an integer 0-6 (0=Sunday)' });
  }
  if (!TIME_RE.test(startTime) || !TIME_RE.test(endTime)) {
    return res.status(400).json({ error: 'startTime and endTime must be in "HH:MM" 24-hour format' });
  }
  if (timeToMinutes(startTime) >= timeToMinutes(endTime)) {
    return res.status(400).json({ error: 'startTime must be before endTime' });
  }
  if (type !== undefined && !SESSION_TYPES.includes(type)) {
    return res.status(400).json({ error: `type must be one of ${SESSION_TYPES.join(', ')}` });
  }

  try {
    const faculty = await getFacultyInInstitution(facultyId, institutionId);
    if (!faculty) {
      return res.status(404).json({ error: 'Faculty not found' });
    }

    const conflicts = await findConflicts({ facultyId, courseId: faculty.courseId, section, dayOfWeek, startTime, endTime, room });
    if (conflicts.length) {
      return res.status(409).json({
        error: 'This slot conflicts with an existing timetable entry',
        conflicts: conflicts.map((c) => ({
          id: c.id,
          faculty: c.faculty.name,
          subjectName: c.subjectName,
          startTime: c.startTime,
          endTime: c.endTime,
          room: c.room,
        })),
      });
    }

    const slot = await prisma.timetableSlot.create({
      data: { facultyId, dayOfWeek, startTime, endTime, subjectName, room, section, type: type || 'Lecture' },
      include: { faculty: { select: { id: true, name: true, departmentId: true } } },
    });

    await logAction(req, {
      action: `Scheduled "${slot.subjectName}" for ${faculty.name} (day ${dayOfWeek}, ${startTime}-${endTime})`,
      module: 'Timetable',
    });

    res.status(201).json({ slot });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create timetable slot' });
  }
}

/**
 * PATCH /api/admin/timetable/:id
 * body: any of { facultyId, dayOfWeek, startTime, endTime, subjectName, room, section, type }
 * Re-checks conflicts using the merged (existing + provided) values.
 */
export async function updateTimetableSlot(req, res) {
  const { id } = req.params;
  const institutionId = req.user.institutionId;
  const { facultyId, dayOfWeek, startTime, endTime, subjectName, room, section, type } = req.body;

  if (dayOfWeek !== undefined && (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6)) {
    return res.status(400).json({ error: 'dayOfWeek must be an integer 0-6 (0=Sunday)' });
  }
  if (startTime !== undefined && !TIME_RE.test(startTime)) {
    return res.status(400).json({ error: 'startTime must be in "HH:MM" 24-hour format' });
  }
  if (endTime !== undefined && !TIME_RE.test(endTime)) {
    return res.status(400).json({ error: 'endTime must be in "HH:MM" 24-hour format' });
  }
  if (type !== undefined && !SESSION_TYPES.includes(type)) {
    return res.status(400).json({ error: `type must be one of ${SESSION_TYPES.join(', ')}` });
  }

  try {
    const existing = await prisma.timetableSlot.findFirst({ where: { id, faculty: { institutionId } } });
    if (!existing) {
      return res.status(404).json({ error: 'Timetable slot not found' });
    }

    const mergedFacultyId = facultyId !== undefined ? facultyId : existing.facultyId;
    const faculty = await getFacultyInInstitution(mergedFacultyId, institutionId);
    if (!faculty) {
      return res.status(404).json({ error: 'Faculty not found' });
    }

    const merged = {
      facultyId: mergedFacultyId,
      courseId: faculty.courseId,
      section: section !== undefined ? section : existing.section,
      dayOfWeek: dayOfWeek !== undefined ? dayOfWeek : existing.dayOfWeek,
      startTime: startTime !== undefined ? startTime : existing.startTime,
      endTime: endTime !== undefined ? endTime : existing.endTime,
      room: room !== undefined ? room : existing.room,
    };

    if (timeToMinutes(merged.startTime) >= timeToMinutes(merged.endTime)) {
      return res.status(400).json({ error: 'startTime must be before endTime' });
    }

    const conflicts = await findConflicts({ ...merged, excludeId: id });
    if (conflicts.length) {
      return res.status(409).json({
        error: 'This slot conflicts with an existing timetable entry',
        conflicts: conflicts.map((c) => ({
          id: c.id,
          faculty: c.faculty.name,
          subjectName: c.subjectName,
          startTime: c.startTime,
          endTime: c.endTime,
          room: c.room,
        })),
      });
    }

    const slot = await prisma.timetableSlot.update({
      where: { id },
      data: {
        ...(facultyId !== undefined && { facultyId }),
        ...(dayOfWeek !== undefined && { dayOfWeek }),
        ...(startTime !== undefined && { startTime }),
        ...(endTime !== undefined && { endTime }),
        ...(subjectName !== undefined && { subjectName }),
        ...(room !== undefined && { room }),
        ...(section !== undefined && { section }),
        ...(type !== undefined && { type }),
      },
      include: { faculty: { select: { id: true, name: true, departmentId: true } } },
    });

    await logAction(req, { action: `Updated timetable slot "${slot.subjectName}" for ${slot.faculty.name}`, module: 'Timetable' });

    res.json({ slot });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update timetable slot' });
  }
}

/**
 * POST /api/admin/timetable/generate
 * body: {
 *   courseId: string,                 // required — generate for every faculty in this course
 *   days?: number[],                  // 0=Sun..6=Sat, default Mon-Fri [1,2,3,4,5]
 *   dayStart?: "HH:MM",               // default "09:00"
 *   dayEnd?: "HH:MM",                 // default "16:00"
 *   periodMinutes?: number,           // length of one class, default 60
 *   classesPerSubjectPerWeek?: number,// how many sessions to place per subject, default 3
 *   lunchStart?: "HH:MM",             // optional — no periods are created inside [lunchStart, lunchEnd)
 *   lunchEnd?: "HH:MM",
 *   rooms?: string[],                 // pool of rooms to assign, cycled round-robin
 *   replaceExisting?: boolean,        // wipe this course's faculty's existing slots first, default true
 * }
 *
 * Places every (faculty, subject) session onto a day/period grid, checking
 * against both the slots it has already placed in this run AND (when
 * replaceExisting is false) whatever is already in the database — so
 * faculty and rooms are never double-booked, and nothing is scheduled
 * through the lunch window. For each session it picks the day the faculty
 * member is currently least loaded on (spreading classes across the whole
 * week instead of filling one day first), and avoids repeating the same
 * subject twice in one day for that faculty when another day still has
 * room. Nothing here balances load beyond that or honors per-subject hour
 * targets. Sessions that genuinely have nowhere left to go (grid full) are
 * reported back instead of silently dropped.
 */
export async function generateTimetable(req, res) {
  const institutionId = req.user.institutionId;
  const {
    courseId,
    days = [1, 2, 3, 4, 5],
    dayStart = '09:00',
    dayEnd = '16:00',
    periodMinutes = 60,
    classesPerSubjectPerWeek = 3,
    lunchStart,
    lunchEnd,
    rooms = [],
    replaceExisting = true,
  } = req.body;

  if (!courseId) {
    return res.status(400).json({ error: 'courseId is required' });
  }
  if (!Array.isArray(days) || days.length === 0 || days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
    return res.status(400).json({ error: 'days must be a non-empty array of integers 0-6' });
  }
  if (!TIME_RE.test(dayStart) || !TIME_RE.test(dayEnd) || timeToMinutes(dayStart) >= timeToMinutes(dayEnd)) {
    return res.status(400).json({ error: 'dayStart/dayEnd must be valid "HH:MM" times with dayStart before dayEnd' });
  }
  if (!Number.isInteger(periodMinutes) || periodMinutes < 15) {
    return res.status(400).json({ error: 'periodMinutes must be an integer >= 15' });
  }
  if (!Number.isInteger(classesPerSubjectPerWeek) || classesPerSubjectPerWeek < 1) {
    return res.status(400).json({ error: 'classesPerSubjectPerWeek must be a positive integer' });
  }
  const hasLunch = lunchStart !== undefined && lunchStart !== null && lunchStart !== '';
  if (hasLunch) {
    if (!TIME_RE.test(lunchStart) || !TIME_RE.test(lunchEnd) || timeToMinutes(lunchStart) >= timeToMinutes(lunchEnd)) {
      return res.status(400).json({ error: 'lunchStart/lunchEnd must be valid "HH:MM" times with lunchStart before lunchEnd' });
    }
  }

  try {
    const course = await prisma.course.findFirst({ where: { id: courseId, institutionId } });
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const faculty = await prisma.faculty.findMany({
      where: { institutionId, courseId },
      include: { subjects: true },
    });
    if (faculty.length === 0) {
      return res.status(400).json({ error: 'No faculty are assigned to this course yet' });
    }

    // ── Build the periods grid, skipping anything that overlaps lunch ──
    const lunchStartMin = hasLunch ? timeToMinutes(lunchStart) : null;
    const lunchEndMin = hasLunch ? timeToMinutes(lunchEnd) : null;
    const periods = [];
    for (let t = timeToMinutes(dayStart); t + periodMinutes <= timeToMinutes(dayEnd); t += periodMinutes) {
      const periodEnd = t + periodMinutes;
      if (hasLunch && rangesOverlap(t, periodEnd, lunchStartMin, lunchEndMin)) continue;
      periods.push({ startMin: t, endMin: periodEnd });
    }
    if (periods.length === 0) {
      return res.status(400).json({ error: 'No periods fit between dayStart and dayEnd (after excluding lunch) at that period length' });
    }
    const minutesToTime = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

    const facultyIds = faculty.map((f) => f.id);

    if (replaceExisting) {
      await prisma.timetableSlot.deleteMany({ where: { facultyId: { in: facultyIds } } });
    }

    // ── Occupancy trackers, seeded with anything already on the grid ──
    const facultyBusy = new Set(); // `${facultyId}|${day}|${startMin}`
    const roomBusy = new Set(); // `${room}|${day}|${startMin}`
    // Smart Generate treats the whole course as one class (no parallel
    // sections), so it also has to track when the CLASS itself already has
    // a session at a day/period — otherwise two different faculty members
    // on the same course can each independently land a subject in the same
    // slot, which shows up as two simultaneous lectures for one class.
    const classBusy = new Set(); // `${day}|${startMin}`
    const facultyDayCount = new Map(); // `${facultyId}|${day}` -> sessions placed so far, for load-spreading
    const facultySubjectDay = new Set(); // `${facultyId}|${subjectName}|${day}` -> avoid repeating a subject same day

    if (!replaceExisting) {
      const existing = await prisma.timetableSlot.findMany({
        where: { OR: [{ facultyId: { in: facultyIds } }, ...(rooms.length ? [{ room: { in: rooms } }] : [])] },
      });
      for (const slot of existing) {
        const startMin = timeToMinutes(slot.startTime);
        facultyBusy.add(`${slot.facultyId}|${slot.dayOfWeek}|${startMin}`);
        if (slot.room) roomBusy.add(`${slot.room}|${slot.dayOfWeek}|${startMin}`);
        if (facultyIds.includes(slot.facultyId)) {
          facultyDayCount.set(`${slot.facultyId}|${slot.dayOfWeek}`, (facultyDayCount.get(`${slot.facultyId}|${slot.dayOfWeek}`) || 0) + 1);
          facultySubjectDay.add(`${slot.facultyId}|${slot.subjectName}|${slot.dayOfWeek}`);
          if (!slot.section) classBusy.add(`${slot.dayOfWeek}|${startMin}`);
        }
      }
    }

    // ── Flatten into one session per required class ──────────────────
    const sessions = [];
    for (const f of faculty) {
      for (const subject of f.subjects) {
        for (let i = 0; i < classesPerSubjectPerWeek; i++) {
          sessions.push({ facultyId: f.id, facultyName: f.name, subjectName: subject.name });
        }
      }
    }
    // Faculty with the most sessions go first — the tightest-to-place
    // sessions get first pick of the grid instead of getting squeezed out.
    const sessionsPerFaculty = new Map();
    for (const s of sessions) sessionsPerFaculty.set(s.facultyId, (sessionsPerFaculty.get(s.facultyId) || 0) + 1);
    sessions.sort((a, b) => sessionsPerFaculty.get(b.facultyId) - sessionsPerFaculty.get(a.facultyId));

    const toCreate = [];
    const unscheduled = [];
    let roomCursor = 0;

    /**
     * Tries to place `session` on the day this faculty member currently has
     * the fewest sessions on (ties broken by day order), so classes spread
     * across the whole week instead of stacking onto the first day. When
     * `avoidSameSubjectSameDay` is true, a day already holding this same
     * subject for this faculty is skipped in favor of another day.
     */
    function tryPlace(session, avoidSameSubjectSameDay) {
      const orderedDays = [...days].sort((a, b) => {
        const la = facultyDayCount.get(`${session.facultyId}|${a}`) || 0;
        const lb = facultyDayCount.get(`${session.facultyId}|${b}`) || 0;
        if (la !== lb) return la - lb;
        return a - b;
      });

      for (const day of orderedDays) {
        if (avoidSameSubjectSameDay && facultySubjectDay.has(`${session.facultyId}|${session.subjectName}|${day}`)) continue;

        for (const period of periods) {
          const facultyKey = `${session.facultyId}|${day}|${period.startMin}`;
          if (facultyBusy.has(facultyKey)) continue;
          const classKey = `${day}|${period.startMin}`;
          if (classBusy.has(classKey)) continue;

          let room = null;
          if (rooms.length > 0) {
            // Try each room once, starting from the round-robin cursor, so
            // load spreads across the pool instead of stacking one room.
            let foundRoom = null;
            for (let i = 0; i < rooms.length; i++) {
              const candidate = rooms[(roomCursor + i) % rooms.length];
              if (!roomBusy.has(`${candidate}|${day}|${period.startMin}`)) {
                foundRoom = candidate;
                roomCursor = (roomCursor + i + 1) % rooms.length;
                break;
              }
            }
            if (!foundRoom) continue; // every room taken at this day/period — try the next slot
            room = foundRoom;
          }

          facultyBusy.add(facultyKey);
          if (room) roomBusy.add(`${room}|${day}|${period.startMin}`);
          classBusy.add(classKey);
          facultyDayCount.set(`${session.facultyId}|${day}`, (facultyDayCount.get(`${session.facultyId}|${day}`) || 0) + 1);
          facultySubjectDay.add(`${session.facultyId}|${session.subjectName}|${day}`);
          toCreate.push({
            facultyId: session.facultyId,
            dayOfWeek: day,
            startTime: minutesToTime(period.startMin),
            endTime: minutesToTime(period.endMin),
            subjectName: session.subjectName,
            room,
            type: 'Lecture',
          });
          return true;
        }
      }
      return false;
    }

    for (const session of sessions) {
      // First pass: spread across days and don't repeat the subject same day.
      // Second pass (only if the first found nowhere free): allow repeats
      // rather than leaving the session unscheduled.
      const placed = tryPlace(session, true) || tryPlace(session, false);
      if (!placed) {
        unscheduled.push({ faculty: session.facultyName, subjectName: session.subjectName });
      }
    }

    const created = await prisma.$transaction(
      toCreate.map((data) => prisma.timetableSlot.create({ data, include: { faculty: { select: { id: true, name: true, departmentId: true } } } }))
    );

    await logAction(req, {
      action: `Auto-generated timetable for "${course.name}" — ${created.length} slot(s) created${unscheduled.length ? `, ${unscheduled.length} unscheduled` : ''}`,
      module: 'Timetable',
    });

    res.status(201).json({ created, unscheduled });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate timetable' });
  }
}

/**
 * DELETE /api/admin/timetable/:id
 */
export async function deleteTimetableSlot(req, res) {
  const { id } = req.params;
  const institutionId = req.user.institutionId;

  try {
    const existing = await prisma.timetableSlot.findFirst({
      where: { id, faculty: { institutionId } },
      include: { faculty: { select: { name: true } } },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Timetable slot not found' });
    }

    await prisma.timetableSlot.delete({ where: { id } });

    await logAction(req, {
      action: `Removed timetable slot "${existing.subjectName}" for ${existing.faculty.name}`,
      module: 'Timetable',
    });

    res.json({ message: 'Timetable slot deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete timetable slot' });
  }
}