import './AdminPerformance.css';
import { useEffect, useState } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Users, ClipboardCheck, AlertTriangle, Loader2 } from 'lucide-react';
import { StatCard, Card, SectionHeader, RiskBadge } from '../../components/ui';
import { analyticsApi, ApiError } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

// Every number on this page comes from real records:
// - performanceTrend buckets PerformanceRecord/Attendance/Submission rows
//   by calendar month (avg score, attendance rate, assignment completion).
// - subjectPerformance averages PerformanceRecord.score per subject.
// - studentRisk combines each active student's attendance rate (60%) and
//   average performance score (40%) into a 0-100 risk score, banded into
//   Low/Medium/High. Students with neither attendance nor performance data
//   on file are left out of risk/top/bottom entirely — there's nothing to
//   score them on.

export default function AdminPerformance() {
  const { token } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [trend, setTrend] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [riskCounts, setRiskCounts] = useState({ Low: 0, Medium: 0, High: 0 });
  const [topPerformers, setTopPerformers] = useState([]);
  const [lowPerformers, setLowPerformers] = useState([]);
  const [scoredCount, setScoredCount] = useState(0);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [trendRes, subjectRes, riskRes] = await Promise.all([
          analyticsApi.performanceTrend(token, { months: 6 }),
          analyticsApi.subjectPerformance(token, { limit: 8 }),
          analyticsApi.studentRisk(token, { limit: 5 }),
        ]);
        setTrend(trendRes.data || []);
        setSubjects(subjectRes.data || []);
        setRiskCounts(riskRes.riskCounts || { Low: 0, Medium: 0, High: 0 });
        setTopPerformers(riskRes.topPerformers || []);
        setLowPerformers(riskRes.lowPerformers || []);
        setScoredCount((riskRes.students || []).length);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to load performance analytics');
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

  // Latest month with real data for each series, for the top-stat cards.
  const latestScore = [...trend].reverse().find((m) => m.score !== null)?.score;
  const latestAttendance = [...trend].reverse().find((m) => m.attendance !== null)?.attendance;
  const latestAssignments = [...trend].reverse().find((m) => m.assignments !== null)?.assignments;

  return (
    <div className="admin-performance-1">
      <SectionHeader title="Academic Performance" sub="Institution-wide performance, attendance & assignment analytics in one view" />

      {error && <div style={{ color: '#dc2626', marginBottom: '1rem' }}>{error}</div>}

      {/* Top Stats */}
      <div className="admin-performance-2">
        <StatCard
          label="Avg Performance"
          value={latestScore != null ? `${latestScore}%` : '—'}
          sub="Most recent month with data"
          icon={<TrendingUp className="admin-performance-3" />}
          color="violet"
        />
        <StatCard
          label="Avg Attendance"
          value={latestAttendance != null ? `${latestAttendance}%` : '—'}
          sub="Most recent month with data"
          icon={<Users className="admin-performance-3" />}
          color="green"
        />
        <StatCard
          label="Assignment Completion"
          value={latestAssignments != null ? `${latestAssignments}%` : '—'}
          sub="Most recent month with data"
          icon={<ClipboardCheck className="admin-performance-3" />}
          color="blue"
        />
        <StatCard
          label="At-Risk Students"
          value={riskCounts.High + riskCounts.Medium}
          sub={`${riskCounts.High} critical, ${riskCounts.Medium} medium`}
          icon={<AlertTriangle className="admin-performance-3" />}
          color="red"
        />
      </div>

      {/* Combined Trend Chart */}
      <Card className="admin-performance-4">
        <SectionHeader title="Performance vs Attendance vs Assignments" sub="6-month institution-wide trend" />
        {trend.length === 0 ? (
          <p style={{ color: '#94a3b8', padding: '1rem 0' }}>No data yet for this range.</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(v) => [v === null || v === undefined ? 'No data' : `${v}%`, '']} contentStyle={{ border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '12px' }} />
              <Legend iconType="circle" iconSize={8} />
              <Line type="monotone" dataKey="score" name="Performance" stroke="#7c3aed" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />
              <Line type="monotone" dataKey="attendance" name="Attendance" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />
              <Line type="monotone" dataKey="assignments" name="Assignments" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      <div className="admin-performance-5">
        {/* Subject-Wise Performance */}
        <Card className="admin-performance-4">
          <SectionHeader title="Subject-Wise Performance" sub="Average score by subject" />
          {subjects.length === 0 ? (
            <p style={{ color: '#94a3b8', padding: '1rem 0' }}>No performance records yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={subjects} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="subject" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                <Tooltip formatter={(v) => [`${v}%`, 'Score']} contentStyle={{ border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '12px' }} />
                <Bar dataKey="score" name="Avg Score" fill="#7c3aed" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Risk Snapshot */}
        <Card className="admin-performance-4">
          <SectionHeader title="Risk Snapshot" sub={`${scoredCount} students analyzed`} />
          <div className="admin-performance-6">
            <div className="admin-performance-7">
              <div className="admin-performance-8">
                <span className="admin-performance-9" style={{ backgroundColor: '#16a34a' }} />
                <span className="admin-performance-10">Low Risk</span>
              </div>
              <span className="admin-performance-11">{riskCounts.Low}</span>
            </div>
            <div className="admin-performance-7">
              <div className="admin-performance-8">
                <span className="admin-performance-9" style={{ backgroundColor: '#d97706' }} />
                <span className="admin-performance-10">Medium Risk</span>
              </div>
              <span className="admin-performance-11">{riskCounts.Medium}</span>
            </div>
            <div className="admin-performance-7">
              <div className="admin-performance-8">
                <span className="admin-performance-9" style={{ backgroundColor: '#dc2626' }} />
                <span className="admin-performance-10">High Risk</span>
              </div>
              <span className="admin-performance-11">{riskCounts.High}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Top / Bottom Performers */}
      <div className="admin-performance-5">
        <Card className="admin-performance-4">
          <SectionHeader title="Top Performers" sub="Highest average performance" />
          {topPerformers.length === 0 ? (
            <p style={{ color: '#94a3b8', padding: '1rem 0' }}>No performance records yet.</p>
          ) : (
            <div className="admin-performance-12">
              {topPerformers.map((s) => (
                <div key={s.student.id} className="admin-performance-13">
                  <div>
                    <div className="admin-performance-14">{s.student.name}</div>
                    <div className="admin-performance-15">{s.student.department?.name}</div>
                  </div>
                  <span className="admin-performance-16">{s.avgPerformance}%</span>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card className="admin-performance-4">
          <SectionHeader title="Needs Attention" sub="Lowest average performance" />
          {lowPerformers.length === 0 ? (
            <p style={{ color: '#94a3b8', padding: '1rem 0' }}>No performance records yet.</p>
          ) : (
            <div className="admin-performance-12">
              {lowPerformers.map((s) => (
                <div key={s.student.id} className="admin-performance-13">
                  <div>
                    <div className="admin-performance-14">{s.student.name}</div>
                    <div className="admin-performance-15">{s.student.department?.name}</div>
                  </div>
                  <div className="admin-performance-17">
                    <span className="admin-performance-18">{s.avgPerformance}%</span>
                    <RiskBadge level={s.risk} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}