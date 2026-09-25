import './SmartTimetable.css';
import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Pencil, X, Loader2, Calendar, Users, AlertTriangle, Sparkles } from 'lucide-react';
import { Card, SectionHeader, Btn, Badge, EmptyState } from '../../components/ui/index';
import { timetableApi, adminApi, ApiError } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useNav } from '../../context/NavigationContext';

// Real per-course (class) timetable slots with server-side clash detection
// (same faculty double-booked, or same room double-booked at an overlapping
// time). The page is scoped to one class at a time — pick a course on the
// left and you get that class's whole weekly schedule across every subject
// and faculty member teaching it, not just one faculty member's own slots.
// This is a full add/edit/delete view over those slots — nothing here is
// mocked, everything round-trips through /api/admin/timetable.

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// Timetable grid only shows the working week — Monday through Friday.
const WEEKDAY_INDICES = [1, 2, 3, 4, 5];

const emptyForm = { facultyId: '', dayOfWeek: new Date().getDay(), startTime: '09:00', endTime: '10:00', subjectName: '', room: '', section: '', type: 'Lecture' };
const SESSION_TYPES = ['Lecture', 'Tutorial', 'Lab', 'Sports', 'Library'];
// Sports and Library periods aren't tied to a subject, so the Subject Name
// field is skipped for these — the type itself is used as the label.
const NO_SUBJECT_TYPES = ['Sports', 'Library'];
const TYPE_STYLES = {
  Lecture: { border: '#dbeafe', background: '#f0f7ff', text: '#2563eb' },
  Tutorial: { border: '#fde68a', background: '#fffbeb', text: '#b45309' },
  Lab: { border: '#e9d5ff', background: '#faf5ff', text: '#7c3aed' },
  Sports: { border: '#bbf7d0', background: '#f0fdf4', text: '#15803d' },
  Library: { border: '#fecdd3', background: '#fff1f2', text: '#be123c' },
};

