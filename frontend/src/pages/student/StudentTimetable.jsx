import './StudentTimetable.css';
import { useEffect, useState } from 'react';
import { Clock, MapPin, User } from 'lucide-react';
import { Card, Badge, SectionHeader } from '../../components/ui/index';
import { useAuth } from '../../context/AuthContext';
import { studentApi } from '../../lib/api';

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

// Backend now returns a real `type` per slot (Lecture/Tutorial/Lab/Sports/
// Library); "Break" is a frontend-only synthetic row, never sent by the API.
const typeConfig = {
  Lecture: { bg: 'bg-blue-50 border-blue-200', dot: 'bg-blue-500', badge: 'info', icon: 'text-blue-500' },
  Lab: { bg: 'bg-violet-50 border-violet-200', dot: 'bg-violet-500', badge: 'ai', icon: 'text-violet-500' },
  Tutorial: { bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-500', badge: 'warning', icon: 'text-amber-500' },
  Sports: { bg: 'bg-green-50 border-green-200', dot: 'bg-green-500', badge: 'success', icon: 'text-green-500' },
  Library: { bg: 'bg-rose-50 border-rose-200', dot: 'bg-rose-500', badge: 'danger', icon: 'text-rose-500' },
  Break: { bg: 'bg-slate-50 border-slate-200', dot: 'bg-slate-300', badge: 'neutral', icon: 'text-slate-400' },
};

function groupByDay(slots) {
  const map = {};
  for (const day of days) map[day] = [];
  for (const s of slots) {
    if (map[s.day]) map[s.day].push(s);
  }
  return map;
}

export default function StudentTimetable() {
  const { token } = useAuth();
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const todayName = days[new Date().getDay() - 1] ?? days[0];
  const [activeDay, setActiveDay] = useState(todayName);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    studentApi
      .getTimetable(token)
      .then((res) => {
        if (!cancelled) setSlots(res.slots);
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

  if (loading) return <div className="student-timetable-1"><p className="student-timetable-3">Loading timetable…</p></div>;
  if (error) return <div className="student-timetable-1"><Card className="student-timetable-23"><p className="student-timetable-3">Couldn't load timetable: {error}</p></Card></div>;

  const byDay = groupByDay(slots);
  const daySlots = byDay[activeDay] ?? [];
  const allTimes = Array.from(new Set(slots.map((s) => s.time))).sort();

  return (
    <div className="student-timetable-1">
      {/* Header */}
      <div>
        <h2 className="student-timetable-2">Weekly Timetable</h2>
        <p className="student-timetable-3">Your section's weekly schedule</p>
      </div>

      {/* Legend */}
      <div className="student-timetable-4">
        {Object.keys(typeConfig).map((type) => (
          <div key={type} className="student-timetable-5">
            <span className={`w-2.5 h-2.5 rounded-full ${typeConfig[type].dot}`} />
            <span className="student-timetable-6">{type}</span>
          </div>
        ))}
      </div>

      {/* Day picker (mobile-friendly tab strip, doubles as day selector for the grid below) */}
      <div className="student-timetable-4">
        {days.map((day) => (
          <button
            key={day}
            onClick={() => setActiveDay(day)}
            className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeDay === day ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {day}
            {day === todayName && <span className="student-timetable-27"> · Today</span>}
          </button>
        ))}
      </div>

      {/* Mobile: card-based timeline */}
      <div className="student-timetable-13">
        {daySlots.length === 0 && <Card className="student-timetable-23"><p className="student-timetable-3">No classes scheduled for {activeDay}.</p></Card>}
        {daySlots.map((slot, i) => {
          const config = typeConfig[slot.type] ?? typeConfig.Lecture;
          return (
            <div key={i} className={`relative rounded-xl border p-4 ${config.bg}`}>
              <div className="student-timetable-16">
                <div className="student-timetable-17">
                  <div className="student-timetable-18">
                    <span className={`w-2 h-2 rounded-full ${config.dot}`} />
                    <h3 className="student-timetable-19">{slot.subject}</h3>
                  </div>
                  <div className="student-timetable-20">
                    <div className="student-timetable-21">
                      <Clock className={`w-3.5 h-3.5 ${config.icon}`} />
                      {slot.time}
                    </div>
                    {slot.faculty && (
                      <div className="student-timetable-21">
                        <User className={`w-3.5 h-3.5 ${config.icon}`} />
                        {slot.faculty}
                      </div>
                    )}
                    {slot.room && (
                      <div className="student-timetable-21">
                        <MapPin className={`w-3.5 h-3.5 ${config.icon}`} />
                        {slot.room}
                      </div>
                    )}
                  </div>
                </div>
                <Badge variant={config.badge}>{slot.type}</Badge>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop: full week grid view */}
      <div className="student-timetable-22">
        <Card className="student-timetable-23">
          <div className="student-timetable-24">
            <div className="student-timetable-25">
              <p className="student-timetable-26">Time</p>
            </div>
            {days.map((day) => (
              <div key={day} className={`p-4 text-center ${day === activeDay ? 'bg-blue-50' : 'bg-slate-50'}`}>
                <p className={`text-sm font-semibold ${day === activeDay ? 'text-blue-700' : 'text-slate-700'}`}>{day}</p>
                {day === todayName && <span className="student-timetable-27">Today</span>}
              </div>
            ))}
          </div>

          {allTimes.length === 0 && <p className="student-timetable-3">No timetable slots found for your section yet.</p>}

          {allTimes.map((time, ti) => (
            <div key={time} className={`grid grid-cols-6 divide-x divide-slate-100 ${ti % 2 === 0 ? '' : 'bg-slate-50/40'}`}>
              <div className="student-timetable-28">
                <span className="student-timetable-29">{time}</span>
              </div>

              {days.map((day) => {
                const period = byDay[day].find((p) => p.time === time);
                if (!period) return <div key={day} className="student-timetable-30" />;
                const config = typeConfig[period.type] ?? typeConfig.Lecture;
                if (period.type === 'Break') {
                  return (
                    <div key={day} className="student-timetable-31">
                      <span className="student-timetable-32">{period.subject}</span>
                    </div>
                  );
                }
                return (
                  <div key={day} className={`p-2.5 min-h-[72px] ${config.bg} border-l-2 ${config.dot.replace('bg-', 'border-')}`}>
                    <div className="student-timetable-33">
                      <p className="student-timetable-34">{period.subject}</p>
                      <span className={`text-[9px] font-bold uppercase tracking-wide ${config.dot.replace('bg-', 'text-')}`}>
                        {period.type}
                      </span>
                    </div>
                    {period.faculty && (
                      <div className="student-timetable-35">
                        <User className="student-timetable-36" />
                        <span className="student-timetable-37">{period.faculty}</span>
                      </div>
                    )}
                    {period.room && (
                      <div className="student-timetable-38">
                        <MapPin className="student-timetable-36" />
                        <span className="student-timetable-39">{period.room}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </Card>
      </div>

      {/* Summary card */}
      <Card className="student-timetable-42">
        <SectionHeader title="Weekly Summary" sub={`${activeDay}'s schedule`} />
        <div className="student-timetable-43">
          {[
            { label: 'Total Classes', value: daySlots.filter((s) => s.type !== 'Break').length },
            { label: 'Lectures', value: daySlots.filter((s) => s.type === 'Lecture').length },
            { label: 'Labs', value: daySlots.filter((s) => s.type === 'Lab').length },
            { label: 'Tutorials', value: daySlots.filter((s) => s.type === 'Tutorial').length },
          ].map((s) => (
            <div key={s.label} className="student-timetable-44">
              <p className="student-timetable-2">{s.value}</p>
              <p className="student-timetable-45">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="student-timetable-46">
          <p className="student-timetable-47">Today's Rooms</p>
          <div className="student-timetable-48">
            {Array.from(new Set(daySlots.filter((s) => s.room).map((s) => s.room))).map((room) => (
              <div key={room} className="student-timetable-49">
                <MapPin className="student-timetable-50" />
                <span className="student-timetable-51">{room}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}