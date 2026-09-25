import './AdminSettings.css';
import { useEffect, useRef, useState } from 'react';
import { Bell, Lock, Globe, ShieldCheck, Mail, Smartphone, UserPlus, AlertTriangle, TrendingDown, KeyRound, UserCog, Check, Building2, CalendarClock, FileSpreadsheet, Loader2 } from 'lucide-react';
import { Card, Btn, SectionHeader, Input, Select } from '../../components/ui';
import { useNav } from '../../context/NavigationContext';
import { useAuth } from '../../context/AuthContext';
import { settingsApi, fileUrl, ApiError } from '../../lib/api';

function Toggle({
  checked,
  onChange,
  label,
  description,
  icon
}) {
  return <div className="admin-settings-1">
      <div className="admin-settings-2">
        {icon && <div className="admin-settings-3">{icon}</div>}
        <div>
          <p className="admin-settings-4">{label}</p>
          {description && <p className="admin-settings-5">{description}</p>}
        </div>
      </div>
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${checked ? 'bg-violet-600' : 'bg-slate-200'}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>;
}
function SavedToast({
  show
}) {
  if (!show) return null;
  return <div className="admin-settings-6">
      <Check className="admin-settings-7" />
      Settings saved
    </div>;
}

// Maps the backend's InstitutionSettings row into the four local UI groups
// this page edits. See backend/src/controllers/settings.controller.js for
// the field list (DEFAULTS) — twoFactorRequired/sessionTimeoutMinutes/
// qrLoginEnabled/joinApprovalRequired live in the same row but are only
// surfaced here (twoFactor) or on the Security Center page (the rest).
function settingsToLocal(settings) {
  return {
    notifPrefs: {
      email: settings.notifyEmail,
      push: settings.notifyPush,
      joinRequests: settings.notifyJoinRequests,
      lowAttendanceAlerts: settings.notifyLowAttendance,
      atRiskFlags: settings.notifyAtRiskFlags,
      workloadAlerts: settings.notifyWorkloadAlerts,
      weeklyDigest: settings.notifyWeeklyDigest,
    },
    institution: {
      academicYear: settings.academicYear,
      defaultGradeScale: settings.defaultGradeScale,
      attendanceThreshold: String(settings.attendanceThreshold),
      landingPage: settings.landingPage,
    },
    preferences: {
      theme: settings.theme,
      language: settings.language,
      timezone: settings.timezone,
    },
    twoFactor: settings.twoFactorRequired,
  };
}

