import './StudentDashboard.css';
import { useEffect, useState } from 'react';
import { CalendarCheck2, ClipboardList, BarChart3, ShieldCheck, Clock, AlertTriangle, BookOpen, TrendingUp, ArrowRight } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { StatCard, AIInsightCard, Card, Badge, SectionHeader, Btn } from '../../components/ui/index';
import { useAuth } from '../../context/AuthContext';
import { studentApi } from '../../lib/api';
import { useNav } from '../../context/NavigationContext';

const ATTENDANCE_THRESHOLD = 75;
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Simple client-side risk label from the two numbers the backend gives us. */
function academicRisk(attendancePct, avgPerformance) {
  const att = attendancePct ?? 100;
  const perf = avgPerformance ?? 100;
  if (att < ATTENDANCE_THRESHOLD || perf < 50) return { label: 'HIGH', score: Math.round((att + perf) / 2) };
  if (att < 80 || perf < 70) return { label: 'MEDIUM', score: Math.round((att + perf) / 2) };
  return { label: 'LOW', score: Math.round((att + perf) / 2) };
}

function greetingWord() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function StudentDashboard() {
  const { token, user } = useAuth();
  const { navigate } = useNav();

  const [dashboard, setDashboard] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [performanceTrend, setPerformanceTrend] = useState([]);
  const [subjectPerformance, setSubjectPerformance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      studentApi.getDashboard(token),
      studentApi.getAssignments(token),
      studentApi.getTimetable(token),
      studentApi.getPerformance(token),
    ])
      .then(([dashboardRes, assignmentsRes, timetableRes, performanceRes]) => {
        if (cancelled) return;
        setDashboard(dashboardRes);
        setAssignments(assignmentsRes.assignments || []);
        setTimetable(timetableRes.slots || []);
        setPerformanceTrend(performanceRes.performanceTrend || []);
        setSubjectPerformance(performanceRes.subjectPerformance || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load dashboard');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return (
      <div className="student-dashboard-1">
        <p className="student-dashboard-3">Loading your dashboard…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="student-dashboard-1">
        <p className="student-dashboard-3">Couldn't load your dashboard: {error}</p>
      </div>
    );
  }

  const stats = dashboard?.stats || {};
  const risk = academicRisk(stats.attendancePct, stats.avgPerformance);

  const today = new Date();
  const todayName = DAY_NAMES[today.getDay()];
  const todaySlots = timetable.filter((s) => s.day === todayName).slice(0, 4);

  const pendingAssignments = assignments
    .filter((a) => a.status === 'Pending' || a.status === 'Late')
    .slice(0, 2);

  // Alerts derived from the real numbers we already have — no separate endpoint for these yet.
  const alerts = [];
  if (stats.attendancePct != null && stats.attendancePct < ATTENDANCE_THRESHOLD) {
    alerts.push({
      id: 'attendance',
      type: 'warning',
      title: 'Attendance Below Threshold',
      desc: `Your overall attendance is at ${stats.attendancePct}% — below the ${ATTENDANCE_THRESHOLD}% minimum required for exam eligibility.`,
      action: 'View Attendance',
    });
  }
  if (pendingAssignments.length) {
    const next = pendingAssignments[0];
    const due = new Date(next.dueDate);
    const diff = Math.ceil((due.getTime() - today.getTime()) / 86400000);
    if (diff <= 5) {
      alerts.push({
        id: 'assignment',
        type: 'danger',
        title: 'Pending Assignment Due Soon',
        desc: `${next.title} is due ${diff <= 0 ? 'today' : `in ${diff} day${diff === 1 ? '' : 's'}`} (${next.dueDate}). Submit before the deadline.`,
        action: 'View Assignment',
      });
    }
  }

  // AI-style recommendations derived from real subject performance, not mocked text.
  const studentInsights = [];
  const sortedSubjects = [...subjectPerformance].sort((a, b) => a.score - b.score);
  if (sortedSubjects.length && sortedSubjects[0].score < 80) {
    const weakest = sortedSubjects[0];
    studentInsights.push({
      id: 'SI-weak-subject',
      title: `Focus on ${weakest.subject}`,
      description: `Your ${weakest.subject} average is ${weakest.score}% — the lowest among your subjects.`,
      type: weakest.score < 60 ? 'critical' : 'warning',
      recommendation: `Revisit recent ${weakest.subject} material and reach out to your faculty if needed.`,
      action: 'View Performance',
      confidence: 90,
    });
  }
  if (performanceTrend.length >= 2) {
    const first = performanceTrend.find((p) => p.score != null);
    const last = [...performanceTrend].reverse().find((p) => p.score != null);
    if (first && last && last.score > first.score) {
      studentInsights.push({
        id: 'SI-trend-up',
        title: 'Strong upward performance trend',
        description: `Your academic performance has improved from ${first.score}% (${first.month}) to ${last.score}% (${last.month}).`,
        type: 'success',
        recommendation: 'Maintain consistent assignment submissions and test preparation.',
        action: 'View Performance',
        confidence: 90,
      });
    }
  }

  return <div className="student-dashboard-1">
      {/* Greeting */}
      <div>
        <h2 className="student-dashboard-2">{greetingWord()}, {dashboard?.student?.name || user?.name || 'Student'} 👋</h2>
        <p className="student-dashboard-3">Here's your academic overview for today — {todayName}, {today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.</p>
      </div>

      {/* KPI cards */}
      <div className="student-dashboard-4">
        <StatCard label="Attendance" value={stats.attendancePct != null ? `${stats.attendancePct}%` : '—'} sub="This semester" icon={<CalendarCheck2 className="student-dashboard-5" />} color="blue" />
        <StatCard label="Pending Assignments" value={stats.pendingAssignments ?? '—'} sub="Awaiting submission" icon={<ClipboardList className="student-dashboard-5" />} color="green" />
        <StatCard label="Avg Performance" value={stats.avgPerformance != null ? `${stats.avgPerformance}%` : '—'} sub="Across all subjects" icon={<BarChart3 className="student-dashboard-5" />} color="violet" />
        <StatCard label="Academic Risk" value={risk.label} sub={`Score ${risk.score}/100`} icon={<ShieldCheck className="student-dashboard-5" />} color={risk.label === 'LOW' ? 'green' : risk.label === 'MEDIUM' ? 'amber' : 'red'} />
      </div>

      <div className="student-dashboard-6">
        {/* Left column */}
        <div className="student-dashboard-7">
          {/* Performance Trend */}
          <Card className="student-dashboard-8">
            <SectionHeader title="Performance Trend" sub="Recent months" action={<Btn variant="ghost" size="sm" onClick={() => navigate('student/performance')}>
                  View All
                </Btn>} />
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={performanceTrend} margin={{
              top: 4,
              right: 4,
              left: -20,
              bottom: 0
            }}>
                <defs>
                  <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="assignGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16a34a" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{
                fontSize: 11,
                fill: '#94a3b8'
              }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{
                fontSize: 11,
                fill: '#94a3b8'
              }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
              }}
              formatter={(value, name) => [`${value}%`, name === 'score' ? 'Performance' : 'Assignments']} />
                <Area type="monotone" dataKey="score" stroke="#2563eb" strokeWidth={2} fill="url(#scoreGrad)" dot={{
                r: 3,
                fill: '#2563eb'
              }} />
                <Area type="monotone" dataKey="assignments" stroke="#16a34a" strokeWidth={2} fill="url(#assignGrad)" dot={{
                r: 3,
                fill: '#16a34a'
              }} />
              </AreaChart>
            </ResponsiveContainer>
            <div className="student-dashboard-9">
              <div className="student-dashboard-10">
                <span className="student-dashboard-11" />
                <span className="student-dashboard-12">Performance</span>
              </div>
              <div className="student-dashboard-10">
                <span className="student-dashboard-13" />
                <span className="student-dashboard-12">Assignments</span>
              </div>
            </div>
          </Card>

          {/* Upcoming Assignments */}
          <Card className="student-dashboard-8">
            <SectionHeader title="Upcoming Assignments" sub="Pending submissions" action={<Btn variant="ghost" size="sm" onClick={() => navigate('student/assignments')}>
                  View All
                </Btn>} />
            <div className="student-dashboard-14">
              {pendingAssignments.length === 0 && <p className="student-dashboard-3">No pending assignments — you're all caught up.</p>}
              {pendingAssignments.map(a => {
              const due = new Date(a.dueDate);
              const diff = Math.ceil((due.getTime() - today.getTime()) / 86400000);
              return <div key={a.id} className="student-dashboard-15">
                    <div className="student-dashboard-16">
                      <BookOpen className="student-dashboard-17" />
                    </div>
                    <div className="student-dashboard-18">
                      <p className="student-dashboard-19">{a.title}</p>
                      <p className="student-dashboard-20">{a.subject} · {a.faculty}</p>
                      <div className="student-dashboard-21">
                        <span className={`text-xs font-medium ${diff <= 4 ? 'text-amber-600' : 'text-slate-500'}`}>
                          Due {diff === 0 ? 'today' : diff === 1 ? 'tomorrow' : diff < 0 ? 'passed' : `in ${diff} days`} · {a.dueDate}
                        </span>
                        <Badge variant="info">/{a.totalMarks} marks</Badge>
                      </div>
                    </div>
                    <button className="student-dashboard-22" onClick={() => navigate('student/assignments')}>
                      <ArrowRight className="student-dashboard-23" />
                    </button>
                  </div>;
            })}
            </div>
          </Card>
        </div>

        {/* Right column */}
        <div className="student-dashboard-24">
          {/* Today's Schedule */}
          <Card className="student-dashboard-8">
            <SectionHeader title="Today's Schedule" sub={todayName} action={<Btn variant="ghost" size="sm" onClick={() => navigate('student/timetable')}>
                  Full View
                </Btn>} />
            <div className="student-dashboard-25">
              {todaySlots.length === 0 && <p className="student-dashboard-3">No classes scheduled today.</p>}
              {todaySlots.map((slot, i) => {
              const typeColors = {
                Lecture: 'bg-blue-500',
                Lab: 'bg-violet-500',
                Tutorial: 'bg-amber-500',
                Break: 'bg-slate-300'
              };
              return <div key={i} className="student-dashboard-26">
                    <div className="student-dashboard-27">
                      <div className={`w-2 h-2 rounded-full ${typeColors[slot.type] || 'bg-blue-500'}`} />
                      {i < todaySlots.length - 1 && <div className="student-dashboard-28" />}
                    </div>
                    <div className="student-dashboard-18">
                      <p className="student-dashboard-29">{slot.subject}</p>
                      <div className="student-dashboard-30">
                        <Clock className="student-dashboard-31" />
                        <span className="student-dashboard-12">{slot.time}</span>
                        {slot.room && <span className="student-dashboard-32">· {slot.room}</span>}
                      </div>
                    </div>
                  </div>;
            })}
            </div>
          </Card>

          {/* Academic Alerts */}
          <Card className="student-dashboard-8">
            <SectionHeader title="Academic Alerts" sub="Requires your attention" />
            <div className="student-dashboard-14">
              {alerts.length === 0 && <p className="student-dashboard-3">No alerts — you're on track.</p>}
              {alerts.map(alert => <div key={alert.id} className={`p-3 rounded-xl border ${alert.type === 'warning' ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100'}`}>
                  <div className="student-dashboard-33">
                    <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${alert.type === 'warning' ? 'text-amber-500' : 'text-red-500'}`} />
                    <div>
                      <p className={`text-xs font-semibold ${alert.type === 'warning' ? 'text-amber-800' : 'text-red-800'}`}>{alert.title}</p>
                      <p className="student-dashboard-34">{alert.desc}</p>
                    </div>
                  </div>
                </div>)}
            </div>
          </Card>

          {/* AI Recommendations */}
          <Card className="student-dashboard-8">
            <SectionHeader title="AI Recommendations" sub="Personalised for you" action={<TrendingUp className="student-dashboard-35" />} />
            <div className="student-dashboard-14">
              {studentInsights.length === 0 && <p className="student-dashboard-3">Nothing to flag right now — keep it up.</p>}
              {studentInsights.map(ins => <AIInsightCard key={ins.id} insight={ins} />)}
            </div>
          </Card>
        </div>
      </div>
    </div>;
}