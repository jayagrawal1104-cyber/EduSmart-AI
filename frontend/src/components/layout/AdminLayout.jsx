import './AdminLayout.css';
import { useState, useRef, useEffect } from 'react';
import { LayoutDashboard, Building2, Calendar, UserPlus, TrendingUp, Briefcase, Bell, Megaphone, FolderOpen, MessageSquare, BarChart2, ScrollText, Shield, Settings, Search, ChevronRight, LogOut, PanelLeft, GraduationCap } from 'lucide-react';
import { useNav } from '../../context/NavigationContext';
import { useAuth } from '../../context/AuthContext';
import { settingsApi } from '../../lib/api';

// Turns "Admin Rajesh" -> "AR", falling back to "AD" if the name is missing.
function getInitials(name) {
  if (!name) return 'AD';
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}
const navItems = [{
  label: 'Dashboard',
  icon: <LayoutDashboard className="admin-layout-1" />,
  page: 'admin/dashboard'
}, {
  label: 'Institution',
  icon: <Building2 className="admin-layout-1" />,
  page: 'admin/institution'
}, {
  label: 'Timetable',
  icon: <Calendar className="admin-layout-1" />,
  page: 'admin/timetable'
}, {
  label: 'Join Requests',
  icon: <UserPlus className="admin-layout-1" />,
  page: 'admin/join-requests'
}, {
  label: 'Workload & Engagement',
  icon: <Briefcase className="admin-layout-1" />,
  page: 'admin/workload'
}, {
  label: 'Notices',
  icon: <Megaphone className="admin-layout-1" />,
  page: 'admin/notices'
}, {
  label: 'Resources',
  icon: <FolderOpen className="admin-layout-1" />,
  page: 'admin/resources'
}, {
  label: 'Feedback',
  icon: <MessageSquare className="admin-layout-1" />,
  page: 'admin/feedback'
}, {
  label: 'Reports',
  icon: <BarChart2 className="admin-layout-1" />,
  page: 'admin/reports'
}, {
  label: 'Settings',
  icon: <Settings className="admin-layout-1" />,
  page: 'admin/settings'
}];
export default function AdminLayout({
  children
}) {
  const {
    currentPage,
    navigate,
    setSearchOpen
  } = useNav();
  const { user, token, logout } = useAuth();
  // Sidebar starts open on desktop and closed on mobile, matching the
  // previous behavior, but is now a single toggle that works everywhere.
  const [sidebarOpen, setSidebarOpen] = useState(() => typeof window !== 'undefined' ? window.innerWidth >= 1024 : true);
  const [profileOpen, setProfileOpen] = useState(false);
  const [academicYear, setAcademicYear] = useState(null);
  const profileRef = useRef(null);
  const initials = getInitials(user?.name);
  useEffect(() => {
    function handleClickOutside(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  useEffect(() => {
    let cancelled = false;
    settingsApi.getSettings(token)
      .then(data => { if (!cancelled) setAcademicYear(data.settings?.academicYear ?? null); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [token]);
  function handleNav(page) {
    navigate(page);
  }
  function handleLogout() {
    setProfileOpen(false);
    logout();
    navigate('landing');
  }
  return <div className="admin-layout-2">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 admin-layout-sidebar flex flex-col transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Logo */}
        <div className="admin-layout-3">
          <div className="admin-layout-4">
            <GraduationCap className="admin-layout-5" />
          </div>
          <div className="admin-layout-6">
            <div className="admin-layout-7">EduSmart AI</div>
            <div className="admin-layout-8">Admin Portal</div>
          </div>
          <span className="admin-layout-9">Admin</span>
        </div>

        {/* Nav */}
        <nav className="admin-layout-14">
          {navItems.map(item => {
          const active = currentPage === item.page;
          return <button key={item.page} onClick={() => handleNav(item.page)} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${active ? 'text-white shadow-lg shadow-blue-900/30' : 'text-white/60 hover:text-white hover:bg-white/10 hover:translate-x-0.5'}`} style={active ? { backgroundImage: 'linear-gradient(135deg, #3b6ef7 0%, #6d28d9 100%)' } : undefined}>
                {item.icon}
                <span className="admin-layout-17">{item.label}</span>
                {active && <ChevronRight className="admin-layout-18 animate-pulse" />}
              </button>;
        })}
        </nav>

        {/* Avatar */}
        <div className="admin-layout-38">
          <div className="admin-layout-10">
            {initials}
          </div>
          <div className="admin-layout-11">
            <div className="admin-layout-12">{user?.name || 'Admin'}</div>
            <div className="admin-layout-13">Administrator</div>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && <div className="admin-layout-21" onClick={() => setSidebarOpen(false)} />}

      {/* Main area */}
      <div className={`admin-layout-22 transition-[margin] duration-200 ${sidebarOpen ? 'lg:ml-64' : 'lg:ml-0'}`}>
        {/* Topbar */}
        <header className="admin-layout-23">
          <button className="admin-layout-24" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}>
            <PanelLeft className="admin-layout-25" />
          </button>

          <div className="admin-layout-26">
            <Building2 className="admin-layout-27" />
            <span className="admin-layout-28">{user?.institutionName || 'Institution'}</span>
            {academicYear && <>
              <span className="admin-layout-29">|</span>
              <span className="admin-layout-30">{academicYear} Academic Year</span>
            </>}
          </div>

          <div className="admin-layout-31" />

          <button onClick={() => setSearchOpen(true)} className="admin-layout-32">
            <Search className="admin-layout-33" />
            Search anything...
            <kbd className="admin-layout-34">⌘K</kbd>
          </button>

          <button className="admin-layout-35">
            <Bell className="admin-layout-25" />
            <span className="admin-layout-36" />
          </button>

          <div className="admin-layout-40" ref={profileRef}>
            <button onClick={() => setProfileOpen(v => !v)} className="admin-layout-39">
              {initials}
            </button>
            {profileOpen && <div className="admin-layout-41">
                <button onClick={handleLogout} className="admin-layout-42">
                  <LogOut className="admin-layout-33" />
                  Sign Out
                </button>
              </div>}
          </div>
        </header>

        {/* Page content */}
        <main className="admin-layout-31 admin-content-bg">
          {children}
        </main>
      </div>
    </div>;
}