import './StudentLayout.css';
import { useState, useRef, useEffect } from 'react';
import { Brain, LayoutDashboard, CalendarCheck2, Calendar, ClipboardList, Sparkles, BookOpen, Library, FileText, BarChart3, Bell, MessageSquare, User, Settings, Search, PanelLeft, ChevronDown, LogOut } from 'lucide-react';
import { useNav } from '../../context/NavigationContext';
import { useAuth } from '../../context/AuthContext';
const navItems = [{
  label: 'Dashboard',
  page: 'student/dashboard',
  icon: <LayoutDashboard className="student-layout-1" />
}, {
  label: 'My Attendance',
  page: 'student/attendance',
  icon: <CalendarCheck2 className="student-layout-1" />
}, {
  label: 'Timetable',
  page: 'student/timetable',
  icon: <Calendar className="student-layout-1" />
}, {
  label: 'Assignments',
  page: 'student/assignments',
  icon: <ClipboardList className="student-layout-1" />
}, {
  label: 'Courses',
  page: 'student/dashboard',
  icon: <BookOpen className="student-layout-1" />
}, {
  label: 'Learning Resources',
  page: 'student/resources',
  icon: <Library className="student-layout-1" />
}, {
  label: 'Periodic Tests',
  page: 'student/periodic-tests',
  icon: <FileText className="student-layout-1" />
}, {
  label: 'Performance',
  page: 'student/performance',
  icon: <BarChart3 className="student-layout-1" />
}, {
  label: 'Feedback',
  page: 'student/feedback',
  icon: <MessageSquare className="student-layout-1" />
}, {
  label: 'Settings',
  page: 'student/settings',
  icon: <Settings className="student-layout-1" />
}];
const pageTitles = {
  'student/dashboard': 'Dashboard',
  'student/attendance': 'My Attendance',
  'student/timetable': 'Timetable',
  'student/assignments': 'Assignments',
  'student/ai-assistant': 'AI Study Assistant',
  'student/resources': 'Learning Resources',
  'student/performance': 'Performance',
  'student/notices': 'Notices',
  'student/feedback': 'Feedback',
  'student/profile': 'Profile',
  'student/settings': 'Settings',
  'student/periodic-tests': 'Periodic Tests'
};
const CHATBOT_SIZE = 56;
const CHATBOT_MARGIN = 24;

