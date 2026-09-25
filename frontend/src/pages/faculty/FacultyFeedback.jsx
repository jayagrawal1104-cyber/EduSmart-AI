import './FacultyFeedback.css';
import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Star, Download, ShieldCheck, MessageSquare } from 'lucide-react';
import { StatCard, SectionHeader } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { facultyApi } from '../../lib/api';

function StarDisplay({ value }) {
  return <div className="faculty-feedback-1">
      {[1, 2, 3, 4, 5].map(i => <Star key={i} className={`w-4 h-4 ${value != null && i <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />)}
    </div>;
}

export default function FacultyFeedback() {
  const { token } = useAuth();

  const [stats, setStats] = useState(null);
  const [starDist, setStarDist] = useState([]);
  const [trend, setTrend] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    facultyApi.getFeedback(token).then(res => {
      setStats(res.stats);
      setStarDist(res.starDist || []);
      setTrend(res.trend || []);
      setSubjects(res.subjects || []);
      setCourse(res.subjects?.[0]?.name ?? null);
      setError(null);
    }).catch(err => {
      setError(err.message || 'Failed to load feedback');
    }).finally(() => {
      setLoading(false);
    });
  }, [token]);

  if (loading) return <div className="faculty-feedback-2"><p>Loading feedback…</p></div>;
  if (error) return <div className="faculty-feedback-2"><p>Couldn't load feedback: {error}</p></div>;

  const active = subjects.find(s => s.name === course);

  return <div className="faculty-feedback-2">
      {/* Header */}
      <div className="faculty-feedback-3">
        <div>
          <h1 className="faculty-feedback-4">Student Feedback</h1>
          <p className="faculty-feedback-5">Aggregated and anonymized feedback from your students</p>
        </div>
        <button disabled title="Report generation isn't wired up yet" className="faculty-feedback-6 opacity-50 cursor-not-allowed">
          <Download className="faculty-feedback-7" />
          Request Detailed Report
        </button>
      </div>

      {/* Privacy notice */}
      <div className="faculty-feedback-8">
        <ShieldCheck className="faculty-feedback-9" />
        <p className="faculty-feedback-10">
          <span className="faculty-feedback-11">Privacy Protected:</span> Feedback is anonymized and aggregated. Individual
          student responses are never attributed to any specific person.
        </p>
      </div>

      {/* Summary stat cards */}
      <div className="faculty-feedback-12">
        <StatCard label="Overall Rating" value={stats.overallRating != null ? `${stats.overallRating} / 5` : '—'} icon={<Star className="faculty-feedback-13" />} color="violet" />
        <StatCard label="Total Reviews" value={stats.totalReviews} icon={<MessageSquare className="faculty-feedback-13" />} color="blue" />
        <StatCard label="This Month's Avg" value={stats.thisMonthAvg != null ? `${stats.thisMonthAvg} / 5` : '—'} icon={<Star className="faculty-feedback-13" />} color="green" />
        <StatCard label="Most Reviewed" value={stats.mostReviewedSubject || '—'} icon={<Star className="faculty-feedback-13" />} color="amber" />
      </div>

      <div className="faculty-feedback-14">
        {/* Star distribution */}
        <div className="faculty-feedback-15">
          <SectionHeader title="Rating Breakdown" sub="Distribution of student ratings" />
          <div className="faculty-feedback-16">
            {starDist.map(s => <div key={s.stars} className="faculty-feedback-17">
                <div className="faculty-feedback-18">
                  <Star className="faculty-feedback-19" />
                  <span className="faculty-feedback-20">{s.stars}</span>
                </div>
                <div className="faculty-feedback-21">
                  <div className="faculty-feedback-22" style={{ width: `${s.pct}%` }} />
                </div>
                <span className="faculty-feedback-23">{s.pct}%</span>
              </div>)}
          </div>
        </div>

        {/* Rating trend */}
        <div className="faculty-feedback-15">
          <SectionHeader title="Rating Trend" sub="Monthly overall rating" />
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis domain={[0, 5]} tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
              <Line type="monotone" dataKey="rating" stroke="#7c3aed" strokeWidth={2.5} dot={{ fill: '#7c3aed', r: 4 }} name="Rating" connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Subject tabs */}
      {subjects.length === 0
        ? <div className="faculty-feedback-24">
            <div className="faculty-feedback-26">
              <p className="text-sm text-slate-500">No student feedback yet.</p>
            </div>
          </div>
        : <div className="faculty-feedback-24">
            <div className="faculty-feedback-25">
              {subjects.map(s => <button key={s.name} onClick={() => setCourse(s.name)} className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${course === s.name ? 'border-b-2 border-violet-600 text-violet-700 bg-violet-50/40' : 'text-slate-500 hover:text-slate-700'}`}>
                  {s.name}
                </button>)}
            </div>

            <div className="faculty-feedback-26">
              {/* Subject summary */}
              <div className="faculty-feedback-27">
                <div className="faculty-feedback-28">
                  <Star className="faculty-feedback-29" />
                  <span className="faculty-feedback-30">{active?.name}</span>
                </div>
                <p className="faculty-feedback-31">
                  {active?.avgRating != null ? `${active.avgRating} / 5 average` : 'No ratings yet'} across {active?.count} review{active?.count === 1 ? '' : 's'}.
                </p>
              </div>

              {/* Individual comments */}
              <div className="space-y-3">
                {active?.feedback.map(f => <div key={f.id} className="border border-slate-100 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1">
                      <StarDisplay value={f.rating} />
                      <span className="text-xs text-slate-400">{f.date}</span>
                    </div>
                    <p className="text-sm text-slate-600">{f.message}</p>
                  </div>)}
              </div>
            </div>
          </div>}
    </div>;
}