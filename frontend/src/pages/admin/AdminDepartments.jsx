import './AdminDepartments.css';
import { useEffect, useState } from 'react';
import { Plus, ChevronDown, ChevronUp, Users, UserCheck, BookOpen, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { StatCard, Badge, ProgressBar, SectionHeader, Btn } from '../../components/ui';
import { adminApi, analyticsApi, ApiError } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

const emptyAddForm = { name: '', code: '' };

export default function AdminDepartments() {
  const { token } = useAuth();

  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [expanded, setExpanded] = useState(null);
  const [expandedCache, setExpandedCache] = useState({}); // { [deptId]: { courses, faculty, loading } }

  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState(emptyAddForm);
  const [addError, setAddError] = useState('');
  const [addSubmitting, setAddSubmitting] = useState(false);

  async function loadDepartments() {
    setLoading(true);
    setError('');
    try {
      // Base list (counts) and attendance rollup come from separate endpoints —
      // merge them by department id below.
      const [deptRes, attendanceRes] = await Promise.all([
        adminApi.listDepartments(token),
        analyticsApi.attendanceByDepartment(token),
      ]);

      const attendanceById = Object.fromEntries(
        (attendanceRes.departments || []).map((row) => [row.department.id, row.attendanceRate])
      );

      const base = deptRes.departments || [];

      // Average performance has no per-department bulk endpoint, so it's one
      // call per department. Institutions have a handful of these, not
      // thousands — fine for a page load.
      const perfResults = await Promise.all(
        base.map((d) => analyticsApi.performanceOverview(token, { departmentId: d.id }).catch(() => null))
      );

      const merged = base.map((d, i) => ({
        ...d,
        attendanceRate: attendanceById[d.id] ?? null,
        avgPerformance: perfResults[i]?.averageScore ?? null,
      }));

      setDepartments(merged);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load departments');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDepartments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function toggleExpand(dep) {
    if (expanded === dep.id) {
      setExpanded(null);
      return;
    }
    setExpanded(dep.id);
    if (expandedCache[dep.id]) return; // already fetched

    setExpandedCache((prev) => ({ ...prev, [dep.id]: { loading: true } }));
    try {
      const [coursesRes, facultyRes] = await Promise.all([
        adminApi.listCourses(token, dep.id),
        adminApi.listFaculty(token, { departmentId: dep.id }),
      ]);
      setExpandedCache((prev) => ({
        ...prev,
        [dep.id]: {
          loading: false,
          courses: coursesRes.courses || [],
          faculty: facultyRes.faculty || [],
        },
      }));
    } catch (err) {
      setExpandedCache((prev) => ({
        ...prev,
        [dep.id]: { loading: false, error: err instanceof ApiError ? err.message : 'Failed to load details' },
      }));
    }
  }

  async function handleAddDepartment(e) {
    e.preventDefault();
    setAddError('');
    if (!addForm.name.trim() || !addForm.code.trim()) {
      setAddError('Name and code are required');
      return;
    }
    setAddSubmitting(true);
    try {
      await adminApi.createDepartment(token, { name: addForm.name.trim(), code: addForm.code.trim() });
      setShowAddModal(false);
      setAddForm(emptyAddForm);
      await loadDepartments();
    } catch (err) {
      setAddError(err instanceof ApiError ? err.message : 'Failed to create department');
    } finally {
      setAddSubmitting(false);
    }
  }

  const totalStudents = departments.reduce((sum, d) => sum + (d.studentCount || 0), 0);
  const totalFaculty = departments.reduce((sum, d) => sum + (d.facultyCount || 0), 0);

  const chartData = departments.map((d) => ({
    name: d.code,
    Attendance: d.attendanceRate ?? 0,
    Performance: d.avgPerformance ?? 0,
  }));

  return (
    <div className="admin-departments-2">
      <SectionHeader
        title="Department Management"
        sub="Manage all departments, courses, and faculty assignments"
        action={
          <Btn variant="primary" icon={<Plus className="admin-departments-3" />} onClick={() => setShowAddModal(true)}>
            Add Department
          </Btn>
        }
      />

      {error && <div className="admin-departments-error" style={{ color: '#dc2626', marginBottom: '1rem' }}>{error}</div>}

      {/* Summary */}
      <div className="admin-departments-4">
        <StatCard label="Departments" value={String(departments.length)} sub="Active departments" icon={<BookOpen className="admin-departments-5" />} color="blue" />
        <StatCard label="Total Students" value={totalStudents.toLocaleString()} sub="Across all departments" icon={<Users className="admin-departments-5" />} color="green" />
        <StatCard label="Total Faculty" value={totalFaculty.toLocaleString()} sub="Active faculty members" icon={<UserCheck className="admin-departments-5" />} color="violet" />
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <Loader2 className="animate-spin" />
        </div>
      ) : (
        <>
          {/* Department Cards */}
          <div className="admin-departments-6">
            {departments.map((dep) => {
              const isExpanded = expanded === dep.id;
              const cache = expandedCache[dep.id];
              return (
                <div key={dep.id} className="admin-departments-7">
                  <div className="admin-departments-8">
                    <div className="admin-departments-9">
                      <div>
                        <div className="admin-departments-10">
                          <h3 className="admin-departments-11">{dep.name}</h3>
                          <Badge variant="info">{dep.code}</Badge>
                        </div>
                        <div className="admin-departments-12">
                          <span className="admin-departments-13"><Users className="admin-departments-14" />{dep.studentCount} students</span>
                          <span className="admin-departments-13"><UserCheck className="admin-departments-14" />{dep.facultyCount} faculty</span>
                        </div>
                      </div>
                    </div>

                    <div className="admin-departments-15">
                      <div>
                        <div className="admin-departments-16">
                          <span>Avg Attendance (30d)</span>
                          <span className="admin-departments-17">{dep.attendanceRate !== null ? `${dep.attendanceRate}%` : '—'}</span>
                        </div>
                        <ProgressBar
                          value={dep.attendanceRate ?? 0}
                          color={dep.attendanceRate >= 80 ? 'green' : dep.attendanceRate >= 70 ? 'amber' : 'red'}
                        />
                      </div>
                      <div>
                        <div className="admin-departments-16">
                          <span>Avg Performance</span>
                          <span className="admin-departments-17">{dep.avgPerformance !== null ? `${dep.avgPerformance}%` : '—'}</span>
                        </div>
                        <ProgressBar
                          value={dep.avgPerformance ?? 0}
                          color={dep.avgPerformance >= 80 ? 'green' : dep.avgPerformance >= 70 ? 'amber' : 'red'}
                        />
                      </div>
                    </div>

                    <div className="admin-departments-27">
                      <button onClick={() => toggleExpand(dep)} className="admin-departments-28">
                        View Details {isExpanded ? <ChevronUp className="admin-departments-14" /> : <ChevronDown className="admin-departments-14" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="admin-departments-30">
                      {cache?.loading && <div style={{ padding: '0.5rem 0' }}>Loading…</div>}
                      {cache?.error && <div style={{ color: '#dc2626' }}>{cache.error}</div>}
                      {cache && !cache.loading && !cache.error && (
                        <div className="admin-departments-31">
                          <div>
                            <p className="admin-departments-32">Courses ({cache.courses.length})</p>
                            <div className="admin-departments-33">
                              {cache.courses.length === 0 && <span style={{ color: '#94a3b8' }}>No courses yet</span>}
                              {cache.courses.map((c) => (
                                <div key={c.id} className="admin-departments-34">
                                  <span className="admin-departments-35" />
                                  {c.name}
                                </div>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="admin-departments-32">Faculty ({cache.faculty.length})</p>
                            <div className="admin-departments-33">
                              {cache.faculty.length === 0 && <span style={{ color: '#94a3b8' }}>No faculty yet</span>}
                              {cache.faculty.map((f) => (
                                <div key={f.id} className="admin-departments-34">
                                  <span className="admin-departments-36" />
                                  {f.name}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Department Comparison Chart */}
          <div className="admin-departments-37">
            <SectionHeader title="Department Comparison" sub="Attendance vs Performance across departments" />
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} barSize={24} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                <Bar dataKey="Attendance" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Performance" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* Add Department Modal */}
      {showAddModal && (
        <div className="admin-departments-38">
          <div className="admin-departments-39">
            <h3 className="admin-departments-40">Add New Department</h3>
            {addError && <div style={{ color: '#dc2626', marginBottom: '0.5rem' }}>{addError}</div>}
            <div className="admin-departments-15">
              <div>
                <label className="admin-departments-41">Department Name</label>
                <input
                  className="admin-departments-42"
                  placeholder="e.g. Information Technology"
                  value={addForm.name}
                  onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="admin-departments-41">Department Code</label>
                <input
                  className="admin-departments-42"
                  placeholder="e.g. IT"
                  value={addForm.code}
                  onChange={(e) => setAddForm((f) => ({ ...f, code: e.target.value }))}
                />
              </div>
            </div>
            <div className="admin-departments-43">
              <Btn variant="outline" onClick={() => { setShowAddModal(false); setAddError(''); }} disabled={addSubmitting}>Cancel</Btn>
              <Btn variant="primary" onClick={handleAddDepartment} disabled={addSubmitting}>
                {addSubmitting ? 'Adding…' : 'Add Department'}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}