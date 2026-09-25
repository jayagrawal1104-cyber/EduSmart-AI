import bcrypt from 'bcryptjs';
import { prisma } from '../config/db.js';
import { logAction } from '../utils/audit.js';

const SALT_ROUNDS = 10;

/**
 * GET /api/admin/join-requests?status=PENDING
 * Lists join requests for the admin's institution. `status` is optional
 * (PENDING | APPROVED | REJECTED); omit it to get all of them.
 */
export async function listJoinRequests(req, res) {
  const institutionId = req.user.institutionId;
  const { status } = req.query;

  try {
    const where = { institutionId };
    if (status) where.status = String(status).toUpperCase();

    const joinRequests = await prisma.joinRequest.findMany({
      where,
      orderBy: { requestedDate: 'desc' },
      // passwordHash intentionally excluded — it never needs to leave the server.
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        rollId: true,
        status: true,
        requestedDate: true,
        faceDescriptor: true,
        courseId: true,
        subjects: true,
      },
    });

    // Look up course names for any faculty requests that picked one, so the
    // admin UI can show "B.Tech CSE" instead of a bare id.
    const courseIds = [...new Set(joinRequests.map(jr => jr.courseId).filter(Boolean))];
    const courses = courseIds.length
      ? await prisma.course.findMany({ where: { id: { in: courseIds } }, select: { id: true, name: true } })
      : [];
    const courseNameById = Object.fromEntries(courses.map(c => [c.id, c.name]));

    // Never send the raw descriptor vector to the admin UI — just whether
    // Face ID was captured, so the admin can see at a glance if a student
    // will need to set it up manually after approval.
    res.json({
      joinRequests: joinRequests.map(({ faceDescriptor, courseId, subjects, ...jr }) => ({
        ...jr,
        faceEnrolled: !!faceDescriptor,
        courseId,
        courseName: courseId ? courseNameById[courseId] || null : null,
        subjects: subjects ? subjects.split(',').map(s => s.trim()).filter(Boolean) : [],
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch join requests' });
  }
}

/**
 * POST /api/admin/join-requests/:id/approve
 * body (student): { departmentId, courseId?, year?, section? } — courseId is
 *   optional here since students already pick their course on the join form
 *   (joinRequest.courseId); passing one in the body overrides that choice.
 * body (faculty): { departmentId, courseId?, designation? } — courseId is
 *   optional here since faculty already pick their course on the join form
 *   (joinRequest.courseId); passing one in the body overrides that choice.
 * body (admin): {} — no department/course needed, admins aren't department-scoped
 *
 * Creates the real Student/Faculty/Admin record using the password the person
 * chose when they submitted the join request, then marks it APPROVED.
 *
 * departmentId isn't collected on the join form, so the admin picks it here —
 * use GET /api/admin/departments and GET /api/admin/courses to populate that
 * (and, for students, the course) choice.
 */
export async function approveJoinRequest(req, res) {
  const { id } = req.params;
  const { departmentId, courseId, designation, year, section } = req.body;
  const institutionId = req.user.institutionId;

  try {
    const joinRequest = await prisma.joinRequest.findFirst({ where: { id, institutionId } });

    if (!joinRequest) {
      return res.status(404).json({ error: 'Join request not found' });
    }
    if (joinRequest.status !== 'PENDING') {
      return res.status(409).json({ error: `Join request is already ${joinRequest.status.toLowerCase()}` });
    }

    const role = (joinRequest.role || '').toLowerCase();

    // Resolve the department: prefer an explicit departmentId, otherwise try
    // to match the free-text department name the person typed on the form.
    // Admin accounts aren't scoped to a department, so this is skipped for them.
    let department = null;
    if (role !== 'admin') {
      if (departmentId) {
        department = await prisma.department.findFirst({ where: { id: departmentId, institutionId } });
      } else if (joinRequest.department) {
        department = await prisma.department.findFirst({
          where: { institutionId, name: joinRequest.department },
        });
      }
      if (!department) {
        return res.status(400).json({ error: 'A valid departmentId is required to approve this request' });
      }
    }

    let created;

    if (role === 'admin') {
      created = await prisma.admin.create({
        data: {
          institutionId,
          name: joinRequest.name,
          email: joinRequest.email,
          passwordHash: joinRequest.passwordHash,
        },
      });
    } else if (role === 'student') {
      // Course: prefer whatever the admin picks on the approval form
      // (courseId in the request body); fall back to the course the student
      // already chose for themselves on the join form (joinRequest.courseId)
      // — the normal case now that students pick a class up front. Either
      // way it must belong to this institution.
      const chosenCourseId = courseId || joinRequest.courseId;
      if (!chosenCourseId) {
        return res.status(400).json({ error: 'courseId is required to approve a student join request' });
      }
      const course = await prisma.course.findFirst({ where: { id: chosenCourseId, institutionId } });
      if (!course) {
        return res.status(400).json({ error: 'courseId is not valid for this institution' });
      }

      created = await prisma.student.create({
        data: {
          institutionId,
          departmentId: department.id,
          courseId: course.id,
          name: joinRequest.name,
          email: joinRequest.email,
          passwordHash: joinRequest.passwordHash,
          rollId: joinRequest.rollId,
          year: year ? Number(year) : 1,
          section: section || 'A',
          // Carry over the Face ID captured during the join form so Smart
          // Attendance recognizes this student immediately — no separate
          // enrollment step needed after approval.
          faceDescriptor: joinRequest.faceDescriptor || null,
          faceEnrolledAt: joinRequest.faceDescriptor ? new Date() : null,
        },
      });
    } else if (role === 'faculty') {
      // Course: prefer whatever the admin picks on the approval form
      // (courseId in the request body); fall back to the course the faculty
      // member chose for themselves on the join form (joinRequest.courseId).
      // Either way it must belong to this institution.
      let course = null;
      const chosenCourseId = courseId || joinRequest.courseId;
      if (chosenCourseId) {
        course = await prisma.course.findFirst({ where: { id: chosenCourseId, institutionId } });
        if (!course) {
          return res.status(400).json({ error: 'courseId is not valid for this institution' });
        }
      }

      // Subjects: free text the faculty member typed on the join form
      // ("Data Structures, Operating Systems, DBMS") — turned into real
      // Subject rows owned by this faculty member.
      const subjectNames = joinRequest.subjects
        ? joinRequest.subjects.split(',').map(s => s.trim()).filter(Boolean)
        : [];

      created = await prisma.faculty.create({
        data: {
          institutionId,
          departmentId: department.id,
          courseId: course ? course.id : null,
          name: joinRequest.name,
          email: joinRequest.email,
          passwordHash: joinRequest.passwordHash,
          designation: designation || null,
          subjects: subjectNames.length
            ? { create: subjectNames.map(name => ({ name })) }
            : undefined,
        },
        include: { subjects: true },
      });
    } else {
      return res.status(400).json({ error: `Unknown role "${joinRequest.role}" on join request` });
    }

    await prisma.joinRequest.update({
      where: { id: joinRequest.id },
      data: { status: 'APPROVED' },
    });

    const { passwordHash, ...safeCreated } = created;

    const roleLabel = role === 'student' ? 'Student' : role === 'faculty' ? 'Faculty' : 'Admin';

    await logAction(req, {
      action: `Approved ${roleLabel.toLowerCase()} join request for ${joinRequest.email}`,
      module: 'Join Requests',
    });

    res.json({
      message: `${roleLabel} account created and approved`,
      [role]: safeCreated,
    });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'An account with that email already exists in this institution' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to approve join request' });
  }
}

/**
 * POST /api/admin/join-requests/:id/reject
 */
export async function rejectJoinRequest(req, res) {
  const { id } = req.params;
  const institutionId = req.user.institutionId;

  try {
    const joinRequest = await prisma.joinRequest.findFirst({ where: { id, institutionId } });
    if (!joinRequest) {
      return res.status(404).json({ error: 'Join request not found' });
    }
    if (joinRequest.status !== 'PENDING') {
      return res.status(409).json({ error: `Join request is already ${joinRequest.status.toLowerCase()}` });
    }

    await prisma.joinRequest.update({
      where: { id: joinRequest.id },
      data: { status: 'REJECTED' },
    });

    await logAction(req, {
      action: `Rejected join request for ${joinRequest.email}`,
      module: 'Join Requests',
    });

    res.json({ message: 'Join request rejected' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to reject join request' });
  }
}

/**
 * GET /api/admin/departments
 * Lists departments with student/faculty/course counts, for the
 * Department Management page (and the approval-form picker).
 */
export async function listDepartments(req, res) {
  try {
    const departments = await prisma.department.findMany({
      where: { institutionId: req.user.institutionId },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { students: true, faculty: true, courses: true } },
      },
    });

    res.json({
      departments: departments.map(({ _count, ...d }) => ({
        ...d,
        studentCount: _count.students,
        facultyCount: _count.faculty,
        courseCount: _count.courses,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
}

/**
 * POST /api/admin/departments
 * body: { name, code }
 */
export async function createDepartment(req, res) {
  const institutionId = req.user.institutionId;
  const { name, code } = req.body;

  if (!name || !code) {
    return res.status(400).json({ error: 'name and code are required' });
  }

  try {
    const department = await prisma.department.create({
      data: { institutionId, name, code },
    });

    await logAction(req, { action: `Created department "${department.name}"`, module: 'Departments' });

    res.status(201).json({ department });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'A department with that code already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to create department' });
  }
}

/**
 * PATCH /api/admin/departments/:id
 * body: { name?, code? }
 */
export async function updateDepartment(req, res) {
  const { id } = req.params;
  const institutionId = req.user.institutionId;
  const { name, code } = req.body;

  try {
    const existing = await prisma.department.findFirst({ where: { id, institutionId } });
    if (!existing) {
      return res.status(404).json({ error: 'Department not found' });
    }

    const department = await prisma.department.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(code !== undefined && { code }),
      },
    });

    await logAction(req, { action: `Updated department "${department.name}"`, module: 'Departments' });

    res.json({ department });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'A department with that code already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to update department' });
  }
}

/**
 * DELETE /api/admin/departments/:id
 * Refuses to delete while students/faculty/courses are still assigned to it
 * (the schema cascades on delete, so this guard prevents an admin from
 * accidentally wiping out every student/faculty record in a department).
 * Pass ?force=true to delete anyway.
 */
export async function deleteDepartment(req, res) {
  const { id } = req.params;
  const institutionId = req.user.institutionId;
  const force = req.query.force === 'true';

  try {
    const existing = await prisma.department.findFirst({
      where: { id, institutionId },
      include: { _count: { select: { students: true, faculty: true, courses: true } } },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Department not found' });
    }

    const { students, faculty, courses } = existing._count;
    if (!force && (students > 0 || faculty > 0 || courses > 0)) {
      return res.status(409).json({
        error: `Department has ${students} student(s), ${faculty} faculty, and ${courses} course(s) assigned. Reassign or delete them first, or pass force=true to delete anyway.`,
        counts: { students, faculty, courses },
      });
    }

    await prisma.department.delete({ where: { id } });

    await logAction(req, { action: `Deleted department "${existing.name}"`, module: 'Departments' });

    res.json({ message: 'Department deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete department' });
  }
}

/**
 * GET /api/admin/courses?departmentId=...
 * Lists courses with student counts and department name.
 */
export async function listCourses(req, res) {
  try {
    const { departmentId } = req.query;
    const where = { institutionId: req.user.institutionId };
    if (departmentId) where.departmentId = departmentId;

    const courses = await prisma.course.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        department: { select: { name: true, code: true } },
        _count: { select: { students: true } },
      },
    });

    res.json({
      courses: courses.map(({ _count, ...c }) => ({
        ...c,
        studentCount: _count.students,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
}

/**
 * POST /api/admin/courses
 * body: { name, code, departmentId }
 */
export async function createCourse(req, res) {
  const institutionId = req.user.institutionId;
  const { name, code, departmentId } = req.body;

  if (!name || !code || !departmentId) {
    return res.status(400).json({ error: 'name, code and departmentId are required' });
  }

  try {
    const department = await prisma.department.findFirst({ where: { id: departmentId, institutionId } });
    if (!department) {
      return res.status(400).json({ error: 'departmentId is not valid for this institution' });
    }

    const course = await prisma.course.create({
      data: { institutionId, departmentId, name, code },
    });

    await logAction(req, { action: `Created course "${course.name}"`, module: 'Courses' });

    res.status(201).json({ course });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'A course with that code already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to create course' });
  }
}

/**
 * PATCH /api/admin/courses/:id
 * body: { name?, code?, departmentId? }
 */
export async function updateCourse(req, res) {
  const { id } = req.params;
  const institutionId = req.user.institutionId;
  const { name, code, departmentId } = req.body;

  try {
    const existing = await prisma.course.findFirst({ where: { id, institutionId } });
    if (!existing) {
      return res.status(404).json({ error: 'Course not found' });
    }

    if (departmentId) {
      const department = await prisma.department.findFirst({ where: { id: departmentId, institutionId } });
      if (!department) {
        return res.status(400).json({ error: 'departmentId is not valid for this institution' });
      }
    }

    const course = await prisma.course.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(code !== undefined && { code }),
        ...(departmentId !== undefined && { departmentId }),
      },
    });

    await logAction(req, { action: `Updated course "${course.name}"`, module: 'Courses' });

    res.json({ course });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'A course with that code already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to update course' });
  }
}

