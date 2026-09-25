import { useEffect } from 'react';
import { NavigationProvider, useNav } from './context/NavigationContext';
import { AuthProvider, useAuth } from './context/AuthContext';

// Auth / public pages
import LandingPage from './pages/LandingPage';
import AuthGateway from './pages/AuthGateway';
import AdminLogin from './pages/auth/AdminLogin';
import FacultyStudentLogin from './pages/auth/FacultyStudentLogin';
import InstituteCreation from './pages/auth/InstituteCreation';
import JoinInstitution from './pages/auth/JoinInstitution';

// Layouts
import StudentLayout from './components/layout/StudentLayout';
import FacultyLayout from './components/layout/FacultyLayout';
import AdminLayout from './components/layout/AdminLayout';
import SuperAdminLayout from './components/layout/SuperAdminLayout';

// ── Student pages ───────────────────────────────────────────────
import StudentDashboard from './pages/student/StudentDashboard';
import StudentAttendance from './pages/student/StudentAttendance';
import StudentAssignments from './pages/student/StudentAssignments';
import AIStudyAssistant from './pages/student/AIStudyAssistant';
import StudentPerformance from './pages/student/StudentPerformance';
import StudentTimetable from './pages/student/StudentTimetable';
import StudentResources from './pages/student/StudentResources';
import StudentNotices from './pages/student/StudentNotices';
import StudentFeedback from './pages/student/StudentFeedback';
import StudentProfile from './pages/student/StudentProfile';
import StudentSettings from './pages/student/StudentSettings';
import StudentPeriodicTests from './pages/student/StudentPeriodicTests';

// ── Faculty pages ────────────────────────────────────────────────
import FacultyDashboard from './pages/faculty/FacultyDashboard';
import SmartAttendance from './pages/faculty/SmartAttendance';
import FacultyAssignments from './pages/faculty/FacultyAssignments';
import FacultyWorkload from './pages/faculty/FacultyWorkload';
import FacultyClasses from './pages/faculty/FacultyClasses';
import FacultyTimetable from './pages/faculty/FacultyTimetable';
import FacultyStudentPerformance from './pages/faculty/FacultyStudentPerformance';
import FacultyResources from './pages/faculty/FacultyResources';
import FacultyNotices from './pages/faculty/FacultyNotices';
import FacultyFeedback from './pages/faculty/FacultyFeedback';
import FacultyProfile from './pages/faculty/FacultyProfile';
import FacultySettings from './pages/faculty/FacultySettings';

// ── Admin pages ──────────────────────────────────────────────────
import AdminDashboard from './pages/admin/AdminDashboard';
import StudentManagement from './pages/admin/StudentManagement';
import FacultyManagement from './pages/admin/FacultyManagement';
import SmartTimetable from './pages/admin/SmartTimetable';
import JoinRequests from './pages/admin/JoinRequests';
import Reports from './pages/admin/Reports';
import AdminInstitution from './pages/admin/AdminInstitution';
import AdminDepartments from './pages/admin/AdminDepartments';
import AdminCourses from './pages/admin/AdminCourses';
import AdminWorkload from './pages/admin/AdminWorkload';
import NoticeCenter from './pages/admin/NoticeCenter';
import AdminResources from './pages/admin/AdminResources';
import AdminFeedback from './pages/admin/AdminFeedback';
import AdminSettings from './pages/admin/AdminSettings';

// ── Super Admin ──────────────────────────────────────────────────
import SuperAdminDashboard from './pages/superadmin/SuperAdminDashboard';

// ────────────────────────────────────────────────────────────────

// Where an authenticated user of each role lands / where an unauthenticated
// visitor gets sent back to if they try to open a role's portal directly.
const ROLE_HOME = {
  student: 'student/dashboard',
  faculty: 'faculty/dashboard',
  admin: 'admin/dashboard',
  superadmin: 'superadmin/overview'
};
const ROLE_LOGIN_PAGE = {
  student: 'student-login',
  faculty: 'faculty-login',
  admin: 'admin-login',
  // No dedicated superadmin login UI exists yet, so send them to the
  // gateway instead of a 404-ish page.
  superadmin: 'auth'
};

function FullPageLoader() {
  return <div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">
      Loading…
    </div>;
}

// Guards a portal: redirects to that role's login page if the visitor isn't
// authenticated as that role. Runs the redirect in an effect (not during
// render) and renders nothing in between to avoid a flash of protected UI.
function RequireRole({
  requiredRole,
  children
}) {
  const {
    navigate
  } = useNav();
  const {
    isAuthenticated,
    role,
    initializing
  } = useAuth();
  const authorized = isAuthenticated && role === requiredRole;
  useEffect(() => {
    if (initializing || authorized) return;
    navigate(ROLE_LOGIN_PAGE[requiredRole] ?? 'auth');
  }, [initializing, authorized, requiredRole]);
  if (initializing) return <FullPageLoader />;
  if (!authorized) return null;
  return children;
}

