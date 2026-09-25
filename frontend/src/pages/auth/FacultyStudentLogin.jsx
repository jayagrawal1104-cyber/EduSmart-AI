import './FacultyStudentLogin.css';
import { useState } from 'react';
import { Brain, Mail, Lock, Eye, EyeOff, ArrowLeft, Users, GraduationCap, Building2, AlertCircle } from 'lucide-react';
import { useNav } from '../../context/NavigationContext';
import { useAuth } from '../../context/AuthContext';
import { authApi, ApiError } from '../../lib/api';
export default function FacultyStudentLogin({
  type
}) {
  const {
    navigate
  } = useNav();
  const { login } = useAuth();
  const [form, setForm] = useState({
    instituteCode: '',
    email: '',
    password: ''
  });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isFaculty = type === 'faculty';
  const Icon = isFaculty ? Users : GraduationCap;
  const dashPage = isFaculty ? 'faculty/dashboard' : 'student/dashboard';
  const color = isFaculty ? 'violet' : 'green';
  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const call = isFaculty ? authApi.facultyLogin : authApi.studentLogin;
      const data = await call({
        instituteCode: form.instituteCode.trim(),
        email: form.email.trim(),
        password: form.password
      });
      login(data);
      navigate(dashPage);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }
  return <div className="faculty-student-login-1">
      <div className="faculty-student-login-2">
        <button onClick={() => navigate('auth')} className="faculty-student-login-3">
          <ArrowLeft className="faculty-student-login-4" /> Back to role selection
        </button>

        <div className="faculty-student-login-5">
          <div className="faculty-student-login-6">
            <div className="faculty-student-login-7">
              <Brain className="faculty-student-login-8" />
            </div>
            <span className="faculty-student-login-9">EduSmart AI</span>
          </div>

          <div className={`inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full mb-5 ${isFaculty ? 'bg-violet-50 text-violet-700' : 'bg-green-50 text-green-700'}`}>
            <Icon className="faculty-student-login-10" />
            {isFaculty ? 'Faculty Portal' : 'Student Portal'}
          </div>

          <h1 className="faculty-student-login-11">
            {isFaculty ? 'Welcome, Professor' : 'Welcome back'}
          </h1>
          <p className="faculty-student-login-12">
            {isFaculty ? 'Login to your faculty portal to manage classes and students.' : 'Login to track your academic journey.'}
          </p>

          <form onSubmit={handleSubmit} className="faculty-student-login-13">
            {error && <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>}

            <div>
              <label className="faculty-student-login-14">Institute Code</label>
              <div className="faculty-student-login-15">
                <Building2 className="faculty-student-login-16" />
                <input type="text" required value={form.instituteCode} onChange={e => setForm({
                ...form,
                instituteCode: e.target.value
              })} placeholder="EDU-7X42-PQ9" className="faculty-student-login-17" />
              </div>
            </div>

            <div>
              <label className="faculty-student-login-14">Email Address</label>
              <div className="faculty-student-login-15">
                <Mail className="faculty-student-login-16" />
                <input type="email" required value={form.email} onChange={e => setForm({
                ...form,
                email: e.target.value
              })} placeholder={isFaculty ? 'professor@institution.edu' : 'student@institution.edu'} className="faculty-student-login-17" />
              </div>
            </div>

            <div>
              <div className="faculty-student-login-18">
                <label className="faculty-student-login-19">Password</label>
                <button type="button" className="faculty-student-login-20">Forgot Password?</button>
              </div>
              <div className="faculty-student-login-15">
                <Lock className="faculty-student-login-16" />
                <input type={showPw ? 'text' : 'password'} required value={form.password} onChange={e => setForm({
                ...form,
                password: e.target.value
              })} placeholder="Enter your password" className="faculty-student-login-21" />
                <button type="button" onClick={() => setShowPw(!showPw)} className="faculty-student-login-22">
                  {showPw ? <EyeOff className="faculty-student-login-4" /> : <Eye className="faculty-student-login-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className={`w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 text-white disabled:opacity-60 ${isFaculty ? 'bg-violet-600 hover:bg-violet-700' : 'bg-green-600 hover:bg-green-700'}`}>
              {loading ? <><div className="faculty-student-login-23" /> Logging in...</> : `Continue to ${isFaculty ? 'Faculty' : 'Student'} Portal`}
            </button>
          </form>

          <div className="faculty-student-login-24">
            <p className="faculty-student-login-25">Not registered with your institution yet?</p>
            <button onClick={() => navigate('join-institution')} className="faculty-student-login-26">
              Join an Institution →
            </button>
          </div>

          {/* Demo hint — matches backend/prisma/seed.js (run `npm run db:seed`) */}
          <div className="mt-6 text-xs text-slate-400 text-center space-y-0.5">
            <p className="font-medium text-slate-500">Demo Credentials</p>
            <div>Code: EDU-DEMO-0001</div>
            <div>Email: {isFaculty ? 'suresh.kumar@techuniv.edu' : 'aarav.sharma@techuniv.edu'}</div>
            <div>Password: password123</div>
          </div>
        </div>
      </div>
    </div>;
}