/**
 * DELETE /api/admin/courses/:id
 * Refuses to delete while students are still enrolled. Pass ?force=true to
 * delete anyway (this cascades and removes those students' course link).
 */
export async function deleteCourse(req, res) {
  const { id } = req.params;
  const institutionId = req.user.institutionId;
  const force = req.query.force === 'true';

  try {
    const existing = await prisma.course.findFirst({
      where: { id, institutionId },
      include: { _count: { select: { students: true } } },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Course not found' });
    }

    if (!force && existing._count.students > 0) {
      return res.status(409).json({
        error: `${existing._count.students} student(s) are enrolled in this course. Reassign them first, or pass force=true to delete anyway.`,
        counts: { students: existing._count.students },
      });
    }

    await prisma.course.delete({ where: { id } });

    await logAction(req, { action: `Deleted course "${existing.name}"`, module: 'Courses' });

    res.json({ message: 'Course deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete course' });
  }
}
/**
 * GET /api/admin/faculty?search=&departmentId=&status=
 * Lists faculty for the Faculty Management page. `classes` is the count of
 * timetable slots assigned (closest real proxy for "how many classes they
 * teach" — workload/engagement scores from the old mock UI aren't modeled
 * yet and need real attendance/performance data to compute honestly).
 */
export async function listFaculty(req, res) {
  const institutionId = req.user.institutionId;
  const { search, departmentId, courseId, status } = req.query;

  try {
    const where = { institutionId };
    if (departmentId) where.departmentId = departmentId;
    if (courseId) where.courseId = courseId;
    if (status) where.status = String(status).toUpperCase();
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
      ];
    }

    const faculty = await prisma.faculty.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        department: { select: { id: true, name: true, code: true } },
        course: { select: { id: true, name: true, code: true } },
        subjects: { select: { id: true, name: true } },
        _count: { select: { timetableSlots: true, assignments: true } },
      },
    });

    res.json({
      faculty: faculty.map(({ passwordHash, _count, ...f }) => ({
        ...f,
        classes: _count.timetableSlots,
        assignmentCount: _count.assignments,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch faculty' });
  }
}

/**
 * GET /api/admin/faculty/:id
 * Single faculty member with fuller detail, for a profile/detail view.
 */
export async function getFaculty(req, res) {
  const { id } = req.params;
  const institutionId = req.user.institutionId;

  try {
    const faculty = await prisma.faculty.findFirst({
      where: { id, institutionId },
      include: {
        department: { select: { id: true, name: true, code: true } },
        subjects: { select: { id: true, name: true } },
        timetableSlots: true,
        _count: { select: { assignments: true, lessonPlans: true, feedbackGiven: true } },
      },
    });
    if (!faculty) {
      return res.status(404).json({ error: 'Faculty not found' });
    }

    const { passwordHash, ...safe } = faculty;
    res.json({ faculty: safe });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch faculty member' });
  }
}

/**
 * POST /api/admin/faculty
 * body: { name, email, password, departmentId, designation?, subjects?: string[] }
 * Creates a faculty account directly (bypasses the join-request flow — for
 * when an admin wants to onboard someone themselves).
 */
export async function createFaculty(req, res) {
  const institutionId = req.user.institutionId;
  const { name, email, password, departmentId, designation, subjects } = req.body;

  if (!name || !email || !password || !departmentId) {
    return res.status(400).json({ error: 'name, email, password and departmentId are required' });
  }

  try {
    const department = await prisma.department.findFirst({ where: { id: departmentId, institutionId } });
    if (!department) {
      return res.status(400).json({ error: 'departmentId is not valid for this institution' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const faculty = await prisma.faculty.create({
      data: {
        institutionId,
        departmentId,
        name,
        email,
        passwordHash,
        designation: designation || null,
        subjects: subjects?.length ? { create: subjects.map((s) => ({ name: s })) } : undefined,
      },
      include: { department: { select: { id: true, name: true, code: true } }, subjects: true },
    });

    const { passwordHash: _omit, ...safe } = faculty;

    await logAction(req, { action: `Created faculty account for ${faculty.email}`, module: 'Faculty' });

    res.status(201).json({ faculty: safe });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'A faculty account with that email already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to create faculty' });
  }
}

/**
 * PATCH /api/admin/faculty/:id
 * body: { name?, email?, departmentId?, designation?, status?, subjects?: string[] }
 * Passing `subjects` replaces the full subject list (simplest correct
 * semantics for an editable tag list in the UI).
 */
export async function updateFaculty(req, res) {
  const { id } = req.params;
  const institutionId = req.user.institutionId;
  const { name, email, departmentId, designation, status, subjects } = req.body;

  try {
    const existing = await prisma.faculty.findFirst({ where: { id, institutionId } });
    if (!existing) {
      return res.status(404).json({ error: 'Faculty not found' });
    }

    if (departmentId) {
      const department = await prisma.department.findFirst({ where: { id: departmentId, institutionId } });
      if (!department) {
        return res.status(400).json({ error: 'departmentId is not valid for this institution' });
      }
    }
    if (status && !['ACTIVE', 'INACTIVE'].includes(String(status).toUpperCase())) {
      return res.status(400).json({ error: 'status must be ACTIVE or INACTIVE' });
    }

    if (subjects !== undefined) {
      await prisma.subject.deleteMany({ where: { facultyId: id } });
    }

    const faculty = await prisma.faculty.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email }),
        ...(departmentId !== undefined && { departmentId }),
        ...(designation !== undefined && { designation }),
        ...(status !== undefined && { status: String(status).toUpperCase() }),
        ...(subjects !== undefined && { subjects: { create: subjects.map((s) => ({ name: s })) } }),
      },
      include: { department: { select: { id: true, name: true, code: true } }, subjects: true },
    });

    const { passwordHash, ...safe } = faculty;

    await logAction(req, { action: `Updated faculty account for ${faculty.email}`, module: 'Faculty' });

    res.json({ faculty: safe });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'A faculty account with that email already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to update faculty' });
  }
}

