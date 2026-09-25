import './FacultyWorkload.css';
import { useEffect, useState } from 'react';
import { CheckCircle, X, MessageSquare, AlertTriangle, BookOpen, ClipboardList, BookMarked, Users, FileText } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar } from 'recharts';
import { Card, SectionHeader, AIInsightCard, Badge, ProgressBar } from '../../components/ui/index';
import { useAuth } from '../../context/AuthContext';
import { facultyApi } from '../../lib/api';

// Cosmetic icon/color lookup for the "Workload Breakdown" list — the backend
// only returns { activity, hours }, since icons aren't data.
const BREAKDOWN_STYLE = {
  'Teaching Hours': { icon: <BookOpen className="faculty-workload-1" />, color: 'text-violet-600', bg: 'bg-violet-50' },
  'Evaluation Hours': { icon: <ClipboardList className="faculty-workload-1" />, color: 'text-blue-600', bg: 'bg-blue-50' },
  'Lesson Planning': { icon: <BookMarked className="faculty-workload-1" />, color: 'text-amber-600', bg: 'bg-amber-50' },
  'Student Support': { icon: <Users className="faculty-workload-1" />, color: 'text-green-600', bg: 'bg-green-50' },
  'Administrative': { icon: <FileText className="faculty-workload-1" />, color: 'text-slate-600', bg: 'bg-slate-50' },
};

