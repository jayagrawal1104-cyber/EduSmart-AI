import './AuthGateway.css';
import { Brain, Shield, Users, GraduationCap, ChevronRight, ArrowLeft } from 'lucide-react';
import { useNav } from '../context/NavigationContext';
const roles = [{
  id: 'admin',
  icon: <Shield className="auth-gateway-1" />,
  title: 'Institute Admin',
  desc: 'Manage your institution and academic ecosystem.',
  cta: 'Login as Admin',
  color: 'border-blue-200 hover:border-blue-400',
  iconBg: 'bg-blue-50 text-blue-600',
  ctaClass: 'bg-blue-600 hover:bg-blue-700 text-white',
  loginPage: 'admin-login'
}, {
  id: 'faculty',
  icon: <Users className="auth-gateway-1" />,
  title: 'Faculty',
  desc: 'Teach, analyze and manage your classes.',
  cta: 'Login as Faculty',
  color: 'border-violet-200 hover:border-violet-400',
  iconBg: 'bg-violet-50 text-violet-600',
  ctaClass: 'bg-violet-600 hover:bg-violet-700 text-white',
  loginPage: 'faculty-login'
}, {
  id: 'student',
  icon: <GraduationCap className="auth-gateway-1" />,
  title: 'Student',
  desc: 'Learn, track and improve your academic journey.',
  cta: 'Login as Student',
  color: 'border-green-200 hover:border-green-400',
  iconBg: 'bg-green-50 text-green-600',
  ctaClass: 'bg-green-600 hover:bg-green-700 text-white',
  loginPage: 'student-login'
}];
export default function AuthGateway() {
  const {
    navigate,
    setRole
  } = useNav();
  function handleRoleSelect(role, loginPage) {
    setRole(role);
    navigate(loginPage);
  }
  return <div className="auth-gateway-2">
      {/* Header */}
      <div className="auth-gateway-3">
        <button onClick={() => navigate('landing')} className="auth-gateway-4">
          <ArrowLeft className="auth-gateway-5" />
          Back to Home
        </button>
        <div className="auth-gateway-6">
          <div className="auth-gateway-7">
            <Brain className="auth-gateway-8" />
          </div>
          <span className="auth-gateway-9">EduSmart <span className="auth-gateway-10">AI</span></span>
        </div>
        <div className="auth-gateway-11" />
      </div>

      {/* Content */}
      <div className="auth-gateway-12">
        <div className="auth-gateway-13">
          <div className="auth-gateway-14">
            <h1 className="auth-gateway-15">Welcome back</h1>
            <p className="auth-gateway-16">Choose how you want to continue</p>
          </div>

          <div className="auth-gateway-17">
            {roles.map(role => <div key={role.id} className={`bg-white/80 backdrop-blur-md rounded-2xl border-2 p-6 cursor-pointer group transition-all duration-200 hover:shadow-xl hover:-translate-y-1 ${role.color}`} onClick={() => handleRoleSelect(role.id, role.loginPage)}>
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 ${role.iconBg}`}>
                  {role.icon}
                </div>
                <h3 className="auth-gateway-18">{role.title}</h3>
                <p className="auth-gateway-19">{role.desc}</p>
                <button className={`w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 group-hover:gap-3 transition-all ${role.ctaClass}`}>
                  {role.cta}
                  <ChevronRight className="auth-gateway-5" />
                </button>
              </div>)}
          </div>

          {/* Bottom links */}
          <div className="auth-gateway-20">
            <div className="auth-gateway-21">
              <p className="auth-gateway-22">New institution?</p>
              <button onClick={() => navigate('institute-creation')} className="auth-gateway-23">
                Create Institution Account →
              </button>
            </div>
            <div className="auth-gateway-24" />
            <div className="auth-gateway-21">
              <p className="auth-gateway-22">Already part of an institution?</p>
              <button onClick={() => navigate('join-institution')} className="auth-gateway-23">
                Join Institution →
              </button>
            </div>
          </div>

          {/* Platform admin hint */}
          <div className="auth-gateway-25">
            <button onClick={() => {
            setRole('superadmin');
            navigate('superadmin/overview');
          }} className="auth-gateway-26">
              Platform Administration
            </button>
          </div>
        </div>
      </div>
    </div>;
}