// If someone who is already logged in lands on a public/auth page, send
// them straight to their dashboard instead of showing the login form again.
function RedirectIfAuthenticated({
  children
}) {
  const {
    navigate
  } = useNav();
  const {
    isAuthenticated,
    role,
    initializing
  } = useAuth();
  useEffect(() => {
    if (initializing || !isAuthenticated) return;
    navigate(ROLE_HOME[role] ?? 'landing');
  }, [initializing, isAuthenticated, role]);
  if (initializing) return <FullPageLoader />;
  if (isAuthenticated) return null;
  return children;
}

function StudentPortal() {
  const {
    currentPage
  } = useNav();
  const pages = {
    'student/dashboard': <StudentDashboard />,
    'student/attendance': <StudentAttendance />,
    'student/assignments': <StudentAssignments />,
    'student/ai-assistant': <AIStudyAssistant />,
    'student/performance': <StudentPerformance />,
    'student/timetable': <StudentTimetable />,
    'student/resources': <StudentResources />,
    'student/notices': <StudentNotices />,
    'student/feedback': <StudentFeedback />,
    'student/profile': <StudentProfile />,
    'student/settings': <StudentSettings />,
    'student/periodic-tests': <StudentPeriodicTests />
  };
  return <RequireRole requiredRole="student">
      <StudentLayout>{pages[currentPage] ?? <StudentDashboard />}</StudentLayout>
    </RequireRole>;
}
function FacultyPortal() {
  const {
    currentPage
  } = useNav();
  const pages = {
    'faculty/dashboard': <FacultyDashboard />,
    'faculty/classes': <FacultyClasses />,
    'faculty/attendance': <SmartAttendance />,
    'faculty/timetable': <FacultyTimetable />,
    'faculty/assignments': <FacultyAssignments />,
    'faculty/workload': <FacultyWorkload />,
    'faculty/performance': <FacultyStudentPerformance />,
    'faculty/resources': <FacultyResources />,
    'faculty/notices': <FacultyNotices />,
    'faculty/feedback': <FacultyFeedback />,
    'faculty/profile': <FacultyProfile />,
    'faculty/settings': <FacultySettings />
  };
  return <RequireRole requiredRole="faculty">
      <FacultyLayout>{pages[currentPage] ?? <FacultyDashboard />}</FacultyLayout>
    </RequireRole>;
}
function AdminPortal() {
  const {
    currentPage
  } = useNav();
  const pages = {
    'admin/dashboard': <AdminDashboard />,
    'admin/institution': <AdminInstitution />,
    'admin/students': <StudentManagement />,
    'admin/faculty': <FacultyManagement />,
    'admin/departments': <AdminDepartments />,
    'admin/courses': <AdminCourses />,
    'admin/timetable': <SmartTimetable />,
    'admin/workload': <AdminWorkload />,
    'admin/notices': <NoticeCenter />,
    'admin/resources': <AdminResources />,
    'admin/feedback': <AdminFeedback />,
    'admin/join-requests': <JoinRequests />,
    'admin/reports': <Reports />,
    'admin/settings': <AdminSettings />
  };
  return <RequireRole requiredRole="admin">
      <AdminLayout>{pages[currentPage] ?? <AdminDashboard />}</AdminLayout>
    </RequireRole>;
}
function SuperAdminPortal() {
  return <RequireRole requiredRole="superadmin">
      <SuperAdminLayout>
        <SuperAdminDashboard />
      </SuperAdminLayout>
    </RequireRole>;
}
function Router() {
  const {
    currentPage
  } = useNav();
  if (currentPage.startsWith('student/')) return <StudentPortal />;
  if (currentPage.startsWith('faculty/')) return <FacultyPortal />;
  if (currentPage.startsWith('admin/')) return <AdminPortal />;
  if (currentPage.startsWith('superadmin/')) return <SuperAdminPortal />;
  switch (currentPage) {
    case 'landing':
      return <LandingPage />;
    case 'auth':
      return <AuthGateway />;
    case 'admin-login':
      return <RedirectIfAuthenticated><AdminLogin /></RedirectIfAuthenticated>;
    case 'faculty-login':
      return <RedirectIfAuthenticated><FacultyStudentLogin type="faculty" /></RedirectIfAuthenticated>;
    case 'student-login':
      return <RedirectIfAuthenticated><FacultyStudentLogin type="student" /></RedirectIfAuthenticated>;
    case 'institute-creation':
      return <RedirectIfAuthenticated><InstituteCreation /></RedirectIfAuthenticated>;
    case 'join-institution':
      return <JoinInstitution />;
    default:
      return <LandingPage />;
  }
}
export default function App() {
  return <AuthProvider>
      <NavigationProvider>
        <Router />
      </NavigationProvider>
    </AuthProvider>;
}