import './StudentAttendance.css';
import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Card, SectionHeader, ProgressBar, Badge } from '../../components/ui/index';
import { useAuth } from '../../context/AuthContext';
import { studentApi } from '../../lib/api';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ATTENDANCE_THRESHOLD = 75;

/** Groups flat attendance records into one calendar block per (year, month) present in the data. */
function buildMonthBlocks(records) {
  const byMonth = new Map();
  for (const r of records) {
    const d = new Date(r.date);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (!byMonth.has(key)) byMonth.set(key, { year: d.getFullYear(), month: d.getMonth(), byDate: new Map() });
    byMonth.get(key).byDate.set(d.getDate(), r.status);
  }
  return Array.from(byMonth.values()).sort((a, b) => a.year - b.year || a.month - b.month);
}

export default function StudentAttendance() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState('subject');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    studentApi
      .getAttendance(token)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load attendance');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const tabs = [
    { key: 'overall', label: 'Overall' },
    { key: 'subject', label: 'Subject-wise' },
    { key: 'calendar', label: 'Calendar' },
  ];

  if (loading) {
    return (
      <div className="student-attendance-1">
        <p className="student-attendance-3">Loading attendance…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="student-attendance-1">
        <Card className="student-attendance-12">
          <p className="student-attendance-3">Couldn't load attendance: {error}</p>
        </Card>
      </div>
    );
  }

  const subjectAttendance = data.summary;
  const overall = data.overall;
  const monthBlocks = buildMonthBlocks(data.records);
  const lowAttendance = subjectAttendance.filter((s) => s.percentage < s.threshold);

  return (
    <div className="student-attendance-1">
      {/* Header */}
      <div>
        <h2 className="student-attendance-2">My Attendance</h2>
        <p className="student-attendance-3">Overview across all recorded classes</p>
      </div>

      {/* Summary stat strip */}
      <div className="student-attendance-4">
        {[
          { label: 'Overall Attendance', value: `${overall.percentage}%`, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Absences this Month', value: overall.absencesThisMonth, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Classes Attended', value: `${overall.present} / ${overall.total}`, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Subjects Below 75%', value: lowAttendance.length, color: 'text-red-600', bg: 'bg-red-50' },
        ].map((s) => (
          <Card key={s.label} className="student-attendance-5">
            <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center shrink-0`}>
              <span className={`text-lg font-bold ${s.color}`}>{String(s.value).length <= 4 ? s.value : ''}</span>
            </div>
            <div>
              <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
              <p className="student-attendance-6">{s.label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Low attendance warning */}
      {lowAttendance.length > 0 && (
        <div className="student-attendance-7">
          <AlertTriangle className="student-attendance-8" />
          <div>
            <p className="student-attendance-9">Low Attendance Warning</p>
            <p className="student-attendance-10">
              {lowAttendance.map((s) => s.subject).join(', ')} — attendance is below the 75% minimum required for
              exam eligibility. You must attend upcoming classes to avoid debarment.
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="student-attendance-11">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overall' && (
        <Card className="student-attendance-12">
          <SectionHeader title="Overall Attendance Summary" sub="Across all subjects" />
          <div className="student-attendance-13">
            <div className="student-attendance-14">
              <svg viewBox="0 0 120 120" className="student-attendance-15">
                <circle cx="60" cy="60" r="48" fill="none" stroke="#f1f5f9" strokeWidth="12" />
                <circle
                  cx="60"
                  cy="60"
                  r="48"
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={`${(overall.percentage / 100) * 301.6} 301.6`}
                />
              </svg>
              <div className="student-attendance-16">
                <span className="student-attendance-17">{overall.percentage}%</span>
                <span className="student-attendance-6">Overall</span>
              </div>
            </div>
            <p className="student-attendance-18">
              You have attended <span className="student-attendance-19">{overall.present} out of {overall.total}</span> classes.
            </p>
            <p className="student-attendance-20">
              Minimum required: {ATTENDANCE_THRESHOLD}% ·{' '}
              {lowAttendance.length > 0
                ? `Focus on ${lowAttendance.map((s) => s.subject).join(', ')} to recover eligibility.`
                : 'You are meeting the minimum in every subject.'}
            </p>
          </div>
          <div className="student-attendance-21">
            {[
              { label: 'Present', count: overall.present, icon: <CheckCircle className="student-attendance-22" /> },
              { label: 'Late', count: overall.late, icon: <Clock className="student-attendance-23" /> },
              { label: 'Absent', count: overall.absent, icon: <XCircle className="student-attendance-24" /> },
            ].map((s) => (
              <div key={s.label} className="student-attendance-25">
                {s.icon}
                <span className="student-attendance-26">{s.count}</span>
                <span className="student-attendance-6">{s.label}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {activeTab === 'subject' && (
        <Card className="student-attendance-27">
          <div className="student-attendance-28">
            <SectionHeader title="Subject-wise Attendance" sub="Current breakdown" />
          </div>
          <div className="student-attendance-29">
            {subjectAttendance.length === 0 && <p className="student-attendance-6">No attendance records yet.</p>}
            {subjectAttendance.map((s) => (
              <div key={s.subject} className="student-attendance-30">
                <div className="student-attendance-31">
                  <div>
                    <div className="student-attendance-32">
                      <p className="student-attendance-33">{s.subject}</p>
                      {s.percentage < s.threshold && <Badge variant="danger">Below 75%</Badge>}
                    </div>
                    <p className="student-attendance-34">{s.faculty}</p>
                  </div>
                  <div className="student-attendance-35">
                    <span
                      className={`text-base font-bold ${
                        s.percentage < s.threshold ? 'text-red-600' : s.percentage < 80 ? 'text-amber-600' : 'text-green-600'
                      }`}
                    >
                      {s.percentage}%
                    </span>
                    <p className="student-attendance-36">{s.attended}/{s.total} classes</p>
                  </div>
                </div>
                <ProgressBar
                  value={s.percentage}
                  color={s.percentage < s.threshold ? 'red' : s.percentage < 80 ? 'amber' : 'green'}
                  showLabel={false}
                />
                {s.percentage < s.threshold && (
                  <p className="student-attendance-37">You need {s.classesNeeded} more classes to reach 75%</p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {activeTab === 'calendar' && (
        <Card className="student-attendance-38">
          <SectionHeader title="Attendance Calendar" sub="By month, most recent first" />
          <div className="student-attendance-39">
            {[
              { color: 'bg-green-500', label: 'Present' },
              { color: 'bg-amber-400', label: 'Late' },
              { color: 'bg-red-400', label: 'Absent' },
              { color: 'bg-slate-100', label: 'No record' },
            ].map((l) => (
              <div key={l.label} className="student-attendance-40">
                <span className={`w-3 h-3 rounded ${l.color}`} />
                <span className="student-attendance-6">{l.label}</span>
              </div>
            ))}
          </div>

          {monthBlocks.length === 0 && <p className="student-attendance-6">No attendance records yet.</p>}

          {monthBlocks.map((block) => {
            const daysInMonth = new Date(block.year, block.month + 1, 0).getDate();
            // JS getDay(): 0=Sun..6=Sat; convert to Mon-first offset for the grid.
            const firstDay = new Date(block.year, block.month, 1).getDay();
            const offset = (firstDay + 6) % 7;
            return (
              <div key={`${block.year}-${block.month}`}>
                <p className="student-attendance-41">{MONTH_NAMES[block.month]} {block.year}</p>
                <div className="student-attendance-42">
                  {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                    <div key={i} className="student-attendance-43">{d}</div>
                  ))}
                </div>
                <div className="student-attendance-44">
                  {Array.from({ length: offset }).map((_, i) => (
                    <div key={`off-${i}`} />
                  ))}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const d = i + 1;
                    const dayOfWeek = new Date(block.year, block.month, d).getDay();
                    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                    const status = block.byDate.get(d);
                    if (isWeekend && !status) return <div key={d} className="student-attendance-45">{d}</div>;
                    const bg =
                      status === 'present'
                        ? 'bg-green-500 text-white'
                        : status === 'late'
                        ? 'bg-amber-400 text-white'
                        : status === 'absent'
                        ? 'bg-red-400 text-white'
                        : 'bg-slate-100 text-slate-400';
                    return (
                      <div key={d} className={`aspect-square rounded flex items-center justify-center text-[10px] font-medium ${bg}`}>
                        {d}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}