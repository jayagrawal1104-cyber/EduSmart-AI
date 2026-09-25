import './InstituteCreation.css';
import { useRef, useState } from 'react';
import { Brain, ArrowLeft, ArrowRight, Check, Building2, User, BookOpen, Settings, QrCode, Copy, Download, Share2, CheckCircle, AlertCircle } from 'lucide-react';
import { useNav } from '../../context/NavigationContext';
import { useAuth } from '../../context/AuthContext';
import { authApi, ApiError } from '../../lib/api';
import InstituteQRCode, { downloadDataUrl, printDataUrl, shareDataUrl } from '../../components/ui/InstituteQRCode';
const steps = [{
  id: 1,
  title: 'Institution Details',
  icon: <Building2 className="institute-creation-1" />
}, {
  id: 2,
  title: 'Administrator',
  icon: <User className="institute-creation-1" />
}, {
  id: 3,
  title: 'Academic Structure',
  icon: <BookOpen className="institute-creation-1" />
}, {
  id: 4,
  title: 'Configuration',
  icon: <Settings className="institute-creation-1" />
}, {
  id: 5,
  title: 'Institute Identity',
  icon: <QrCode className="institute-creation-1" />
}];
export default function InstituteCreation() {
  const {
    navigate
  } = useNav();
  const { login } = useAuth();
  const [step, setStep] = useState(1);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [result, setResult] = useState(null); // { institution, admin, token }
  // These fields are sent to the backend on submit — see
  // backend/src/controllers/auth.controller.js#createInstitute. The
  // Academic Structure and Configuration steps (departments, grading,
  // notification defaults) are still UI-only for now — no backend model
  // for them yet.
  const [account, setAccount] = useState({
    institutionName: '',
    institutionType: 'Engineering College',
    website: '',
    officialEmail: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    adminName: '',
    adminEmail: '',
    password: '',
    confirmPassword: ''
  });
  function updateAccount(patch) {
    setAccount(a => ({ ...a, ...patch }));
  }
  function handleCopy() {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  function handleNext() {
    if (step < 5) setStep(step + 1);
  }
  function handleBack() {
    if (step > 1) setStep(step - 1);else navigate('auth');
  }
  async function handleGenerateIdentity() {
    setSubmitError('');
    if (account.password !== account.confirmPassword) {
      setSubmitError('Passwords do not match.');
      return;
    }
    if (account.password.length < 6) {
      setSubmitError('Password must be at least 6 characters.');
      return;
    }
    setSubmitting(true);
    try {
      const data = await authApi.createInstitute({
        institutionName: account.institutionName.trim(),
        adminName: account.adminName.trim(),
        adminEmail: account.adminEmail.trim(),
        password: account.password,
        type: account.institutionType,
        website: account.website.trim() || undefined,
        email: account.officialEmail.trim() || undefined,
        phone: account.phone.trim() || undefined,
        address: [account.address.trim(), account.city.trim()].filter(Boolean).join(', ') || undefined,
        state: account.state.trim() || undefined,
      });
      setResult(data);
      setStep(5);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }
  function handleFinish() {
    if (result) login(result);
    navigate('admin/dashboard');
  }
  return <div className="institute-creation-2">
      {/* Header */}
      <div className="institute-creation-3">
        <div className="institute-creation-4">
          <div className="institute-creation-5">
            <div className="institute-creation-6">
              <Brain className="institute-creation-7" />
            </div>
            <span className="institute-creation-8">EduSmart AI</span>
          </div>
          <div className="institute-creation-9">Already have an account?{' '}
            <button onClick={() => navigate('auth')} className="institute-creation-10">Login</button>
          </div>
        </div>
      </div>

      <div className="institute-creation-11">
        <div className="institute-creation-12">
          <button onClick={handleBack} className="institute-creation-13">
            <ArrowLeft className="institute-creation-1" />
            {step === 1 ? 'Back to Login' : 'Previous Step'}
          </button>
          <h1 className="institute-creation-14">Create Your Institution</h1>
          <p className="institute-creation-15">Set up EduSmart AI for your institution in 5 easy steps.</p>
        </div>

        {/* Progress steps */}
        <div className="institute-creation-16">
          {steps.map((s, i) => <div key={s.id} className="institute-creation-17">
              <div className="institute-creation-18">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${s.id < step ? 'bg-green-500 text-white' : s.id === step ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                  {s.id < step ? <Check className="institute-creation-1" /> : s.id}
                </div>
                <div className={`text-xs mt-1 text-center whitespace-nowrap ${s.id === step ? 'text-blue-600 font-medium' : 'text-slate-400'}`}>
                  {s.title}
                </div>
              </div>
              {i < steps.length - 1 && <div className={`h-px flex-1 mx-2 mb-4 min-w-[24px] ${s.id < step ? 'bg-green-400' : 'bg-slate-200'}`} />}
            </div>)}
        </div>

        {/* Step content */}
        <div className="institute-creation-19">
          {step === 1 && <StepInstitutionDetails account={account} updateAccount={updateAccount} onNext={handleNext} />}
          {step === 2 && <StepAdministrator account={account} updateAccount={updateAccount} onNext={handleNext} />}
          {step === 3 && <StepAcademicStructure onNext={handleNext} />}
          {step === 4 && <StepConfiguration onNext={handleGenerateIdentity} submitting={submitting} submitError={submitError} />}
          {step === 5 && result && <StepIdentity code={result.institution.code} id={result.institution.id} name={result.institution.name} copied={copied} onCopy={handleCopy} onFinish={handleFinish} />}
        </div>
      </div>
    </div>;
}
function StepInstitutionDetails({
  account,
  updateAccount,
  onNext
}) {
  const canContinue = account.institutionName.trim().length > 0 && account.officialEmail.trim().length > 0;
  return <div className="institute-creation-20">
      <h2 className="institute-creation-21">Institution Details</h2>
      <p className="institute-creation-22">Tell us about your institution.</p>
      <div className="institute-creation-23">
        <div className="institute-creation-24">
          <label className="institute-creation-25">Institution Name <span className="institute-creation-26">*</span></label>
          <input value={account.institutionName} onChange={e => updateAccount({ institutionName: e.target.value })} placeholder="e.g. Tech University" className="institute-creation-27" />
        </div>
        <div>
          <label className="institute-creation-25">Institution Type <span className="institute-creation-26">*</span></label>
          <select value={account.institutionType} onChange={e => updateAccount({ institutionType: e.target.value })} className="institute-creation-28">
            {['University', 'Engineering College', 'Medical College', 'School', 'Coaching Institute', 'Research Institute'].map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="institute-creation-25">Website</label>
          <input value={account.website} onChange={e => updateAccount({ website: e.target.value })} placeholder="https://techuniversity.edu" className="institute-creation-27" />
        </div>
        <div>
          <label className="institute-creation-25">Email <span className="institute-creation-26">*</span></label>
          <input type="email" value={account.officialEmail} onChange={e => updateAccount({ officialEmail: e.target.value })} placeholder="admin@techuniversity.edu" className="institute-creation-27" />
        </div>
        <div>
          <label className="institute-creation-25">Phone</label>
          <input value={account.phone} onChange={e => updateAccount({ phone: e.target.value })} placeholder="+91 98765 43210" className="institute-creation-27" />
        </div>
        <div className="institute-creation-24">
          <label className="institute-creation-25">Address</label>
          <input value={account.address} onChange={e => updateAccount({ address: e.target.value })} placeholder="123 University Road" className="institute-creation-27" />
        </div>
        <div>
          <label className="institute-creation-25">City</label>
          <input value={account.city} onChange={e => updateAccount({ city: e.target.value })} placeholder="Bengaluru" className="institute-creation-27" />
        </div>
        <div>
          <label className="institute-creation-25">State</label>
          <input value={account.state} onChange={e => updateAccount({ state: e.target.value })} placeholder="Karnataka" className="institute-creation-27" />
        </div>
      </div>
      <div className="institute-creation-29">
        <button onClick={onNext} disabled={!canContinue} className="institute-creation-30 disabled:opacity-50 disabled:cursor-not-allowed">
          Continue <ArrowRight className="institute-creation-1" />
        </button>
      </div>
    </div>;
}
function StepAdministrator({
  account,
  updateAccount,
  onNext
}) {
  const canContinue = account.adminName.trim() && account.adminEmail.trim() && account.password.length >= 6 && account.password === account.confirmPassword;
  return <div className="institute-creation-20">
      <h2 className="institute-creation-21">Administrator Setup</h2>
      <p className="institute-creation-22">Create the primary admin account for your institution.</p>
      <div className="institute-creation-23">
        <div>
          <label className="institute-creation-25">Full Name <span className="institute-creation-26">*</span></label>
          <input value={account.adminName} onChange={e => updateAccount({ adminName: e.target.value })} placeholder="e.g. Dr. Jane Smith" className="institute-creation-27" />
        </div>
        <div>
          <label className="institute-creation-25">Phone</label>
          <input defaultValue="+91 99887 76655" className="institute-creation-27" />
        </div>
        <div className="institute-creation-24">
          <label className="institute-creation-25">Admin Email <span className="institute-creation-26">*</span></label>
          <input type="email" value={account.adminEmail} onChange={e => updateAccount({ adminEmail: e.target.value })} placeholder="you@yourinstitution.edu" className="institute-creation-27" />
        </div>
        <div>
          <label className="institute-creation-25">Password <span className="institute-creation-26">*</span></label>
          <input type="password" value={account.password} onChange={e => updateAccount({ password: e.target.value })} placeholder="At least 6 characters" className="institute-creation-27" />
        </div>
        <div>
          <label className="institute-creation-25">Confirm Password <span className="institute-creation-26">*</span></label>
          <input type="password" value={account.confirmPassword} onChange={e => updateAccount({ confirmPassword: e.target.value })} className="institute-creation-27" />
        </div>
      </div>
      {account.confirmPassword && account.password !== account.confirmPassword && <div className="flex items-center gap-2 text-red-600 text-xs mt-2">
          <AlertCircle className="w-3.5 h-3.5" /> Passwords do not match.
        </div>}
      <div className="institute-creation-31">
        This account will have full institution-wide admin access. A two-factor authentication setup will be prompted on first login.
      </div>
      <div className="institute-creation-29">
        <button onClick={onNext} disabled={!canContinue} className="institute-creation-30 disabled:opacity-50 disabled:cursor-not-allowed">
          Continue <ArrowRight className="institute-creation-1" />
        </button>
      </div>
    </div>;
}
function StepAcademicStructure({
  onNext
}) {
  const [departments, setDepartments] = useState(['Computer Science & Engineering', 'Electronics & Communication', 'Mechanical Engineering']);
  const [newDept, setNewDept] = useState('');
  function addDept() {
    if (newDept.trim()) {
      setDepartments([...departments, newDept.trim()]);
      setNewDept('');
    }
  }
  return <div className="institute-creation-20">
      <h2 className="institute-creation-21">Academic Structure</h2>
      <p className="institute-creation-22">Define your institution's academic hierarchy.</p>
      <div className="institute-creation-32">
        <div>
          <label className="institute-creation-25">Academic Year</label>
          <select className="institute-creation-28">
            <option>2026 - 2027</option><option>2025 - 2026</option>
          </select>
        </div>
        <div>
          <label className="institute-creation-25">Current Semester</label>
          <select className="institute-creation-28">
            {['Odd Semester (Jul - Nov)', 'Even Semester (Jan - May)'].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="institute-creation-25">Working Days</label>
          <select className="institute-creation-28">
            <option>Monday to Friday (5 days)</option><option>Monday to Saturday (6 days)</option>
          </select>
        </div>
        <div>
          <label className="institute-creation-25">Daily Periods</label>
          <select className="institute-creation-28">
            {['6 periods/day', '7 periods/day', '8 periods/day'].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="institute-creation-33">Departments</label>
        <div className="institute-creation-34">
          {departments.map((d, i) => <div key={i} className="institute-creation-35">
              <CheckCircle className="institute-creation-36" />
              <span className="institute-creation-37">{d}</span>
              <button onClick={() => setDepartments(departments.filter((_, j) => j !== i))} className="institute-creation-38">Remove</button>
            </div>)}
        </div>
        <div className="institute-creation-39">
          <input value={newDept} onChange={e => setNewDept(e.target.value)} onKeyDown={e => e.key === 'Enter' && addDept()} placeholder="Add department..." className="institute-creation-40" />
          <button onClick={addDept} className="institute-creation-41">Add</button>
        </div>
      </div>

      <div className="institute-creation-29">
        <button onClick={onNext} className="institute-creation-30">
          Continue <ArrowRight className="institute-creation-1" />
        </button>
      </div>
    </div>;
}
function StepConfiguration({
  onNext,
  submitting,
  submitError
}) {
  const [threshold, setThreshold] = useState(75);
  const [grading, setGrading] = useState('10-point');
  const [approvalRequired, setApprovalRequired] = useState(true);
  const [notify, setNotify] = useState(true);
  return <div className="institute-creation-20">
      <h2 className="institute-creation-21">Institution Configuration</h2>
      <p className="institute-creation-22">Set policies and defaults for your institution.</p>
      <div className="institute-creation-42">
        <div>
          <div className="institute-creation-43">
            <label className="institute-creation-44">Attendance Threshold: <span className="institute-creation-45">{threshold}%</span></label>
          </div>
          <input type="range" min={50} max={90} value={threshold} onChange={e => setThreshold(Number(e.target.value))} className="institute-creation-46" />
          <div className="institute-creation-47"><span>50%</span><span>90%</span></div>
          <p className="institute-creation-48">Students below this threshold will be flagged as at-risk.</p>
        </div>

        <div>
          <label className="institute-creation-25">Grading System</label>
          <select value={grading} onChange={e => setGrading(e.target.value)} className="institute-creation-28">
            {['10-point CGPA', 'Percentage (0-100)', 'Letter Grades (A-F)', 'Custom'].map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>

        <div className="institute-creation-49">
          <div className="institute-creation-50">
            <div>
              <div className="institute-creation-51">Approval Required for Joining</div>
              <div className="institute-creation-52">Admin must approve all student/faculty join requests</div>
            </div>
            <button onClick={() => setApprovalRequired(!approvalRequired)} className={`w-11 h-6 rounded-full relative transition-colors ${approvalRequired ? 'bg-blue-600' : 'bg-slate-300'}`}>
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${approvalRequired ? 'left-5' : 'left-0.5'}`} />
            </button>
          </div>
          <div className="institute-creation-50">
            <div>
              <div className="institute-creation-51">AI Notifications</div>
              <div className="institute-creation-52">Receive AI-generated academic alerts and insights</div>
            </div>
            <button onClick={() => setNotify(!notify)} className={`w-11 h-6 rounded-full relative transition-colors ${notify ? 'bg-blue-600' : 'bg-slate-300'}`}>
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${notify ? 'left-5' : 'left-0.5'}`} />
            </button>
          </div>
        </div>
      </div>

      {submitError && <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 mt-4">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{submitError}</span>
        </div>}

      <div className="institute-creation-29">
        <button onClick={onNext} disabled={submitting} className="institute-creation-30 disabled:opacity-60">
          {submitting ? 'Creating Institution...' : <>Generate Institution Identity <ArrowRight className="institute-creation-1" /></>}
        </button>
      </div>
    </div>;
}
function StepIdentity({
  code,
  id,
  name,
  copied,
  onCopy,
  onFinish
}) {
  const qrRef = useRef(null);
  function handleShareLink() {
    shareDataUrl(qrRef.current?.getDataURL(), code, `${name || 'Your institution'} — Institute QR Code`);
  }
  function handleDownloadQR() {
    downloadDataUrl(qrRef.current?.getDataURL(), `${code}-qr-code.png`);
  }
  function handlePrintQR() {
    printDataUrl(qrRef.current?.getDataURL(), `${name || 'Your institution'} — Institute QR Code`);
  }
  return <div className="institute-creation-53">
      <div className="institute-creation-54">
        <CheckCircle className="institute-creation-55" />
      </div>
      <h2 className="institute-creation-56">Institution Created!</h2>
      <p className="institute-creation-57">Your institution identity has been generated. Share the institute code and QR with your students and faculty to invite them.</p>

      <div className="institute-creation-58">
        <div className="institute-creation-59">
          <div className="institute-creation-60">Institute ID</div>
          <div className="institute-creation-61">{id}</div>
        </div>

        <div className="institute-creation-62">
          <div className="institute-creation-63">Institute Code</div>
          <div className="institute-creation-64">{code}</div>
          <div className="institute-creation-65">
            <button onClick={onCopy} className="institute-creation-66">
              {copied ? <><Check className="institute-creation-67" /> Copied!</> : <><Copy className="institute-creation-67" /> Copy Code</>}
            </button>
            <button onClick={handleShareLink} className="institute-creation-66">
              <Share2 className="institute-creation-67" /> Share Link
            </button>
          </div>
        </div>

        <div className="institute-creation-68">
          <div className="institute-creation-69">
            <InstituteQRCode ref={qrRef} value={code} size={104} />
          </div>
          <div className="institute-creation-71">Institute QR Code</div>
          <div className="institute-creation-39">
            <button onClick={handleDownloadQR} className="institute-creation-72">
              <Download className="institute-creation-67" /> Download
            </button>
            <button onClick={handlePrintQR} className="institute-creation-72">
              Print QR
            </button>
          </div>
        </div>
      </div>

      <button onClick={onFinish} className="institute-creation-73">
        Go to admin Dashboard <ArrowRight className="institute-creation-1" />
      </button>
    </div>;
}