/**
 * DELETE /api/admin/faculty/:id
 * Refuses to hard-delete a faculty member with assignments or timetable
 * slots still attached (deleting would cascade and wipe that history).
 * Prefer PATCH .../faculty/:id { status: 'INACTIVE' } for normal
 * offboarding; this is for genuine data cleanup. Pass ?force=true to
 * override.
 */
export async function deleteFaculty(req, res) {
  const { id } = req.params;
  const institutionId = req.user.institutionId;
  const force = req.query.force === 'true';

  try {
    const existing = await prisma.faculty.findFirst({
      where: { id, institutionId },
      include: { _count: { select: { assignments: true, timetableSlots: true } } },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Faculty not found' });
    }

    const { assignments, timetableSlots } = existing._count;
    if (!force && (assignments > 0 || timetableSlots > 0)) {
      return res.status(409).json({
        error: `This faculty member has ${assignments} assignment(s) and ${timetableSlots} timetable slot(s) on record. Consider setting status to INACTIVE instead, or pass force=true to delete anyway.`,
        counts: { assignments, timetableSlots },
      });
    }

    await prisma.faculty.delete({ where: { id } });

    await logAction(req, { action: `Deleted faculty account for ${existing.email}`, module: 'Faculty' });

    res.json({ message: 'Faculty deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete faculty' });
  }
}

/**
 * GET /api/admin/students?search=&departmentId=&courseId=&year=&status=
 * Lists students for the Student Management page. Note: `attendance`,
 * `performance` and `risk` from the old mock UI aren't modeled — those need
 * real Attendance/PerformanceRecord aggregation (a later analytics step),
 * so they're intentionally left out here rather than faked.
 */
export async function listStudents(req, res) {
  const institutionId = req.user.institutionId;
  const { search, departmentId, courseId, year, status } = req.query;

  try {
    const where = { institutionId };
    if (departmentId) where.departmentId = departmentId;
    if (courseId) where.courseId = courseId;
    if (year) where.year = Number(year);
    if (status) where.status = String(status).toUpperCase();
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { rollId: { contains: search } },
      ];
    }

    const students = await prisma.student.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        department: { select: { id: true, name: true, code: true } },
        course: { select: { id: true, name: true, code: true } },
      },
    });

    res.json({ students: students.map(({ passwordHash, ...s }) => s) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
}

/**
 * GET /api/admin/students/:id
 */
export async function getStudent(req, res) {
  const { id } = req.params;
  const institutionId = req.user.institutionId;

  try {
    const student = await prisma.student.findFirst({
      where: { id, institutionId },
      include: {
        department: { select: { id: true, name: true, code: true } },
        course: { select: { id: true, name: true, code: true } },
        _count: { select: { submissions: true, attendance: true, performanceRecords: true } },
      },
    });
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const { passwordHash, ...safe } = student;
    res.json({ student: safe });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch student' });
  }
}

/**
 * POST /api/admin/students
 * body: { name, email, password, departmentId, courseId, rollId?, year?, section? }
 * Creates a student account directly (bypasses the join-request flow).
 */
export async function createStudent(req, res) {
  const institutionId = req.user.institutionId;
  const { name, email, password, departmentId, courseId, rollId, year, section } = req.body;

  if (!name || !email || !password || !departmentId || !courseId) {
    return res.status(400).json({ error: 'name, email, password, departmentId and courseId are required' });
  }

  try {
    const department = await prisma.department.findFirst({ where: { id: departmentId, institutionId } });
    if (!department) {
      return res.status(400).json({ error: 'departmentId is not valid for this institution' });
    }
    const course = await prisma.course.findFirst({ where: { id: courseId, institutionId } });
    if (!course) {
      return res.status(400).json({ error: 'courseId is not valid for this institution' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const student = await prisma.student.create({
      data: {
        institutionId,
        departmentId,
        courseId,
        name,
        email,
        passwordHash,
        rollId: rollId || null,
        year: year ? Number(year) : 1,
        section: section || 'A',
      },
      include: {
        department: { select: { id: true, name: true, code: true } },
        course: { select: { id: true, name: true, code: true } },
      },
    });

    const { passwordHash: _omit, ...safe } = student;

    await logAction(req, { action: `Created student account for ${student.email}`, module: 'Students' });

    res.status(201).json({ student: safe });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'A student account with that email already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to create student' });
  }
}

/**
 * PATCH /api/admin/students/:id
 * body: { name?, email?, departmentId?, courseId?, rollId?, year?, section?, status?, password? }
 * Passing `password` resets it (hashed here) — this is the "Reset Password"
 * action from the UI; there's no separate reset-token flow.
 */
export async function updateStudent(req, res) {
  const { id } = req.params;
  const institutionId = req.user.institutionId;
  const { name, email, departmentId, courseId, rollId, year, section, status, password } = req.body;

  try {
    const existing = await prisma.student.findFirst({ where: { id, institutionId } });
    if (!existing) {
      return res.status(404).json({ error: 'Student not found' });
    }

    if (departmentId) {
      const department = await prisma.department.findFirst({ where: { id: departmentId, institutionId } });
      if (!department) {
        return res.status(400).json({ error: 'departmentId is not valid for this institution' });
      }
    }
    if (courseId) {
      const course = await prisma.course.findFirst({ where: { id: courseId, institutionId } });
      if (!course) {
        return res.status(400).json({ error: 'courseId is not valid for this institution' });
      }
    }
    if (status && !['ACTIVE', 'INACTIVE'].includes(String(status).toUpperCase())) {
      return res.status(400).json({ error: 'status must be ACTIVE or INACTIVE' });
    }

    const passwordHash = password ? await bcrypt.hash(password, SALT_ROUNDS) : undefined;

    const student = await prisma.student.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email }),
        ...(departmentId !== undefined && { departmentId }),
        ...(courseId !== undefined && { courseId }),
        ...(rollId !== undefined && { rollId }),
        ...(year !== undefined && { year: Number(year) }),
        ...(section !== undefined && { section }),
        ...(status !== undefined && { status: String(status).toUpperCase() }),
        ...(passwordHash !== undefined && { passwordHash }),
      },
      include: {
        department: { select: { id: true, name: true, code: true } },
        course: { select: { id: true, name: true, code: true } },
      },
    });

    const { passwordHash: _omit, ...safe } = student;

    await logAction(req, { action: `Updated student account for ${student.email}`, module: 'Students' });

    res.json({ student: safe });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'A student account with that email already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to update student' });
  }
}

