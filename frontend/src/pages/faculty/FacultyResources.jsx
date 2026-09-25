import './FacultyResources.css';
import { useEffect, useRef, useState } from 'react';
import { FileText, Video, FileArchive, File, Upload, Download, Pencil, Trash2, X, Plus, BookOpen } from 'lucide-react';
import { SectionHeader, Badge, Btn } from '../../components/ui';
import { useNav } from '../../context/NavigationContext';
import { useAuth } from '../../context/AuthContext';
import { facultyApi } from '../../lib/api';

const RESOURCE_TYPES = [
  { value: 'SYLLABUS', label: 'Syllabus' },
  { value: 'NOTES', label: 'Notes' },
  { value: 'VIDEO', label: 'Video' },
  { value: 'QUESTION_PAPER', label: 'Question Paper' },
  { value: 'REFERENCE', label: 'Reference' },
];

const STATUS_BADGE = {
  PENDING: { variant: 'warning', label: 'Pending Approval' },
  APPROVED: { variant: 'success', label: 'Approved' },
  REJECTED: { variant: 'danger', label: 'Rejected' },
};

const FORMAT_CONFIG = {
  PDF: { icon: FileText, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100', variant: 'danger' },
  Video: { icon: Video, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', variant: 'info' },
  DOCX: { icon: File, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100', variant: 'ai' },
  ZIP: { icon: FileArchive, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', variant: 'warning' },
};
const DEFAULT_FORMAT_CONFIG = { icon: File, color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200', variant: 'neutral' };
const formatConfig = (format) => FORMAT_CONFIG[format] || DEFAULT_FORMAT_CONFIG;

const EMPTY_MODAL = { open: false, title: '', subject: '', type: 'NOTES', description: '', file: null };

export default function FacultyResources() {
  const { navParams } = useNav();
  const { token } = useAuth();
  const fileInputRef = useRef(null);

  const [resources, setResources] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [subjectFilter, setSubjectFilter] = useState('');
  const [modal, setModal] = useState(EMPTY_MODAL);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  useEffect(() => {
    facultyApi.getResources(token).then(res => {
      setResources(res.resources || []);
      setSubjects(res.subjects || []);
      if (navParams?.subject && res.subjects?.includes(navParams.subject)) {
        setSubjectFilter(navParams.subject);
      }
      setError(null);
    }).catch(err => {
      setError(err.message || 'Failed to load resources');
    }).finally(() => {
      setLoading(false);
    });
  }, [token]);

  const totalDownloads = resources.reduce((s, r) => s + r.downloads, 0);
  const subjectsCovered = new Set(resources.map(r => r.subject)).size;
  const formatsUsed = [...new Set(resources.map(r => r.format))];
  const groupedSubjects = [...new Set(resources.map(r => r.subject))];

  function openModal() {
    setModal({ ...EMPTY_MODAL, open: true, subject: subjects[0] || '' });
    setUploadError(null);
  }
  const closeModal = () => setModal(EMPTY_MODAL);

  async function handleUpload() {
    if (!modal.title || !modal.subject || !modal.file) {
      setUploadError('Title, subject and a file are required.');
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const res = await facultyApi.uploadResource(token, {
        title: modal.title,
        subject: modal.subject,
        type: modal.type,
        description: modal.description,
        file: modal.file,
      });
      setResources(rs => [res.resource, ...rs]);
      closeModal();
    } catch (err) {
      setUploadError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this resource? This cannot be undone.')) return;
    try {
      await facultyApi.deleteResource(token, id);
      setResources(rs => rs.filter(r => r.id !== id));
    } catch (err) {
      window.alert(err.message || 'Failed to delete resource');
    }
  }

  if (loading) return <div className="faculty-resources-1"><p>Loading resources…</p></div>;
  if (error) return <div className="faculty-resources-1"><p>Couldn't load resources: {error}</p></div>;

  return <div className="faculty-resources-1">
      {/* Header */}
      <div className="faculty-resources-2">
        <div>
          <h1 className="faculty-resources-3">Course Resources</h1>
          <p className="faculty-resources-4">Upload and manage study materials for your classes</p>
        </div>
        <Btn variant="primary" icon={<Upload className="faculty-resources-5" />} onClick={openModal}>
          Upload Resource
        </Btn>
      </div>

      {/* Stats */}
      <div className="faculty-resources-6">
        <div className="faculty-resources-7">
          <div className="faculty-resources-3">{resources.length}</div>
          <div className="faculty-resources-8">Total Resources</div>
        </div>
        <div className="faculty-resources-7">
          <div className="faculty-resources-3">{totalDownloads}</div>
          <div className="faculty-resources-8">Total Downloads</div>
        </div>
        <div className="faculty-resources-7">
          <div className="faculty-resources-3">{subjectsCovered}</div>
          <div className="faculty-resources-8">Subjects Covered</div>
        </div>
        <div className="faculty-resources-7">
          <div className="faculty-resources-3">{formatsUsed.length}</div>
          <div className="faculty-resources-8">File Formats</div>
        </div>
      </div>

      {/* Legend */}
      {formatsUsed.length > 0 && <div className="faculty-resources-9">
          {formatsUsed.map(fmt => {
        const cfg = formatConfig(fmt);
        const Icon = cfg.icon;
        return <div key={fmt} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
              <Icon className="faculty-resources-10" />
              {fmt}
            </div>;
      })}
        </div>}

      {/* Subject filter banner */}
      {subjectFilter && <div className="faculty-resources-9">
          <Badge variant="ai">Showing: {subjectFilter}</Badge>
          <button onClick={() => setSubjectFilter('')} className="text-xs font-medium text-violet-600 hover:text-violet-700 underline">
            Show all subjects
          </button>
        </div>}

      {resources.length === 0 && <p className="faculty-resources-4">You haven't uploaded any resources yet.</p>}

      {/* Resource sections by subject */}
      {groupedSubjects.filter(subj => !subjectFilter || subj === subjectFilter).map(subj => {
      const subResources = resources.filter(r => r.subject === subj);
      return <div key={subj} className="faculty-resources-11">
            <div className="faculty-resources-12">
              <BookOpen className="faculty-resources-13" />
              <h2 className="faculty-resources-14">{subj}</h2>
              <Badge variant="neutral">{subResources.length} files</Badge>
            </div>
            <div className="faculty-resources-15">
              {subResources.map(r => {
            const cfg = formatConfig(r.format);
            const Icon = cfg.icon;
            const statusBadge = STATUS_BADGE[r.status] || STATUS_BADGE.PENDING;
            return <div key={r.id} className="faculty-resources-16">
                    <div className={`p-2.5 rounded-xl border ${cfg.bg} ${cfg.border} shrink-0`}>
                      <Icon className={`w-5 h-5 ${cfg.color}`} />
                    </div>
                    <div className="faculty-resources-17">
                      <div className="faculty-resources-18">
                        <span className="faculty-resources-19">{r.title}</span>
                        <Badge variant={cfg.variant} size="xs">{r.format}</Badge>
                        <Badge variant={statusBadge.variant} size="xs">{statusBadge.label}</Badge>
                      </div>
                      {r.description && <p className="faculty-resources-20">{r.description}</p>}
                      <div className="faculty-resources-21">
                        <span>{r.size}</span>
                        <span>·</span>
                        <span>Uploaded {r.uploadDate}</span>
                        <span>·</span>
                        <span className="faculty-resources-22">
                          <Download className="faculty-resources-10" />
                          {r.downloads} downloads
                        </span>
                      </div>
                    </div>
                    <div className="faculty-resources-23">
                      <button disabled title="Editing isn't wired up yet — delete and re-upload for now" className="faculty-resources-24 opacity-50 cursor-not-allowed">
                        <Pencil className="faculty-resources-5" />
                      </button>
                      <button onClick={() => handleDelete(r.id)} className="faculty-resources-25">
                        <Trash2 className="faculty-resources-5" />
                      </button>
                    </div>
                  </div>;
          })}
            </div>
          </div>;
    })}

      {/* Upload modal */}
      {modal.open && <div className="faculty-resources-26">
          <div className="faculty-resources-27">
            <div className="faculty-resources-28">
              <h3 className="faculty-resources-14">Upload Resource</h3>
              <button onClick={closeModal} className="faculty-resources-29">
                <X className="faculty-resources-30" />
              </button>
            </div>
            <div className="faculty-resources-31">
              {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
              <div>
                <label className="faculty-resources-32">Title</label>
                <input className="faculty-resources-33" placeholder="e.g. Unit 4 Lecture Slides" value={modal.title} onChange={e => setModal(m => ({ ...m, title: e.target.value }))} />
              </div>
              <div>
                <label className="faculty-resources-32">Subject</label>
                {subjects.length === 0
                  ? <p className="text-xs text-slate-500">No subjects assigned to you yet.</p>
                  : <select className="faculty-resources-33" value={modal.subject} onChange={e => setModal(m => ({ ...m, subject: e.target.value }))}>
                      {subjects.map(s => <option key={s}>{s}</option>)}
                    </select>}
              </div>
              <div>
                <label className="faculty-resources-32">Resource Type</label>
                <div className="faculty-resources-34">
                  {RESOURCE_TYPES.map(t => <button key={t.value} onClick={() => setModal(m => ({ ...m, type: t.value }))} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${modal.type === t.value ? 'bg-violet-600 text-white border-violet-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                      {t.label}
                    </button>)}
                </div>
              </div>
              <div>
                <label className="faculty-resources-32">Description</label>
                <textarea rows={2} className="faculty-resources-35" placeholder="Brief description of the resource…" value={modal.description} onChange={e => setModal(m => ({ ...m, description: e.target.value }))} />
              </div>
              {/* File upload area */}
              <input ref={fileInputRef} type="file" className="hidden" onChange={e => setModal(m => ({ ...m, file: e.target.files?.[0] || null }))} />
              <div className="faculty-resources-36 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <Plus className="faculty-resources-37" />
                <p className="faculty-resources-38">{modal.file ? modal.file.name : 'Click to select file or drag and drop'}</p>
                <p className="faculty-resources-39">PDF, DOCX, ZIP, MP4 up to 300 MB</p>
              </div>
            </div>
            <div className="faculty-resources-40">
              <Btn variant="outline" onClick={closeModal}>Cancel</Btn>
              <Btn variant="primary" onClick={handleUpload} disabled={uploading}>{uploading ? 'Uploading…' : 'Upload Resource'}</Btn>
            </div>
          </div>
        </div>}
    </div>;
}