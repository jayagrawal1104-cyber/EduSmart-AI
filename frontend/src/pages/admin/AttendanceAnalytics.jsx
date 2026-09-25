import './AttendanceAnalytics.css';
import { useEffect, useState } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ClipboardList, AlertTriangle, Users, Loader2 } from 'lucide-react';
import { StatCard, Card, SectionHeader } from '../../components/ui/index';
import { analyticsApi, ApiError } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

// Every chart on this page is now backed by real Attendance records:
// - attendanceOverview / atRiskStudents / attendanceByDepartment power the
//   top stats, risk thresholds, and department bar chart (as before).
// - attendanceTrend (new) buckets Attendance rows by calendar month and
//   department, in memory, for the trend line.
// - attendanceHeatmap (new) buckets Attendance rows by ISO week and weekday
//   (Mon-Fri) for the heatmap grid.
// A cell/point is left blank (null) rather than shown as 0% when there's no
// attendance data for that slice, so gaps read as "no data" not "0%".

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const dayKeys = ['mon', 'tue', 'wed', 'thu', 'fri'];
const lineColors = ['#2563eb', '#7c3aed', '#dc2626', '#16a34a', '#d97706', '#0891b2', '#db2777', '#65a30d'];

function heatColor(val) {
  if (val === null || val === undefined) return 'bg-slate-100';
  if (val >= 85) return 'bg-green-500';
  if (val >= 80) return 'bg-green-400';
  if (val >= 75) return 'bg-amber-400';
  if (val >= 70) return 'bg-amber-500';
  return 'bg-red-500';
}

