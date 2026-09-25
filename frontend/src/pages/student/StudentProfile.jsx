import './StudentProfile.css';
import { useEffect, useState } from 'react';
import { Edit3, Mail, Phone, Calendar, MapPin, Heart, BookOpen, GraduationCap, KeyRound, Bell, Shield, TrendingUp, ClipboardList, Award, Layers, CheckCircle } from 'lucide-react';
import { Badge, Card, Btn, SectionHeader, ProgressBar } from '../../components/ui/index';
import { useAuth } from '../../context/AuthContext';
import { studentApi } from '../../lib/api';

function InfoRow({
  icon,
  label,
  value
}) {
  return <div className="student-profile-1">
      <div className="student-profile-2">
        {icon}
      </div>
      <div className="student-profile-3">
        <p className="student-profile-4">{label}</p>
        <p className="student-profile-5">{value ?? 'Not provided'}</p>
      </div>
    </div>;
}
function MiniStat({
  icon,
  label,
  value,
  color,
  progressValue
}) {
  const colorMap = {
    blue: {
      bg: 'bg-blue-50',
      icon: 'text-blue-600',
      value: 'text-blue-700'
    },
    green: {
      bg: 'bg-green-50',
      icon: 'text-green-600',
      value: 'text-green-700'
    },
    amber: {
      bg: 'bg-amber-50',
      icon: 'text-amber-600',
      value: 'text-amber-700'
    },
    violet: {
      bg: 'bg-violet-50',
      icon: 'text-violet-600',
      value: 'text-violet-700'
    }
  };
  const c = colorMap[color];
  return <div className="student-profile-6">
      <div className={`w-9 h-9 rounded-xl ${c.bg} flex items-center justify-center mb-3`}>
        <span className={c.icon}>{icon}</span>
      </div>
      <p className={`text-xl font-bold font-display ${c.value}`}>{value}</p>
      <p className="student-profile-7">{label}</p>
      {progressValue !== undefined && <div className="student-profile-8">
          <ProgressBar value={progressValue} color={color === 'amber' ? 'amber' : color === 'green' ? 'green' : color === 'violet' ? 'violet' : 'blue'} />
        </div>}
    </div>;
}
function AccountSettingRow({
  icon,
  title,
  description
}) {
  return <div className="student-profile-9">
      <div className="student-profile-10">
        <div className="student-profile-11">
          {icon}
        </div>
        <div>
          <p className="student-profile-12">{title}</p>
          <p className="student-profile-13">{description}</p>
        </div>
      </div>
      <button className="student-profile-14">
        Manage
      </button>
    </div>;
}

function initialsOf(name) {
  if (!name) return '';
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
}

