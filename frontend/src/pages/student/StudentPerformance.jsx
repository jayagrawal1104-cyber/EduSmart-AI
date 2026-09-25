import './StudentPerformance.css';
import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Download, Star, AlertTriangle, BarChart3, CalendarCheck2, ClipboardList } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import { Card, SectionHeader, AIBadge, Btn } from '../../components/ui/index';
import { useAuth } from '../../context/AuthContext';
import { studentApi } from '../../lib/api';

export default function StudentPerformance() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    studentApi
      .getPerformance(token)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load performance');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) return <div className="student-performance-1"><p className="student-performance-4">Loading performance…</p></div>;
  if (error) return <div className="student-performance-1"><Card className="student-performance-6"><p className="student-performance-4">Couldn't load performance: {error}</p></Card></div>;

  const { subjectPerformance, performanceTrend, overallScore, strengths, improvements, metrics } = data;

  const trendWithScores = performanceTrend.filter((t) => t.score != null);
  const trendDelta =
    trendWithScores.length >= 2
      ? trendWithScores[trendWithScores.length - 1].score - trendWithScores[trendWithScores.length - 2].score
      : null;

  const lowestSubject = [...subjectPerformance].sort((a, b) => a.score - b.score)[0];

  return (
    <div className="student-performance-1">
      {/* Header */}
      <div className="student-performance-2">
        <div>
          <h2 className="student-performance-3">Academic Performance</h2>
          <p className="student-performance-4">Your scores across recorded tests and assignments</p>
        </div>
        <Btn variant="outline" icon={<Download className="student-performance-5" />}>
          Export Report
        </Btn>
      </div>

      {/* Overall score hero */}
      <Card className="student-performance-6">
        <div className="student-performance-7">
          <div className="student-performance-8">
            <svg viewBox="0 0 120 120" className="student-performance-9">
              <circle cx="60" cy="60" r="48" fill="none" stroke="#f1f5f9" strokeWidth="12" />
              <circle
                cx="60"
                cy="60"
                r="48"
                fill="none"
                stroke="#2563eb"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${((overallScore ?? 0) / 100) * 301.6} 301.6`}
              />
            </svg>
            <div className="student-performance-10">
              <span className="student-performance-11">{overallScore != null ? `${overallScore}%` : '—'}</span>
              <span className="student-performance-12">Overall</span>
            </div>
          </div>
          <div className="student-performance-13">
            <div className="student-performance-14">
              <h3 className="student-performance-15">Overall Score: {overallScore != null ? `${overallScore}%` : 'No data yet'}</h3>
              {trendDelta != null && (
                <div className="student-performance-16">
                  {trendDelta >= 0 ? <TrendingUp className="student-performance-5" /> : <TrendingDown className="student-performance-5" />}
                  {trendDelta >= 0 ? '+' : ''}{trendDelta}% vs previous month
                </div>
              )}
            </div>
            <p className="student-performance-17">
              {overallScore != null ? 'Based on all recorded performance entries this term.' : 'No performance records yet — check back once tests are graded.'}
            </p>
            <div className="student-performance-18">
              {[
                { label: 'Attendance', value: metrics.attendancePct != null ? `${metrics.attendancePct}%` : '—', icon: <CalendarCheck2 className="student-performance-19" /> },
                { label: 'Assignments', value: metrics.assignmentCompletionPct != null ? `${metrics.assignmentCompletionPct}%` : '—', icon: <ClipboardList className="student-performance-20" /> },
                { label: 'Test Avg', value: metrics.testAvgPct != null ? `${metrics.testAvgPct}%` : '—', icon: <BarChart3 className="student-performance-21" /> },
              ].map((m) => (
                <div key={m.label} className="student-performance-23">
                  <div className="student-performance-24">{m.icon}<span className="student-performance-25">{m.label}</span></div>
                  <p className="student-performance-26">{m.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <div className="student-performance-27">
        {/* Subject Performance */}
        <Card className="student-performance-28">
          <SectionHeader title="Subject Performance" sub="Average score per subject" />
          {subjectPerformance.length === 0 ? (
            <p className="student-performance-25">No performance records yet.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={subjectPerformance} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="subject" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={60} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} formatter={(value) => [`${value}%`, 'Score']} />
                  <Bar dataKey="score" radius={[0, 6, 6, 0]}>
                    {subjectPerformance.map((entry) => (
                      <Cell key={entry.subject} fill={entry.score >= 88 ? '#16a34a' : entry.score >= 80 ? '#2563eb' : entry.score >= 75 ? '#d97706' : '#dc2626'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="student-performance-29">
                {[
                  { color: 'bg-green-600', label: '88%+ Excellent' },
                  { color: 'bg-blue-600', label: '80%+ Good' },
                  { color: 'bg-amber-500', label: '75%+ Average' },
                  { color: 'bg-red-500', label: '<75% Needs Work' },
                ].map((l) => (
                  <div key={l.label} className="student-performance-30">
                    <span className={`w-2.5 h-2.5 rounded-sm ${l.color}`} />
                    <span className="student-performance-31">{l.label}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>

        {/* Performance Trend */}
        <Card className="student-performance-28">
          <SectionHeader title="Performance Trend" sub="Month by month" />
          {performanceTrend.length === 0 ? (
            <p className="student-performance-25">Not enough history yet to chart a trend.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={performanceTrend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="assignGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#16a34a" stopOpacity={0.12} />
                      <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                    formatter={(value, name) => [`${value}%`, name === 'score' ? 'Score' : 'Assignments']}
                  />
                  <Area type="monotone" dataKey="score" stroke="#2563eb" strokeWidth={2} fill="url(#perfGrad)" dot={{ r: 3, fill: '#2563eb' }} connectNulls />
                  <Area type="monotone" dataKey="assignments" stroke="#16a34a" strokeWidth={2} fill="url(#assignGrad)" dot={{ r: 3, fill: '#16a34a' }} connectNulls />
                </AreaChart>
              </ResponsiveContainer>
              <div className="student-performance-32">
                <div className="student-performance-30">
                  <span className="student-performance-33" />
                  <span className="student-performance-25">Performance Score</span>
                </div>
                <div className="student-performance-30">
                  <span className="student-performance-34" />
                  <span className="student-performance-25">Assignment Score</span>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Strengths and Improvements */}
      <div className="student-performance-27">
        <Card className="student-performance-28">
          <SectionHeader title="Strengths" sub="Your top-performing subjects" action={<Star className="student-performance-22" />} />
          <div className="student-performance-35">
            {strengths.length === 0 && <p className="student-performance-25">No data yet.</p>}
            {strengths.map((s, i) => (
              <div key={s.subject} className="student-performance-36">
                <div className="student-performance-37">{i + 1}</div>
                <div className="student-performance-13">
                  <div className="student-performance-38">
                    <span className="student-performance-39">{s.subject}</span>
                    <span className="student-performance-40">{s.score}%</span>
                  </div>
                  <div className="student-performance-41">
                    <div className="student-performance-42" style={{ width: `${s.score}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="student-performance-28">
          <SectionHeader title="Areas to Improve" sub="Subjects below 80%" action={<AlertTriangle className="student-performance-22" />} />
          <div className="student-performance-43">
            {improvements.length === 0 && <p className="student-performance-25">No subjects currently below 80% — nice work.</p>}
            {improvements.map((s) => (
              <div key={s.subject}>
                <div className="student-performance-44">
                  <div className="student-performance-45">
                    <AlertTriangle className="student-performance-46" />
                  </div>
                  <div className="student-performance-13">
                    <div className="student-performance-38">
                      <span className="student-performance-39">{s.subject}</span>
                      <span className="student-performance-47">{s.score}%</span>
                    </div>
                    <div className="student-performance-41">
                      <div className="student-performance-48" style={{ width: `${s.score}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Insights derived from the real data above (not an AI model) */}
      {(trendDelta != null || lowestSubject) && (
        <div>
          <SectionHeader title="Insights" sub="Quick takeaways from your recorded performance" badge={<AIBadge label="Auto-generated" />} />
          <div className="student-performance-50">
            {trendDelta != null && (
              <Card className="student-performance-28">
                <p className="student-performance-39">
                  {trendDelta >= 0
                    ? `Your average score moved up ${trendDelta}% from the previous recorded month.`
                    : `Your average score dropped ${Math.abs(trendDelta)}% from the previous recorded month — worth a check-in.`}
                </p>
              </Card>
            )}
            {lowestSubject && (
              <Card className="student-performance-28">
                <p className="student-performance-39">
                  {lowestSubject.subject} is your lowest-scoring subject at {lowestSubject.score}%. Focusing extra time there will
                  do the most to raise your overall average.
                </p>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}