// Workload gauge SVG
function WorkloadGauge({
  score
}) {
  const clampedScore = Math.min(100, Math.max(0, score));
  const rotation = clampedScore / 100 * 180;
  const isHigh = score >= 85;
  const isMedium = score >= 65;
  const color = isHigh ? '#dc2626' : isMedium ? '#d97706' : '#16a34a';
  const label = isHigh ? 'HIGH' : isMedium ? 'MEDIUM' : 'NORMAL';
  return <div className="faculty-workload-2">
      <div className="faculty-workload-3">
        <svg viewBox="0 0 140 70" className="faculty-workload-4">
          {/* Track */}
          <path d="M 10 65 A 55 55 0 0 1 130 65" fill="none" stroke="#f1f5f9" strokeWidth="12" strokeLinecap="round" />
          {/* Green zone */}
          <path d="M 10 65 A 55 55 0 0 1 130 65" fill="none" stroke="#dcfce7" strokeWidth="12" strokeLinecap="round" strokeDasharray={`${65 / 100 * 172.8} 172.8`} />
          {/* Amber zone */}
          <path d="M 10 65 A 55 55 0 0 1 130 65" fill="none" stroke="#fef3c7" strokeWidth="12" strokeLinecap="round" strokeDasharray={`${85 / 100 * 172.8} 172.8`} />
          {/* Active arc */}
          <path d="M 10 65 A 55 55 0 0 1 130 65" fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${clampedScore / 100 * 172.8} 172.8`} />
          {/* Needle */}
          <g transform={`translate(70, 65) rotate(${rotation - 90})`}>
            <line x1="0" y1="2" x2="0" y2="-44" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" />
            <circle cx="0" cy="0" r="4.5" fill="#0f172a" />
          </g>
        </svg>
      </div>
      <div className="faculty-workload-5">{score}</div>
      <div className={`text-xs font-bold px-3 py-0.5 rounded-full mt-1.5 ${isHigh ? 'bg-red-100 text-red-700' : isMedium ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>{label}</div>
      <p className="faculty-workload-6">Workload Index</p>
    </div>;
}
export default function FacultyWorkload() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    facultyApi
      .getWorkload(token)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load workload data');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return <div className="faculty-workload-7"><p className="faculty-workload-9">Loading workload…</p></div>;
  }
  if (error || !data) {
    return <div className="faculty-workload-7"><p className="faculty-workload-9">Couldn't load workload data: {error}</p></div>;
  }

  const {
    facultyName,
    totalHours,
    recommendedMaxHours,
    capacityUsedPct,
    workloadIndex,
    activeClasses,
    workloadBreakdown,
    weeklyDistribution,
    engagementData,
    radarData,
    engagementIndex,
    workloadInsight,
  } = data;

  const overloaded = totalHours > recommendedMaxHours;

  return <div className="faculty-workload-7">
      {/* Header */}
      <div>
        <h1 className="faculty-workload-8">
          Workload Overview
          <Badge variant={overloaded ? 'danger' : 'success'}>{overloaded ? 'High Load' : 'Normal Load'}</Badge>
        </h1>
        <p className="faculty-workload-9">{facultyName}</p>
      </div>

      <div className="faculty-workload-10">
        {/* Gauge + status */}
        <Card className="faculty-workload-11">
          <WorkloadGauge score={workloadIndex} />
          <div className="faculty-workload-12">
            <div className="faculty-workload-13">
              <span className="faculty-workload-14">Total Hours/Week</span>
              <span className="faculty-workload-15">{totalHours}h</span>
            </div>
            <div className="faculty-workload-13">
              <span className="faculty-workload-14">Recommended Max</span>
              <span className="faculty-workload-16">{recommendedMaxHours}h</span>
            </div>
            <div className="faculty-workload-13">
              <span className="faculty-workload-14">Active Classes</span>
              <span className="faculty-workload-17">{activeClasses} classes</span>
            </div>
            <div className="faculty-workload-18">
              <div className="faculty-workload-19">
                <span className="faculty-workload-20">Capacity used</span>
                <span className="faculty-workload-21">{capacityUsedPct}%</span>
              </div>
              <div className="faculty-workload-22">
                <div className="faculty-workload-23" style={{
                width: `${Math.min(100, capacityUsedPct)}%`
              }} />
              </div>
            </div>
          </div>
        </Card>

        {/* Breakdown table */}
        <Card className="faculty-workload-24">
          <SectionHeader title="Workload Breakdown" sub="Hours per category this week" />
          <div className="faculty-workload-25">
            {workloadBreakdown.map(item => {
              const style = BREAKDOWN_STYLE[item.activity] || BREAKDOWN_STYLE['Administrative'];
              return <div key={item.activity} className="faculty-workload-26">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${style.bg} ${style.color}`}>
                  {style.icon}
                </div>
                <div className="faculty-workload-27">
                  <div className="faculty-workload-28">
                    <span className="faculty-workload-29">{item.activity}</span>
                    <span className="faculty-workload-30">{item.hours}h</span>
                  </div>
                  <ProgressBar value={item.hours} max={totalHours || 1} color={style.color.includes('violet') ? 'violet' : style.color.includes('blue') ? 'blue' : style.color.includes('amber') ? 'amber' : style.color.includes('green') ? 'green' : 'blue'} />
                </div>
              </div>;
            })}
            <div className="faculty-workload-31">
              <span className="faculty-workload-32">Total Weekly Hours</span>
              <span className="faculty-workload-33">{totalHours}h</span>
            </div>
          </div>
        </Card>

        {/* Weekly distribution chart */}
        <Card className="faculty-workload-24">
          <SectionHeader title="Weekly Distribution" sub="Hours spent per day this week" />
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={weeklyDistribution} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="day" tick={{
              fontSize: 11,
              fill: '#94a3b8'
            }} axisLine={false} tickLine={false} />
              <YAxis tick={{
              fontSize: 11,
              fill: '#94a3b8'
            }} axisLine={false} tickLine={false} width={25} />
              <Tooltip contentStyle={{
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              fontSize: '12px'
            }} formatter={v => [`${v}h`, 'Hours']} />
              <Bar dataKey="hours" fill="#7c3aed" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <p className="faculty-workload-34">Based on your saved timetable this week</p>
        </Card>
      </div>

      {/* AI Recommendation */}
      <Card className="faculty-workload-24">
        <SectionHeader title="AI Workload Recommendation" sub="Intelligent suggestions for optimizing your schedule" badge={<Badge variant="ai">AI Insight</Badge>} />
        <AIInsightCard insight={workloadInsight} />
        <div className="faculty-workload-35">
          <button className="faculty-workload-36">
            <CheckCircle className="faculty-workload-1" />
            Accept Recommendation
          </button>
          <button className="faculty-workload-37">
            <MessageSquare className="faculty-workload-1" />
            Request Review
          </button>
          <button className="faculty-workload-38">
            <X className="faculty-workload-1" />
            Dismiss
          </button>
        </div>
        <p className="faculty-workload-39">
          <AlertTriangle className="faculty-workload-40" />
          AI recommendations are framed as workload optimization, not performance surveillance. Data is used only for academic planning.
        </p>
      </Card>

      {/* Academic Engagement Index */}
      <div className="faculty-workload-41">
        <Card className="faculty-workload-24">
          <SectionHeader title="Academic Engagement Index" sub={`${facultyName} · Current semester`} />
          <div className="faculty-workload-42">
            <div className="faculty-workload-43">
              <svg viewBox="0 0 120 120" className="faculty-workload-44">
                <circle cx="60" cy="60" r="48" fill="none" stroke="#f1f5f9" strokeWidth="10" />
                <circle cx="60" cy="60" r="48" fill="none" stroke="#7c3aed" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${engagementIndex / 100 * 301.6} 301.6`} transform="rotate(-90 60 60)" />
              </svg>
              <div className="faculty-workload-45">
                <span className="faculty-workload-46">{engagementIndex}%</span>
                <span className="faculty-workload-47">Engagement</span>
              </div>
            </div>
          </div>

          <div className="faculty-workload-48">
            {engagementData.map(item => <div key={item.metric}>
                <div className="faculty-workload-49">
                  <span className="faculty-workload-50">{item.metric}</span>
                  <span className="faculty-workload-51">{item.value}%</span>
                </div>
                <ProgressBar value={item.value} color="violet" />
              </div>)}
          </div>
        </Card>

        <Card className="faculty-workload-24">
          <SectionHeader title="Engagement Radar" sub="Multi-dimension performance view" />
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
              <PolarGrid stroke="#f1f5f9" />
              <PolarAngleAxis dataKey="metric" tick={{
              fontSize: 11,
              fill: '#64748b'
            }} />
              <Radar name="Engagement" dataKey="value" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.15} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
          <div className="faculty-workload-52">
            <p className="faculty-workload-47">Overall Academic Engagement Score: <span className="faculty-workload-53">{engagementIndex}%</span></p>
          </div>
        </Card>
      </div>
    </div>;
}