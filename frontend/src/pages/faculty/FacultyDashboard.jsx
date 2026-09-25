import './FacultyDashboard.css';
import { useEffect, useState } from 'react';
import { BookOpen, Users, ClipboardList, TrendingUp, CheckSquare, Upload, BookMarked, Bell, AlertTriangle, Calendar, Clock, ChevronRight } from 'lucide-react';
import { StatCard, AIInsightCard, SectionHeader, Card, Badge, ProgressBar, Table } from '../../components/ui/index';
import { useAuth } from '../../context/AuthContext';
import { facultyApi } from '../../lib/api';
import { useNav } from '../../context/NavigationContext';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const quickActions = [{
  label: 'Take Attendance',
  icon: <CheckSquare className="faculty-dashboard-1" />,
  page: 'faculty/attendance',
  color: 'bg-violet-50 text-violet-600 border-violet-200 hover:bg-violet-100'
}, {
  label: 'Create Assignment',
  icon: <ClipboardList className="faculty-dashboard-1" />,
  page: 'faculty/assignments',
  color: 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100'
}, {
  label: 'Upload Resource',
  icon: <Upload className="faculty-dashboard-1" />,
  page: 'faculty/resources',
  color: 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100'
}, {
  label: 'Plan Lesson',
  icon: <BookMarked className="faculty-dashboard-1" />,
  page: 'faculty/lesson-planner',
  color: 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100'
}, {
  label: 'Post Notice',
  icon: <Bell className="faculty-dashboard-1" />,
  page: 'faculty/notices',
  color: 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100'
}];
function greetingWord() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function FacultyDashboard() {
  const { navigate } = useNav();
  const { token, user } = useAuth();

  const [dashboard, setDashboard] = useState(null);
  const [classes, setClasses] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [periodicTests, setPeriodicTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      facultyApi.getDashboard(token),
      facultyApi.getMyClasses(token),
      facultyApi.getTimetable(token),
      facultyApi.listAssignments(token),
      facultyApi.listPeriodicTests(token),
    ])
      .then(([dashboardRes, classesRes, timetableRes, assignmentsRes, testsRes]) => {
        if (cancelled) return;
        setDashboard(dashboardRes);
        setClasses(classesRes.classes || []);
        setTimetable(timetableRes.slots || []);
        setAssignments(assignmentsRes.assignments || []);
        setPeriodicTests(testsRes.tests || []);
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
    return <div className="faculty-dashboard-2">
        <p className="faculty-dashboard-4">Loading your dashboard…</p>
      </div>;
  }

  if (error) {
    return <div className="faculty-dashboard-2">
        <p className="faculty-dashboard-4">Couldn't load your dashboard: {error}</p>
      </div>;
  }

  const stats = dashboard?.stats || {};
  const today = new Date();
  const todayName = DAY_NAMES[today.getDay()];
  const todaySlots = timetable
    .filter((s) => s.dayOfWeek === today.getDay())
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  // Pending grading (assignments) + ungraded periodic tests, soonest first.
  const upcomingTasks = [
    ...assignments
      .filter((a) => a.submittedCount - a.gradedCount > 0)
      .map((a) => ({
        task: `Grade ${a.title}`,
        subject: a.subject,
        due: a.dueDate,
        count: a.submittedCount - a.gradedCount,
        type: 'grade',
      })),
    ...periodicTests
      .filter((t) => t.recordedCount < t.totalStudents)
      .map((t) => ({
        task: `Record ${t.title} results`,
        subject: t.subject,
        due: t.date,
        count: t.totalStudents - t.recordedCount,
        type: 'review',
      })),
  ]
    .sort((a, b) => new Date(a.due) - new Date(b.due))
    .slice(0, 4);

  return <div className="faculty-dashboard-2">
      {/* Greeting */}
      <div>
        <h1 className="faculty-dashboard-3">{greetingWord()}, {user?.name || 'Professor'} <span className="wave-emoji">👋</span></h1>
        <p className="faculty-dashboard-4">Here is your teaching overview for today, {todayName}, {today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.</p>
      </div>

      {/* KPIs */}
      <div className="faculty-dashboard-5">
        <StatCard label="Classes Today" value={todaySlots.length} sub={todayName} icon={<BookOpen className="faculty-dashboard-6" />} color="violet" />
        <StatCard label="Total Students" value={stats.totalStudents ?? '—'} sub={`Across ${stats.subjectsTaught ?? 0} subjects`} icon={<Users className="faculty-dashboard-6" />} color="blue" />
        <StatCard label="Pending Evaluations" value={stats.pendingGrading ?? '—'} sub="Submissions awaiting grading" icon={<ClipboardList className="faculty-dashboard-6" />} color="amber" />
        <StatCard label="Avg Attendance" value={stats.avgAttendance != null ? `${stats.avgAttendance}%` : '—'} sub="Across everything you've marked" icon={<TrendingUp className="faculty-dashboard-6" />} color="green" />
      </div>

      {/* Quick Actions */}
      <Card className="faculty-dashboard-7">
        <SectionHeader title="Quick Actions" sub="Jump to frequently used features" />
        <div className="faculty-dashboard-8">
          {quickActions.map(action => <button key={action.label} onClick={() => navigate(action.page)} className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:shadow-none ${action.color}`}>
              {action.icon}
              {action.label}
            </button>)}
        </div>
      </Card>

      <div className="faculty-dashboard-9">
        {/* Your Classes */}
        <Card className="faculty-dashboard-7">
          <SectionHeader title="Your Classes" sub="Subjects you teach" badge={<Badge variant="info">{classes.length}</Badge>} />
          <div className="faculty-dashboard-10">
            {classes.length === 0 && <p className="faculty-dashboard-4">No subjects assigned yet.</p>}
            {classes.slice(0, 5).map((c, i) => <div key={`${c.subjectId}-${i}`} className="faculty-dashboard-11">
                <div className="faculty-dashboard-12">
                  <span className="faculty-dashboard-13">
                    {c.subject.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <div className="faculty-dashboard-14">
                  <p className="faculty-dashboard-15">{c.subject}</p>
                  <p className="faculty-dashboard-16">{c.section ? `Section ${c.section}` : 'No section assigned yet'}</p>
                </div>
              </div>)}
          </div>
          <button onClick={() => navigate('faculty/classes')} className="faculty-dashboard-21">
            View All Classes <ChevronRight className="faculty-dashboard-22" />
          </button>
        </Card>

        {/* Upcoming Tasks */}
        <Card className="faculty-dashboard-7">
          <SectionHeader title="Upcoming Tasks" sub="Pending grading and deadlines" />
          <div className="faculty-dashboard-23">
            {upcomingTasks.length === 0 && <p className="faculty-dashboard-4">Nothing pending — you're all caught up.</p>}
            {upcomingTasks.map((task, i) => <div key={i} className="faculty-dashboard-24">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${task.type === 'grade' ? 'bg-violet-50 text-violet-600' : 'bg-blue-50 text-blue-600'}`}>
                  {task.type === 'grade' ? <ClipboardList className="faculty-dashboard-25" /> : <CheckSquare className="faculty-dashboard-25" />}
                </div>
                <div className="faculty-dashboard-14">
                  <p className="faculty-dashboard-26">{task.task}</p>
                  <p className="faculty-dashboard-27">{task.subject}</p>
                </div>
                <div className="faculty-dashboard-28">
                  <p className="faculty-dashboard-29">{task.due}</p>
                  {task.count > 0 && <p className="faculty-dashboard-19">{task.count} pending</p>}
                </div>
              </div>)}
          </div>
        </Card>

        {/* Today's Schedule */}
        <Card className="faculty-dashboard-7">
          <SectionHeader title="Today's Classes" sub={todayName} />
          <div className="faculty-dashboard-23">
            {todaySlots.length === 0 && <p className="faculty-dashboard-4">No classes scheduled today.</p>}
            {todaySlots.map((slot) => <div key={slot.id} className="faculty-dashboard-30">
                <div className="faculty-dashboard-31">
                  <p className="faculty-dashboard-32">{slot.startTime}</p>
                  <p className="faculty-dashboard-33">{slot.endTime}</p>
                </div>
                <div className="faculty-dashboard-34" />
                <div className="faculty-dashboard-14">
                  <p className="faculty-dashboard-35">{slot.subject}</p>
                  <div className="faculty-dashboard-36">
                    {slot.room && <span className="faculty-dashboard-19">{slot.room}</span>}
                    {slot.room && slot.section && <span className="faculty-dashboard-37">·</span>}
                    {slot.section && <span className="faculty-dashboard-19">{slot.section}</span>}
                  </div>
                </div>
              </div>)}
          </div>
          <button onClick={() => navigate('faculty/timetable')} className="faculty-dashboard-38">
            <Clock className="faculty-dashboard-22" /> Full Timetable
          </button>
        </Card>
      </div>
    </div>;
}