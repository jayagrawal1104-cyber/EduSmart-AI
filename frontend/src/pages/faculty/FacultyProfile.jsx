import './FacultyProfile.css';
import { useEffect, useState } from 'react';
import { BookOpen, Users, Clock, GraduationCap, Mail, Phone, Calendar, MapPin, CheckSquare, Award, Pencil, ClipboardList, Upload } from 'lucide-react';
import { Badge, StatCard, SectionHeader } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { facultyApi } from '../../lib/api';

const ACTIVITY_ICONS = { CheckSquare, ClipboardList, Upload };

function initials(name) {
  if (!name) return '';
  return name
    .replace(/^(Prof\.|Dr\.|Mr\.|Ms\.|Mrs\.)\s*/i, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}

function formatJoinedDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function timeAgo(value) {
  if (!value) return '';
  const diffMs = Date.now() - new Date(value).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `Today, ${new Date(value).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  const weeks = Math.round(days / 7);
  return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
}

const EMPTY_FORM = { name: '', email: '', phone: '', qualifications: '', specialization: '', officeHours: '', officeRoom: '' };

export default function FacultyProfile() {
  const { token } = useAuth();

  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    facultyApi.getProfile(token).then(res => {
      setProfile(res.profile);
      setStats(res.stats);
      setActivity(res.activity || []);
      setForm({
        name: res.profile.name || '',
        email: res.profile.email || '',
        phone: res.profile.phone || '',
        qualifications: res.profile.qualifications || '',
        specialization: res.profile.specialization || '',
        officeHours: res.profile.officeHours || '',
        officeRoom: res.profile.officeRoom || '',
      });
      setError(null);
    }).catch(err => {
      setError(err.message || 'Failed to load profile');
    }).finally(() => {
      setLoading(false);
    });
  }, [token]);

  async function handleEditToggle() {
    if (!editing) {
      setEditing(true);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await facultyApi.updateProfile(token, form);
      setProfile(res.profile);
      setEditing(false);
    } catch (err) {
      setSaveError(err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  }

  function updateField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  if (loading) return <div className="faculty-profile-1"><p>Loading profile…</p></div>;
  if (error) return <div className="faculty-profile-1"><p>Couldn't load profile: {error}</p></div>;

  const personalFields = [
    { icon: GraduationCap, label: 'Full Name', field: 'name', value: profile.name },
    { icon: Mail, label: 'Email', field: 'email', value: profile.email },
    { icon: Phone, label: 'Phone', field: 'phone', value: profile.phone || '—' },
    { icon: Calendar, label: 'Date of Joining', value: formatJoinedDate(profile.joinedDate), readOnly: true },
    { icon: Award, label: 'Qualifications', field: 'qualifications', value: profile.qualifications || '—' },
  ];

  const academicFields = [
    { icon: BookOpen, label: 'Department', value: profile.department || '—', readOnly: true },
    { icon: Award, label: 'Designation', value: profile.designation || '—', readOnly: true },
    { icon: GraduationCap, label: 'Status', value: profile.status === 'ACTIVE' ? 'Active' : 'Inactive', readOnly: true },
    { icon: BookOpen, label: 'Specialization', field: 'specialization', value: profile.specialization || '—' },
    { icon: Clock, label: 'Office Hours', field: 'officeHours', value: profile.officeHours || '—' },
    { icon: MapPin, label: 'Office Room', field: 'officeRoom', value: profile.officeRoom || '—' },
  ];

  return <div className="faculty-profile-1">
      {/* Profile header card */}
      <div className="faculty-profile-2">
        <div className="faculty-profile-3" />
        <div className="faculty-profile-4">
          <div className="faculty-profile-5">
            {/* Avatar */}
            <div className="faculty-profile-6">
              {initials(profile.name)}
            </div>
            <button onClick={handleEditToggle} disabled={saving} className="faculty-profile-7">
              <Pencil className="faculty-profile-8" />
              {saving ? 'Saving…' : editing ? 'Save Profile' : 'Edit Profile'}
            </button>
          </div>
          <div className="faculty-profile-9">
            <div>
              <h1 className="faculty-profile-10">{profile.name}</h1>
              <p className="faculty-profile-11">{profile.designation || 'Faculty'}</p>
            </div>
            <div className="faculty-profile-12">
              {profile.department && <Badge variant="ai">{profile.department}</Badge>}
              <Badge variant={profile.status === 'ACTIVE' ? 'success' : 'neutral'}>
                {profile.status === 'ACTIVE' ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {saveError && <p className="faculty-profile-11">Couldn't save: {saveError}</p>}

      {/* Teaching summary */}
      <div className="faculty-profile-13">
        <StatCard label="Classes" value={stats.classes} icon={<BookOpen className="faculty-profile-14" />} color="violet" sub="This semester" />
        <StatCard label="Students" value={stats.students} icon={<Users className="faculty-profile-14" />} color="blue" sub="Across all classes" />
        <StatCard label="Subjects" value={stats.subjects} icon={<GraduationCap className="faculty-profile-14" />} color="green" sub={profile.department || undefined} />
        <StatCard label="Teaching Hrs/wk" value={stats.teachingHoursPerWeek} icon={<Clock className="faculty-profile-14" />} color="amber" sub="From timetable" />
      </div>

      <div className="faculty-profile-15">
        {/* Personal info */}
        <div className="faculty-profile-16">
          <SectionHeader title="Personal Information" />
          <div className="faculty-profile-17">
            {personalFields.map(item => <div key={item.label} className="faculty-profile-18">
                  <div className="faculty-profile-19">
                    <item.icon className="faculty-profile-8" />
                  </div>
                  <div>
                    <p className="faculty-profile-20">{item.label}</p>
                    {editing && !item.readOnly
                      ? <input value={form[item.field]} onChange={(e) => updateField(item.field, e.target.value)} className="faculty-profile-21" />
                      : <p className="faculty-profile-22">{item.value}</p>}
                  </div>
                </div>)}
          </div>
        </div>

        {/* Academic details */}
        <div className="faculty-profile-16">
          <SectionHeader title="Academic Details" />
          <div className="faculty-profile-17">
            {academicFields.map(item => <div key={item.label} className="faculty-profile-18">
                  <div className="faculty-profile-19">
                    <item.icon className="faculty-profile-8" />
                  </div>
                  <div>
                    <p className="faculty-profile-20">{item.label}</p>
                    {editing && !item.readOnly
                      ? <input value={form[item.field]} onChange={(e) => updateField(item.field, e.target.value)} className="faculty-profile-21" />
                      : <p className="faculty-profile-22">{item.value}</p>}
                  </div>
                </div>)}
          </div>
        </div>
      </div>

      <div className="faculty-profile-15">
        {/* Recent activity */}
        <div className="faculty-profile-16">
          <SectionHeader title="Recent Activity" sub="Last 5 actions" />
          {activity.length === 0
            ? <p className="faculty-profile-27">No recent activity yet.</p>
            : <ol className="faculty-profile-23">
                {activity.map((a, i) => {
                  const Icon = ACTIVITY_ICONS[a.icon] || CheckSquare;
                  return <li key={i} className="faculty-profile-24">
                      <div className="absolute -left-3 flex items-center justify-center w-6 h-6 rounded-full border border-white text-violet-600 bg-violet-50 shadow-sm">
                        <Icon className="faculty-profile-25" />
                      </div>
                      <p className="faculty-profile-26">{a.text}</p>
                      <p className="faculty-profile-27">{timeAgo(a.time)}</p>
                    </li>;
                })}
              </ol>}
        </div>

        {/* Certifications */}
        <div className="faculty-profile-16">
          <SectionHeader title="Certifications & Credentials" />
          {(!profile.certifications || profile.certifications.length === 0)
            ? <p className="faculty-profile-27">No certifications on file yet.</p>
            : <div className="faculty-profile-28">
                {profile.certifications.map(c => <div key={c.id} className="rounded-xl border p-4 bg-slate-50 border-slate-200 text-slate-700">
                    <div className="faculty-profile-18">
                      <Award className="faculty-profile-29" />
                      <div>
                        <p className="faculty-profile-30">{c.title}</p>
                        <p className="faculty-profile-31">{c.issuer} · {c.year}</p>
                      </div>
                    </div>
                  </div>)}
              </div>}
        </div>
      </div>
    </div>;
}