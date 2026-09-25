import './FacultyClasses.css';
import { useEffect, useState } from 'react';
import { BookOpen, Users, CheckSquare, ClipboardList, GraduationCap, Clock, FolderOpen } from 'lucide-react';
import { StatCard, Badge, ProgressBar, SectionHeader, Btn } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { facultyApi } from '../../lib/api';
import { useNav } from '../../context/NavigationContext';

function attendanceColor(pct) {
  if (pct == null) return 'blue';
  if (pct >= 80) return 'green';
  if (pct >= 60) return 'amber';
  return 'red';
}

export default function FacultyClasses() {
  const { navigate } = useNav();
  const { token, user } = useAuth();

  const [classes, setClasses] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    facultyApi
      .getMyClasses(token)
      .then((res) => {
        if (!cancelled) setClasses(res.classes || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load classes');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return <div className="faculty-classes-1">
        <p className="faculty-classes-4">Loading your classes…</p>
      </div>;
  }

  if (error) {
    return <div className="faculty-classes-1">
        <p className="faculty-classes-4">Couldn't load your classes: {error}</p>
      </div>;
  }

  const filtered = classes.filter(c => c.subject.toLowerCase().includes(search.toLowerCase()) || (c.department || '').toLowerCase().includes(search.toLowerCase()) || (c.section || '').toLowerCase().includes(search.toLowerCase()));
  // Every subject shares the same roster now — students are enrolled in the
  // course, not a specific subject — so "Total Students" is that one count,
  // not a sum across subject cards (which would multiply it per subject).
  const totalStudents = classes[0]?.students || 0;
  const withAttendance = classes.filter(c => c.attendancePct != null);
  const avgAttendance = withAttendance.length ? Math.round(withAttendance.reduce((s, c) => s + c.attendancePct, 0) / withAttendance.length) : null;
  const subjectCount = new Set(classes.map(c => c.subject)).size;

  return <div className="faculty-classes-1">
      {/* Header */}
      <div className="faculty-classes-2">
        <div>
          <h1 className="faculty-classes-3">My Classes</h1>
          <p className="faculty-classes-4">All classes assigned to {user?.name || 'you'} this semester</p>
        </div>
        <input className="faculty-classes-5" placeholder="Search classes…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Summary bar */}
      <div className="faculty-classes-6">
        <StatCard label="Total Classes" value={classes.length} icon={<BookOpen className="faculty-classes-7" />} color="violet" sub="This semester" />
        <StatCard
          label="Total Students"
          value={totalStudents}
          icon={<Users className="faculty-classes-7" />}
          color="blue"
          sub="Across all classes · click to view roster"
          onClick={classes.length ? () => navigate('faculty/performance', {
            subjectId: classes[0].subjectId,
            section: classes[0].section
          }) : undefined}
        />
        <StatCard label="Avg Attendance" value={avgAttendance != null ? `${avgAttendance}%` : '—'} icon={<CheckSquare className="faculty-classes-7" />} color="green" sub="Across marked classes" />
        <StatCard label="Subjects" value={subjectCount} icon={<GraduationCap className="faculty-classes-7" />} color="amber" sub="Distinct subjects" />
      </div>

      {/* Class cards grid */}
      <div className="faculty-classes-8">
        {filtered.map(cls => {
        const attColor = attendanceColor(cls.attendancePct);
        const attVariant = attColor === 'green' ? 'success' : attColor === 'amber' ? 'warning' : attColor === 'red' ? 'danger' : 'info';
        return <div key={`${cls.subjectId}-${cls.section || 'none'}`} className="faculty-classes-9">
              {/* Top row */}
              <div className="faculty-classes-10">
                <div>
                  <div className="faculty-classes-11">
                    {cls.department && <Badge variant="ai">{cls.department}</Badge>}
                    <Badge variant="neutral">{cls.section ? `Section ${cls.section}` : 'No section'}</Badge>
                  </div>
                  <h3 className="faculty-classes-12">{cls.subject}</h3>
                </div>
                <div className="faculty-classes-14">
                  <Users className="faculty-classes-15" />
                  <span className="faculty-classes-16">{cls.students}</span>
                  <span className="faculty-classes-17">students</span>
                </div>
              </div>

              {/* Attendance */}
              <div className="faculty-classes-18">
                <div className="faculty-classes-19">
                  <span>Attendance</span>
                  <Badge variant={attVariant}>{cls.attendancePct != null ? `${cls.attendancePct}%` : 'No data yet'}</Badge>
                </div>
                <ProgressBar value={cls.attendancePct || 0} color={attColor} />

                <div className="faculty-classes-20">
                  <span>Assignment completion</span>
                  <span className="faculty-classes-21">{cls.assignmentCompletionPct != null ? `${cls.assignmentCompletionPct}%` : 'No data yet'}</span>
                </div>
                <ProgressBar value={cls.assignmentCompletionPct || 0} color="blue" />
              </div>

              {/* Next class */}
              <div className="faculty-classes-22">
                <Clock className="faculty-classes-23" />
                <span>
                  {cls.nextClass ? <><span className="faculty-classes-21">Next:</span> {cls.nextClass.day} {cls.nextClass.time}{cls.nextClass.room ? ` · ${cls.nextClass.room}` : ''}</> : 'Not on your timetable yet'}
                </span>
              </div>

              {/* Quick actions */}
              <div className="faculty-classes-24">
                <button onClick={() => navigate('faculty/attendance')} className="faculty-classes-25">
                  <CheckSquare className="faculty-classes-26" />
                  Take Attendance
                </button>
                <button onClick={() => navigate('faculty/assignments')} className="faculty-classes-27">
                  <ClipboardList className="faculty-classes-26" />
                  Create Assignment
                </button>
                <button onClick={() => navigate('faculty/resources', {
                subject: cls.subject
              })} className="faculty-classes-41">
                  <FolderOpen className="faculty-classes-26" />
                  Class Resources
                </button>
              </div>
            </div>;
      })}
      </div>

      {filtered.length === 0 && <div className="faculty-classes-30">
          <BookOpen className="faculty-classes-31" />
          <p>{classes.length === 0 ? 'No classes assigned yet.' : 'No classes match your search.'}</p>
        </div>}
    </div>;
}