export default function AdminSettings() {
  const {
    navigate
  } = useNav();
  const { token, logout } = useAuth();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [notifPrefs, setNotifPrefs] = useState({
    email: true,
    push: true,
    joinRequests: true,
    lowAttendanceAlerts: true,
    atRiskFlags: true,
    workloadAlerts: true,
    weeklyDigest: true
  });
  const [institution, setInstitution] = useState({
    academicYear: '2026',
    defaultGradeScale: 'percentage',
    attendanceThreshold: '75',
    landingPage: 'admin/dashboard'
  });
  const [security, setSecurity] = useState({
    twoFactor: true,
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [preferences, setPreferences] = useState({
    theme: 'light',
    language: 'en',
    timezone: 'ist'
  });

  const [saved, setSaved] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const [saveError, setSaveError] = useState('');
  const savedTimerRef = useRef(null);

  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setLoadError('');
      try {
        const { settings } = await settingsApi.getSettings(token);
        const local = settingsToLocal(settings);
        setNotifPrefs(local.notifPrefs);
        setInstitution(local.institution);
        setPreferences(local.preferences);
        setSecurity((prev) => ({ ...prev, twoFactor: local.twoFactor }));
      } catch (err) {
        setLoadError(err instanceof ApiError ? err.message : 'Failed to load settings');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  function updateNotif(key, value) {
    setNotifPrefs(prev => ({
      ...prev,
      [key]: value
    }));
  }

  async function handleSaveAll() {
    setSavingAll(true);
    setSaveError('');
    try {
      await settingsApi.updateSettings(token, {
        notifyEmail: notifPrefs.email,
        notifyPush: notifPrefs.push,
        notifyJoinRequests: notifPrefs.joinRequests,
        notifyLowAttendance: notifPrefs.lowAttendanceAlerts,
        notifyAtRiskFlags: notifPrefs.atRiskFlags,
        notifyWorkloadAlerts: notifPrefs.workloadAlerts,
        notifyWeeklyDigest: notifPrefs.weeklyDigest,
        academicYear: institution.academicYear,
        defaultGradeScale: institution.defaultGradeScale,
        attendanceThreshold: Number(institution.attendanceThreshold),
        landingPage: institution.landingPage,
        theme: preferences.theme,
        language: preferences.language,
        timezone: preferences.timezone,
        twoFactorRequired: security.twoFactor,
      });
      setSaved(true);
      window.clearTimeout(savedTimerRef.current);
      savedTimerRef.current = window.setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Failed to save settings');
    } finally {
      setSavingAll(false);
    }
  }

  async function handlePasswordUpdate(e) {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess(false);
    setPasswordSaving(true);
    try {
      await settingsApi.changePassword(token, {
        currentPassword: security.currentPassword,
        newPassword: security.newPassword,
      });
      setSecurity(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      }));
      setPasswordSuccess(true);
      window.setTimeout(() => setPasswordSuccess(false), 2500);
    } catch (err) {
      setPasswordError(err instanceof ApiError ? err.message : 'Failed to update password');
    } finally {
      setPasswordSaving(false);
    }
  }

  async function handleSignOutAllDevices() {
    setSigningOut(true);
    setSignOutError('');
    try {
      await settingsApi.signOutAllDevices(token);
      // This invalidates every JWT issued before now, including the one this
      // tab is using — so treat it as a forced logout.
      logout();
      navigate('landing');
    } catch (err) {
      setSignOutError(err instanceof ApiError ? err.message : 'Failed to sign out of other devices');
      setSigningOut(false);
    }
  }

  async function handleExportData() {
    setExporting(true);
    setExportError('');
    try {
      const { fileUrl: relativeUrl } = await settingsApi.exportInstitutionData(token);
      window.open(fileUrl(relativeUrl), '_blank', 'noopener');
    } catch (err) {
      setExportError(err instanceof ApiError ? err.message : 'Failed to export institution data');
    } finally {
      setExporting(false);
    }
  }

  const passwordsMismatch = security.newPassword.length > 0 && security.confirmPassword.length > 0 && security.newPassword !== security.confirmPassword;

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  return <div className="admin-settings-8">
      <SectionHeader title="Settings" sub="Manage institution defaults, notifications, and account security." />

      {loadError && <div style={{ color: '#dc2626', marginBottom: '1rem' }}>{loadError}</div>}

      {/* Notifications */}
      <Card className="admin-settings-9">
        <div className="admin-settings-10">
          <Bell className="admin-settings-11" />
          <h3 className="admin-settings-12">Notification Preferences</h3>
        </div>
        <p className="admin-settings-13">Choose how and when EduSmart AI notifies you.</p>
        <div className="admin-settings-14">
          <Toggle icon={<Mail className="admin-settings-15" />} label="Email Notifications" description="Receive important updates in your inbox." checked={notifPrefs.email} onChange={v => updateNotif('email', v)} />
          <Toggle icon={<Smartphone className="admin-settings-15" />} label="Push Notifications" description="Get real-time alerts on this device." checked={notifPrefs.push} onChange={v => updateNotif('push', v)} />
          <Toggle icon={<UserPlus className="admin-settings-15" />} label="New Join Requests" description="Notify me when a student or faculty member requests to join." checked={notifPrefs.joinRequests} onChange={v => updateNotif('joinRequests', v)} />
          <Toggle icon={<AlertTriangle className="admin-settings-15" />} label="Low Attendance Alerts" description="Notify me when institution-wide attendance drops below threshold." checked={notifPrefs.lowAttendanceAlerts} onChange={v => updateNotif('lowAttendanceAlerts', v)} />
          <Toggle icon={<TrendingDown className="admin-settings-15" />} label="At-Risk Student Flags" description="Notify me when new students are flagged as at-risk." checked={notifPrefs.atRiskFlags} onChange={v => updateNotif('atRiskFlags', v)} />
          <Toggle icon={<UserCog className="admin-settings-15" />} label="Faculty Workload Alerts" description="Notify me when a faculty member exceeds the workload threshold." checked={notifPrefs.workloadAlerts} onChange={v => updateNotif('workloadAlerts', v)} />
          <Toggle icon={<CalendarClock className="admin-settings-15" />} label="Weekly Summary Digest" description="Get a weekly email summarizing institution performance." checked={notifPrefs.weeklyDigest} onChange={v => updateNotif('weeklyDigest', v)} />
        </div>
      </Card>

      {/* Institution Defaults */}
      <Card className="admin-settings-9">
        <div className="admin-settings-10">
          <Building2 className="admin-settings-11" />
          <h3 className="admin-settings-12">Institution Defaults</h3>
        </div>
        <p className="admin-settings-16">Defaults applied across departments, courses, and reporting.</p>
        <div className="admin-settings-22">
          <Select label="Academic Year" value={institution.academicYear} onChange={v => setInstitution(prev => ({
          ...prev,
          academicYear: v
        }))} options={[{
          value: '2026',
          label: '2026 Academic Year'
        }, {
          value: '2025',
          label: '2025 Academic Year'
        }]} />
          <Select label="Default Grade Scale" value={institution.defaultGradeScale} onChange={v => setInstitution(prev => ({
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
          <Select label="Attendance Threshold" value={institution.attendanceThreshold} onChange={v => setInstitution(prev => ({
          ...prev,
          attendanceThreshold: v
        }))} options={[{
          value: '65',
          label: '65%'
        }, {
          value: '75',
          label: '75%'
        }, {
          value: '85',
          label: '85%'
        }]} />
          <Select label="Default Landing Page" value={institution.landingPage} onChange={v => setInstitution(prev => ({
          ...prev,
          landingPage: v
        }))} options={[{
          value: 'admin/dashboard',
          label: 'Dashboard'
        }, {
          value: 'admin/institution',
          label: 'Institution'
        }, {
          value: 'admin/performance',
          label: 'Performance'
        }]} />
        </div>
      </Card>

      {/* Security */}
      <Card className="admin-settings-9">
        <div className="admin-settings-10">
          <Lock className="admin-settings-11" />
          <h3 className="admin-settings-12">Password &amp; Security</h3>
        </div>
        <p className="admin-settings-16">Keep your admin account secure with a strong password and 2FA.</p>

        <form onSubmit={handlePasswordUpdate} className="admin-settings-17">
          <div className="admin-settings-18">
            <Input label="Current Password" type="password" icon={<KeyRound className="admin-settings-15" />} placeholder="Enter current password" value={security.currentPassword} onChange={v => setSecurity(prev => ({
            ...prev,
            currentPassword: v
          }))} />
          </div>
          <Input label="New Password" type="password" icon={<KeyRound className="admin-settings-15" />} placeholder="Enter new password" value={security.newPassword} onChange={v => setSecurity(prev => ({
          ...prev,
          newPassword: v
        }))} />
          <div>
            <Input label="Confirm New Password" type="password" icon={<KeyRound className="admin-settings-15" />} placeholder="Re-enter new password" value={security.confirmPassword} onChange={v => setSecurity(prev => ({
            ...prev,
            confirmPassword: v
          }))} />
            {passwordsMismatch && <p className="admin-settings-19">Passwords do not match.</p>}
          </div>
          {passwordError && <p className="admin-settings-19">{passwordError}</p>}
          {passwordSuccess && <p style={{ color: '#16a34a', fontSize: '0.8rem' }}>Password updated.</p>}
          <div className="admin-settings-20">
            <Btn type="submit" variant="primary" size="sm" disabled={passwordSaving || !security.currentPassword || !security.newPassword || passwordsMismatch}>
              {passwordSaving ? 'Updating...' : 'Update Password'}
            </Btn>
          </div>
        </form>

        <div className="admin-settings-21">
          <Toggle icon={<ShieldCheck className="admin-settings-15" />} label="Two-Factor Authentication" description="Add an extra layer of security to your account at login." checked={security.twoFactor} onChange={v => setSecurity(prev => ({
          ...prev,
          twoFactor: v
        }))} />
        </div>
      </Card>

      {/* Appearance & Language */}
      <Card className="admin-settings-9">
        <div className="admin-settings-10">
          <Globe className="admin-settings-11" />
          <h3 className="admin-settings-12">Appearance &amp; Language</h3>
        </div>
        <p className="admin-settings-16">Personalize how EduSmart AI looks and speaks to you.</p>
        <div className="admin-settings-22">
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
          <Select label="Timezone" value={preferences.timezone} onChange={v => setPreferences(prev => ({
          ...prev,
          timezone: v
        }))} options={[{
          value: 'ist',
          label: 'India Standard Time (IST)'
        }, {
          value: 'utc',
          label: 'Coordinated Universal Time (UTC)'
        }]} />
        </div>
      </Card>

      {/* Account */}
      <Card className="admin-settings-9">
        <div className="admin-settings-10">
          <UserCog className="admin-settings-11" />
          <h3 className="admin-settings-12">Account</h3>
        </div>
        <p className="admin-settings-16">Manage your profile details and account access.</p>
        {signOutError && <p style={{ color: '#dc2626', fontSize: '0.8rem' }}>{signOutError}</p>}
        <div className="admin-settings-23">
          <Btn variant="outline" size="sm" onClick={() => navigate('admin/dashboard')}>
            Edit Profile
          </Btn>
          <Btn variant="secondary" size="sm" onClick={handleSignOutAllDevices} disabled={signingOut}>
            {signingOut ? 'Signing Out...' : 'Sign Out of All Devices'}
          </Btn>
        </div>

        <div className="admin-settings-24">
          <div className="admin-settings-25">
            <FileSpreadsheet className="admin-settings-26" />
            <div className="admin-settings-27">
              <p className="admin-settings-28">Export Institution Data</p>
              <p className="admin-settings-29">
                Download a full export of students, faculty, and academic records for backup or migration.
              </p>
              {exportError && <p style={{ color: '#dc2626', fontSize: '0.8rem' }}>{exportError}</p>}
              <Btn variant="outline" size="sm" onClick={handleExportData} disabled={exporting}>
                {exporting ? 'Preparing Export...' : 'Request Export'}
              </Btn>
            </div>
          </div>
        </div>
      </Card>

      {saveError && <div style={{ color: '#dc2626', marginBottom: '1rem' }}>{saveError}</div>}
      <div className="admin-settings-30">
        <Btn variant="primary" onClick={handleSaveAll} disabled={savingAll}>
          {savingAll ? 'Saving...' : 'Save All Settings'}
        </Btn>
      </div>

      <SavedToast show={saved} />
    </div>;
}