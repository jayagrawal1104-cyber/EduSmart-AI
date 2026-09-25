import './AdminInstitution.css';
import { useEffect, useRef, useState } from 'react';
import { Building2, Mail, Phone, Globe, Award, Copy, Download, Printer, Share2, RefreshCw, QrCode, Users, UserCheck, BookOpen, Layers, CheckCircle, Edit3, Save, X } from 'lucide-react';
import { SectionHeader, Badge, Btn, StatCard } from '../../components/ui';
import InstituteQRCode, { downloadDataUrl, printDataUrl, shareDataUrl } from '../../components/ui/InstituteQRCode';
import { useNav } from '../../context/NavigationContext';
import { useAuth } from '../../context/AuthContext';
import { institutionApi, securityApi, ApiError } from '../../lib/api';
function CopyButton({
  text
}) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return <button onClick={handleCopy} className="admin-institution-1">
      {copied ? <CheckCircle className="admin-institution-2" /> : <Copy className="admin-institution-3" />}
    </button>;
}

const EMPTY_FORM = {
  name: '',
  type: '',
  address: '',
  state: '',
  email: '',
  phone: '',
  website: ''
};

// Maps a fetched institution record onto the editable form shape (nulls -> '').
function toFormData(institution) {
  return {
    name: institution?.name ?? '',
    type: institution?.type ?? '',
    address: institution?.address ?? '',
    state: institution?.state ?? '',
    email: institution?.email ?? '',
    phone: institution?.phone ?? '',
    website: institution?.website ?? ''
  };
}