export default function StudentProfile() {
  const { token } = useAuth();
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState(null);
  const [attendancePct, setAttendancePct] = useState(null);
  const [assignmentCompletionPct, setAssignmentCompletionPct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [form, setForm] = useState({ name: '', email: '' });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([studentApi.getProfile(token), studentApi.getPerformance(token)])
      .then(([profileRes, performanceRes]) => {
        if (cancelled) return;
        setProfile(profileRes.profile);
        setForm({ name: profileRes.profile.name, email: profileRes.profile.email });
        setAttendancePct(performanceRes.metrics?.attendancePct ?? null);
        setAssignmentCompletionPct(performanceRes.metrics?.assignmentCompletionPct ?? null);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load profile');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  function handleSave() {
    setSaveError(null);
    studentApi
      .updateProfile(token, form)
      .then((res) => {
        setProfile(res.profile);
        setEditing(false);
      })
      .catch((err) => setSaveError(err.message || 'Failed to save changes'));
  }

  if (loading) {
    return (
      <div className="student-profile-15">
        <p className="student-profile-4">Loading profile…</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="student-profile-15">
        <p className="student-profile-4">Couldn't load profile: {error}</p>
      </div>
    );
  }

  return <div className="student-profile-15">
      {/* Profile header card */}
      <Card className="student-profile-16">
        <div className="student-profile-17">
          {/* Avatar */}
          <div className="student-profile-18">
            <span className="student-profile-19">{initialsOf(profile.name)}</span>
          </div>

          {/* Name & meta */}
          <div className="student-profile-3">
            <div className="student-profile-20">
              <div>
                <h1 className="student-profile-21">{profile.name}</h1>
                <p className="student-profile-22">{profile.rollId || profile.id} · {profile.email}</p>
                <div className="student-profile-23">
                  <Badge variant="info">{profile.department?.name}</Badge>
                  <Badge variant="success">{profile.course?.name}</Badge>
                  <Badge variant="neutral">Year {profile.year} · Section {profile.section}</Badge>
                </div>
              </div>
              <Btn variant="outline" size="sm" icon={<Edit3 className="student-profile-24" />} onClick={() => setEditing(v => !v)}>
                {editing ? 'Cancel Edit' : 'Edit Profile'}
              </Btn>
            </div>
          </div>
        </div>

        {editing && <div className="student-profile-25">
            <div className="student-profile-26">
              <div>
                <label className="student-profile-27">Name</label>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="student-profile-28" />
              </div>
              <div>
                <label className="student-profile-27">Email</label>
                <input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="student-profile-28" />
              </div>
            </div>
            {saveError && <p className="student-profile-4">{saveError}</p>}
            <div className="student-profile-29">
              <Btn size="sm" onClick={handleSave}>Save Changes</Btn>
              <Btn size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Btn>
            </div>
          </div>}
      </Card>

      {/* Academic summary — only what the backend actually tracks per student */}
      <div className="student-profile-30">
        <MiniStat icon={<TrendingUp className="student-profile-31" />} label="Attendance" value={attendancePct != null ? `${attendancePct}%` : '—'} color="blue" progressValue={attendancePct ?? 0} />
        <MiniStat icon={<ClipboardList className="student-profile-31" />} label="Assignments" value={assignmentCompletionPct != null ? `${assignmentCompletionPct}%` : '—'} color="green" progressValue={assignmentCompletionPct ?? 0} />
        <MiniStat icon={<Award className="student-profile-31" />} label="Status" value={profile.status} color="violet" />
        <MiniStat icon={<Layers className="student-profile-31" />} label="Year / Section" value={`${profile.year} / ${profile.section}`} color="amber" />
      </div>

      {/* Two-column layout */}
      <div className="student-profile-32">
        {/* Personal Information */}
        <Card className="student-profile-33">
          <SectionHeader title="Personal Information" sub="Your registered personal details" />
          <div className="student-profile-34">
            <InfoRow icon={<span className="student-profile-35">{initialsOf(profile.name)}</span>} label="Full Name" value={profile.name} />
            <InfoRow icon={<Mail className="student-profile-36" />} label="Email Address" value={profile.email} />
            {/* Phone, address, date of birth and blood group are not part of the Student
                table in the current schema — nothing to wire these to yet. Add the
                columns (and a migration) if you want them editable here. */}
          </div>
        </Card>

        {/* Academic Information */}
        <Card className="student-profile-33">
          <SectionHeader title="Academic Information" sub="Your enrollment and academic details" />
          <div className="student-profile-34">
            <InfoRow icon={<span className="student-profile-37">#ID</span>} label="Student ID" value={profile.rollId || profile.id} />
            <InfoRow icon={<BookOpen className="student-profile-36" />} label="Department" value={profile.department?.name} />
            <InfoRow icon={<GraduationCap className="student-profile-36" />} label="Course" value={profile.course?.name} />
            <InfoRow icon={<span className="student-profile-38">Y/S</span>} label="Year / Section" value={`Year ${profile.year} · Section ${profile.section}`} />
            <InfoRow icon={<Calendar className="student-profile-36" />} label="Enrolled Since" value={profile.enrolledDate ? new Date(profile.enrolledDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null} />
            {/* CGPA and credits earned aren't stored on Student either — there's no
                grading/credits model yet, so these are left out rather than faked. */}
          </div>
        </Card>
      </div>

      {/* Account Settings — UI only for now; no backend endpoints beyond the
          basic name/email/password update on PUT /student/profile. */}
      <Card className="student-profile-33">
        <SectionHeader title="Account Settings" sub="Manage your account preferences and security" />
        <div className="student-profile-34">
          <AccountSettingRow icon={<KeyRound className="student-profile-36" />} title="Change Password" description="Update your account password regularly for security" />
          <AccountSettingRow icon={<Bell className="student-profile-36" />} title="Notification Preferences" description="Choose which alerts and updates you receive" />
          <AccountSettingRow icon={<Shield className="student-profile-36" />} title="Privacy Settings" description="Control what information is visible to others" />
        </div>
      </Card>
    </div>;
}