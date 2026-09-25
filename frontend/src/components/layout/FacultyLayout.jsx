import './FacultyLayout.css';
import { useState, useRef, useEffect } from 'react';
import { LayoutDashboard, BookOpen, CheckSquare, Calendar, BarChart2, BookMarked, Activity, Bell, MessageSquare, Settings, Search, ChevronRight, Sparkles, User, LogOut, PanelLeft } from 'lucide-react';
import { useNav } from '../../context/NavigationContext';
import { useAuth } from '../../context/AuthContext';
const navItems = [{
  label: 'Dashboard',
  icon: <LayoutDashboard className="faculty-layout-1" />,
  page: 'faculty/dashboard'
}, {
  label: 'My Classes',
  icon: <BookOpen className="faculty-layout-1" />,
  page: 'faculty/classes'
}, {
  label: 'Attendance',
  icon: <CheckSquare className="faculty-layout-1" />,
  page: 'faculty/attendance'
}, {
  label: 'Timetable',
  icon: <Calendar className="faculty-layout-1" />,
  page: 'faculty/timetable'
}, {
  label: 'Assignment Analytics',
  icon: <BarChart2 className="faculty-layout-1" />,
  page: 'faculty/assignments'
},{
  label: 'Workload',
  icon: <Activity className="faculty-layout-1" />,
  page: 'faculty/workload'
}, {
  label: 'Feedback',
  icon: <MessageSquare className="faculty-layout-1" />,
  page: 'faculty/feedback'
}, {
  label: 'Settings',
  icon: <Settings className="faculty-layout-1" />,
  page: 'faculty/settings'
}];
const pageTitles = {
  'faculty/dashboard': 'Dashboard',
  'faculty/classes': 'My Classes',
  'faculty/attendance': 'Smart Attendance',
  'faculty/timetable': 'Timetable',
  'faculty/assignments': 'Assignments',
  'faculty/workload': 'Workload',
  'faculty/performance': 'Student Performance',
  'faculty/resources': 'Course Resources',
  'faculty/notices': 'Notices',
  'faculty/feedback': 'Feedback',
  'faculty/settings': 'Settings'
};
export default function FacultyLayout({
  children
}) {
  const {
    currentPage,
    navigate,
    setSearchOpen
  } = useNav();
  const { logout } = useAuth();
  // Sidebar starts open on desktop and closed on mobile; a single toggle
  // (button in the sidebar + button in the header) controls it everywhere.
  const [sidebarOpen, setSidebarOpen] = useState(() => typeof window !== 'undefined' ? window.innerWidth >= 1024 : true);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  useEffect(() => {
    function handleClickOutside(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  function handleLogout() {
    setProfileOpen(false);
    logout();
    navigate('landing');
  }
  const pageTitle = pageTitles[currentPage] ?? 'Faculty Portal';
  return <div className="faculty-layout-2">
      {/* Sidebar */}
      <aside className={`faculty-layout-3 transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Logo */}
        <div className="faculty-layout-4">
          <div className="faculty-layout-5">
            <div className="faculty-layout-6">
              <Sparkles className="faculty-layout-7" />
            </div>
            <span className="faculty-layout-8">EduSmart AI</span>
          </div>
        </div>

        {/* Nav Items */}
        <nav className="faculty-layout-16">
          {navItems.map(item => {
          const isActive = currentPage === item.page;
          return <button key={item.label} onClick={() => item.page && navigate(item.page)} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${isActive ? 'text-white shadow-lg shadow-blue-900/30' : 'text-white/60 hover:text-white hover:bg-white/10 hover:translate-x-0.5'}`} style={isActive ? { backgroundImage: 'linear-gradient(135deg, #3b6ef7 0%, #6d28d9 100%)' } : undefined}>
                <span className={`transition-transform duration-200 ${isActive ? 'text-white scale-105' : 'text-white/50'}`}>{item.icon}</span>
                {item.label}
                {isActive && <ChevronRight className="faculty-layout-19 animate-pulse" />}
              </button>;
        })}
        </nav>

        {/* Faculty detail block */}
        <div className="faculty-layout-20">
          <div className="faculty-layout-10">
            <div className="faculty-layout-11">
              <span className="faculty-layout-12">MI</span>
            </div>
            <div className="faculty-layout-13">
              <p className="faculty-layout-14">Prof. Meena Iyer</p>
              <p className="faculty-layout-15">Associate Professor · CSE</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Backdrop for mobile when sidebar is open */}
      {sidebarOpen && <div className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main content */}
      <div className={`faculty-layout-25 transition-[margin] duration-200 ${sidebarOpen ? 'lg:ml-64' : ''}`}>
        {/* Topbar */}
        <header className="faculty-layout-26">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(v => !v)} className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors" aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}>
              <PanelLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="faculty-layout-27">{pageTitle}</h1>
              <p className="faculty-layout-28">EduSmart AI · Faculty Portal</p>
            </div>
          </div>
          <div className="faculty-layout-10">
            <button onClick={() => setSearchOpen(true)} className="faculty-layout-29">
              <Search className="faculty-layout-24" />
              <span className="faculty-layout-30">Search...</span>
            </button>
            <button onClick={() => navigate('faculty/notices')} className="faculty-layout-31">
              <Bell className="faculty-layout-32" />
              <span className="faculty-layout-33" />
            </button>
            <div className="faculty-layout-39" ref={profileRef}>
              <button onClick={() => setProfileOpen(v => !v)} className="faculty-layout-34 group">
                <div className="faculty-layout-35">
                  <span className="faculty-layout-36">MI</span>
                </div>
                <span className="faculty-layout-37">
                  Prof. Meena
                </span>
              </button>
              {profileOpen && <div className="faculty-layout-40">
                  <button onClick={() => {
                setProfileOpen(false);
                navigate('faculty/profile');
              }} className="faculty-layout-41">
                    <User className="faculty-layout-24" />
                    Profile
                  </button>
                  <button onClick={handleLogout} className="faculty-layout-42">
                    <LogOut className="faculty-layout-24" />
                    Logout
                  </button>
                </div>}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="faculty-layout-38">
          {children}
        </main>
      </div>
    </div>;
}