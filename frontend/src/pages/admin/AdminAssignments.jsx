import './AdminAssignments.css';
import { useEffect, useState } from 'react';
import { ClipboardList, AlertTriangle, Eye, TrendingUp, Clock, CheckCircle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { StatCard, Badge, SectionHeader } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { adminApi, assignmentsApi } from '../../lib/api';

export default function AdminAssignments() {
  const { token } = useAuth();
  const [deptFilter, setDeptFilter] = useState('All');
  const [facultyFilter, setFacultyFilter] = useState('All');
  const [departments, setDepartments] = useState([]);
  const [facultyList, setFacultyList] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([adminApi.listDepartments(token), adminApi.listFaculty(token)])
      .then(([deptRes, facultyRes]) => {
        if (cancelled) return;
        setDepartments(deptRes.departments || []);
        setFacultyList(facultyRes.faculty || []);
      })
      .catch(() => {
        // Filter dropdowns are a convenience; leave them at "All" if this fails.
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    assignmentsApi
      .getOverview(token, {
        departmentId: deptFilter === 'All' ? undefined : deptFilter,
        facultyId: facultyFilter === 'All' ? undefined : facultyFilter,
      })
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load assignment overview');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, deptFilter, facultyFilter]);

  const completionColor = v => v >= 85 ? 'text-green-600' : v >= 70 ? 'text-amber-600' : 'text-red-600';

  if (loading && !data) {
    return <div className="admin-assignments-1"><p>Loading assignment overview…</p></div>;
  }
  if (error) {
    return <div className="admin-assignments-1"><p>Couldn't load assignment overview: {error}</p></div>;
  }

  const { stats, assignments, completionTrend } = data;

  return <div className="admin-assignments-1">
      <SectionHeader title="Assignment Overview" sub="Institution-wide assignment tracking and submission analytics" />

      {/* Summary Stats */}
      <div className="admin-assignments-2">
        <StatCard label="Total Assignments" value={String(stats.totalAssignments)} sub="This semester" icon={<ClipboardList className="admin-assignments-3" />} color="blue" />
        <StatCard label="Submission Rate" value={stats.submissionRatePct != null ? `${stats.submissionRatePct}%` : '—'} sub="Non-pending submissions" icon={<CheckCircle className="admin-assignments-3" />} color="green" trend={stats.submissionRateTrend || undefined} />
        <StatCard label="Late Submissions" value={stats.lateSubmissionPct != null ? `${stats.lateSubmissionPct}%` : '—'} sub="Across all assignments" icon={<Clock className="admin-assignments-3" />} color="amber" />
        <StatCard label="Avg Score" value={stats.avgScorePct != null ? `${stats.avgScorePct}%` : '—'} sub="Institution average (graded work)" icon={<TrendingUp className="admin-assignments-3" />} color="violet" trend={stats.avgScoreTrend || undefined} />
      </div>

      {/* Filter Bar */}
      <div className="admin-assignments-4">
        <span className="admin-assignments-5">Filter:</span>
        <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="admin-assignments-6">
          <option value="All">All Departments</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select value={facultyFilter} onChange={e => setFacultyFilter(e.target.value)} className="admin-assignments-6">
          <option value="All">All Faculty</option>
          {facultyList.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <span className="admin-assignments-7">{assignments.length} assignments</span>
      </div>

      {/* Assignment Table */}
      <div className="admin-assignments-8">
        <div className="admin-assignments-9">
          <table className="admin-assignments-10">
            <thead>
              <tr className="admin-assignments-11">
                {['Title', 'Subject', 'Faculty', 'Department', 'Due Date', 'Submissions', 'Avg Score', 'Completion', 'Actions'].map(h => <th key={h} className="admin-assignments-12">{h}</th>)}
              </tr>
            </thead>
            <tbody className="admin-assignments-13">
              {assignments.map((row) => <tr key={row.id} className="admin-assignments-14">
                  <td className="admin-assignments-15">{row.title}</td>
                  <td className="admin-assignments-16">{row.subject}</td>
                  <td className="admin-assignments-17">{row.faculty}</td>
                  <td className="admin-assignments-18"><Badge variant="info">{row.department}</Badge></td>
                  <td className="admin-assignments-17">{row.dueDate}</td>
                  <td className="admin-assignments-19">{row.submitted}/{row.total}</td>
                  <td className="admin-assignments-20">{row.avgScore != null ? `${row.avgScore}%` : '—'}</td>
                  <td className="admin-assignments-18">
                    <span className={`font-semibold ${completionColor(row.completion)}`}>{row.completion}%</span>
                  </td>
                  <td className="admin-assignments-18">
                    <button className="admin-assignments-21" title="Detail view not built yet">
                      <Eye className="admin-assignments-22" />
                    </button>
                  </td>
                </tr>)}
              {assignments.length === 0 && <tr>
                  <td className="admin-assignments-15" colSpan={9}>No assignments match this filter.</td>
                </tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="admin-assignments-23">
        {/* Similarity detection — no plagiarism/similarity engine is wired into this codebase */}
        <div className="admin-assignments-24">
          <div className="admin-assignments-25">
            <div className="admin-assignments-26">
              <AlertTriangle className="admin-assignments-27" />
            </div>
            <h3 className="admin-assignments-28">Similarity Alerts</h3>
          </div>
          <div className="admin-assignments-29">
            <p className="admin-assignments-32">No similarity/plagiarism-detection system is connected yet, so this can't flag anything real. Wiring this up would need a text-similarity engine (e.g. comparing submitted files pairwise) — out of scope for the current data model.</p>
          </div>
        </div>

        {/* Completion Trend */}
        <div className="admin-assignments-24">
          <h3 className="admin-assignments-34">Completion Trend (last {completionTrend.length || 0} weeks with due assignments)</h3>
          {completionTrend.length > 0 ? <ResponsiveContainer width="100%" height={200}>
            <LineChart data={completionTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="week" tick={{
              fontSize: 11,
              fill: '#64748b'
            }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{
              fontSize: 11,
              fill: '#64748b'
            }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              fontSize: '12px'
            }} formatter={v => [`${v}%`, 'Completion']} />
              <Line type="monotone" dataKey="completion" stroke="#3b82f6" strokeWidth={2.5} dot={{
              fill: '#3b82f6',
              r: 4
            }} activeDot={{
              r: 6
            }} />
            </LineChart>
          </ResponsiveContainer> : <p className="admin-assignments-32">No assignments with due dates yet to chart.</p>}
        </div>
      </div>
    </div>;
}