function FloatingChatbot({
  onOpen
}) {
  const [pos, setPos] = useState(() => ({
    x: window.innerWidth - CHATBOT_SIZE - CHATBOT_MARGIN,
    y: window.innerHeight - CHATBOT_SIZE - CHATBOT_MARGIN
  }));
  const draggingRef = useRef(false);
  const movedRef = useRef(false);
  const offsetRef = useRef({
    x: 0,
    y: 0
  });

  function clamp(x, y) {
    const maxX = window.innerWidth - CHATBOT_SIZE;
    const maxY = window.innerHeight - CHATBOT_SIZE;
    return {
      x: Math.min(Math.max(x, 0), Math.max(maxX, 0)),
      y: Math.min(Math.max(y, 0), Math.max(maxY, 0))
    };
  }

  function getPoint(e) {
    if (e.touches && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      };
    }
    return {
      x: e.clientX,
      y: e.clientY
    };
  }

  function handlePointerMove(e) {
    if (!draggingRef.current) return;
    if (e.cancelable) e.preventDefault();
    const point = getPoint(e);
    movedRef.current = true;
    setPos(clamp(point.x - offsetRef.current.x, point.y - offsetRef.current.y));
  }

  function handlePointerUp() {
    draggingRef.current = false;
    window.removeEventListener('mousemove', handlePointerMove);
    window.removeEventListener('mouseup', handlePointerUp);
    window.removeEventListener('touchmove', handlePointerMove);
    window.removeEventListener('touchend', handlePointerUp);
  }

  function handlePointerDown(e) {
    draggingRef.current = true;
    movedRef.current = false;
    const point = getPoint(e);
    offsetRef.current = {
      x: point.x - pos.x,
      y: point.y - pos.y
    };
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchmove', handlePointerMove, {
      passive: false
    });
    window.addEventListener('touchend', handlePointerUp);
  }

  useEffect(() => {
    function handleResize() {
      setPos(p => clamp(p.x, p.y));
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return <button type="button" className="student-layout-55" style={{
    left: pos.x,
    top: pos.y
  }} onMouseDown={handlePointerDown} onTouchStart={handlePointerDown} onClick={() => {
    if (!movedRef.current) onOpen();
  }} aria-label="Open AI Study Assistant">
      <Sparkles className="student-layout-56" />
    </button>;
}
export default function StudentLayout({
  children
}) {
  const {
    currentPage,
    navigate,
    setSearchOpen
  } = useNav();
  const { user, logout } = useAuth();
  // Sidebar starts open on desktop and closed on mobile, matching the
  // previous behavior, but the same toggle now also closes the desktop one.
  const [sidebarOpen, setSidebarOpen] = useState(() => typeof window !== 'undefined' ? window.innerWidth >= 1024 : true);
  const [profileOpen, setProfileOpen] = useState(false);
  const pageTitle = pageTitles[currentPage] ?? 'Student Portal';
  function handleLogout() {
    setProfileOpen(false);
    logout();
    navigate('landing');
  }
  const SidebarContent = () => <div className="student-layout-2">
      {/* Logo */}
      <div className="student-layout-3">
        <div className="student-layout-4">
          <div className="student-layout-5">
            <Brain className="student-layout-6" />
          </div>
          <span className="student-layout-7">EduSmart AI</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="student-layout-14">
        <ul className="student-layout-16">
          {navItems.map(item => {
          const isActive = currentPage === item.page;
          return <li key={item.label}>
                  <button onClick={() => {
    navigate(item.page);
  }} className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${isActive ? 'text-white shadow-lg shadow-blue-900/30' : 'text-slate-300 hover:bg-white/10 hover:text-white hover:translate-x-0.5'}`} style={isActive ? { backgroundImage: 'linear-gradient(135deg, #3b6ef7 0%, #6d28d9 100%)' } : undefined}>
                    {item.icon}
                    {item.label}
                  </button>
                </li>;
        })}
        </ul>
      </nav>

      {/* Student avatar */}
      <div className="student-layout-8">
        <div className="student-layout-9">
          <div className="student-layout-10">
            {user?.name ? user.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : 'ST'}
          </div>
          <div className="student-layout-11">
            <p className="student-layout-12">{user?.name ?? 'Student'}</p>
            <p className="student-layout-13">{user?.institutionName ?? 'Student Portal'}</p>
          </div>
        </div>
      </div>
    </div>;
  return <div className="student-layout-21">
      {/* Desktop sidebar */}
      <aside className={`hidden lg:flex fixed left-0 top-0 h-full w-64 student-layout-22 flex-col z-30 transition-transform duration-200 ${sidebarOpen ? 'lg:translate-x-0' : 'lg:-translate-x-full'}`}>
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && <div className="student-layout-23">
          <div className="student-layout-24" onClick={() => setSidebarOpen(false)} />
          <aside className="student-layout-25">
            <button className="student-layout-26" onClick={() => setSidebarOpen(false)}>
              <PanelLeft className="student-layout-27" />
            </button>
            <SidebarContent />
          </aside>
        </div>}

      {/* Main area */}
      <div className={`student-layout-28 transition-[margin] duration-200 ${sidebarOpen ? 'lg:ml-64' : ''}`}>
        {/* Topbar */}
        <header className="student-layout-29">
          {/* Sidebar toggle */}
          <button className="student-layout-30" onClick={() => setSidebarOpen(v => !v)} aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}>
            <PanelLeft className="student-layout-27" />
          </button>

          {/* Page title */}
          <div className="student-layout-31">
            <h1 className="student-layout-32">{pageTitle}</h1>
          </div>

          {/* Actions */}
          <div className="student-layout-33">
            {/* Search */}
            <button className="student-layout-34" onClick={() => setSearchOpen(true)}>
              <Search className="student-layout-35" />
            </button>

            {/* Notifications */}
            <div className="student-layout-36">
              <button className="student-layout-37" onClick={() => navigate('student/notices')}>
                <Bell className="student-layout-35" />
                <span className="student-layout-38" />
              </button>
            </div>

            {/* Avatar dropdown */}
            <div className="student-layout-36">
              <button className="student-layout-46 group" onClick={() => setProfileOpen(!profileOpen)}>
                <div className="student-layout-47">
                  {user?.name ? user.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : 'ST'}
                </div>
                <ChevronDown className="student-layout-48" />
              </button>
              {profileOpen && <div className="student-layout-49">
                  <div className="student-layout-50">
                    <p className="student-layout-51">{user?.name ?? 'Student'}</p>
                    <p className="student-layout-52">{user?.email ?? ''}</p>
                  </div>
                  <button className="student-layout-53" onClick={() => {
                navigate('student/profile');
                setProfileOpen(false);
              }}>
                    <User className="student-layout-1" /> Profile
                  </button>
                  <button className="student-layout-54" onClick={handleLogout}>
                    <LogOut className="student-layout-1" /> Sign Out
                  </button>
                </div>}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="student-layout-31 student-content-bg">
          {children}
        </main>
      </div>

      <FloatingChatbot onOpen={() => navigate('student/ai-assistant')} />
    </div>;
}