export default function AttendanceAnalytics() {
  const { token } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [overview, setOverview] = useState(null); // { attendanceRate, total }
  const [amberCount, setAmberCount] = useState(null); // 60-75%
  const [redCount, setRedCount] = useState(null); // <60%
  const [deptData, setDeptData] = useState([]);
  const [trend, setTrend] = useState({ data: [], departments: [] });
  const [heatmapWeeks, setHeatmapWeeks] = useState([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [ov, atRisk75, atRisk60, byDept, trendRes, heatmapRes] = await Promise.all([
          analyticsApi.attendanceOverview(token),
          analyticsApi.atRiskStudents(token, { threshold: 75 }),
          analyticsApi.atRiskStudents(token, { threshold: 60 }),
          analyticsApi.attendanceByDepartment(token),
          analyticsApi.attendanceTrend(token, { months: 6 }),
          analyticsApi.attendanceHeatmap(token, { weeks: 4 }),
        ]);
        setOverview(ov);
        // atRisk75.total includes everyone below 75%, including those below 60% —
        // subtract to get the 60-75% "amber" band specifically.
        setAmberCount((atRisk75.total || 0) - (atRisk60.total || 0));
        setRedCount(atRisk60.total || 0);
        setDeptData(
          (byDept.departments || []).map((d) => ({
            dept: d.department.code,
            attendance: d.attendanceRate ?? 0,
            target: 80,
          }))
        );
        setTrend({ data: trendRes.data || [], departments: trendRes.departments || [] });
        setHeatmapWeeks(heatmapRes || []);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to load attendance analytics');
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

  return (
    <div className="attendance-analytics-1">
      <div className="attendance-analytics-2">
        <div>
          <h1 className="attendance-analytics-3">Attendance Analytics</h1>
          <p className="attendance-analytics-4">Institution-wide attendance tracking and risk analysis</p>
        </div>
      </div>

      {error && <div style={{ color: '#dc2626', marginBottom: '1rem' }}>{error}</div>}

      {/* Top Stats */}
      <div className="attendance-analytics-5">
        <StatCard
          label="Institution Attendance"
          value={overview?.attendanceRate !== null && overview?.attendanceRate !== undefined ? `${overview.attendanceRate}%` : '—'}
          sub={`Based on ${overview?.total ?? 0} attendance records`}
          icon={<ClipboardList className="attendance-analytics-6" />}
          color="green"
        />
        <StatCard
          label="Below 75% Threshold"
          value={amberCount ?? '—'}
          sub="Students at amber alert (60-75%)"
          icon={<AlertTriangle className="attendance-analytics-6" />}
          color="amber"
        />
        <StatCard
          label="Below 60% Critical"
          value={redCount ?? '—'}
          sub="Students at red alert"
          icon={<AlertTriangle className="attendance-analytics-6" />}
          color="red"
        />
      </div>

      {/* Trend Chart — real, one line per department */}
      <Card className="attendance-analytics-7">
        <SectionHeader title="Attendance Trend" sub="Monthly attendance rate by department, last 6 months" />
        {trend.data.length === 0 || trend.departments.length === 0 ? (
          <p style={{ color: '#94a3b8', padding: '1rem 0' }}>No attendance history yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trend.data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(v) => [v === null || v === undefined ? 'No data' : `${v}%`, '']} contentStyle={{ border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '12px' }} />
              <Legend iconType="circle" iconSize={8} />
              {trend.departments.map((d, i) => (
                <Line
                  key={d.code}
                  type="monotone"
                  dataKey={d.code}
                  name={d.code}
                  stroke={lineColors[i % lineColors.length]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      <div className="attendance-analytics-8">
        {/* Department Bar Chart — real data */}
        <Card className="attendance-analytics-9">
          <SectionHeader title="Department Comparison" sub="Current attendance % per department" />
          {deptData.length === 0 ? (
            <p style={{ color: '#94a3b8', padding: '1rem 0' }}>No departments with attendance data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={deptData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="dept" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                <Tooltip formatter={(v) => [`${v}%`, '']} contentStyle={{ border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '12px' }} />
                <Bar dataKey="attendance" name="Attendance" fill="#2563eb" radius={[6, 6, 0, 0]} />
                <Bar dataKey="target" name="Target (80%)" fill="#e2e8f0" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Risk Thresholds — real counts */}
        <Card className="attendance-analytics-9">
          <SectionHeader title="Risk Thresholds" sub="Student attendance risk bands" />
          <div className="attendance-analytics-10">
            <div className="attendance-analytics-11">
              <div className="attendance-analytics-12"><ClipboardList className="attendance-analytics-13" /></div>
              <div className="attendance-analytics-14">
                <div className="attendance-analytics-15">
                  <span className="attendance-analytics-16">Above 75% — Safe Zone</span>
                </div>
                <p className="attendance-analytics-18">Students maintaining required attendance threshold</p>
              </div>
            </div>

            <div className="attendance-analytics-21">
              <div className="attendance-analytics-22"><AlertTriangle className="attendance-analytics-23" /></div>
              <div className="attendance-analytics-14">
                <div className="attendance-analytics-15">
                  <span className="attendance-analytics-24">60–75% — Amber Alert</span>
                  <span className="attendance-analytics-25">{amberCount ?? '—'}</span>
                </div>
                <p className="attendance-analytics-26">Advisory recommended</p>
              </div>
            </div>

            <div className="attendance-analytics-29">
              <div className="attendance-analytics-30"><Users className="attendance-analytics-31" /></div>
              <div className="attendance-analytics-14">
                <div className="attendance-analytics-15">
                  <span className="attendance-analytics-32">Below 60% — Red Alert</span>
                  <span className="attendance-analytics-33">{redCount ?? '—'}</span>
                </div>
                <p className="attendance-analytics-34">Exam eligibility at risk — immediate intervention required</p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Attendance Heatmap — real data, last 4 weeks */}
      <Card className="attendance-analytics-9">
        <SectionHeader title="Attendance Heatmap" sub="Daily attendance rate, last 4 weeks (Mon-Fri)" />
        <div className="attendance-analytics-37">
          <div className="attendance-analytics-38">
            <div className="attendance-analytics-39">
              <div />
              {days.map((d) => <div key={d} className="attendance-analytics-40">{d}</div>)}
            </div>
            {heatmapWeeks.map((week) => (
              <div key={week.week} className="attendance-analytics-39">
                <div className="attendance-analytics-41">{week.week}</div>
                {dayKeys.map((key) => {
                  const val = week[key];
                  return (
                    <div key={key} className={`h-12 rounded-lg flex items-center justify-center text-sm font-bold text-white ${heatColor(val)}`} title={val === null || val === undefined ? 'No data' : `${val}%`}>
                      {val === null || val === undefined ? '—' : `${val}%`}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}