import './StudentManagement.css';
import { useEffect, useState } from 'react';
import { Search, Eye, Edit, KeyRound, Ban, UserCheck, ChevronLeft, ChevronRight, Loader2, Plus, X } from 'lucide-react';
import { StatusBadge, Table, Btn, Select, Input, Card } from '../../components/ui/index';
import { Users } from 'lucide-react';
import { adminApi, ApiError } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

const yearOptions = [
  { value: '', label: 'All Years' },
  { value: '1', label: 'Year 1' },
  { value: '2', label: 'Year 2' },
  { value: '3', label: 'Year 3' },
  { value: '4', label: 'Year 4' },
];

// Schema only has ACTIVE/INACTIVE — there's no separate SUSPENDED state, so
// "Suspend" (below) just sets INACTIVE, same as Faculty's deactivate.
const statusOptions = [
  { value: '', label: 'All Status' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

const PAGE_SIZE = 10;

function initials(name) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function titleCase(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

const emptyForm = { name: '', email: '', password: '', departmentId: '', courseId: '', rollId: '', year: '1', section: 'A' };

export default function StudentManagement() {
  const { token } = useAuth();

  const [students, setStudents] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [dept, setDept] = useState('');
  const [year, setYear] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const [selected, setSelected] = useState([]);
  const [actingId, setActingId] = useState(null);

  const [viewing, setViewing] = useState(null);
  const [viewDetail, setViewDetail] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState(emptyForm);
  const [addCourses, setAddCourses] = useState([]);
  const [addError, setAddError] = useState('');
  const [addSubmitting, setAddSubmitting] = useState(false);

  const [editing, setEditing] = useState(null); // student being edited, or null
  const [editForm, setEditForm] = useState(emptyForm);
  const [editCourses, setEditCourses] = useState([]);
  const [editError, setEditError] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [resetting, setResetting] = useState(null); // student having password reset, or null
  const [resetPassword, setResetPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSubmitting, setResetSubmitting] = useState(false);

  async function loadStudents() {
    setLoading(true);
    setError('');
    try {
      const data = await adminApi.listStudents(token, { departmentId: dept, year, status });
      setStudents(data.students || []);
      setPage(1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load students');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, dept, year, status]);

  useEffect(() => {
    async function loadDepartments() {
      try {
        const data = await adminApi.listDepartments(token);
        setDepartments(data.departments || []);
      } catch {
        // Non-fatal — filter/picker just stays empty.
      }
    }
    loadDepartments();
  }, [token]);

  const departmentOptions = [
    { value: '', label: 'All Departments' },
    ...departments.map(d => ({ value: d.id, label: d.name })),
  ];

  const filtered = students.filter(s => {
    if (search && !s.name.toLowerCase().includes(search.toLowerCase()) && !(s.rollId || '').toLowerCase().includes(search.toLowerCase()) && !s.id.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageStudents = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function toggleSelect(id) {
    setSelected(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  }

  async function openView(s) {
    setViewing(s.id);
    setViewDetail(null);
    setViewLoading(true);
    try {
      const data = await adminApi.getStudent(token, s.id);
      setViewDetail(data.student);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load student details');
      setViewing(null);
    } finally {
      setViewLoading(false);
    }
  }

  async function toggleStatus(s) {
    setActingId(s.id);
    try {
      const nextStatus = s.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await adminApi.updateStudent(token, s.id, { status: nextStatus });
      setStudents(prev => prev.map(x => (x.id === s.id ? { ...x, status: nextStatus } : x)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update student status');
    } finally {
      setActingId(null);
    }
  }

  async function suspendSelected() {
    for (const id of selected) {
      const s = students.find(x => x.id === id);
      if (s && s.status === 'ACTIVE') {
        // eslint-disable-next-line no-await-in-loop
        await toggleStatus(s);
      }
    }
    setSelected([]);
  }

  function openAddModal() {
    setAddForm(emptyForm);
    setAddCourses([]);
    setAddError('');
    setShowAddModal(true);
  }

  async function onAddDeptChange(departmentId) {
    setAddForm(f => ({ ...f, departmentId, courseId: '' }));
    if (!departmentId) {
      setAddCourses([]);
      return;
    }
    try {
      const data = await adminApi.listCourses(token, departmentId);
      setAddCourses(data.courses || []);
    } catch {
      setAddCourses([]);
    }
  }

  async function submitAdd(e) {
    e.preventDefault();
    setAddError('');

    if (!addForm.name || !addForm.email || !addForm.password || !addForm.departmentId || !addForm.courseId) {
      setAddError('Name, email, password, department and course are required');
      return;
    }

    setAddSubmitting(true);
    try {
      await adminApi.createStudent(token, {
        name: addForm.name,
        email: addForm.email,
        password: addForm.password,
        departmentId: addForm.departmentId,
        courseId: addForm.courseId,
        rollId: addForm.rollId || undefined,
        year: addForm.year,
        section: addForm.section,
      });
      setShowAddModal(false);
      await loadStudents();
    } catch (err) {
      setAddError(err instanceof ApiError ? err.message : 'Failed to create student account');
    } finally {
      setAddSubmitting(false);
    }
  }

  async function openEdit(s) {
    setEditError('');
    setEditForm({
      name: s.name,
      email: s.email,
      password: '',
      departmentId: s.departmentId,
      courseId: s.courseId,
      rollId: s.rollId || '',
      year: String(s.year),
      section: s.section,
    });
    setEditing(s);
    try {
      const data = await adminApi.listCourses(token, s.departmentId);
      setEditCourses(data.courses || []);
    } catch {
      setEditCourses([]);
    }
  }

  async function onEditDeptChange(departmentId) {
    setEditForm(f => ({ ...f, departmentId, courseId: '' }));
    if (!departmentId) {
      setEditCourses([]);
      return;
    }
    try {
      const data = await adminApi.listCourses(token, departmentId);
      setEditCourses(data.courses || []);
    } catch {
      setEditCourses([]);
    }
  }

  async function submitEdit(e) {
    e.preventDefault();
    if (!editing) return;
    setEditError('');

    if (!editForm.name || !editForm.email || !editForm.departmentId || !editForm.courseId) {
      setEditError('Name, email, department and course are required');
      return;
    }

    setEditSubmitting(true);
    try {
      await adminApi.updateStudent(token, editing.id, {
        name: editForm.name,
        email: editForm.email,
        departmentId: editForm.departmentId,
        courseId: editForm.courseId,
        rollId: editForm.rollId || undefined,
        year: editForm.year,
        section: editForm.section,
      });
      setEditing(null);
      await loadStudents();
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : 'Failed to update student');
    } finally {
      setEditSubmitting(false);
    }
  }

  function openReset(s) {
    setResetting(s);
    setResetPassword('');
    setResetError('');
  }

  async function submitReset(e) {
    e.preventDefault();
    if (!resetting) return;
    if (!resetPassword || resetPassword.length < 6) {
      setResetError('Password must be at least 6 characters');
      return;
    }
    setResetSubmitting(true);
    setResetError('');
    try {
      await adminApi.updateStudent(token, resetting.id, { password: resetPassword });
      setResetting(null);
    } catch (err) {
      setResetError(err instanceof ApiError ? err.message : 'Failed to reset password');
    } finally {
      setResetSubmitting(false);
    }
  }

  return <div className="student-management-1">
      {/* Header */}
      <div className="student-management-2">
        <div>
          <h1 className="student-management-3">Student Management</h1>
          <p className="student-management-4">{students.length} student{students.length === 1 ? '' : 's'} enrolled{dept ? ' in this department' : ' across all departments'}</p>
        </div>
        <div className="student-management-5">
          <Btn variant="primary" size="sm" icon={<Plus className="student-management-6" />} onClick={openAddModal}>Add Student</Btn>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2 mb-5">
          {error}
        </div>
      )}

      {/* Filters */}
      <Card className="student-management-7">
        <div className="student-management-8">
          <div className="student-management-9">
            <Input placeholder="Search by name or roll ID..." value={search} onChange={setSearch} icon={<Search className="student-management-6" />} />
          </div>
          <div className="student-management-10">
            <Select options={departmentOptions} value={dept} onChange={setDept} />
          </div>
          <div className="student-management-11">
            <Select options={yearOptions} value={year} onChange={setYear} />
          </div>
          <div className="student-management-11">
            <Select options={statusOptions} value={status} onChange={setStatus} />
          </div>
        </div>
      </Card>

      {/* Bulk actions bar */}
      {selected.length > 0 && <div className="student-management-13">
          <span className="student-management-14">{selected.length} selected</span>
          <div className="student-management-15">
            <Btn variant="danger" size="sm" onClick={suspendSelected}>Suspend Selected</Btn>
          </div>
        </div>}

      {/* Table */}
      <Card>
        <div className="student-management-16">
          <span className="student-management-17">
            Showing {pageStudents.length} of {filtered.length} students
          </span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
            <p className="text-sm text-slate-400">Loading students…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <Users className="w-8 h-8 text-slate-300" />
            <h3 className="text-sm font-semibold text-slate-600">No students found</h3>
            <p className="text-xs text-slate-400">Try a different search or filter</p>
          </div>
        ) : (
          <Table headers={['', 'Roll ID', 'Name', 'Department', 'Course', 'Year/Sec', 'Status', 'Actions']}>
            {pageStudents.map(student => <tr key={student.id} className="student-management-19">
                <td className="student-management-20">
                  <input type="checkbox" checked={selected.includes(student.id)} onChange={() => toggleSelect(student.id)} className="student-management-21" />
                </td>
                <td className="student-management-22">{student.rollId || '—'}</td>
                <td className="student-management-20">
                  <div className="student-management-23">
                    <div className="student-management-24">
                      {initials(student.name)}
                    </div>
                    <div>
                      <div className="student-management-25">{student.name}</div>
                      <div className="student-management-18">{student.email}</div>
                    </div>
                  </div>
                </td>
                <td className="student-management-26">{student.department?.name || '—'}</td>
                <td className="student-management-27">{student.course?.name || '—'}</td>
                <td className="student-management-26">Yr {student.year} / {student.section}</td>
                <td className="student-management-20">
                  <StatusBadge status={titleCase(student.status)} />
                </td>
                <td className="student-management-20">
                  <div className="student-management-28">
                    <button className="student-management-29" title="View" onClick={() => openView(student)}>
                      <Eye className="student-management-6" />
                    </button>
                    <button className="student-management-30" title="Edit" onClick={() => openEdit(student)}>
                      <Edit className="student-management-6" />
                    </button>
                    <button className="student-management-31" title="Reset Password" onClick={() => openReset(student)}>
                      <KeyRound className="student-management-6" />
                    </button>
                    <button
                      className="student-management-32 disabled:opacity-50"
                      title={student.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                      disabled={actingId === student.id}
                      onClick={() => toggleStatus(student)}
                    >
                      {student.status === 'ACTIVE' ? <Ban className="student-management-6" /> : <UserCheck className="student-management-6" />}
                    </button>
                  </div>
                </td>
              </tr>)}
          </Table>
        )}

        {/* Pagination */}
        {!loading && filtered.length > 0 && (
          <div className="student-management-33">
            <span className="student-management-34">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} students
            </span>
            <div className="student-management-28">
              <button className="student-management-35" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                <ChevronLeft className="student-management-36" />
              </button>
              <span className="student-management-34">Page {page} of {totalPages}</span>
              <button className="student-management-35" disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
                <ChevronRight className="student-management-36" />
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Add Student modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-base font-semibold text-slate-800">Add Student</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-4">Creates the account directly and sets its initial password.</p>

            <form onSubmit={submitAdd} className="space-y-3">
              <Input label="Full name" required value={addForm.name} onChange={v => setAddForm(f => ({ ...f, name: v }))} />
              <Input label="Email" type="email" required value={addForm.email} onChange={v => setAddForm(f => ({ ...f, email: v }))} />
              <Input label="Initial password" type="password" required value={addForm.password} onChange={v => setAddForm(f => ({ ...f, password: v }))} />

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Department<span className="text-red-500">*</span></label>
                <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={addForm.departmentId} onChange={e => onAddDeptChange(e.target.value)}>
                  <option value="">Select department…</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Course<span className="text-red-500">*</span></label>
                <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={addForm.courseId} onChange={e => setAddForm(f => ({ ...f, courseId: e.target.value }))} disabled={!addForm.departmentId}>
                  <option value="">Select course…</option>
                  {addCourses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <Input label="Roll ID (optional)" value={addForm.rollId} onChange={v => setAddForm(f => ({ ...f, rollId: v }))} />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Year</label>
                  <input type="number" min="1" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={addForm.year} onChange={e => setAddForm(f => ({ ...f, year: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Section</label>
                  <input type="text" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={addForm.section} onChange={e => setAddForm(f => ({ ...f, section: e.target.value }))} />
                </div>
              </div>

              {addError && <p className="text-xs text-red-600">{addError}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <Btn type="button" variant="ghost" size="sm" onClick={() => setShowAddModal(false)}>Cancel</Btn>
                <Btn type="submit" variant="primary" size="sm" disabled={addSubmitting}>{addSubmitting ? 'Creating…' : 'Create Student'}</Btn>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Student modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-slate-800">Edit Student</h3>
              <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={submitEdit} className="space-y-3">
              <Input label="Full name" required value={editForm.name} onChange={v => setEditForm(f => ({ ...f, name: v }))} />
              <Input label="Email" type="email" required value={editForm.email} onChange={v => setEditForm(f => ({ ...f, email: v }))} />

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Department</label>
                <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={editForm.departmentId} onChange={e => onEditDeptChange(e.target.value)}>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Course</label>
                <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={editForm.courseId} onChange={e => setEditForm(f => ({ ...f, courseId: e.target.value }))}>
                  {editCourses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <Input label="Roll ID" value={editForm.rollId} onChange={v => setEditForm(f => ({ ...f, rollId: v }))} />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Year</label>
                  <input type="number" min="1" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={editForm.year} onChange={e => setEditForm(f => ({ ...f, year: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Section</label>
                  <input type="text" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={editForm.section} onChange={e => setEditForm(f => ({ ...f, section: e.target.value }))} />
                </div>
              </div>

              {editError && <p className="text-xs text-red-600">{editError}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <Btn type="button" variant="ghost" size="sm" onClick={() => setEditing(null)}>Cancel</Btn>
                <Btn type="submit" variant="primary" size="sm" disabled={editSubmitting}>{editSubmitting ? 'Saving…' : 'Save Changes'}</Btn>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password modal */}
      {resetting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-base font-semibold text-slate-800">Reset Password</h3>
              <button onClick={() => setResetting(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-4">Setting a new password for {resetting.name}.</p>

            <form onSubmit={submitReset} className="space-y-3">
              <Input label="New password" type="password" required value={resetPassword} onChange={setResetPassword} />
              {resetError && <p className="text-xs text-red-600">{resetError}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <Btn type="button" variant="ghost" size="sm" onClick={() => setResetting(null)}>Cancel</Btn>
                <Btn type="submit" variant="primary" size="sm" disabled={resetSubmitting}>{resetSubmitting ? 'Saving…' : 'Reset Password'}</Btn>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Profile modal */}
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-slate-800">Student Profile</h3>
              <button onClick={() => setViewing(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {viewLoading || !viewDetail ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Name</span><span className="font-medium text-slate-800">{viewDetail.name}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Email</span><span className="font-medium text-slate-800">{viewDetail.email}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Roll ID</span><span className="font-medium text-slate-800">{viewDetail.rollId || '—'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Department</span><span className="font-medium text-slate-800">{viewDetail.department?.name || '—'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Course</span><span className="font-medium text-slate-800">{viewDetail.course?.name || '—'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Year / Section</span><span className="font-medium text-slate-800">Yr {viewDetail.year} / {viewDetail.section}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Status</span><StatusBadge status={titleCase(viewDetail.status)} /></div>
                <div className="flex justify-between"><span className="text-slate-500">Enrolled</span><span className="font-medium text-slate-800">{viewDetail.enrolledDate ? new Date(viewDetail.enrolledDate).toLocaleDateString() : '—'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Submissions</span><span className="font-medium text-slate-800">{viewDetail._count?.submissions ?? 0}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Attendance records</span><span className="font-medium text-slate-800">{viewDetail._count?.attendance ?? 0}</span></div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>;
}