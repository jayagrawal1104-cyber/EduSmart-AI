import './FacultyManagement.css';
import { useEffect, useState } from 'react';
import { Search, Eye, UserX, UserCheck as UserCheckIcon, Loader2, Plus, X } from 'lucide-react';
import { StatusBadge, Table, Btn, Select, Input, Card, SectionHeader, StatCard } from '../../components/ui/index';
import { Users, UserCheck, BookOpen } from 'lucide-react';
import { adminApi, ApiError } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

function initials(name) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function titleCase(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

const emptyForm = { name: '', email: '', password: '', departmentId: '', designation: '', subjects: '' };

export default function FacultyManagement() {
  const { token } = useAuth();

  const [faculty, setFaculty] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [dept, setDept] = useState('');

  const [viewing, setViewing] = useState(null); // faculty id being viewed in detail modal
  const [viewDetail, setViewDetail] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState(emptyForm);
  const [addError, setAddError] = useState('');
  const [addSubmitting, setAddSubmitting] = useState(false);

  const [actingId, setActingId] = useState(null); // id currently being (de)activated

  async function loadFaculty() {
    setLoading(true);
    setError('');
    try {
      const data = await adminApi.listFaculty(token, { departmentId: dept });
      setFaculty(data.faculty || []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load faculty');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFaculty();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, dept]);

  useEffect(() => {
    async function loadDepartments() {
      try {
        const data = await adminApi.listDepartments(token);
        setDepartments(data.departments || []);
      } catch {
        // Non-fatal — the department filter/picker just stays empty.
      }
    }
    loadDepartments();
  }, [token]);

  const departmentOptions = [
    { value: '', label: 'All Departments' },
    ...departments.map(d => ({ value: d.id, label: d.name })),
  ];

  const filtered = faculty.filter(f => {
    if (search && !f.name.toLowerCase().includes(search.toLowerCase()) && !f.id.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const activeCount = faculty.filter(f => f.status === 'ACTIVE').length;
  const avgClasses = faculty.length
    ? Math.round(faculty.reduce((sum, f) => sum + (f.classes || 0), 0) / faculty.length)
    : 0;

  async function openView(f) {
    setViewing(f.id);
    setViewDetail(null);
    setViewLoading(true);
    try {
      const data = await adminApi.getFaculty(token, f.id);
      setViewDetail(data.faculty);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load faculty details');
      setViewing(null);
    } finally {
      setViewLoading(false);
    }
  }

  async function toggleStatus(f) {
    setActingId(f.id);
    try {
      const nextStatus = f.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await adminApi.updateFaculty(token, f.id, { status: nextStatus });
      setFaculty(prev => prev.map(x => (x.id === f.id ? { ...x, status: nextStatus } : x)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update faculty status');
    } finally {
      setActingId(null);
    }
  }

  function openAddModal() {
    setAddForm(emptyForm);
    setAddError('');
    setShowAddModal(true);
  }

  async function submitAdd(e) {
    e.preventDefault();
    setAddError('');

    if (!addForm.name || !addForm.email || !addForm.password || !addForm.departmentId) {
      setAddError('Name, email, password and department are required');
      return;
    }

    setAddSubmitting(true);
    try {
      const subjects = addForm.subjects
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      await adminApi.createFaculty(token, {
        name: addForm.name,
        email: addForm.email,
        password: addForm.password,
        departmentId: addForm.departmentId,
        designation: addForm.designation || undefined,
        subjects: subjects.length ? subjects : undefined,
      });

      setShowAddModal(false);
      await loadFaculty();
    } catch (err) {
      setAddError(err instanceof ApiError ? err.message : 'Failed to create faculty account');
    } finally {
      setAddSubmitting(false);
    }
  }

  return <div className="faculty-management-1">
      {/* Header */}
      <div className="faculty-management-2">
        <div>
          <h1 className="faculty-management-3">Faculty Management</h1>
          <p className="faculty-management-4">
            {faculty.length} faculty member{faculty.length === 1 ? '' : 's'}{departments.length ? ` across ${departments.length} department${departments.length === 1 ? '' : 's'}` : ''}
          </p>
        </div>
        <div className="faculty-management-5">
          <Btn variant="primary" size="sm" icon={<Plus className="faculty-management-7" />} onClick={openAddModal}>
            Add Faculty
          </Btn>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2 mb-5">
          {error}
        </div>
      )}

      {/* Summary Stats */}
      <div className="faculty-management-6">
        <StatCard label="Total Faculty" value={String(faculty.length)} sub="In this department filter" icon={<Users className="faculty-management-7" />} color="blue" />
        <StatCard label="Active" value={String(activeCount)} sub={`${faculty.length - activeCount} inactive`} icon={<UserCheck className="faculty-management-7" />} color="green" />
        <StatCard label="Avg Classes / Faculty" value={String(avgClasses)} sub="Timetable slots assigned" icon={<BookOpen className="faculty-management-7" />} color="violet" />
      </div>

      {/* Filters */}
      <Card className="faculty-management-8">
        <div className="faculty-management-9">
          <div className="faculty-management-10">
            <Input placeholder="Search by name or faculty ID..." value={search} onChange={setSearch} icon={<Search className="faculty-management-11" />} />
          </div>
          <div className="faculty-management-12">
            <Select options={departmentOptions} value={dept} onChange={setDept} />
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card>
        <div className="faculty-management-13">
          <span className="faculty-management-14">
            Showing {filtered.length} of {faculty.length} faculty
          </span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
            <p className="text-sm text-slate-400">Loading faculty…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <Users className="w-8 h-8 text-slate-300" />
            <h3 className="text-sm font-semibold text-slate-600">No faculty found</h3>
            <p className="text-xs text-slate-400">Try a different search or department filter</p>
          </div>
        ) : (
          <Table headers={['Faculty ID', 'Name', 'Department', 'Designation', 'Classes', 'Status', 'Actions']}>
            {filtered.map(f => <tr key={f.id} className="faculty-management-15">
                <td className="faculty-management-16">{f.id}</td>
                <td className="faculty-management-17">
                  <div className="faculty-management-18">
                    <div className="faculty-management-19">
                      {initials(f.name)}
                    </div>
                    <div>
                      <div className="faculty-management-20">{f.name}</div>
                      <div className="faculty-management-21">{f.email}</div>
                      <div className="faculty-management-22">
                        {(f.subjects || []).slice(0, 2).map(sub => <span key={sub.id} className="faculty-management-23">{sub.name}</span>)}
                        {(f.subjects || []).length > 2 && <span className="faculty-management-24">+{f.subjects.length - 2}</span>}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="faculty-management-25">{f.department?.name || '—'}</td>
                <td className="faculty-management-25">{f.designation || '—'}</td>
                <td className="faculty-management-26">{f.classes}</td>
                <td className="faculty-management-17">
                  <StatusBadge status={titleCase(f.status)} />
                </td>
                <td className="faculty-management-17">
                  <div className="faculty-management-29">
                    <button className="faculty-management-30" title="View Profile" onClick={() => openView(f)}>
                      <Eye className="faculty-management-11" />
                    </button>
                    <button
                      className="faculty-management-33 disabled:opacity-50"
                      title={f.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                      disabled={actingId === f.id}
                      onClick={() => toggleStatus(f)}
                    >
                      {f.status === 'ACTIVE' ? <UserX className="faculty-management-11" /> : <UserCheckIcon className="faculty-management-11" />}
                    </button>
                  </div>
                </td>
              </tr>)}
          </Table>
        )}
      </Card>

      {/* Add Faculty modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-base font-semibold text-slate-800">Add Faculty</h3>
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
                <select
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  value={addForm.departmentId}
                  onChange={e => setAddForm(f => ({ ...f, departmentId: e.target.value }))}
                >
                  <option value="">Select department…</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>

              <Input label="Designation (optional)" placeholder="e.g. Assistant Professor" value={addForm.designation} onChange={v => setAddForm(f => ({ ...f, designation: v }))} />
              <Input label="Subjects (optional, comma-separated)" placeholder="e.g. DBMS, Operating Systems" value={addForm.subjects} onChange={v => setAddForm(f => ({ ...f, subjects: v }))} />

              {addError && <p className="text-xs text-red-600">{addError}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <Btn type="button" variant="ghost" size="sm" onClick={() => setShowAddModal(false)}>Cancel</Btn>
                <Btn type="submit" variant="primary" size="sm" disabled={addSubmitting}>
                  {addSubmitting ? 'Creating…' : 'Create Faculty'}
                </Btn>
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
              <h3 className="text-base font-semibold text-slate-800">Faculty Profile</h3>
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
                <div className="flex justify-between"><span className="text-slate-500">Department</span><span className="font-medium text-slate-800">{viewDetail.department?.name || '—'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Designation</span><span className="font-medium text-slate-800">{viewDetail.designation || '—'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Status</span><StatusBadge status={titleCase(viewDetail.status)} /></div>
                <div className="flex justify-between"><span className="text-slate-500">Joined</span><span className="font-medium text-slate-800">{viewDetail.joinedDate ? new Date(viewDetail.joinedDate).toLocaleDateString() : '—'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Assignments</span><span className="font-medium text-slate-800">{viewDetail._count?.assignments ?? 0}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Lesson plans</span><span className="font-medium text-slate-800">{viewDetail._count?.lessonPlans ?? 0}</span></div>
                {viewDetail.subjects?.length > 0 && (
                  <div className="pt-1">
                    <span className="text-slate-500">Subjects</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {viewDetail.subjects.map(s => <span key={s.id} className="faculty-management-23">{s.name}</span>)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>;
}