export default function AdminInstitution() {
  const {
    navigate
  } = useNav();
  const { user, token } = useAuth();
  const qrRef = useRef(null);
  const [activeTab, setActiveTab] = useState('profile');
  const [editing, setEditing] = useState(false);
  const [showRegenCodeModal, setShowRegenCodeModal] = useState(false);
  const [showRegenQRModal, setShowRegenQRModal] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [institution, setInstitution] = useState(null);
  const [counts, setCounts] = useState({ departments: 0, courses: 0, students: 0, faculty: 0 });
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const [regenError, setRegenError] = useState('');
  // Access-control flags shown in the Identity & Access status row — fetched
  // from the same security overview endpoint the Security Center page uses,
  // so this always reflects real settings instead of always saying "Active".
  const [accessControl, setAccessControl] = useState({ qrLoginEnabled: true, joinApprovalRequired: true });

  async function loadProfile() {
    setLoading(true);
    setLoadError('');
    try {
      const [data, security] = await Promise.all([
        institutionApi.getProfile(token),
        securityApi.getOverview(token),
      ]);
      setInstitution(data.institution);
      setCounts(data.counts);
      setFormData(toFormData(data.institution));
      setAccessControl(security.accessControl);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Failed to load institution profile');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Falls back to the identity fields cached on the logged-in session while
  // the full profile is still loading, so the header/identity tab don't
  // flash empty on first paint.
  const INST_CODE = institution?.code || user?.institutionCode || '';
  const INST_ID = institution?.id || user?.institutionId || '';
  const INST_NAME = institution?.name || user?.institutionName || '';
  const JOIN_LINK = `edunexus.ai/join/${INST_CODE}`;

  function handleDownloadQR() {
    downloadDataUrl(qrRef.current?.getDataURL(), `${INST_CODE}-qr-code.png`);
  }
  function handlePrintQR() {
    printDataUrl(qrRef.current?.getDataURL(), `${INST_NAME} — Institute QR Code`);
  }
  function handleShareQR() {
    shareDataUrl(qrRef.current?.getDataURL(), INST_CODE, `${INST_NAME} — Institute QR Code`);
  }

  async function handleSave() {
    setSaving(true);
    setSaveError('');
    try {
      const data = await institutionApi.updateProfile(token, formData);
      setInstitution(data.institution);
      setFormData(toFormData(data.institution));
      setEditing(false);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Failed to save institution profile');
    } finally {
      setSaving(false);
    }
  }

  function handleCancelEdit() {
    setFormData(toFormData(institution));
    setSaveError('');
    setEditing(false);
  }

  // Institute code and QR share the same underlying value, so both
  // "Regenerate" actions invalidate the old code — regenerating one
  // regenerates the other.
  async function handleRegenerate(closeModal) {
    setRegenerating(true);
    setRegenError('');
    try {
      const data = await securityApi.regenerateInstituteCode(token);
      setInstitution(prev => prev ? { ...prev, code: data.code } : prev);
      closeModal();
    } catch (err) {
      setRegenError(err instanceof ApiError ? err.message : 'Failed to regenerate code');
    } finally {
      setRegenerating(false);
    }
  }

  const infoRows = [{
    label: 'Full Institution Name',
    value: formData.name,
    field: 'name'
  }, {
    label: 'Institution Type',
    value: formData.type || '—',
    field: 'type'
  }, {
    label: 'Address',
    value: formData.address && formData.state ? `${formData.address}, ${formData.state}` : formData.address || formData.state || '—',
    field: 'address'
  }, {
    label: 'Official Email',
    value: formData.email || '—',
    field: 'email'
  }, {
    label: 'Phone',
    value: formData.phone || '—',
    field: 'phone'
  }, {
    label: 'Website',
    value: formData.website || '—',
    field: 'website'
  }];
  const tabs = [{
    id: 'profile',
    label: 'Profile'
  }, {
    id: 'identity',
    label: 'Identity & Access'
  }];

  if (loading) {
    return <div className="admin-institution-5">
        <p className="admin-institution-20">Loading institution profile…</p>
      </div>;
  }

  if (loadError) {
    return <div className="admin-institution-5">
        <p className="admin-institution-20">{loadError}</p>
        <Btn variant="outline" size="sm" onClick={loadProfile}>Retry</Btn>
      </div>;
  }

  const initials = (INST_NAME || 'IN').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const locationLabel = [formData.address, formData.state].filter(Boolean).join(', ');

  return <div className="admin-institution-5">
      {/* Header */}
      <div className="admin-institution-6">
        <div className="admin-institution-7">
          <div className="admin-institution-8">
            {initials}
          </div>
          <div className="admin-institution-9">
            <h1 className="admin-institution-10">{INST_NAME}</h1>
            <p className="admin-institution-11">{formData.type || 'Institution type not set'}</p>
            <div className="admin-institution-12">
              {locationLabel && <Badge variant="info">{locationLabel}</Badge>}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="admin-institution-13">
        {tabs.map(tab => <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {tab.label}
          </button>)}
      </div>

      {activeTab === 'profile' && <div className="admin-institution-14">
          {/* Academic Stats */}
          <div className="admin-institution-15">
            <div className="cursor-pointer" onClick={() => navigate('admin/departments')}>
              <StatCard label="Departments" value={String(counts.departments)} sub="Active departments" icon={<Layers className="admin-institution-16" />} color="blue" />
            </div>
            <div className="cursor-pointer" onClick={() => navigate('admin/courses')}>
              <StatCard label="Courses" value={String(counts.courses)} sub="Across all departments" icon={<BookOpen className="admin-institution-16" />} color="violet" />
            </div>
            <div className="cursor-pointer" onClick={() => navigate('admin/students')}>
              <StatCard label="Students" value={counts.students.toLocaleString()} sub="Enrolled this semester" icon={<Users className="admin-institution-16" />} color="green" />
            </div>
            <div className="cursor-pointer" onClick={() => navigate('admin/faculty')}>
              <StatCard label="Faculty" value={String(counts.faculty)} sub="Active faculty members" icon={<UserCheck className="admin-institution-16" />} color="amber" />
            </div>
          </div>

          {/* Info Cards */}
          <div className="admin-institution-17">
            <div className="admin-institution-18">
              <div>
                <h2 className="admin-institution-19">Institution Information</h2>
                <p className="admin-institution-20">Basic profile and contact details</p>
              </div>
              {!editing ? <Btn variant="outline" size="sm" icon={<Edit3 className="admin-institution-21" />} onClick={() => setEditing(true)}>
                  Edit
                </Btn> : <div className="admin-institution-22">
                  <Btn variant="primary" size="sm" icon={<Save className="admin-institution-21" />} onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving…' : 'Save'}
                  </Btn>
                  <Btn variant="ghost" size="sm" icon={<X className="admin-institution-21" />} onClick={handleCancelEdit} disabled={saving}>
                    Cancel
                  </Btn>
                </div>}
            </div>
            {saveError && <p className="admin-institution-20">{saveError}</p>}
            <div className="admin-institution-23">
              {infoRows.map(row => <div key={row.label} className="admin-institution-24">
                  <span className="admin-institution-25">{row.label}</span>
                  {editing ? <input className="admin-institution-26" type="text" value={formData[row.field]} onChange={e => setFormData(prev => ({
              ...prev,
              [row.field]: e.target.value
            }))} /> : <span className="admin-institution-27">{row.value}</span>}
                </div>)}
            </div>
          </div>
        </div>}

      {activeTab === 'identity' && <div className="admin-institution-14">
          {/* Security Status — reflects real settings from the Security Center,
              not static badges: QR login and join approval can each be
              switched off there, and this row follows suit. */}
          <div className="admin-institution-28">
            <div className="admin-institution-29">
              <CheckCircle className="admin-institution-30" />
              <span className="admin-institution-31">Code Active</span>
            </div>
            <div className="admin-institution-29">
              <CheckCircle className="admin-institution-30" />
              <span className="admin-institution-31">{accessControl.qrLoginEnabled ? 'QR Active' : 'QR Disabled'}</span>
            </div>
            <div className="admin-institution-32">
              <CheckCircle className="admin-institution-33" />
              <span className="admin-institution-34">{accessControl.joinApprovalRequired ? 'Approval Required' : 'Auto-Approved'}</span>
            </div>
          </div>

          <div className="admin-institution-35">
            {/* IDs */}
            <div className="admin-institution-36">
              {/* Institute ID */}
              <div className="admin-institution-37">
                <p className="admin-institution-38">Institute ID</p>
                <div className="admin-institution-39">
                  <code className="admin-institution-40">{INST_ID}</code>
                  <CopyButton text={INST_ID} />
                </div>
              </div>

              {/* Institute Code */}
              <div className="admin-institution-37">
                <p className="admin-institution-38">Institute Code</p>
                <div className="admin-institution-41">
                  <code className="admin-institution-42">{INST_CODE}</code>
                  <CopyButton text={INST_CODE} />
                </div>
                <div className="admin-institution-43">
                  <Btn variant="outline" size="sm" icon={<RefreshCw className="admin-institution-21" />} onClick={() => setShowRegenCodeModal(true)}>
                    Regenerate Code
                  </Btn>
                </div>
              </div>

              {/* Joining Link */}
              <div className="admin-institution-37">
                <p className="admin-institution-38">Joining Link</p>
                <div className="admin-institution-39">
                  <span className="admin-institution-44">{JOIN_LINK}</span>
                  <CopyButton text={`https://${JOIN_LINK}`} />
                </div>
              </div>
            </div>

            {/* QR Code */}
            <div className="admin-institution-45">
              <div className="admin-institution-46">
                <QrCode className="admin-institution-47" />
                <p className="admin-institution-48">Institute QR Code</p>
              </div>
              <div className="admin-institution-4">
                <InstituteQRCode ref={qrRef} value={INST_CODE} size={176} />
              </div>
              <p className="admin-institution-49">Scan to join {INST_NAME} on EduSmart</p>
              <div className="admin-institution-50">
                <Btn variant="primary" size="sm" icon={<Download className="admin-institution-21" />} onClick={handleDownloadQR}>
                  Download
                </Btn>
                <Btn variant="outline" size="sm" icon={<Printer className="admin-institution-21" />} onClick={handlePrintQR}>
                  Print
                </Btn>
                <Btn variant="outline" size="sm" icon={<Share2 className="admin-institution-21" />} onClick={handleShareQR}>
                  Share
                </Btn>
              </div>
              <div className="admin-institution-51">
                <Btn variant="ghost" size="sm" icon={<RefreshCw className="admin-institution-21" />} onClick={() => setShowRegenQRModal(true)}>
                  Regenerate QR
                </Btn>
              </div>
            </div>
          </div>
        </div>}

      {/* Regenerate Code Modal */}
      {showRegenCodeModal && <div className="admin-institution-52">
          <div className="admin-institution-53">
            <div className="admin-institution-54">
              <div className="admin-institution-55">
                <RefreshCw className="admin-institution-56" />
              </div>
              <h3 className="admin-institution-57">Regenerate Institute Code</h3>
            </div>
            <p className="admin-institution-58">
              This will generate a new institute code and <strong>invalidate the existing code</strong>.
            </p>
            <p className="admin-institution-59">
              Students and faculty who have not yet joined using the current code will need the new code.
            </p>
            {regenError && <p className="admin-institution-59">{regenError}</p>}
            <div className="admin-institution-60">
              <Btn variant="outline" onClick={() => setShowRegenCodeModal(false)} disabled={regenerating}>Cancel</Btn>
              <Btn variant="danger" onClick={() => handleRegenerate(() => setShowRegenCodeModal(false))} disabled={regenerating}>
                {regenerating ? 'Regenerating…' : 'Yes, Regenerate'}
              </Btn>
            </div>
          </div>
        </div>}

      {/* Regenerate QR Modal */}
      {showRegenQRModal && <div className="admin-institution-52">
          <div className="admin-institution-53">
            <div className="admin-institution-54">
              <div className="admin-institution-55">
                <QrCode className="admin-institution-56" />
              </div>
              <h3 className="admin-institution-57">Regenerate Institute QR Code</h3>
            </div>
            <p className="admin-institution-61">
              This will generate a new QR code. The old QR code will be <strong>invalidated immediately</strong>. Update any printed materials.
            </p>
            {regenError && <p className="admin-institution-61">{regenError}</p>}
            <div className="admin-institution-60">
              <Btn variant="outline" onClick={() => setShowRegenQRModal(false)} disabled={regenerating}>Cancel</Btn>
              <Btn variant="danger" onClick={() => handleRegenerate(() => setShowRegenQRModal(false))} disabled={regenerating}>
                {regenerating ? 'Regenerating…' : 'Yes, Regenerate QR'}
              </Btn>
            </div>
          </div>
        </div>}
    </div>;
}