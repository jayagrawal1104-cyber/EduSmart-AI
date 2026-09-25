import './FacultySettings.css';
import { useEffect, useRef, useState } from 'react';
import { Bell, Lock, Globe, ShieldCheck, Mail, Smartphone, Megaphone, ClipboardCheck, Users, KeyRound, UserCog, AlertTriangle, Check, GraduationCap, FileSpreadsheet, CalendarClock } from 'lucide-react';
import { Card, Btn, SectionHeader, Input, Select } from '../../components/ui/index';
import { useNav } from '../../context/NavigationContext';
import { useAuth } from '../../context/AuthContext';
import { facultyApi } from '../../lib/api';

function Toggle({
  checked,
  onChange,
  label,
  description,
  icon
}) {
  return <div className="faculty-settings-1">
      <div className="faculty-settings-2">
        {icon && <div className="faculty-settings-3">{icon}</div>}
        <div>
          <p className="faculty-settings-4">{label}</p>
          {description && <p className="faculty-settings-5">{description}</p>}
        </div>
      </div>
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${checked ? 'bg-violet-600' : 'bg-slate-200'}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>;
}
function SavedToast({
  show,
  message
}) {
  if (!show) return null;
  return <div className="faculty-settings-6">
      <Check className="faculty-settings-7" />
      {message || 'Settings saved'}
    </div>;
}
export default function FacultySettings() {
  const {
    navigate
  } = useNav();
  const { token, logout } = useAuth();

  const [notifPrefs, setNotifPrefs] = useState({
    email: true,
    push: true,
    assignmentSubmissions: true,
    attendanceReminders: true,
    lowAttendanceAlerts: true,
    studentFeedback: false,
    notices: true
  });
  const [teaching, setTeaching] = useState({
    attendanceMethod: 'manual',
    defaultGradeScale: 'percentage',
    autoReminders: true,
    shareGradesWithStudents: true
  });
  const [security, setSecurity] = useState({
    twoFactor: false,
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [preferences, setPreferences] = useState({
    theme: 'light',
    language: 'en',
    landingPage: 'faculty/dashboard'
  });

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [passwordError, setPasswordError] = useState(null);
  const [signOutError, setSignOutError] = useState(null);
  const [deactivateRequested, setDeactivateRequested] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const savedTimerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    facultyApi
      .getSettings(token)
      .then((res) => {
        if (cancelled) return;
        const s = res.settings;
        setNotifPrefs({
          email: s.notifyEmail,
          push: s.notifyPush,
          assignmentSubmissions: s.notifyAssignmentSubmissions,
          attendanceReminders: s.notifyAttendanceReminders,
          lowAttendanceAlerts: s.notifyLowAttendanceAlerts,
          studentFeedback: s.notifyStudentFeedback,
          notices: s.notifyNotices,
        });
        setTeaching({
          attendanceMethod: s.attendanceMethod,
          defaultGradeScale: s.defaultGradeScale,
          autoReminders: s.autoReminders,
          shareGradesWithStudents: s.shareGradesWithStudents,
        });
        setSecurity((prev) => ({ ...prev, twoFactor: s.twoFactorEnabled }));
        setPreferences({ theme: s.theme, language: s.language, landingPage: s.landingPage });
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message || 'Failed to load settings');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  function updateNotif(key, value) {
    setNotifPrefs(prev => ({
      ...prev,
      [key]: value
    }));
  }

  function flashSaved(message) {
    setSaved(true);
    setSavedMessage(message);
    window.clearTimeout(savedTimerRef.current);
    savedTimerRef.current = window.setTimeout(() => setSaved(false), 2500);
  }

  function handleSaveAll() {
    setSaving(true);
    facultyApi
      .updateSettings(token, {
        notifyEmail: notifPrefs.email,
        notifyPush: notifPrefs.push,
        notifyAssignmentSubmissions: notifPrefs.assignmentSubmissions,
        notifyAttendanceReminders: notifPrefs.attendanceReminders,
        notifyLowAttendanceAlerts: notifPrefs.lowAttendanceAlerts,
        notifyStudentFeedback: notifPrefs.studentFeedback,
        notifyNotices: notifPrefs.notices,
        attendanceMethod: teaching.attendanceMethod,
        defaultGradeScale: teaching.defaultGradeScale,
        autoReminders: teaching.autoReminders,
        shareGradesWithStudents: teaching.shareGradesWithStudents,
        theme: preferences.theme,
        language: preferences.language,
        landingPage: preferences.landingPage,
        twoFactorEnabled: security.twoFactor,
      })
      .then(() => flashSaved('Settings saved'))
      .catch((err) => flashSaved(err.message || 'Failed to save settings'))
      .finally(() => setSaving(false));
  }

  function handlePasswordUpdate(e) {
    e.preventDefault();
    setPasswordError(null);
    facultyApi
      .changePassword(token, {
        currentPassword: security.currentPassword,
        newPassword: security.newPassword,
      })
      .then(() => {
        setSecurity(prev => ({
          ...prev,
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        }));
        flashSaved('Password updated');
      })
      .catch((err) => setPasswordError(err.message || 'Failed to update password'));
  }

  function handleSignOutAllDevices() {
    setSignOutError(null);
    facultyApi
      .signOutAllDevices(token)
      .then(() => logout())
      .catch((err) => setSignOutError(err.message || 'Failed to sign out of all devices'));
  }

  function handleRequestDeactivation() {
    facultyApi
      .requestDeactivation(token)
      .then(() => setDeactivateRequested(true))
      .catch((err) => flashSaved(err.message || 'Failed to submit request'));
  }

  const passwordsMismatch = security.newPassword.length > 0 && security.confirmPassword.length > 0 && security.newPassword !== security.confirmPassword;

  if (loading) {
    return (
      <div className="faculty-settings-8">
        <p className="faculty-settings-16">Loading settings…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="faculty-settings-8">
        <p className="faculty-settings-16">Couldn't load settings: {loadError}</p>
      </div>
    );
  }

  return <div className="faculty-settings-8">
      <SectionHeader title="Settings" sub="Manage your teaching preferences, notifications, and account." />

      {/* Notifications */}
      <Card className="faculty-settings-9">
        <div className="faculty-settings-10">
          <Bell className="faculty-settings-11" />
          <h3 className="faculty-settings-12">Notification Preferences</h3>
        </div>
        <p className="faculty-settings-13">Choose how and when EduSmart AI notifies you.</p>
        <div className="faculty-settings-14">
          <Toggle icon={<Mail className="faculty-settings-15" />} label="Email Notifications" description="Receive important updates in your inbox." checked={notifPrefs.email} onChange={v => updateNotif('email', v)} />
          <Toggle icon={<Smartphone className="faculty-settings-15" />} label="Push Notifications" description="Get real-time alerts on this device." checked={notifPrefs.push} onChange={v => updateNotif('push', v)} />
          <Toggle icon={<ClipboardCheck className="faculty-settings-15" />} label="Assignment Submissions" description="Alerts when students submit or resubmit assignments." checked={notifPrefs.assignmentSubmissions} onChange={v => updateNotif('assignmentSubmissions', v)} />
          <Toggle icon={<CalendarClock className="faculty-settings-15" />} label="Attendance Reminders" description="Remind me to take attendance before each class." checked={notifPrefs.attendanceReminders} onChange={v => updateNotif('attendanceReminders', v)} />
          <Toggle icon={<Users className="faculty-settings-15" />} label="Low Attendance Alerts" description="Notify me when a student's attendance drops below threshold." checked={notifPrefs.lowAttendanceAlerts} onChange={v => updateNotif('lowAttendanceAlerts', v)} />
          <Toggle icon={<GraduationCap className="faculty-settings-15" />} label="Student Feedback Received" description="Notify me when new feedback is submitted for my classes." checked={notifPrefs.studentFeedback} onChange={v => updateNotif('studentFeedback', v)} />
          <Toggle icon={<Megaphone className="faculty-settings-15" />} label="Notice Board Updates" description="Notify me when a new institution notice is posted." checked={notifPrefs.notices} onChange={v => updateNotif('notices', v)} />
        </div>
        <p className="faculty-settings-16">Note: these preferences are saved, but no notification-delivery system (email/push) is wired up yet — toggling them won't change what you actually receive until that's built.</p>
      </Card>

      {/* Teaching preferences */}
      <Card className="faculty-settings-9">
        <div className="faculty-settings-10">
          <GraduationCap className="faculty-settings-11" />
          <h3 className="faculty-settings-12">Teaching Preferences</h3>
        </div>
        <p className="faculty-settings-16">Defaults used across attendance, grading, and assignments.</p>
        <div className="faculty-settings-22">
          <Select label="Default Attendance Method" value={teaching.attendanceMethod} onChange={v => setTeaching(prev => ({
          ...prev,
          attendanceMethod: v
        }))} options={[{
          value: 'manual',
          label: 'Manual Roll Call'
        }, {
          value: 'qr',
          label: 'QR Code Check-in'
        }, {
          value: 'biometric',
          label: 'Biometric / Face Recognition'
        }]} />
          <Select label="Default Grade Scale" value={teaching.defaultGradeScale} onChange={v => setTeaching(prev => ({
          ...prev,
          defaultGradeScale: v
        }))} options={[{
          value: 'percentage',
          label: 'Percentage (0-100%)'
        }, {
          value: 'letter',
          label: 'Letter Grade (A-F)'
        }, {
          value: 'gpa',
          label: 'GPA (0-10)'
        }]} />
        </div>
        <div className="faculty-settings-14">
          <Toggle icon={<CalendarClock className="faculty-settings-15" />} label="Auto-remind Students of Deadlines" description="Automatically notify students 24 hours before assignment due dates." checked={teaching.autoReminders} onChange={v => setTeaching(prev => ({
          ...prev,
          autoReminders: v
        }))} />
          <Toggle icon={<FileSpreadsheet className="faculty-settings-15" />} label="Share Grades with Students Automatically" description="Publish grades to students as soon as you finish evaluating." checked={teaching.shareGradesWithStudents} onChange={v => setTeaching(prev => ({
          ...prev,
          shareGradesWithStudents: v
        }))} />
        </div>
        <p className="faculty-settings-16">Note: these defaults are saved, but grading/assignment/attendance screens don't read them back yet — they're not applied automatically until that's wired up.</p>
      </Card>

      {/* Security */}
      <Card className="faculty-settings-9">
        <div className="faculty-settings-10">
          <Lock className="faculty-settings-11" />
          <h3 className="faculty-settings-12">Password &amp; Security</h3>
        </div>
        <p className="faculty-settings-16">Keep your account secure with a strong password and 2FA.</p>

        <form onSubmit={handlePasswordUpdate} className="faculty-settings-17">
          <div className="faculty-settings-18">
            <Input label="Current Password" type="password" icon={<KeyRound className="faculty-settings-15" />} placeholder="Enter current password" value={security.currentPassword} onChange={v => setSecurity(prev => ({
            ...prev,
            currentPassword: v
          }))} />
          </div>
          <Input label="New Password" type="password" icon={<KeyRound className="faculty-settings-15" />} placeholder="Enter new password" value={security.newPassword} onChange={v => setSecurity(prev => ({
          ...prev,
          newPassword: v
        }))} />
          <div>
            <Input label="Confirm New Password" type="password" icon={<KeyRound className="faculty-settings-15" />} placeholder="Re-enter new password" value={security.confirmPassword} onChange={v => setSecurity(prev => ({
            ...prev,
            confirmPassword: v
          }))} />
            {passwordsMismatch && <p className="faculty-settings-19">Passwords do not match.</p>}
          </div>
          {passwordError && <p className="faculty-settings-19">{passwordError}</p>}
          <div className="faculty-settings-20">
            <Btn type="submit" variant="primary" size="sm" disabled={!security.currentPassword || !security.newPassword || passwordsMismatch}>
              Update Password
            </Btn>
          </div>
        </form>

        <div className="faculty-settings-21">
          <Toggle icon={<ShieldCheck className="faculty-settings-15" />} label="Two-Factor Authentication" description="Add an extra layer of security to your account at login." checked={security.twoFactor} onChange={v => setSecurity(prev => ({
          ...prev,
          twoFactor: v
        }))} />
        </div>
        {security.twoFactor && <p className="faculty-settings-16">Note: this flag is saved, but there's no OTP/2FA challenge built into login yet — enabling it here doesn't change what happens when you sign in.</p>}
      </Card>

      {/* Appearance & Language */}
      <Card className="faculty-settings-9">
        <div className="faculty-settings-10">
          <Globe className="faculty-settings-11" />
          <h3 className="faculty-settings-12">Appearance &amp; Language</h3>
        </div>
        <p className="faculty-settings-16">Personalize how EduSmart AI looks and speaks to you.</p>
        <div className="faculty-settings-22">
          <Select label="Theme" value={preferences.theme} onChange={v => setPreferences(prev => ({
          ...prev,
          theme: v
        }))} options={[{
          value: 'light',
          label: 'Light'
        }, {
          value: 'dark',
          label: 'Dark (coming soon)'
        }, {
          value: 'system',
          label: 'Match System'
        }]} />
          <Select label="Language" value={preferences.language} onChange={v => setPreferences(prev => ({
          ...prev,
          language: v
        }))} options={[{
          value: 'en',
          label: 'English'
        }, {
          value: 'hi',
          label: 'Hindi'
        }, {
          value: 'mr',
          label: 'Marathi'
        }]} />
          <Select label="Default Landing Page" value={preferences.landingPage} onChange={v => setPreferences(prev => ({
          ...prev,
          landingPage: v
        }))} options={[{
          value: 'faculty/dashboard',
          label: 'Dashboard'
        }, {
          value: 'faculty/classes',
          label: 'My Classes'
        }, {
          value: 'faculty/attendance',
          label: 'Attendance'
        }, {
          value: 'faculty/timetable',
          label: 'Timetable'
        }]} />
        </div>
        <p className="faculty-settings-16">Note: your choice is saved, but the app doesn't have a dark theme or translations implemented yet, and login doesn't redirect to your default landing page yet either — this only stores the preference for later.</p>
      </Card>

      {/* Account */}
      <Card className="faculty-settings-9">
        <div className="faculty-settings-10">
          <UserCog className="faculty-settings-11" />
          <h3 className="faculty-settings-12">Account</h3>
        </div>
        <p className="faculty-settings-16">Manage your profile details and account access.</p>
        <div className="faculty-settings-23">
          <Btn variant="outline" size="sm" onClick={() => navigate('faculty/profile')}>
            Edit Profile
          </Btn>
          <Btn variant="secondary" size="sm" onClick={handleSignOutAllDevices}>Sign Out of All Devices</Btn>
        </div>
        {signOutError && <p className="faculty-settings-19">{signOutError}</p>}

        <div className="faculty-settings-24">
          <div className="faculty-settings-25">
            <AlertTriangle className="faculty-settings-26" />
            <div className="faculty-settings-27">
              <p className="faculty-settings-28">Deactivate Account</p>
              <p className="faculty-settings-29">
                This will request account deactivation from your institution admin. Your data is retained per institution policy.
              </p>
              {deactivateRequested ? (
                <p className="faculty-settings-16">Request submitted — your institution admin has been logged as needing to review this.</p>
              ) : (
                <Btn variant="danger" size="sm" onClick={handleRequestDeactivation}>Request Deactivation</Btn>
              )}
            </div>
          </div>
        </div>
      </Card>

      <div className="faculty-settings-30">
        <Btn variant="primary" onClick={handleSaveAll} disabled={saving}>{saving ? 'Saving…' : 'Save All Settings'}</Btn>
      </div>

      <SavedToast show={saved} message={savedMessage} />
    </div>;
}