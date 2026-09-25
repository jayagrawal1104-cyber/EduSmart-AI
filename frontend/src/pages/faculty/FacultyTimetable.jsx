import './FacultyTimetable.css';
import { useEffect, useMemo, useState } from 'react';
import { Clock, MapPin, BookOpen, FlaskConical, Calendar } from 'lucide-react';
import { SectionHeader, Badge } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { facultyApi } from '../../lib/api';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
// Which weekdays to show as tabs — Mon–Sat covers a typical Indian academic week.
const DAY_INDICES = [1, 2, 3, 4, 5, 6];

const PALETTE = [
  { color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', dot: 'bg-blue-500' },
  { color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200', dot: 'bg-violet-500' },
  { color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', dot: 'bg-green-500' },
  { color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', dot: 'bg-rose-500' },
  { color: 'text-cyan-700', bg: 'bg-cyan-50', border: 'border-cyan-200', dot: 'bg-cyan-500' },
];
const LAB_COLOR = { color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-500' };

/** Deterministic color per subject name, labs always get the amber lab color. */
function colorFor(subject, colorMap) {
  if (subject.toLowerCase().includes('lab')) return LAB_COLOR;
  return colorMap[subject];
}

function durationHours(start, end) {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return (eh * 60 + em - (sh * 60 + sm)) / 60;
}

export default function FacultyTimetable() {
  const { token } = useAuth();
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const today = new Date();
  const todayIndex = today.getDay();
  const [activeDay, setActiveDay] = useState(DAY_INDICES.includes(todayIndex) ? todayIndex : 1);
  const [view, setView] = useState('week');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    facultyApi
      .getTimetable(token)
      .then((res) => {
        if (!cancelled) setSlots(res.slots || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load timetable');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const subjects = useMemo(() => [...new Set(slots.map((s) => s.subject).filter((s) => !s.toLowerCase().includes('lab')))], [slots]);
  const colorMap = useMemo(() => Object.fromEntries(subjects.map((s, i) => [s, PALETTE[i % PALETTE.length]])), [subjects]);

  if (loading) {
    return <div className="faculty-timetable-1">
        <p className="faculty-timetable-4">Loading your timetable…</p>
      </div>;
  }

  if (error) {
    return <div className="faculty-timetable-1">
        <p className="faculty-timetable-4">Couldn't load your timetable: {error}</p>
      </div>;
  }

  const teachingHours = slots.reduce((sum, s) => sum + durationHours(s.startTime, s.endTime), 0);
  const labsCt = slots.filter((s) => s.subject.toLowerCase().includes('lab')).length;
  const classesCt = slots.length;
  const roomsCt = new Set(slots.map((s) => s.room).filter(Boolean)).size;

  const hours = [...new Set(slots.map((s) => s.startTime))].sort();
  const dayData = slots.filter((s) => s.dayOfWeek === activeDay).sort((a, b) => a.startTime.localeCompare(b.startTime));

  return <div className="faculty-timetable-1">
      {/* Header */}
      <div className="faculty-timetable-2">
        <div>
          <h1 className="faculty-timetable-3">My Timetable</h1>
          <p className="faculty-timetable-4">Your weekly teaching schedule</p>
        </div>
        <div className="faculty-timetable-5">
          <button onClick={() => setView('week')} className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${view === 'week' ? 'bg-violet-600 text-white border-violet-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            Week View
          </button>
          <button onClick={() => setView('day')} className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${view === 'day' ? 'bg-violet-600 text-white border-violet-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            Day View
          </button>
        </div>
      </div>

      {/* Weekly summary */}
      <div className="faculty-timetable-6">
        {[{
        label: 'Teaching Hours',
        value: `${teachingHours} hrs`,
        icon: <Clock className="faculty-timetable-7" />,
        color: 'bg-violet-50 text-violet-600'
      }, {
        label: 'Classes',
        value: classesCt,
        icon: <BookOpen className="faculty-timetable-7" />,
        color: 'bg-blue-50 text-blue-600'
      }, {
        label: 'Labs',
        value: labsCt,
        icon: <FlaskConical className="faculty-timetable-7" />,
        color: 'bg-amber-50 text-amber-600'
      }, {
        label: 'Rooms Used',
        value: roomsCt,
        icon: <Calendar className="faculty-timetable-7" />,
        color: 'bg-green-50 text-green-600'
      }].map(s => <div key={s.label} className="faculty-timetable-8">
            <div className={`p-2 rounded-lg ${s.color}`}>{s.icon}</div>
            <div>
              <div className="faculty-timetable-9">{s.value}</div>
              <div className="faculty-timetable-10">{s.label}</div>
            </div>
          </div>)}
      </div>

      {/* Legend */}
      <div className="faculty-timetable-11">
        {subjects.map(subj => <div key={subj} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${colorMap[subj].bg} ${colorMap[subj].color} ${colorMap[subj].border}`}>
            <div className={`w-2 h-2 rounded-full ${colorMap[subj].dot}`} />
            {subj}
          </div>)}
        {labsCt > 0 && <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${LAB_COLOR.bg} ${LAB_COLOR.color} ${LAB_COLOR.border}`}>
            <div className={`w-2 h-2 rounded-full ${LAB_COLOR.dot}`} />
            Lab
          </div>}
      </div>

      {/* Day tabs */}
      <div className="faculty-timetable-12">
        {DAY_INDICES.map((i) => <button key={i} onClick={() => {
        setActiveDay(i);
        setView('day');
      }} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${activeDay === i && view === 'day' ? 'bg-violet-600 text-white' : i === todayIndex ? 'bg-violet-50 text-violet-700 border border-violet-200' : 'text-slate-600 hover:bg-slate-100'}`}>
            {DAY_NAMES[i].slice(0, 3)}
            {i === todayIndex && <span className="faculty-timetable-13">(Today)</span>}
          </button>)}
      </div>

      {view === 'day' ? (/* Day view */
    <div className="faculty-timetable-14">
          <div className={`px-5 py-3 border-b border-slate-100 flex items-center gap-2 ${activeDay === todayIndex ? 'bg-violet-50' : ''}`}>
            <h2 className="faculty-timetable-15">{DAY_NAMES[activeDay]}</h2>
            {activeDay === todayIndex && <Badge variant="ai">Today</Badge>}
          </div>
          <div className="faculty-timetable-16">
            {dayData.length === 0 && <p className="faculty-timetable-21">No classes scheduled this day.</p>}
            {dayData.map((s) => {
            const c = colorFor(s.subject, colorMap) || PALETTE[0];
            const isLab = s.subject.toLowerCase().includes('lab');
            return <div key={s.id} className="flex gap-4 px-5 py-3 items-start">
                  <div className="faculty-timetable-17">
                    {s.startTime}–{s.endTime}
                  </div>
                  <div className={`flex-1 rounded-lg border p-3 ${c.bg} ${c.border}`}>
                    <div className="faculty-timetable-18">
                      {isLab ? <FlaskConical className={`w-3.5 h-3.5 ${c.color}`} /> : <BookOpen className={`w-3.5 h-3.5 ${c.color}`} />}
                      <span className={`font-semibold text-sm ${c.color}`}>{s.subject}</span>
                      {s.section && <Badge variant="neutral">{s.section}</Badge>}
                      <Badge variant="neutral">{isLab ? 'Lab' : 'Lecture'}</Badge>
                    </div>
                    {s.room && <div className="faculty-timetable-19">
                        <MapPin className="faculty-timetable-20" />
                        {s.room}
                      </div>}
                  </div>
                </div>;
          })}
          </div>
        </div>) : (/* Week view table */
    <div className="faculty-timetable-22">
          <table className="faculty-timetable-23">
            <thead>
              <tr className="faculty-timetable-24">
                <th className="faculty-timetable-25">Time</th>
                {DAY_INDICES.map((i) => <th key={i} className={`text-left px-4 py-3 text-xs font-medium ${i === todayIndex ? 'text-violet-700 bg-violet-50' : 'text-slate-500'}`}>
                    {DAY_NAMES[i]}
                    {i === todayIndex && <span className="faculty-timetable-26">Today</span>}
                  </th>)}
              </tr>
            </thead>
            <tbody>
              {hours.map((hour) => <tr key={hour} className="faculty-timetable-27">
                  <td className="faculty-timetable-28">{hour}</td>
                  {DAY_INDICES.map((di) => {
              const s = slots.find((sl) => sl.dayOfWeek === di && sl.startTime === hour);
              if (!s) return <td key={di} className="faculty-timetable-29" />;
              const c = colorFor(s.subject, colorMap) || PALETTE[0];
              const isLab = s.subject.toLowerCase().includes('lab');
              return <td key={di} className={`px-2 py-1.5 ${di === todayIndex ? 'bg-violet-50/30' : ''}`}>
                        <div className={`rounded-lg border p-2 ${c.bg} ${c.border}`}>
                          <div className={`font-semibold text-xs ${c.color} leading-tight`}>{s.subject}</div>
                          <div className="faculty-timetable-30">{[s.section, s.room].filter(Boolean).join(' · ')}</div>
                          {isLab && <div className="faculty-timetable-31">
                              <Badge variant="warning" size="xs">Lab</Badge>
                            </div>}
                        </div>
                      </td>;
            })}
                </tr>)}
            </tbody>
          </table>
        </div>)}
    </div>;
}