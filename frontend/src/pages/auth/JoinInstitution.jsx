import './JoinInstitution.css';
import { useEffect, useState } from 'react';
import { Brain, ArrowLeft, Building2, QrCode, Users, GraduationCap, Check, Clock, AlertCircle, ShieldCheck, X } from 'lucide-react';
import { useNav } from '../../context/NavigationContext';
import { authApi, ApiError } from '../../lib/api';
import QRCodeScanner from '../../components/ui/QRCodeScanner';
import FaceIdCapture from '../../components/ui/FaceIdCapture';
export default function JoinInstitution() {
  const {
    navigate,
    navParams
  } = useNav();
  const [joinStep, setJoinStep] = useState('enter-code');
  const [code, setCode] = useState('');
  const [institution, setInstitution] = useState(null); // { name, code } from backend lookup
  const [role, setRole] = useState(navParams?.role === 'admin' ? 'admin' : 'student');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  // Departments/courses shown in the pickers below always come from the
  // backend — only what this institution's admin has actually created.
  const [departments, setDepartments] = useState([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(false);
  const [courses, setCourses] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [subjectInput, setSubjectInput] = useState('');
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    rollId: '',
    departmentId: '',
    courseId: '',
    subjects: [], // faculty only — free-text subjects typed by the applicant
    password: ''
  });
  function updateForm(patch) {
    setForm(f => ({ ...f, ...patch }));
  }

  // Load this institution's admin-created departments once it's known.
  useEffect(() => {
    if (!institution) return;
    let cancelled = false;
    setDepartmentsLoading(true);
    authApi.listInstituteDepartments(institution.code)
      .then(data => { if (!cancelled) setDepartments(data.departments || []); })
      .catch(() => { if (!cancelled) setDepartments([]); })
      .finally(() => { if (!cancelled) setDepartmentsLoading(false); });
    return () => { cancelled = true; };
  }, [institution]);

  // Students and faculty both pick their course from the admin-created list
  // for the selected department — students so they land directly in the
  // right class with the right faculty, faculty so their course is known
  // up front too.
  useEffect(() => {
    if (!institution || (role !== 'faculty' && role !== 'student') || !form.departmentId) {
      setCourses([]);
      return;
    }
    let cancelled = false;
    setCoursesLoading(true);
    authApi.listInstituteCourses(institution.code, form.departmentId)
      .then(data => { if (!cancelled) setCourses(data.courses || []); })
      .catch(() => { if (!cancelled) setCourses([]); })
      .finally(() => { if (!cancelled) setCoursesLoading(false); });
    return () => { cancelled = true; };
  }, [institution, role, form.departmentId]);

  // Faculty subjects are typed freely, one at a time, into chips — pressing
  // Enter or "," adds the current text as a subject.
  function addSubjectFromInput() {
    const value = subjectInput.trim().replace(/,+$/, '');
    if (!value) return;
    if (!form.subjects.includes(value)) {
      updateForm({ subjects: [...form.subjects, value] });
    }
    setSubjectInput('');
  }
  function handleSubjectKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addSubjectFromInput();
    } else if (e.key === 'Backspace' && !subjectInput && form.subjects.length > 0) {
      updateForm({ subjects: form.subjects.slice(0, -1) });
    }
  }
  function removeSubject(name) {
    updateForm({ subjects: form.subjects.filter(s => s !== name) });
  }
  async function lookupCode(rawCode) {
    const trimmed = (rawCode || '').trim();
    if (!trimmed) return;
    setError('');
    setLoading(true);
    try {
      const data = await authApi.lookupInstitute(trimmed);
      setInstitution(data.institution);
      setJoinStep('select-role');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }
  function handleCodeSubmit(e) {
    e.preventDefault();
    lookupCode(code);
  }
  function handleScan(text) {
    setScanning(false);
    setCode(text.toUpperCase());
    lookupCode(text);
  }
  function handleRoleSelect() {
    setError('');
    setJoinStep('register');
  }
  function handleRegister(e) {
    e.preventDefault();
    setError('');
    if (!form.firstName.trim() || !form.email.trim() || !form.password) {
      setError('Please fill in all required fields.');
      return;
    }
    if (role !== 'admin' && !form.departmentId) {
      setError('Please select a department.');
      return;
    }
    if (role === 'student' && !form.courseId) {
      setError('Please select a course.');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    // Students set up Face ID as part of joining — before the request even
    // goes to the admin — so Smart Attendance can recognize them from day
    // one, instead of enrolling later from the student profile. Faculty and
    // admin don't take attendance themselves, so they skip straight to
    // submitting the request as before.
    if (role === 'student') {
      setJoinStep('face-id');
      return;
    }
    submitJoinRequest();
  }
  async function submitJoinRequest(faceDescriptor) {
    setError('');
    setLoading(true);
    try {
      const selectedDepartment = departments.find(d => d.id === form.departmentId);
      await authApi.joinInstitution({
        instituteCode: institution.code,
        name: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
        email: form.email.trim(),
        role,
        department: role === 'admin' ? undefined : selectedDepartment?.name,
        rollId: role === 'student' ? form.rollId.trim() : undefined,
        courseId: (role === 'faculty' || role === 'student') ? (form.courseId || undefined) : undefined,
        subjects: role === 'faculty' && form.subjects.length > 0 ? form.subjects.join(', ') : undefined,
        password: form.password,
        faceDescriptor: role === 'student' ? faceDescriptor : undefined,
      });
      setJoinStep('pending');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      // If Face ID submission failed server-side, send them back to redo
      // the capture rather than stranding them on the pending screen.
      if (role === 'student') setJoinStep('face-id');
    } finally {
      setLoading(false);
    }
  }
  function handleFaceIdComplete(descriptor) {
    submitJoinRequest(descriptor);
  }
  return <div className="join-institution-1">
      {/* Header */}
      <div className="join-institution-2">
        <div className="join-institution-3">
          <button onClick={() => joinStep === 'enter-code' ? navigate('auth') : joinStep === 'face-id' ? setJoinStep('register') : setJoinStep('enter-code')} className="join-institution-4">
            <ArrowLeft className="join-institution-5" /> Back
          </button>
          <div className="join-institution-6">
            <div className="join-institution-7">
              <Brain className="join-institution-8" />
            </div>
            <span className="join-institution-9">EduSmart AI</span>
          </div>
          <div className="join-institution-10" />
        </div>
      </div>

      <div className="join-institution-11">
        <div className="join-institution-12">
          {error && <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 mb-4">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>}

          {joinStep === 'enter-code' && <div className="join-institution-13">
              <h2 className="join-institution-14">Join an Institution</h2>
              <p className="join-institution-15">Enter your institution code or scan the QR provided by your institution.</p>

              <form onSubmit={handleCodeSubmit} className="join-institution-16">
                <div>
                  <label className="join-institution-17">Institute Code</label>
                  <div className="join-institution-18">
                    <Building2 className="join-institution-19" />
                    <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="EDU-XXXX-XXX" className="join-institution-20" />
                  </div>
                </div>
                <button type="submit" disabled={loading} className="join-institution-21">
                  {loading ? <><div className="join-institution-22" /> Searching...</> : 'Find Institution'}
                </button>
              </form>

              <div className="join-institution-23">
                <div className="join-institution-24" />
                <span className="join-institution-25">or</span>
                <div className="join-institution-24" />
              </div>

              {scanning ? <div className="space-y-3">
                  <div className="w-full aspect-square max-w-[280px] mx-auto rounded-xl overflow-hidden bg-slate-900">
                    <QRCodeScanner className="w-full h-full object-cover" onScan={handleScan} />
                  </div>
                  <button onClick={() => setScanning(false)} className="join-institution-26">
                    <X className="join-institution-5" /> Cancel Scan
                  </button>
                </div> : <button onClick={() => setScanning(true)} className="join-institution-26">
                  <QrCode className="join-institution-5" /> Scan QR Code
                </button>}
            </div>}

          {joinStep === 'select-role' && institution && <div className="join-institution-13">
              <div className="join-institution-27">
                <Check className="join-institution-28" />
                <div>
                  <div className="join-institution-29">Institution Found</div>
                  <div className="join-institution-30">{institution.name}</div>
                </div>
              </div>

              <h2 className="join-institution-31">Select Your Role</h2>
              <p className="join-institution-32">How will you be joining this institution?</p>

              <div className="join-institution-33">
                {['student', 'faculty', 'admin'].map(r => <button key={r} onClick={() => setRole(r)} className={`rounded-xl border-2 p-4 text-left transition-all ${role === r ? r === 'student' ? 'border-green-500 bg-green-50' : r === 'faculty' ? 'border-violet-500 bg-violet-50' : 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${r === 'student' ? 'bg-green-100 text-green-600' : r === 'faculty' ? 'bg-violet-100 text-violet-600' : 'bg-blue-100 text-blue-600'}`}>
                      {r === 'student' ? <GraduationCap className="join-institution-5" /> : r === 'faculty' ? <Users className="join-institution-5" /> : <ShieldCheck className="join-institution-5" />}
                    </div>
                    <div className="join-institution-34">{r}</div>
                    <div className="join-institution-35">{r === 'student' ? 'I am enrolling as a student' : r === 'faculty' ? 'I am joining as faculty' : 'I am requesting admin access'}</div>
                  </button>)}
              </div>

              <button onClick={handleRoleSelect} className="join-institution-36">
                Continue as {role.charAt(0).toUpperCase() + role.slice(1)}
              </button>
            </div>}

          {joinStep === 'register' && institution && <div className="join-institution-13">
              <h2 className="join-institution-31">Complete Registration</h2>
              <p className="join-institution-15">Create your account for {institution.name}.</p>

              <form onSubmit={handleRegister} className="join-institution-16">
                <div className="join-institution-37">
                  <div>
                    <label className="join-institution-17">First Name</label>
                    <input value={form.firstName} onChange={e => updateForm({ firstName: e.target.value })} className="join-institution-38" placeholder="Kiran" />
                  </div>
                  <div>
                    <label className="join-institution-17">Last Name</label>
                    <input value={form.lastName} onChange={e => updateForm({ lastName: e.target.value })} className="join-institution-38" placeholder="Sharma" />
                  </div>
                </div>
                <div>
                  <label className="join-institution-17">Email</label>
                  <input type="email" value={form.email} onChange={e => updateForm({ email: e.target.value })} className="join-institution-38" placeholder="your@email.com" />
                </div>
                {role === 'student' && <div>
                    <label className="join-institution-17">Roll Number / Student ID</label>
                    <input value={form.rollId} onChange={e => updateForm({ rollId: e.target.value })} className="join-institution-39" placeholder="CSE2024001" />
                  </div>}
                {role !== 'admin' && <div>
                    <label className="join-institution-17">Department</label>
                    <select
                      value={form.departmentId}
                      onChange={e => updateForm({ departmentId: e.target.value, courseId: '' })}
                      className="join-institution-40"
                      disabled={departmentsLoading}
                    >
                      <option value="">
                        {departmentsLoading ? 'Loading departments…' : 'Select department…'}
                      </option>
                      {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                    {!departmentsLoading && departments.length === 0 && (
                      <p className="join-institution-55">
                        No departments have been added yet — contact your institution's admin.
                      </p>
                    )}
                  </div>}
                {(role === 'faculty' || role === 'student') && <div>
                    <label className="join-institution-17">Course</label>
                    <select
                      value={form.courseId}
                      onChange={e => updateForm({ courseId: e.target.value })}
                      className="join-institution-40"
                      disabled={!form.departmentId || coursesLoading}
                    >
                      <option value="">
                        {coursesLoading ? 'Loading courses…' : 'Select course…'}
                      </option>
                      {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    {form.departmentId && !coursesLoading && courses.length === 0 && (
                      <p className="join-institution-55">
                        No courses added for this department yet.
                      </p>
                    )}
                    {role === 'student' && (
                      <p className="join-institution-55">
                        You'll join this class directly, alongside its faculty.
                      </p>
                    )}
                  </div>}
                {role === 'faculty' && <div>
                    <label className="join-institution-17">Subjects You Teach</label>
                    <div className="join-institution-52">
                      {form.subjects.map(subject => (
                        <span key={subject} className="join-institution-53">
                          {subject}
                          <button type="button" onClick={() => removeSubject(subject)} className="join-institution-54" aria-label={`Remove ${subject}`}>
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                      <input
                        value={subjectInput}
                        onChange={e => setSubjectInput(e.target.value)}
                        onKeyDown={handleSubjectKeyDown}
                        onBlur={addSubjectFromInput}
                        placeholder={form.subjects.length ? 'Add another…' : 'e.g. Data Structures, then press Enter'}
                        className="join-institution-56"
                      />
                    </div>
                    <p className="join-institution-55">Type a subject and press Enter or comma to add it.</p>
                  </div>}
                <div>
                  <label className="join-institution-17">Password</label>
                  <input type="password" value={form.password} onChange={e => updateForm({ password: e.target.value })} className="join-institution-38" placeholder="Set a strong password" />
                </div>
                <button type="submit" disabled={loading} className="join-institution-21">
                  {role === 'student' ? 'Continue to Face ID Setup' : loading ? <><div className="join-institution-22" /> Submitting...</> : 'Submit Join Request'}
                </button>
              </form>
            </div>}

          {joinStep === 'face-id' && institution && <div className="join-institution-13">
              <h2 className="join-institution-31">Set Up Face ID</h2>
              <p className="join-institution-15">
                Capture your face from 8 angles so faculty's Smart Attendance camera can recognize you automatically once your account is approved.
              </p>
              {loading ? (
                <div className="flex flex-col items-center gap-2 py-8 text-sm text-slate-500">
                  <div className="join-institution-22" /> Submitting your join request...
                </div>
              ) : (
                <FaceIdCapture onComplete={handleFaceIdComplete} onCancel={() => setJoinStep('register')} />
              )}
            </div>}

          {joinStep === 'pending' && <div className="join-institution-41">
              <div className="join-institution-42">
                <Clock className="join-institution-43" />
              </div>
              <h2 className="join-institution-44">Request Submitted</h2>
              <div className="join-institution-45">
                <div className="join-institution-46" />
                Pending Approval
              </div>
              <p className="join-institution-15">
                Your request has been sent to the institution administrator.
                <br /><br />
                You will receive an email at your registered address once your account is approved.
              </p>
              <div className="join-institution-47">
                <div className="join-institution-48">What happens next?</div>
                <div className="join-institution-49">
                  {['Admin reviews your request', 'Account approved and activated', 'Login email sent to you', 'Access your portal'].map((s, i) => <div key={s} className="join-institution-50">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${i === 0 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>{i + 1}</div>
                      {s}
                    </div>)}
                </div>
              </div>
              <button onClick={() => navigate('landing')} className="join-institution-51">
                Back to Home
              </button>
            </div>}
        </div>
      </div>
    </div>;
}