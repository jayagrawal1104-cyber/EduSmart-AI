import './AdminCourses.css';
import { useEffect, useState } from 'react';
import { Plus, Search, Users, Trash2, X, Loader2 } from 'lucide-react';
import { Badge, SectionHeader, Btn } from '../../components/ui';
import { adminApi, analyticsApi, ApiError } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

const emptyAddForm = { name: '', code: '', departmentId: '' };

export default function AdminCourses() {
  const { token } = useAuth();

  const [courses, setCourses] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [actingId, setActingId] = useState(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState(emptyAddForm);
  const [addError, setAddError] = useState('');
  const [addSubmitting, setAddSubmitting] = useState(false);

  async function loadCourses() {
    setLoading(true);
    setError('');
    try {
      const coursesRes = await adminApi.listCourses(token);
      const base = coursesRes.courses || [];

      // Average performance has no bulk endpoint, so it's one call per
      // course — fine for a page load with a normal number of courses.
      const perfResults = await Promise.all(
        base.map((c) => analyticsApi.performanceOverview(token, { courseId: c.id }).catch(() => null))
      );

      setCourses(base.map((c, i) => ({ ...c, avgPerformance: perfResults[i]?.averageScore ?? null })));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load courses');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCourses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

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

  async function handleAddCourse(e) {
    e.preventDefault();
    setAddError('');
    if (!addForm.name.trim() || !addForm.code.trim() || !addForm.departmentId) {
      setAddError('Name, code and department are all required');
      return;
    }
    setAddSubmitting(true);
    try {
      await adminApi.createCourse(token, {
        name: addForm.name.trim(),
        code: addForm.code.trim(),
        departmentId: addForm.departmentId,
      });
      setShowAddModal(false);
      setAddForm(emptyAddForm);
      await loadCourses();
    } catch (err) {
      setAddError(err instanceof ApiError ? err.message : 'Failed to create course');
    } finally {
      setAddSubmitting(false);
    }
  }

  async function handleDelete(course) {
    if (!window.confirm(`Delete "${course.name}"? This cannot be undone.`)) return;
    setActingId(course.id);
    try {
      await adminApi.deleteCourse(token, course.id);
      await loadCourses();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // Backend refused because students are enrolled — offer the force option.
        if (window.confirm(`${err.message}\n\nDelete anyway?`)) {
          try {
            await adminApi.deleteCourse(token, course.id, true);
            await loadCourses();
          } catch (err2) {
            setError(err2 instanceof ApiError ? err2.message : 'Failed to delete course');
          }
        }
      } else {
        setError(err instanceof ApiError ? err.message : 'Failed to delete course');
      }
    } finally {
      setActingId(null);
    }
  }

  const perfColor = (v) => (v === null ? 'text-slate-400' : v >= 80 ? 'text-green-600' : v >= 70 ? 'text-amber-600' : 'text-red-600');

  const filtered = courses.filter((c) => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.code.toLowerCase().includes(search.toLowerCase());
    const matchDept = !deptFilter || c.departmentId === deptFilter;
    return matchSearch && matchDept;
  });

  return (
    <div className="admin-courses-1">
      <SectionHeader
        title="Course Management"
        sub="Manage all courses and track performance"
        action={
          <Btn variant="primary" icon={<Plus className="admin-courses-2" />} onClick={() => setShowAddModal(true)}>
            Add Course
          </Btn>
        }
      />

      {error && <div style={{ color: '#dc2626', marginBottom: '1rem' }}>{error}</div>}

      {/* Filter Bar */}
      <div className="admin-courses-3">
        <div className="admin-courses-4">
          <Search className="admin-courses-5" />
          <input className="admin-courses-6" placeholder="Search courses..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="admin-courses-7">
          <option value="">All Departments</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <span className="admin-courses-8">{filtered.length} courses</span>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <Loader2 className="animate-spin" />
        </div>
      ) : (
        <div className="admin-courses-9">
          <div className="admin-courses-10">
            <table className="admin-courses-11">
              <thead>
                <tr className="admin-courses-12">
                  {['Course Code', 'Course Name', 'Department', 'Students', 'Avg Performance', 'Actions'].map((h) => (
                    <th key={h} className="admin-courses-13">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="admin-courses-14">
                {filtered.map((course) => (
                  <tr key={course.id} className="admin-courses-15">
                    <td className="admin-courses-16"><code className="admin-courses-17">{course.code}</code></td>
                    <td className="admin-courses-18">{course.name}</td>
                    <td className="admin-courses-16"><Badge variant="info">{course.department?.name}</Badge></td>
                    <td className="admin-courses-16">
                      <span className="admin-courses-20">
                        <Users className="admin-courses-21" />
                        {course.studentCount}
                      </span>
                    </td>
                    <td className="admin-courses-16">
                      <span className={`font-semibold ${perfColor(course.avgPerformance)}`}>
                        {course.avgPerformance !== null ? `${course.avgPerformance}%` : '—'}
                      </span>
                    </td>
                    <td className="admin-courses-16">
                      <div className="admin-courses-23">
                        <button
                          className="admin-courses-27"
                          title="Delete"
                          disabled={actingId === course.id}
                          onClick={() => handleDelete(course)}
                        >
                          <Trash2 className="admin-courses-25" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>No courses found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Course Modal */}
      {showAddModal && (
        <div className="admin-courses-28">
          <div className="admin-courses-29">
            <div className="admin-courses-30">
              <h3 className="admin-courses-31">Add New Course</h3>
              <button onClick={() => { setShowAddModal(false); setAddError(''); }} className="admin-courses-32">
                <X className="admin-courses-33" />
              </button>
            </div>
            {addError && <div style={{ color: '#dc2626', marginBottom: '0.5rem' }}>{addError}</div>}
            <div className="admin-courses-34">
              <div className="admin-courses-35">
                <label className="admin-courses-36">Course Name</label>
                <input
                  className="admin-courses-37"
                  placeholder="e.g. B.Tech Information Technology"
                  value={addForm.name}
                  onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="admin-courses-35">
                <label className="admin-courses-36">Course Code</label>
                <input
                  className="admin-courses-37"
                  placeholder="e.g. IT101"
                  value={addForm.code}
                  onChange={(e) => setAddForm((f) => ({ ...f, code: e.target.value }))}
                />
              </div>
              <div className="admin-courses-35">
                <label className="admin-courses-36">Department</label>
                <select
                  className="admin-courses-38"
                  value={addForm.departmentId}
                  onChange={(e) => setAddForm((f) => ({ ...f, departmentId: e.target.value }))}
                >
                  <option value="">Select a department</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </div>
            <div className="admin-courses-41">
              <Btn variant="outline" onClick={() => { setShowAddModal(false); setAddError(''); }} disabled={addSubmitting}>Cancel</Btn>
              <Btn variant="primary" onClick={handleAddCourse} disabled={addSubmitting}>
                {addSubmitting ? 'Adding…' : 'Add Course'}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}