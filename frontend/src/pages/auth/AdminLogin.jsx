import './AdminLogin.css';
import { useState } from 'react';
import { Brain, Building2, Mail, Lock, Eye, EyeOff, ArrowLeft, Shield, AlertCircle } from 'lucide-react';
import { useNav } from '../../context/NavigationContext';
import { useAuth } from '../../context/AuthContext';
import { authApi, ApiError } from '../../lib/api';
import QRCodeScanner from '../../components/ui/QRCodeScanner';
export default function AdminLogin() {
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
  const [showQR, setShowQR] = useState(false);
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await authApi.adminLogin({
        instituteCode: form.instituteCode.trim(),
        email: form.email.trim(),
        password: form.password
      });
      login(data);
      navigate('admin/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }
  function handleScan(text) {
    setForm(f => ({ ...f, instituteCode: text.toUpperCase() }));
    setShowQR(false);
  }
  return <div className="admin-login-1">
      {/* Left panel */}
      <div className="admin-login-2">
        <div className="admin-login-3">
          <div className="admin-login-4">
            <Brain className="admin-login-5" />
          </div>
          <span className="admin-login-6">EduSmart AI</span>
        </div>

        <div>
          <div className="admin-login-7">Institute Admin Portal</div>
          <h2 className="admin-login-8">
            Full control of your academic ecosystem.
          </h2>
          <p className="admin-login-9">
            Manage students, faculty, analytics, AI insights, and institutional intelligence from one powerful dashboard.
          </p>
          <div className="admin-login-10">
            {['Institution-wide academic analytics', 'AI-powered risk detection', 'Smart attendance & timetable', 'Audit logs & security center'].map(f => <div key={f} className="admin-login-11">
                <Shield className="admin-login-12" />
                {f}
              </div>)}
          </div>
        </div>

        <div className="admin-login-13">© 2026 EduSmart AI · Secure Connection</div>
      </div>

      {/* Right panel */}
      <div className="admin-login-14">
        {/* Nav */}
        <div className="admin-login-15">
          <button onClick={() => navigate('auth')} className="admin-login-16">
            <ArrowLeft className="admin-login-17" /> Back
          </button>
          <div className="admin-login-18">
            Need an account?{' '}
            <button onClick={() => navigate('institute-creation')} className="admin-login-19">Create Institution</button>
            {' · '}
            <button onClick={() => navigate('join-institution', { role: 'admin' })} className="admin-login-19">Join an Institution</button>
          </div>
        </div>

        <div className="admin-login-20">
          <div className="admin-login-21">
            <div className="admin-login-22">
              <div className="admin-login-23">
                <Shield className="admin-login-24" />
                Secure Admin Login
              </div>
              <h1 className="admin-login-25">Login to your institution</h1>
              <p className="admin-login-26">Enter your institute code and credentials to continue.</p>
            </div>

            {/* QR toggle */}
            <div className="admin-login-27">
              <button onClick={() => setShowQR(false)} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${!showQR ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>
                Login with Credentials
              </button>
              <button onClick={() => setShowQR(true)} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${showQR ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>
                Login with QR
              </button>
            </div>

            {showQR ? <div className="admin-login-28">
                <div className="admin-login-29">
                  <QRCodeScanner className="w-full h-full rounded-2xl object-cover" onScan={handleScan} />
                </div>
                <p className="admin-login-18">Point your camera at your institution's QR code. This fills in your institute code — you'll still enter your email and password.</p>
                <button onClick={() => setShowQR(false)} className="admin-login-33">Use credentials instead</button>
              </div> : <form onSubmit={handleSubmit} className="admin-login-34">
                {error && <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>}

                <div>
                  <label className="admin-login-35">Institute Code <span className="admin-login-36">*</span></label>
                  <div className="admin-login-37">
                    <Building2 className="admin-login-38" />
                    <input type="text" required value={form.instituteCode} onChange={e => setForm({
                  ...form,
                  instituteCode: e.target.value
                })} placeholder="EDU-7X42-PQ9" className="admin-login-39" />
                  </div>
                </div>

                <div>
                  <label className="admin-login-35">Admin Email <span className="admin-login-36">*</span></label>
                  <div className="admin-login-37">
                    <Mail className="admin-login-38" />
                    <input type="email" required value={form.email} onChange={e => setForm({
                  ...form,
                  email: e.target.value
                })} placeholder="admin@yourinstitution.edu" className="admin-login-40" />
                  </div>
                </div>

                <div>
                  <div className="admin-login-41">
                    <label className="admin-login-42">Password <span className="admin-login-36">*</span></label>
                    <button type="button" className="admin-login-43">Forgot Password?</button>
                  </div>
                  <div className="admin-login-37">
                    <Lock className="admin-login-38" />
                    <input type={showPw ? 'text' : 'password'} required value={form.password} onChange={e => setForm({
                  ...form,
                  password: e.target.value
                })} placeholder="Enter your password" className="admin-login-44" />
                    <button type="button" onClick={() => setShowPw(!showPw)} className="admin-login-45">
                      {showPw ? <EyeOff className="admin-login-17" /> : <Eye className="admin-login-17" />}
                    </button>
                  </div>
                </div>

                <div className="admin-login-3">
                  <input type="checkbox" id="remember" checked={remember} onChange={e => setRemember(e.target.checked)} className="admin-login-46" />
                  <label htmlFor="remember" className="admin-login-47">Remember this device</label>
                </div>

                <button type="submit" disabled={loading} className="admin-login-48">
                  {loading ? <>
                      <div className="admin-login-49" />
                      Verifying...
                    </> : 'Login to Dashboard'}
                </button>

                <p className="admin-login-50">
                  <Shield className="admin-login-24" />
                  2FA verification may be required for admin accounts.
                </p>
              </form>}

            {/* Demo hint — matches backend/prisma/seed.js (run `npm run db:seed`) */}
            <div className="admin-login-51">
              <p className="admin-login-52">Demo Credentials</p>
              <div className="admin-login-53">
                <div>Code: EDU-DEMO-0001</div>
                <div>Email: admin@techuniv.edu</div>
                <div>Password: password123</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>;
}