export default function SmartTimetable() {
  const { token } = useAuth();
  const { navigate } = useNav();

  const [departments, setDepartments] = useState([]);
  const [departmentFilter, setDepartmentFilter] = useState('');

  // courseFilter is the class this page is currently building/viewing —
  // the whole point of the redesign: pick a class, see and edit its full
  // weekly timetable, instead of picking one faculty member at a time.
  const [courses, setCourses] = useState([]);
  const [courseFilter, setCourseFilter] = useState('');
  const [loadingCourses, setLoadingCourses] = useState(false);

  const [faculty, setFaculty] = useState([]);
  const [loadingFaculty, setLoadingFaculty] = useState(true);

  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [error, setError] = useState('');
  const [actingId, setActingId] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [editingSlot, setEditingSlot] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [formConflicts, setFormConflicts] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // ── Smart Generate (whole-course auto-scheduling) ──────────────────
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generateForm, setGenerateForm] = useState({
    days: [1, 2, 3, 4, 5],
    dayStart: '09:00',
    dayEnd: '16:00',
    periodMinutes: 60,
    classesPerSubjectPerWeek: 3,
    lunchEnabled: true,
    lunchStart: '13:00',
    lunchEnd: '14:00',
    roomsText: '',
    replaceExisting: true,
  });
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');
  const [generateResult, setGenerateResult] = useState(null); // { createdCount, unscheduled }

  async function refreshFacultyList() {
    const facData = await adminApi.listFaculty(token);
    setFaculty(facData.faculty || []);
  }

  // ── Load faculty + departments once ────────────────────────────────
  useEffect(() => {
    let ignore = false;
    async function load() {
      setLoadingFaculty(true);
      setError('');
      try {
        const [deptData, facData] = await Promise.all([
          adminApi.listDepartments(token),
          adminApi.listFaculty(token),
        ]);
        if (ignore) return;
        setDepartments(deptData.departments || []);
        setFaculty(facData.faculty || []);
      } catch (err) {
        if (!ignore) setError(err instanceof ApiError ? err.message : 'Failed to load faculty list');
      } finally {
        if (!ignore) setLoadingFaculty(false);
      }
    }
    load();
    return () => { ignore = true; };
  }, [token]);

  // ── Load courses for the picker, scoped to the selected department ──
  useEffect(() => {
    let ignore = false;
    async function loadCourses() {
      setLoadingCourses(true);
      try {
        const data = await adminApi.listCourses(token, departmentFilter || undefined);
        if (!ignore) setCourses(data.courses || []);
      } catch (err) {
        if (!ignore) setCourses([]);
      } finally {
        if (!ignore) setLoadingCourses(false);
      }
    }
    loadCourses();
    return () => { ignore = true; };
  }, [token, departmentFilter]);

  // Reset the course filter if it no longer belongs to the selected
  // department; otherwise default to the first course once courses load,
  // so the page opens straight onto a class instead of an empty state.
  useEffect(() => {
    if (courseFilter && !courses.some((c) => c.id === courseFilter)) {
      setCourseFilter('');
      return;
    }
    if (!courseFilter && courses.length > 0) {
      setCourseFilter(courses[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courses]);

  // ── Load this class's combined slots (every faculty teaching this
  // course) whenever the selected course changes ─────────────────────
  async function loadSlots(courseId) {
    if (!courseId) { setSlots([]); return; }
    setLoadingSlots(true);
    setError('');
    try {
      const data = await timetableApi.listTimetableSlots(token, { courseId });
      setSlots(data.slots || []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load timetable');
    } finally {
      setLoadingSlots(false);
    }
  }

  useEffect(() => {
    loadSlots(courseFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseFilter, token]);

  const selectedCourse = courses.find((c) => c.id === courseFilter) || null;

  // Faculty who actually belong to the selected course/class — this is who
  // can be picked when adding or editing a slot, and who shows up in the
  // "Faculty on this class" list.
  const courseFaculty = useMemo(
    () => faculty.filter((f) => f.courseId === courseFilter),
    [faculty, courseFilter]
  );

  // ── Modal helpers ────────────────────────────────────────────────
  // lockDayTime: true whenever the modal was opened from a specific grid
  // cell (editing an existing slot, or the "+" on an empty cell) — in
  // those cases the day/start/end are already decided by which cell was
  // clicked, so the modal shows them as read-only instead of asking again.
  // It's only false for the generic "Add Class" toolbar button, where no
  // cell was picked yet.
  const [lockDayTime, setLockDayTime] = useState(false);

  function openAddModal() {
    setEditingSlot(null);
    setForm(emptyForm);
    setFormError('');
    setFormConflicts([]);
    setLockDayTime(false);
    setShowModal(true);
  }

  // Pre-fill Add Slot with a specific empty grid cell's day/time — used by
  // the pencil icon on "No classes" cells, so admins can drop in a
  // remedial class or otherwise fill a gap without retyping the slot.
  function openAddModalForCell(dayIndex, startTime, endTime) {
    setEditingSlot(null);
    setForm({ ...emptyForm, dayOfWeek: dayIndex, startTime, endTime });
    setFormError('');
    setFormConflicts([]);
    setLockDayTime(true);
    setShowModal(true);
  }

  function openEditModal(slot) {
    setEditingSlot(slot);
    setForm({
      facultyId: slot.facultyId,
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      subjectName: slot.subjectName,
      room: slot.room || '',
      section: slot.section || '',
      type: slot.type || 'Lecture',
    });
    setFormError('');
    setFormConflicts([]);
    setLockDayTime(true);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingSlot(null);
    setFormError('');
    setFormConflicts([]);
  }

  const handleFormChange = (field, value) => {
    setForm((prev) => {
      if (field === 'type') {
        if (NO_SUBJECT_TYPES.includes(value)) {
          // Sports/Library don't ask for a subject name — use the type itself
          // so the (still-required) subjectName field is never left empty.
          return { ...prev, type: value, subjectName: value };
        }
        if (NO_SUBJECT_TYPES.includes(prev.type)) {
          // Switching back from Sports/Library to a real subject — clear the
          // auto-filled name so the field starts blank for typing.
          return { ...prev, type: value, subjectName: '' };
        }
      }
      return { ...prev, [field]: value };
    });
  };

  // ── Smart Generate helpers ──────────────────────────────────────
  function openGenerateModal() {
    setGenerateError('');
    setGenerateResult(null);
    setShowGenerateModal(true);
  }

  function closeGenerateModal() {
    setShowGenerateModal(false);
    setGenerateError('');
    setGenerateResult(null);
  }

  const toggleGenerateDay = (dayIndex) => {
    setGenerateForm((prev) => ({
      ...prev,
      days: prev.days.includes(dayIndex) ? prev.days.filter((d) => d !== dayIndex) : [...prev.days, dayIndex].sort(),
    }));
  };

  async function handleGenerate() {
    setGenerateError('');
    setGenerateResult(null);

    if (!courseFilter) {
      setGenerateError('Select a course from the picker on the left first — generation fills in every faculty member on that course.');
      return;
    }
    if (generateForm.days.length === 0) {
      setGenerateError('Pick at least one day of the week');
      return;
    }
    if (generateForm.dayStart >= generateForm.dayEnd) {
      setGenerateError('Day start must be before day end');
      return;
    }
    if (generateForm.lunchEnabled && generateForm.lunchStart >= generateForm.lunchEnd) {
      setGenerateError('Lunch start must be before lunch end');
      return;
    }

    const payload = {
      courseId: courseFilter,
      days: generateForm.days,
      dayStart: generateForm.dayStart,
      dayEnd: generateForm.dayEnd,
      periodMinutes: Number(generateForm.periodMinutes),
      classesPerSubjectPerWeek: Number(generateForm.classesPerSubjectPerWeek),
      ...(generateForm.lunchEnabled && { lunchStart: generateForm.lunchStart, lunchEnd: generateForm.lunchEnd }),
      rooms: generateForm.roomsText.split(',').map((r) => r.trim()).filter(Boolean),
      replaceExisting: generateForm.replaceExisting,
    };

    setGenerating(true);
    try {
      const data = await timetableApi.generateTimetable(token, payload);
      setGenerateResult({ createdCount: data.created?.length || 0, unscheduled: data.unscheduled || [] });
      await Promise.all([loadSlots(courseFilter), refreshFacultyList()]);
    } catch (err) {
      setGenerateError(err instanceof ApiError ? err.message : 'Failed to generate timetable');
    } finally {
      setGenerating(false);
    }
  }

  async function handleSubmit() {
    setFormError('');
    setFormConflicts([]);
    if (!form.facultyId) {
      setFormError('Pick which faculty member is teaching this period');
      return;
    }
    if (!form.subjectName.trim()) {
      setFormError('Subject name is required');
      return;
    }
    if (form.startTime >= form.endTime) {
      setFormError('Start time must be before end time');
      return;
    }

    const payload = {
      facultyId: form.facultyId,
      dayOfWeek: Number(form.dayOfWeek),
      startTime: form.startTime,
      endTime: form.endTime,
      subjectName: form.subjectName.trim(),
      room: form.room.trim() || undefined,
      section: form.section.trim() || undefined,
      type: form.type,
    };

    setSubmitting(true);
    try {
      if (editingSlot) {
        await timetableApi.updateTimetableSlot(token, editingSlot.id, payload);
      } else {
        await timetableApi.createTimetableSlot(token, payload);
      }
      closeModal();
      await loadSlots(courseFilter);
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
        setFormConflicts(err.data?.conflicts || []);
      } else {
        setFormError('Failed to save slot');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(slot) {
    if (!window.confirm(`Remove ${slot.subjectName} on ${DAYS[slot.dayOfWeek]}?`)) return;
    setActingId(slot.id);
    try {
      await timetableApi.deleteTimetableSlot(token, slot.id);
      await loadSlots(courseFilter);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete slot');
    } finally {
      setActingId(null);
    }
  }

  const slotsByDay = DAYS.map((label, dayIndex) => ({
    label,
    dayIndex,
    slots: slots.filter((s) => s.dayOfWeek === dayIndex).sort((a, b) => a.startTime.localeCompare(b.startTime)),
  }));

  const todayIndex = new Date().getDay();
  const totalThisWeek = slots.length;
  const busiestDay = slotsByDay.reduce((best, d) => (d.slots.length > (best?.slots.length || 0) ? d : best), null);

  // ── Shared time-row grid: a fixed row per period across the full working
  // day (dayStart → dayEnd from Smart Generate's settings), so the grid
  // always shows the complete day — including hours with no classes yet —
  // instead of only the periods that happen to have a slot already. The
  // lunch window (if enabled) is rendered as its own "break" row.
  const timeToMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const minToTime = (mins) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

  const gridRows = useMemo(() => {
    const rows = [];
    const startMin = timeToMin(generateForm.dayStart || '09:00');
    const endMin = timeToMin(generateForm.dayEnd || '16:00');
    const period = generateForm.periodMinutes || 60;
    const lunchStartMin = generateForm.lunchEnabled ? timeToMin(generateForm.lunchStart) : null;
    const lunchEndMin = generateForm.lunchEnabled ? timeToMin(generateForm.lunchEnd) : null;

    let cursor = startMin;
    while (cursor < endMin) {
      if (lunchStartMin !== null && cursor === lunchStartMin) {
        rows.push({ kind: 'break', startTime: minToTime(lunchStartMin), endTime: minToTime(lunchEndMin) });
        cursor = lunchEndMin;
        continue;
      }
      const cap = lunchStartMin !== null && cursor < lunchStartMin ? lunchStartMin : endMin;
      const rowEnd = Math.min(cursor + period, cap);
      rows.push({ kind: 'period', startTime: minToTime(cursor), endTime: minToTime(rowEnd) });
      cursor = rowEnd;
    }
    return rows;
  }, [generateForm.dayStart, generateForm.dayEnd, generateForm.periodMinutes, generateForm.lunchEnabled, generateForm.lunchStart, generateForm.lunchEnd]);

  return (
    <div className="smart-timetable-3">
      <div className="smart-timetable-4">
        <div>
          <h1 className="smart-timetable-6">Timetable</h1>
          <p className="smart-timetable-7">Faculty weekly schedule, with server-side clash detection</p>
        </div>
      </div>

      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#b91c1c', background: '#fef2f2',
          border: '1px solid #fecaca', borderRadius: '10px', padding: '0.6rem 0.9rem', marginBottom: '1rem', fontSize: '0.85rem',
        }}>
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      <div className="smart-timetable-8">
        {/* ── Class picker ───────────────────────────────────────── */}
        <div className="smart-timetable-9">
          <Card className="smart-timetable-10">
            <SectionHeader title="Class" />

            {loadingCourses && courses.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#94a3b8', fontSize: '0.85rem', padding: '0.5rem 0' }}>
                <Loader2 className="smart-timetable-15" /> Loading classes…
              </div>
            ) : courses.length === 0 ? (
              <EmptyState
                icon={<Users className="smart-timetable-16" />}
                title="No courses found"
                description="Add a course (class) to this institution before you can build its timetable."
                action={{ label: 'Add Course', onClick: () => navigate('admin/courses') }}
              />
            ) : (
              <>
                {departments.length > 0 && (
                  <select
                    value={departmentFilter}
                    onChange={(e) => setDepartmentFilter(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '0.6rem', fontSize: '0.85rem' }}
                  >
                    <option value="">All Departments</option>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                )}

                <select
                  value={courseFilter}
                  onChange={(e) => setCourseFilter(e.target.value)}
                  disabled={loadingCourses}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                >
                  {courses.length === 0 && <option value="">No matching courses</option>}
                  {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>

                {selectedCourse && (
                  <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: '#64748b' }}>
                    {selectedCourse.department?.name || 'No department'}
                    {selectedCourse.code ? ` · ${selectedCourse.code}` : ''}
                  </div>
                )}

                {courseFilter && courseFaculty.length === 0 && (
                  <div style={{ marginTop: '0.6rem', fontSize: '0.75rem', color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '0.5rem 0.6rem' }}>
                    No faculty assigned to this course yet — assign faculty before building its timetable.
                  </div>
                )}

                {courseFaculty.length > 0 && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', marginBottom: '0.35rem' }}>Faculty on this class</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      {courseFaculty.map((f) => (
                        <div key={f.id} style={{ fontSize: '0.78rem', color: '#334155', display: 'flex', justifyContent: 'space-between' }}>
                          <span>{f.name}</span>
                          <span style={{ color: '#94a3b8' }}>{f.subjects?.map((s) => s.name).join(', ') || 'No subjects'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <Btn
                    variant="primary"
                    size="md"
                    className="smart-timetable-14"
                    icon={<Plus className="smart-timetable-16" />}
                    onClick={openAddModal}
                    disabled={!courseFilter || courseFaculty.length === 0}
                  >
                    Add Slot
                  </Btn>
                  <Btn
                    variant="outline"
                    size="md"
                    icon={<Sparkles size={16} />}
                    onClick={openGenerateModal}
                    disabled={!courseFilter}
                    title={!courseFilter ? 'Select a class above to enable Smart Generate' : 'Auto-schedule this whole class'}
                  >
                    Smart Generate
                  </Btn>
                </div>
              </>
            )}
          </Card>

          {courseFilter && !loadingSlots && (
            <Card className="smart-timetable-17">
              <div className="smart-timetable-18">
                <Calendar className="smart-timetable-19" />
                <span className="smart-timetable-20">This week</span>
              </div>
              <div className="smart-timetable-21">
                <div className="smart-timetable-22">
                  <span>Total classes</span>
                  <span className="smart-timetable-23">{totalThisWeek}</span>
                </div>
                <div className="smart-timetable-22">
                  <span>Busiest day</span>
                  <span className="smart-timetable-23">{busiestDay && busiestDay.slots.length > 0 ? busiestDay.label : '—'}</span>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* ── Weekly grid ────────────────────────────────────────── */}
        <div className="smart-timetable-26">
          {loadingSlots ? (
            <Card>
              <div className="smart-timetable-28">
                <div className="smart-timetable-29">
                  <Calendar className="smart-timetable-30" />
                </div>
                <div className="smart-timetable-31">Loading timetable…</div>
                <div className="smart-timetable-32">Fetching this class's weekly schedule</div>
                <div className="smart-timetable-33">
                  <div className="smart-timetable-34" style={{ animationDelay: '0ms' }} />
                  <div className="smart-timetable-34" style={{ animationDelay: '120ms' }} />
                  <div className="smart-timetable-34" style={{ animationDelay: '240ms' }} />
                </div>
              </div>
            </Card>
          ) : !courseFilter ? (
            <Card>
              <EmptyState
                icon={<Calendar className="smart-timetable-16" />}
                title="Select a class"
                description="Choose a course from the list to view or build its weekly timetable."
              />
            </Card>
          ) : (
            <Card className="smart-timetable-35">
              <div className="smart-timetable-36">
                <table className="smart-timetable-37" style={{ borderCollapse: 'collapse', width: '100%' }}>
                  <thead className="smart-timetable-38">
                    <tr>
                      <th className="smart-timetable-40" style={{ minWidth: '90px', textAlign: 'left' }}>Time</th>
                      {WEEKDAY_INDICES.map((i) => (
                        <th
                          key={DAYS_SHORT[i]}
                          className="smart-timetable-40"
                          style={i === todayIndex ? { color: '#2563eb', background: '#eff6ff' } : undefined}
                        >
                          {DAYS_SHORT[i]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {gridRows.length === 0 ? (
                      <tr>
                        <td colSpan={WEEKDAY_INDICES.length + 1} style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                          No classes scheduled yet
                        </td>
                      </tr>
                    ) : (
                      gridRows.map((row, rowIdx) => (
                        <tr key={rowIdx} className="smart-timetable-41" style={{ borderTop: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.5rem 0.6rem', fontSize: '0.75rem', color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                            {row.startTime}–{row.endTime}
                          </td>
                          {WEEKDAY_INDICES.map((dayIndex, colPos) => {
                            const isLastCol = colPos === WEEKDAY_INDICES.length - 1;
                            if (row.kind === 'break') {
                              return (
                                <td
                                  key={dayIndex}
                                  style={{
                                    minWidth: '150px', padding: '0.5rem',
                                    borderRight: isLastCol ? 'none' : '1px solid #f1f5f9',
                                    background: '#f8fafc',
                                  }}
                                >
                                  <div style={{ borderRadius: '10px', background: '#f1f5f9', padding: '0.5rem 0.6rem', textAlign: 'center' }}>
                                    <div style={{ fontWeight: 600, fontSize: '0.78rem', color: '#64748b' }}>Lunch Break</div>
                                    <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Break</div>
                                  </div>
                                </td>
                              );
                            }

                            // A class can have more than one section meeting in
                            // parallel (different faculty, same day/time), so a
                            // cell shows every matching slot, not just one.
                            const cellSlots = slots.filter((s) => s.dayOfWeek === dayIndex && s.startTime === row.startTime && s.endTime === row.endTime);

                            return (
                              <td
                                key={dayIndex}
                                className="smart-timetable-44"
                                style={{
                                  minWidth: '150px', verticalAlign: 'top',
                                  borderRight: isLastCol ? 'none' : '1px solid #f1f5f9',
                                  background: dayIndex === todayIndex ? '#f8fbff' : undefined,
                                }}
                              >
                                {cellSlots.length === 0 ? (
                                  <div
                                    style={{
                                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem',
                                      fontSize: '0.75rem', color: '#94a3b8', padding: '0.4rem 0.25rem',
                                    }}
                                  >
                                    <span>No classes</span>
                                    <button
                                      title="Add class in this slot"
                                      onClick={() => openAddModalForCell(dayIndex, row.startTime, row.endTime)}
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '0.15rem', display: 'flex', flexShrink: 0 }}
                                      onMouseEnter={(e) => { e.currentTarget.style.color = '#2563eb'; }}
                                      onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; }}
                                    >
                                      <Pencil size={12} />
                                    </button>
                                  </div>
                                ) : (
                                  cellSlots.map((slot) => {
                                    const typeStyle = TYPE_STYLES[slot.type] || TYPE_STYLES.Lecture;
                                    const facultyName = faculty.find((f) => f.id === slot.facultyId)?.name || slot.faculty?.name;
                                    return (
                                      <div
                                        key={slot.id}
                                        onClick={() => openEditModal(slot)}
                                        style={{
                                          cursor: 'pointer', borderRadius: '10px', border: `1px solid ${typeStyle.border}`,
                                          background: typeStyle.background, padding: '0.5rem 0.6rem', position: 'relative', margin: '0.35rem',
                                        }}
                                      >
                                        <div style={{ fontWeight: 600, fontSize: '0.8rem', color: '#0f172a' }}>{slot.subjectName}</div>
                                        {facultyName && <div className="smart-timetable-45">{facultyName}</div>}
                                        {slot.room && <div className="smart-timetable-45">Room {slot.room}</div>}
                                        {slot.section && <div className="smart-timetable-46">Sec {slot.section}</div>}
                                        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: typeStyle.text, marginTop: '0.2rem' }}>{slot.type || 'Lecture'}</div>

                                        <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.4rem' }}>
                                          <button
                                            title="Edit"
                                            onClick={(e) => { e.stopPropagation(); openEditModal(slot); }}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 0 }}
                                          >
                                            <Pencil size={13} />
                                          </button>
                                          <button
                                            title="Remove"
                                            disabled={actingId === slot.id}
                                            onClick={(e) => { e.stopPropagation(); handleDelete(slot); }}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: 0 }}
                                          >
                                            <Trash2 size={13} />
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="smart-timetable-47">
                <span className="smart-timetable-48">{totalThisWeek} class{totalThisWeek === 1 ? '' : 'es'} scheduled</span>
                <span className="smart-timetable-49">
                  <span style={{ width: '8px', height: '8px', borderRadius: '999px', background: '#2563eb', display: 'inline-block' }} />
                  <span className="smart-timetable-50">Today: {DAYS[todayIndex]}</span>
                </span>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* ── Add / Edit Slot Modal ────────────────────────────────── */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', width: '420px', maxWidth: '90vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>{editingSlot ? 'Edit Timetable Slot' : 'Add Timetable Slot'}</h3>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            {selectedCourse && (
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.75rem' }}>
                For <strong style={{ color: '#0f172a' }}>{selectedCourse.name}</strong>
              </div>
            )}

            {formError && (
              <div style={{ color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '0.5rem 0.7rem', marginBottom: '0.75rem', fontSize: '0.82rem' }}>
                {formError}
                {formConflicts.length > 0 && (
                  <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.1rem' }}>
                    {formConflicts.map((c) => (
                      <li key={c.id}>
                        {c.subjectName ? `${c.subjectName} · ` : ''}{c.faculty} · {c.startTime}–{c.endTime}{c.room ? ` · Room ${c.room}` : ''}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Faculty</label>
                <select
                  value={form.facultyId}
                  onChange={(e) => handleFormChange('facultyId', e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                >
                  <option value="">Select faculty…</option>
                  {courseFaculty.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              {lockDayTime ? (
                // Day/time were already fixed by the grid cell that was
                // clicked — show them as read-only instead of asking again.
                // "Change slot" resets the lock so they become editable.
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.6rem 0.75rem' }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>When</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' }}>
                      {DAYS[form.dayOfWeek]} · {form.startTime}–{form.endTime}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLockDayTime(false)}
                    style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                  >
                    Change slot
                  </button>
                </div>
              ) : (
                <>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Day</label>
                    <select
                      value={form.dayOfWeek}
                      onChange={(e) => handleFormChange('dayOfWeek', e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                    >
                      {WEEKDAY_INDICES.map((i) => <option key={DAYS[i]} value={i}>{DAYS[i]}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Start Time</label>
                      <input type="time" value={form.startTime} onChange={(e) => handleFormChange('startTime', e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>End Time</label>
                      <input type="time" value={form.endTime} onChange={(e) => handleFormChange('endTime', e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                    </div>
                  </div>
                </>
              )}
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Type</label>
                <select
                  value={form.type}
                  onChange={(e) => handleFormChange('type', e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                >
                  {SESSION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              {!NO_SUBJECT_TYPES.includes(form.type) && (
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Subject Name</label>
                  <input
                    value={form.subjectName}
                    onChange={(e) => handleFormChange('subjectName', e.target.value)}
                    placeholder="e.g. Data Structures"
                    list="subject-suggestions"
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  />
                  <datalist id="subject-suggestions">
                    {(courseFaculty.find((f) => f.id === form.facultyId)?.subjects || []).map((s) => (
                      <option key={s.id} value={s.name} />
                    ))}
                  </datalist>
                </div>
              )}
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Room (optional)</label>
                  <input value={form.room} onChange={(e) => handleFormChange('room', e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Section (optional)</label>
                  <input value={form.section} onChange={(e) => handleFormChange('section', e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem' }}>
              {editingSlot ? (
                <button
                  onClick={() => { closeModal(); handleDelete(editingSlot); }}
                  style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '0.82rem', cursor: 'pointer', padding: 0 }}
                >
                  Delete slot
                </button>
              ) : <span />}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Btn variant="outline" onClick={closeModal} disabled={submitting}>Cancel</Btn>
                <Btn variant="primary" icon={<Calendar size={16} />} onClick={handleSubmit} disabled={submitting}>
                  {submitting ? 'Saving…' : editingSlot ? 'Save Changes' : 'Add Slot'}
                </Btn>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Smart Generate Modal ─────────────────────────────────── */}
      {showGenerateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', width: '460px', maxWidth: '90vw', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Sparkles size={18} style={{ color: '#7c3aed' }} /> Smart Generate
              </h3>
              <button onClick={closeGenerateModal} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.75rem' }}>
              Auto-schedules every faculty member and subject in{' '}
              <strong style={{ color: '#0f172a' }}>{courses.find((c) => c.id === courseFilter)?.name || 'the selected course'}</strong>{' '}
              across a weekly grid — no faculty or room is ever double-booked.
            </div>

            {generateError && (
              <div style={{ color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '0.5rem 0.7rem', marginBottom: '0.75rem', fontSize: '0.82rem' }}>
                {generateError}
              </div>
            )}

            {generateResult ? (
              <div>
                <div style={{ color: '#166534', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '0.6rem 0.8rem', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                  Created {generateResult.createdCount} slot{generateResult.createdCount === 1 ? '' : 's'}.
                </div>
                {generateResult.unscheduled.length > 0 && (
                  <div style={{ fontSize: '0.82rem' }}>
                    <div style={{ fontWeight: 600, color: '#b45309', marginBottom: '0.35rem' }}>
                      Couldn't fit {generateResult.unscheduled.length} session{generateResult.unscheduled.length === 1 ? '' : 's'} — the grid ran out of room:
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '1.1rem', color: '#64748b', maxHeight: '160px', overflowY: 'auto' }}>
                      {generateResult.unscheduled.map((u, i) => (
                        <li key={i}>{u.faculty} · {u.subjectName}</li>
                      ))}
                    </ul>
                    <div style={{ color: '#64748b', marginTop: '0.5rem' }}>
                      Widen the day range, add more days, or add rooms and try again.
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
                  <Btn variant="primary" onClick={closeGenerateModal}>Done</Btn>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Days</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.3rem' }}>
                      {DAYS_SHORT.map((label, i) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => toggleGenerateDay(i)}
                          style={{
                            padding: '0.3rem 0.6rem', borderRadius: '999px', fontSize: '0.78rem', cursor: 'pointer',
                            border: generateForm.days.includes(i) ? '1px solid #7c3aed' : '1px solid #e2e8f0',
                            background: generateForm.days.includes(i) ? '#f5f3ff' : 'white',
                            color: generateForm.days.includes(i) ? '#6d28d9' : '#64748b',
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Day starts</label>
                      <input
                        type="time"
                        value={generateForm.dayStart}
                        onChange={(e) => setGenerateForm((p) => ({ ...p, dayStart: e.target.value }))}
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Day ends</label>
                      <input
                        type="time"
                        value={generateForm.dayEnd}
                        onChange={(e) => setGenerateForm((p) => ({ ...p, dayEnd: e.target.value }))}
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Period length (min)</label>
                      <input
                        type="number"
                        min={15}
                        step={5}
                        value={generateForm.periodMinutes}
                        onChange={(e) => setGenerateForm((p) => ({ ...p, periodMinutes: e.target.value }))}
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Classes / subject / week</label>
                      <input
                        type="number"
                        min={1}
                        value={generateForm.classesPerSubjectPerWeek}
                        onChange={(e) => setGenerateForm((p) => ({ ...p, classesPerSubjectPerWeek: e.target.value }))}
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={generateForm.lunchEnabled}
                        onChange={(e) => setGenerateForm((p) => ({ ...p, lunchEnabled: e.target.checked }))}
                      />
                      Reserve a lunch break
                    </label>
                    {generateForm.lunchEnabled && (
                      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.4rem' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '0.75rem', color: '#64748b' }}>Lunch starts</label>
                          <input
                            type="time"
                            value={generateForm.lunchStart}
                            onChange={(e) => setGenerateForm((p) => ({ ...p, lunchStart: e.target.value }))}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '0.75rem', color: '#64748b' }}>Lunch ends</label>
                          <input
                            type="time"
                            value={generateForm.lunchEnd}
                            onChange={(e) => setGenerateForm((p) => ({ ...p, lunchEnd: e.target.value }))}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                          />
                        </div>
                      </div>
                    )}
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                      No period will be created that overlaps this window.
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Rooms (optional, comma-separated)</label>
                    <input
                      value={generateForm.roomsText}
                      onChange={(e) => setGenerateForm((p) => ({ ...p, roomsText: e.target.value }))}
                      placeholder="e.g. 101, 102, Lab A"
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                    />
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                      Leave blank to schedule without assigning rooms.
                    </div>
                  </div>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={generateForm.replaceExisting}
                      onChange={(e) => setGenerateForm((p) => ({ ...p, replaceExisting: e.target.checked }))}
                    />
                    Replace this course's existing timetable slots
                  </label>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
                  <Btn variant="outline" onClick={closeGenerateModal} disabled={generating}>Cancel</Btn>
                  <Btn variant="primary" icon={<Sparkles size={16} />} onClick={handleGenerate} disabled={generating}>
                    {generating ? 'Generating…' : 'Generate Timetable'}
                  </Btn>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}