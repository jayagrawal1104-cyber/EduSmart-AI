import './SuperAdminLayout.css';
import { useState } from 'react';
import { Brain, LayoutDashboard, Building2, Users, CreditCard, BarChart3, HeadphonesIcon, Shield, Activity, Menu, X, Bell, ChevronDown, LogOut } from 'lucide-react';
import { useNav } from '../../context/NavigationContext';
import { useAuth } from '../../context/AuthContext';
const navItems = [{
  label: 'Overview',
  icon: <LayoutDashboard className="super-admin-layout-1" />,
  page: 'superadmin/overview'
}, {
  label: 'Institutions',
  icon: <Building2 className="super-admin-layout-1" />,
  page: 'superadmin/institutions'
}, {
  label: 'Users',
  icon: <Users className="super-admin-layout-1" />,
  page: 'superadmin/users'
}, {
  label: 'Subscriptions',
  icon: <CreditCard className="super-admin-layout-1" />,
  page: 'superadmin/subscriptions'
}, {
  label: 'Platform Analytics',
  icon: <BarChart3 className="super-admin-layout-1" />,
  page: 'superadmin/analytics'
}, {
  label: 'Support',
  icon: <HeadphonesIcon className="super-admin-layout-1" />,
  page: 'superadmin/system'
}, {
  label: 'Security',
  icon: <Shield className="super-admin-layout-1" />,
  page: 'superadmin/system'
}, {
  label: 'System Health',
  icon: <Activity className="super-admin-layout-1" />,
  page: 'superadmin/system'
}];
const pageTitles = {
  'superadmin/overview': 'Platform Overview',
  'superadmin/institutions': 'Institutions',
  'superadmin/users': 'Users',
  'superadmin/subscriptions': 'Subscriptions',
  'superadmin/analytics': 'Platform Analytics',
  'superadmin/system': 'System'
};
export default function SuperAdminLayout({
  children
}) {
  const {
    currentPage,
    navigate
  } = useNav();
  const { logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const title = pageTitles[currentPage] || 'Platform Administration';
  return <div className="super-admin-layout-2">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#0d0f1a] flex flex-col transform transition-transform duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        {/* Logo */}
        <div className="super-admin-layout-3">
          <div className="super-admin-layout-4">
            <div className="super-admin-layout-5">
              <Brain className="super-admin-layout-6" />
            </div>
            <div>
              <span className="super-admin-layout-7">EduSmart AI</span>
              <div className="super-admin-layout-8">Platform Admin</div>
            </div>
          </div>
          <div className="super-admin-layout-9">
            <div className="super-admin-layout-10">SA</div>
            <div className="super-admin-layout-11">
              <div className="super-admin-layout-12">Super Admin</div>
              <div className="super-admin-layout-13">platform@edunexus.ai</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="super-admin-layout-14 sidebar-scroll">
          {navItems.map(item => {
          const active = currentPage === item.page;
          return <button key={item.label} onClick={() => {
    navigate(item.page);
    setMobileOpen(false);
  }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm transition-all duration-200 ${active ? 'text-white font-medium shadow-md' : 'text-slate-300 hover:bg-white/5 hover:text-white hover:translate-x-0.5'}`} style={active ? { backgroundImage: 'linear-gradient(135deg, #3b6ef7 0%, #6d28d9 100%)' } : undefined}>
                <span className={active ? 'text-white' : 'text-slate-400'}>{item.icon}</span>
                {item.label}
              </button>;
        })}
        </nav>

        {/* Platform status */}
        <div className="super-admin-layout-15">
          <div className="super-admin-layout-16">
            <div className="super-admin-layout-17" />
            <span className="super-admin-layout-18">All Systems Operational</span>
          </div>
          <button onClick={() => {
          logout();
          navigate('landing');
        }} className="super-admin-layout-19">
            <LogOut className="super-admin-layout-20" />
            Exit Platform Admin
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && <div className="super-admin-layout-21" onClick={() => setMobileOpen(false)} />}

      {/* Main */}
      <div className="super-admin-layout-22">
        {/* Topbar */}
        <header className="super-admin-layout-23">
          <div className="super-admin-layout-24">
            <button className="super-admin-layout-25" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X className="super-admin-layout-26" /> : <Menu className="super-admin-layout-26" />}
            </button>
            <div>
              <h1 className="super-admin-layout-27">{title}</h1>
              <div className="super-admin-layout-28">EduSmart Platform Administration</div>
            </div>
          </div>

          <div className="super-admin-layout-29">
            <button className="super-admin-layout-30">
              <Bell className="super-admin-layout-1" />
              <span className="super-admin-layout-31" />
            </button>
            <div className="super-admin-layout-32">
              <button onClick={() => setProfileOpen(!profileOpen)} className="super-admin-layout-33">
                <div className="super-admin-layout-34">SA</div>
                <ChevronDown className="super-admin-layout-35" />
              </button>
              {profileOpen && <div className="super-admin-layout-36">
                  <div className="super-admin-layout-37">
                    <div className="super-admin-layout-38">Super Admin</div>
                    <div className="super-admin-layout-39">platform@edunexus.ai</div>
                  </div>
                  <button onClick={() => {
                logout();
                navigate('landing');
                setProfileOpen(false);
              }} className="super-admin-layout-40">
                    <LogOut className="super-admin-layout-20" /> Sign Out
                  </button>
                </div>}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="super-admin-layout-41">{children}</main>
      </div>
    </div>;
}