/**
 * DELETE /api/admin/students/:id
 * Refuses to hard-delete a student with submissions, attendance, or
 * performance records on file (cascading delete would erase that history).
 * Prefer PATCH .../students/:id { status: 'INACTIVE' } for normal
 * offboarding; pass ?force=true to override.
 */
export async function deleteStudent(req, res) {
  const { id } = req.params;
  const institutionId = req.user.institutionId;
  const force = req.query.force === 'true';

  try {
    const existing = await prisma.student.findFirst({
      where: { id, institutionId },
      include: { _count: { select: { submissions: true, attendance: true, performanceRecords: true } } },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const { submissions, attendance, performanceRecords } = existing._count;
    if (!force && (submissions > 0 || attendance > 0 || performanceRecords > 0)) {
      return res.status(409).json({
        error: `This student has ${submissions} submission(s), ${attendance} attendance record(s), and ${performanceRecords} performance record(s) on file. Consider setting status to INACTIVE instead, or pass force=true to delete anyway.`,
        counts: { submissions, attendance, performanceRecords },
      });
    }

    await prisma.student.delete({ where: { id } });

    await logAction(req, { action: `Deleted student account for ${existing.email}`, module: 'Students' });

    res.json({ message: 'Student deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete student' });
  }
}

/**
 * GET /api/admin/audit-logs?module=&status=&from=&to=&page=&pageSize=
 * Lists audit log entries for the admin's institution, newest first.
 * - module: filter by section, e.g. "Students", "Faculty", "Departments"
 * - status: "Success" | "Failed"
 * - from/to: ISO date strings, filters on timestamp
 * - page/pageSize: pagination (defaults: page=1, pageSize=50, max pageSize=200)
 */
export async function listAuditLogs(req, res) {
  const institutionId = req.user.institutionId;
  const { module, status, from, to } = req.query;

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize, 10) || 50));

  try {
    const where = { institutionId };
    if (module) where.module = module;
    if (status) where.status = status;
    if (from || to) {
      where.timestamp = {};
      if (from) where.timestamp.gte = new Date(from);
      if (to) where.timestamp.lte = new Date(to);
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({ logs, total, page, pageSize });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
}