import './StudentSettings.css';
import { useEffect, useRef, useState } from 'react';
import { Bell, Lock, Globe, ShieldCheck, Mail, Smartphone, Megaphone, ClipboardCheck, CalendarCheck2, KeyRound, UserCog, AlertTriangle, Check } from 'lucide-react';
import { Card, Btn, SectionHeader, Input, Select } from '../../components/ui/index';
import { useNav } from '../../context/NavigationContext';
import { useAuth } from '../../context/AuthContext';
import { studentApi } from '../../lib/api';

function Toggle({
  checked,
  onChange,
  label,
  description,
  icon
}) {
  return <div className="student-settings-1">
      <div className="student-settings-2">
        {icon && <div className="student-settings-3">{icon}</div>}
        <div>
          <p className="student-settings-4">{label}</p>
          {description && <p className="student-settings-5">{description}</p>}
        </div>
      </div>
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-slate-200'}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>;
}
function SavedToast({
  show,
  message
}) {
  if (!show) return null;
  return <div className="student-settings-6">
      <Check className="student-settings-7" />
      {message || 'Settings saved'}
    </div>;
}

export default function StudentSettings() {
  const { navigate } = useNav();
  const { token, logout } = useAuth();

  const [notifPrefs, setNotifPrefs] = useState({
    email: true,
    push: true,
    assignments: true,
    attendance: true,
    notices: false
  });
  const [security, setSecurity] = useState({
    twoFactor: false,
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [preferences, setPreferences] = useState({
    theme: 'light',
    language: 'en'
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
    studentApi
      .getSettings(token)
      .then((res) => {
        if (cancelled) return;
        const s = res.settings;
        setNotifPrefs({
          email: s.notifyEmail,
          push: s.notifyPush,
          assignments: s.notifyAssignments,
          attendance: s.notifyAttendance,
          notices: s.notifyNotices,
        });
        setSecurity((prev) => ({ ...prev, twoFactor: s.twoFactorEnabled }));
        setPreferences({ theme: s.theme, language: s.language });
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
    studentApi
      .updateSettings(token, {
        notifyEmail: notifPrefs.email,
        notifyPush: notifPrefs.push,
        notifyAssignments: notifPrefs.assignments,
        notifyAttendance: notifPrefs.attendance,
        notifyNotices: notifPrefs.notices,
        theme: preferences.theme,
        language: preferences.language,
        twoFactorEnabled: security.twoFactor,
      })
      .then(() => flashSaved('Settings saved'))
      .catch((err) => flashSaved(err.message || 'Failed to save settings'))
      .finally(() => setSaving(false));
  }

  function handlePasswordUpdate(e) {
    e.preventDefault();
    setPasswordError(null);
    studentApi
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
    studentApi
      .signOutAllDevices(token)
      .then(() => logout())
      .catch((err) => setSignOutError(err.message || 'Failed to sign out of all devices'));
  }

  function handleRequestDeactivation() {
    studentApi
      .requestDeactivation(token)
      .then(() => setDeactivateRequested(true))
      .catch((err) => flashSaved(err.message || 'Failed to submit request'));
  }

  const passwordsMismatch = security.newPassword.length > 0 && security.confirmPassword.length > 0 && security.newPassword !== security.confirmPassword;

  if (loading) {
    return (
      <div className="student-settings-8">
        <p className="student-settings-16">Loading settings…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="student-settings-8">
        <p className="student-settings-16">Couldn't load settings: {loadError}</p>
      </div>
    );
  }

  return <div className="student-settings-8">
      <SectionHeader title="Settings" sub="Manage your notifications, security, and account preferences." />

      {/* Notifications */}
      <Card className="student-settings-9">
        <div className="student-settings-10">
          <Bell className="student-settings-11" />
          <h3 className="student-settings-12">Notification Preferences</h3>
        </div>
        <p className="student-settings-13">Choose how and when you're notified.</p>
        <div className="student-settings-14">
          <Toggle icon={<Mail className="student-settings-15" />} label="Email Notifications" description="Receive important updates in your inbox." checked={notifPrefs.email} onChange={v => updateNotif('email', v)} />
          <Toggle icon={<Smartphone className="student-settings-15" />} label="Push Notifications" description="Get real-time alerts on this device." checked={notifPrefs.push} onChange={v => updateNotif('push', v)} />
          <Toggle icon={<ClipboardCheck className="student-settings-15" />} label="Assignment Reminders" description="Alerts for upcoming and overdue assignments." checked={notifPrefs.assignments} onChange={v => updateNotif('assignments', v)} />
          <Toggle icon={<CalendarCheck2 className="student-settings-15" />} label="Attendance Alerts" description="Get notified when your attendance drops below threshold." checked={notifPrefs.attendance} onChange={v => updateNotif('attendance', v)} />
          <Toggle icon={<Megaphone className="student-settings-15" />} label="Notice Board Updates" description="Notify me when a new institution notice is posted." checked={notifPrefs.notices} onChange={v => updateNotif('notices', v)} />
        </div>
        <p className="student-settings-16">Note: these preferences are saved, but no notification-delivery system (email/push) is wired up yet — toggling them won't change what you actually receive until that's built.</p>
      </Card>

      {/* Security */}
      <Card className="student-settings-9">
        <div className="student-settings-10">
          <Lock className="student-settings-11" />
          <h3 className="student-settings-12">Password &amp; Security</h3>
        </div>
        <p className="student-settings-16">Keep your account secure with a strong password and 2FA.</p>

        <form onSubmit={handlePasswordUpdate} className="student-settings-17">
          <div className="student-settings-18">
            <Input label="Current Password" type="password" icon={<KeyRound className="student-settings-15" />} placeholder="Enter current password" value={security.currentPassword} onChange={v => setSecurity(prev => ({
            ...prev,
            currentPassword: v
          }))} />
          </div>
          <Input label="New Password" type="password" icon={<KeyRound className="student-settings-15" />} placeholder="Enter new password" value={security.newPassword} onChange={v => setSecurity(prev => ({
          ...prev,
          newPassword: v
        }))} />
          <div>
            <Input label="Confirm New Password" type="password" icon={<KeyRound className="student-settings-15" />} placeholder="Re-enter new password" value={security.confirmPassword} onChange={v => setSecurity(prev => ({
            ...prev,
            confirmPassword: v
          }))} />
            {passwordsMismatch && <p className="student-settings-19">Passwords do not match.</p>}
          </div>
          {passwordError && <p className="student-settings-19">{passwordError}</p>}
          <div className="student-settings-20">
            <Btn type="submit" variant="primary" size="sm" disabled={!security.currentPassword || !security.newPassword || passwordsMismatch}>
              Update Password
            </Btn>
          </div>
        </form>

        <div className="student-settings-21">
          <Toggle icon={<ShieldCheck className="student-settings-15" />} label="Two-Factor Authentication" description="Add an extra layer of security to your account at login." checked={security.twoFactor} onChange={v => setSecurity(prev => ({
          ...prev,
          twoFactor: v
        }))} />
        </div>
        {security.twoFactor && <p className="student-settings-16">Note: this flag is saved, but there's no OTP/2FA challenge built into login yet — enabling it here doesn't change what happens when you sign in.</p>}
      </Card>

      {/* Preferences */}
      <Card className="student-settings-9">
        <div className="student-settings-10">
          <Globe className="student-settings-11" />
          <h3 className="student-settings-12">Appearance &amp; Language</h3>
        </div>
        <p className="student-settings-16">Personalize how the portal looks and speaks to you.</p>
        <div className="student-settings-22">
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
        </div>
        <p className="student-settings-16">Note: your choice is saved, but the app doesn't have a dark theme or translations implemented yet — this only stores the preference for later.</p>
      </Card>

      {/* Account */}
      <Card className="student-settings-9">
        <div className="student-settings-10">
          <UserCog className="student-settings-11" />
          <h3 className="student-settings-12">Account</h3>
        </div>
        <p className="student-settings-16">Manage your profile details and account access.</p>
        <div className="student-settings-23">
          <Btn variant="outline" size="sm" onClick={() => navigate('student/profile')}>
            Edit Profile
          </Btn>
          <Btn variant="secondary" size="sm" onClick={handleSignOutAllDevices}>Sign Out of All Devices</Btn>
        </div>
        {signOutError && <p className="student-settings-19">{signOutError}</p>}

        <div className="student-settings-24">
          <div className="student-settings-25">
            <AlertTriangle className="student-settings-26" />
            <div className="student-settings-27">
              <p className="student-settings-28">Deactivate Account</p>
              <p className="student-settings-29">
                This will request account deactivation from your institution admin. Your data is retained per institution policy.
              </p>
              {deactivateRequested ? (
                <p className="student-settings-16">Request submitted — your institution admin has been logged as needing to review this.</p>
              ) : (
                <Btn variant="danger" size="sm" onClick={handleRequestDeactivation}>Request Deactivation</Btn>
              )}
            </div>
          </div>
        </div>
      </Card>

      <div className="student-settings-30">
        <Btn variant="primary" onClick={handleSaveAll} disabled={saving}>{saving ? 'Saving…' : 'Save All Settings'}</Btn>
      </div>

      <SavedToast show={saved} message={savedMessage} />
    </div>;
}