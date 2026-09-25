import './AdminWorkload.css';
import { useEffect, useState } from 'react';
import { UserCheck, AlertTriangle, TrendingDown, Activity, Award, BarChart3, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { StatCard, AIInsightCard, SectionHeader, ProgressBar, Card } from '../../components/ui';
import { analyticsApi, ApiError } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

// Real composite workload index (see facultyWorkload in analytics.controller.js
// for the exact formula) built from four real signals: weekly teaching hours,
// classes/week, attendance-marking backlog, and assignment-grading backlog.
// There is no "engagement score" here — the old mock UI's engagement panel
// had nothing real to back it, so it's gone rather than faked.

function getWorkloadStatus(index) {
  if (index >= 75) return { label: 'High', color: 'text-red-600 bg-red-50 border-red-100' };
  if (index >= 50) return { label: 'Moderate', color: 'text-amber-600 bg-amber-50 border-amber-100' };
  if (index >= 30) return { label: 'Healthy', color: 'text-green-600 bg-green-50 border-green-100' };
  return { label: 'Low Util.', color: 'text-slate-500 bg-slate-50 border-slate-100' };
}

export default function AdminWorkload() {
  const { token } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [faculty, setFaculty] = useState([]);
  const [summary, setSummary] = useState({ avgIndex: 0, highWorkload: 0, lowUtilization: 0, count: 0 });

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const res = await analyticsApi.facultyWorkload(token);
        setFaculty(res.faculty || []);
        setSummary({ avgIndex: res.avgIndex, highWorkload: res.highWorkload, lowUtilization: res.lowUtilization, count: res.count });
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to load faculty workload');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  const chartData = faculty.map((f) => ({
    name: f.name.split(' ').slice(-1)[0],
    fullName: f.name,
    index: f.workloadIndex,
  }));

  const overloaded = [...faculty].filter((f) => f.workloadIndex >= 75).sort((a, b) => b.workloadIndex - a.workloadIndex);
  const backlogged = [...faculty]
    .filter((f) => f.attendanceBacklog > 0 || f.gradingBacklog > 0)
    .sort((a, b) => b.attendanceBacklog + b.gradingBacklog - (a.attendanceBacklog + a.gradingBacklog));

  const workloadInsight = overloaded.length
    ? {
        title: 'Workload imbalance detected',
        description: `${overloaded.length} faculty member${overloaded.length > 1 ? 's are' : ' is'} carrying a workload index of 75+, well above the rest of the institution.`,
        type: 'warning',
        data: overloaded.slice(0, 3).map((f) => `${f.name}: ${f.classesPerWeek} classes/wk, ${f.weeklyHours}h — index ${f.workloadIndex}`),
        recommendation: 'Consider redistributing classes or subjects from these faculty to lower-index colleagues.',
      }
    : {
        title: 'No workload imbalance detected',
        description: 'No faculty member is currently at or above the high-workload threshold (75).',
        type: 'success',
        data: [],
      };

  const backlogInsight = backlogged.length
    ? {
        title: 'Grading & attendance backlog',
        description: `${backlogged.length} faculty member${backlogged.length > 1 ? 's have' : ' has'} an open backlog — ungraded submissions or subjects with no recent attendance marked.`,
        type: 'warning',
        data: backlogged.slice(0, 3).map((f) => `${f.name}: ${f.gradingBacklog} ungraded submission${f.gradingBacklog === 1 ? '' : 's'}, ${f.attendanceBacklog} subject${f.attendanceBacklog === 1 ? '' : 's'} with stale attendance`),
        recommendation: 'Follow up with these faculty to clear grading and attendance backlogs.',
      }
    : {
        title: 'No open backlog',
        description: 'All faculty are current on grading and attendance marking.',
        type: 'success',
        data: [],
      };

  return (
    <div className="admin-workload-1">
      <SectionHeader title="Faculty Workload" sub="Real teaching load, class count, and backlog across departments" />

      {error && <div style={{ color: '#dc2626', marginBottom: '1rem' }}>{error}</div>}

      {/* Summary */}
      <div className="admin-workload-2">
        <StatCard label="Avg Workload" value={summary.avgIndex} sub="Institution avg" icon={<Activity className="admin-workload-3" />} color="blue" />
        <StatCard label="High Workload" value={summary.highWorkload} sub=">=75 index" icon={<AlertTriangle className="admin-workload-3" />} color="red" />
        <StatCard label="Low Utilization" value={summary.lowUtilization} sub="<30 index" icon={<TrendingDown className="admin-workload-3" />} color="amber" />
        <StatCard label="Faculty Analyzed" value={summary.count} sub="Active faculty" icon={<UserCheck className="admin-workload-3" />} color="violet" />
      </div>

      {/* Insights — derived from real data, not fabricated */}
      <div className="admin-workload-38">
        <AIInsightCard insight={workloadInsight} />
        <AIInsightCard insight={backlogInsight} />
      </div>

      {/* Workload chart + breakdown */}
      <div className="admin-workload-4">
        <div className="admin-workload-30">
          <BarChart3 className="admin-workload-31" />
          <h3 className="admin-workload-13">Workload Distribution</h3>
        </div>
        {chartData.length === 0 ? (
          <p style={{ color: '#94a3b8', padding: '1rem 0' }}>No faculty with timetable data yet.</p>
        ) : (
          <div className="admin-workload-40">
            <ResponsiveContainer width="100%" height={130}>
              <BarChart data={chartData} barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} interval={0} angle={-40} textAnchor="end" height={40} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} width={26} />
                <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '12px' }} formatter={(value, _name, props) => [value, props.payload.fullName]} />
                <Bar dataKey="index" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.index >= 75 ? '#ef4444' : entry.index >= 50 ? '#f59e0b' : '#22c55e'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="admin-workload-32">
          {faculty.map((f) => {
            const status = getWorkloadStatus(f.workloadIndex);
            return (
              <div key={f.id} className="admin-workload-33">
                <span className="admin-workload-34">{f.name}</span>
                <div className="admin-workload-26">
                  <ProgressBar value={f.workloadIndex} color={f.workloadIndex >= 75 ? 'red' : f.workloadIndex >= 50 ? 'amber' : 'green'} />
                </div>
                <span className="admin-workload-35">{f.workloadIndex}</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${status.color}`}>{status.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Per-faculty breakdown table */}
      <Card className="admin-workload-4">
        <SectionHeader title="Workload Breakdown" sub="Weekly hours, classes, and backlog per faculty" />
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '8px 6px' }}>Faculty</th>
                <th style={{ padding: '8px 6px' }}>Department</th>
                <th style={{ padding: '8px 6px' }}>Weekly Hours</th>
                <th style={{ padding: '8px 6px' }}>Classes/Week</th>
                <th style={{ padding: '8px 6px' }}>Attendance Backlog</th>
                <th style={{ padding: '8px 6px' }}>Grading Backlog</th>
                <th style={{ padding: '8px 6px' }}>Index</th>
              </tr>
            </thead>
            <tbody>
              {faculty.map((f) => (
                <tr key={f.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px 6px', fontWeight: 600 }}>{f.name}</td>
                  <td style={{ padding: '8px 6px' }}>{f.department?.code}</td>
                  <td style={{ padding: '8px 6px' }}>{f.weeklyHours}h</td>
                  <td style={{ padding: '8px 6px' }}>{f.classesPerWeek}</td>
                  <td style={{ padding: '8px 6px' }}>{f.attendanceBacklog}</td>
                  <td style={{ padding: '8px 6px' }}>{f.gradingBacklog}</td>
                  <td style={{ padding: '8px 6px', fontWeight: 600 }}>{f.workloadIndex}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {faculty.length === 0 && <p style={{ color: '#94a3b8', padding: '1rem 0' }}>No faculty data yet.</p>}
        </div>
      </Card>
    </div>
  );
}