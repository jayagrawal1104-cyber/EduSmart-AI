import './AdminResources.css';
import { useEffect, useState } from 'react';
import { Upload, CheckCircle, XCircle, Download, Trash2, FileText, Video, BookOpen, HelpCircle, Database, Eye, Filter, Loader2 } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Badge, StatusBadge, SectionHeader, Btn, Input, Select } from '../../components/ui';
import { adminApi, resourcesApi, fileUrl, ApiError } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

const typeFilters = ['All', 'Syllabus', 'Notes', 'Videos', 'Question Papers', 'Reference'];
const FILTER_TO_TYPE = {
  Syllabus: 'SYLLABUS',
  Notes: 'NOTES',
  Videos: 'VIDEO',
  'Question Papers': 'QUESTION_PAPER',
  Reference: 'REFERENCE',
};
const TYPE_OPTIONS = [
  { value: 'SYLLABUS', label: 'Syllabus' },
  { value: 'NOTES', label: 'Notes' },
  { value: 'VIDEO', label: 'Video' },
  { value: 'QUESTION_PAPER', label: 'Question Paper' },
  { value: 'REFERENCE', label: 'Reference' },
];
const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444'];

const typeIcon = (type) => {
  const icons = {
    SYLLABUS: <FileText className="admin-resources-1" />,
    NOTES: <BookOpen className="admin-resources-2" />,
    VIDEO: <Video className="admin-resources-3" />,
    QUESTION_PAPER: <HelpCircle className="admin-resources-4" />,
    REFERENCE: <Database className="admin-resources-5" />,
  };
  return icons[type];
};
const typeLabel = (type) => ({ SYLLABUS: 'Syllabus', NOTES: 'Notes', VIDEO: 'Video', QUESTION_PAPER: 'Question Paper', REFERENCE: 'Reference' }[type] || type);

function humanFileSize(bytes) {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let size = bytes / 1024;
  let i = 0;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i += 1;
  }
  return `${size.toFixed(1)} ${units[i]}`;
}

const emptyUploadForm = { title: '', subject: '', departmentId: '', type: 'NOTES', file: null };

export default function AdminResources() {
  const { token } = useAuth();

  const [resources, setResources] = useState([]);
  const [summary, setSummary] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [typeFilter, setTypeFilter] = useState('All');
  const [selected, setSelected] = useState(new Set());

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadForm, setUploadForm] = useState(emptyUploadForm);
  const [uploadError, setUploadError] = useState('');
  const [uploading, setUploading] = useState(false);

  const [busyId, setBusyId] = useState(null); // resource currently being approved/rejected/deleted

  async function loadAll() {
    setLoading(true);
    setError('');
    try {
      const [resRes, summaryRes, deptRes] = await Promise.all([
        resourcesApi.listResources(token),
        resourcesApi.getSummary(token),
        adminApi.listDepartments(token),
      ]);
      setResources(resRes.resources || []);
      setSummary(summaryRes);
      setDepartments(deptRes.departments || []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load resources');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const approvedResources = resources.filter((r) => r.status === 'APPROVED');
  const pendingApproval = resources.filter((r) => r.status === 'PENDING');
  const filtered = approvedResources.filter((r) => (typeFilter === 'All' ? true : r.type === FILTER_TO_TYPE[typeFilter]));

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function selectAll() {
    setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map((r) => r.id)));
  }

  async function handleApprove(id) {
    setBusyId(id);
    try {
      await resourcesApi.approveResource(token, id);
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to approve resource');
    } finally {
      setBusyId(null);
    }
  }
  async function handleReject(id) {
    setBusyId(id);
    try {
      await resourcesApi.rejectResource(token, id);
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to reject resource');
    } finally {
      setBusyId(null);
    }
  }
  async function handleApproveAllPending() {
    setBusyId('bulk-approve');
    try {
      await Promise.all(pendingApproval.map((r) => resourcesApi.approveResource(token, r.id)));
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to approve pending resources');
    } finally {
      setBusyId(null);
    }
  }
  async function handleDelete(id) {
    setBusyId(id);
    try {
      await resourcesApi.deleteResource(token, id);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete resource');
    } finally {
      setBusyId(null);
    }
  }
  async function handleDeleteSelected() {
    setBusyId('bulk-delete');
    try {
      await resourcesApi.bulkDeleteResources(token, [...selected]);
      setSelected(new Set());
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete selected resources');
    } finally {
      setBusyId(null);
    }
  }
  async function handleOpen(resource) {
    try {
      await resourcesApi.registerDownload(token, resource.id);
    } catch {
      // Non-fatal — still open the file even if the counter didn't update.
    }
    window.open(fileUrl(resource.fileUrl), '_blank', 'noopener');
    setResources((prev) => prev.map((r) => (r.id === resource.id ? { ...r, downloads: r.downloads + 1 } : r)));
  }
  async function handleExportList() {
    try {
      await resourcesApi.exportResourcesCsv(token, typeFilter !== 'All' ? { type: FILTER_TO_TYPE[typeFilter] } : {});
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to export resource list');
    }
  }

  async function handleUpload(e) {
    e.preventDefault();
    setUploadError('');
    if (!uploadForm.title.trim() || !uploadForm.subject.trim() || !uploadForm.departmentId || !uploadForm.file) {
      setUploadError('Title, subject, department, and a file are all required');
      return;
    }
    setUploading(true);
    try {
      await resourcesApi.uploadResource(token, uploadForm);
      setShowUploadModal(false);
      setUploadForm(emptyUploadForm);
      await loadAll();
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : 'Failed to upload resource');
    } finally {
      setUploading(false);
    }
  }

  const usedPercent = summary?.usedPercent ?? 0;
  const storageByDept = (summary?.storageByDepartment || []).map((d) => ({ name: d.department, value: Number((d.bytes / (1024 ** 3)).toFixed(2)) }));

  return (
    <div className="admin-resources-6">
      <SectionHeader
        title="Resource Management"
        sub="Institution-wide learning resources — upload, approve, and track"
        action={
          <div className="admin-resources-7">
            <div className="admin-resources-8">
              <Btn variant="outline" icon={<CheckCircle className="admin-resources-9" />} onClick={handleApproveAllPending} disabled={pendingApproval.length === 0 || busyId === 'bulk-approve'}>
                {busyId === 'bulk-approve' ? 'Approving…' : 'Approve Pending'}
              </Btn>
              <span className="admin-resources-10">{pendingApproval.length}</span>
            </div>
            <Btn variant="primary" icon={<Upload className="admin-resources-11" />} onClick={() => setShowUploadModal(true)}>
              Upload Resource
            </Btn>
          </div>
        }
      />

      {error && <div style={{ color: '#dc2626', marginBottom: '1rem' }}>{error}</div>}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <Loader2 className="animate-spin" />
        </div>
      ) : (
        <>
          {/* Storage Summary */}
          <div className="admin-resources-12">
            <div className="admin-resources-13">
              <div>
                <p className="admin-resources-14">Storage Usage</p>
                <p className="admin-resources-15">
                  {summary?.totalResources ?? 0} resources · {humanFileSize(summary?.usedBytes)} used of {humanFileSize(summary?.quotaBytes)}
                </p>
              </div>
              <span className="admin-resources-16">{usedPercent}%</span>
            </div>
            <div className="admin-resources-17">
              <div className="admin-resources-18" style={{ width: `${Math.min(100, usedPercent)}%` }} />
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="admin-resources-19">
            {typeFilters.map((f) => (
              <button
                key={f}
                onClick={() => setTypeFilter(f)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${typeFilter === f ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Bulk Actions */}
          <div className="admin-resources-20">
            <button onClick={selectAll} className="admin-resources-21">
              {selected.size === filtered.length && filtered.length > 0 ? 'Deselect All' : 'Select All'}
            </button>
            {selected.size > 0 && (
              <>
                <span className="admin-resources-22">{selected.size} selected</span>
                <button className="admin-resources-23" onClick={handleDeleteSelected} disabled={busyId === 'bulk-delete'}>
                  <Trash2 className="admin-resources-24" />
                  {busyId === 'bulk-delete' ? 'Deleting…' : 'Delete Selected'}
                </button>
                <button className="admin-resources-25" onClick={handleExportList}>Export List</button>
              </>
            )}
            {selected.size === 0 && (
              <button className="admin-resources-25" onClick={handleExportList}>Export List</button>
            )}
          </div>

          {/* Resource Table */}
          <div className="admin-resources-26">
            <div className="admin-resources-27">
              <table className="admin-resources-28">
                <thead>
                  <tr className="admin-resources-29">
                    <th className="admin-resources-30">
                      <input type="checkbox" className="admin-resources-31" checked={selected.size === filtered.length && filtered.length > 0} onChange={selectAll} />
                    </th>
                    {['Title', 'Subject', 'Department', 'Uploaded By', 'Date', 'Size', 'Downloads', 'Type', 'Status', 'Actions'].map((h) => (
                      <th key={h} className="admin-resources-32">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="admin-resources-33">
                  {filtered.map((r) => (
                    <tr key={r.id} className="admin-resources-34">
                      <td className="admin-resources-35">
                        <input type="checkbox" className="admin-resources-31" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} />
                      </td>
                      <td className="admin-resources-35">
                        <div className="admin-resources-36">
                          {typeIcon(r.type)}
                          <span className="admin-resources-37">{r.title}</span>
                        </div>
                      </td>
                      <td className="admin-resources-38">{r.subject}</td>
                      <td className="admin-resources-35"><Badge variant="info">{r.department}</Badge></td>
                      <td className="admin-resources-38">{r.uploadedBy}</td>
                      <td className="admin-resources-39">{new Date(r.date).toLocaleDateString()}</td>
                      <td className="admin-resources-39">{humanFileSize(r.size)}</td>
                      <td className="admin-resources-35">
                        <span className="admin-resources-40">
                          <Download className="admin-resources-41" />{r.downloads}
                        </span>
                      </td>
                      <td className="admin-resources-35"><Badge variant="neutral">{typeLabel(r.type)}</Badge></td>
                      <td className="admin-resources-35"><StatusBadge status={r.status === 'APPROVED' ? 'Approved' : r.status === 'REJECTED' ? 'Rejected' : 'Pending'} /></td>
                      <td className="admin-resources-35">
                        <div className="admin-resources-42">
                          <button className="admin-resources-43" onClick={() => handleOpen(r)}><Eye className="admin-resources-24" /></button>
                          <button className="admin-resources-44" onClick={() => handleDelete(r.id)} disabled={busyId === r.id}><Trash2 className="admin-resources-24" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pending Approval */}
          <div className="admin-resources-45">
            <div className="admin-resources-46">
              <Filter className="admin-resources-9" />
              <h3 className="admin-resources-14">Pending Approval</h3>
              <span className="admin-resources-47">{pendingApproval.length} waiting</span>
            </div>
            <div className="admin-resources-48">
              {pendingApproval.map((r) => (
                <div key={r.id} className="admin-resources-49">
                  <div className="admin-resources-20">
                    {typeIcon(r.type)}
                    <div>
                      <p className="admin-resources-50">{r.title}</p>
                      <p className="admin-resources-51">{r.subject} · {r.department} · by {r.uploadedBy} · {humanFileSize(r.size)}</p>
                    </div>
                  </div>
                  <div className="admin-resources-7">
                    <button className="admin-resources-52" onClick={() => handleApprove(r.id)} disabled={busyId === r.id}>
                      <CheckCircle className="admin-resources-24" />Approve
                    </button>
                    <button className="admin-resources-53" onClick={() => handleReject(r.id)} disabled={busyId === r.id}>
                      <XCircle className="admin-resources-24" />Reject
                    </button>
                  </div>
                </div>
              ))}
              {pendingApproval.length === 0 && <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Nothing waiting on review.</p>}
            </div>
          </div>

          {/* Analytics */}
          <div className="admin-resources-54">
            <div className="admin-resources-12">
              <h3 className="admin-resources-55">Most Downloaded</h3>
              <div className="admin-resources-48">
                {(summary?.topDownloaded || []).map((r, i) => (
                  <div key={r.id} className="admin-resources-20">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${i === 0 ? 'bg-amber-500' : i === 1 ? 'bg-slate-400' : 'bg-amber-700'}`}>
                      {i + 1}
                    </span>
                    <div className="admin-resources-56">
                      <p className="admin-resources-57">{r.title}</p>
                      <p className="admin-resources-58">{r.department}</p>
                    </div>
                    <span className="admin-resources-59">{r.downloads}</span>
                  </div>
                ))}
                {(summary?.topDownloaded || []).length === 0 && <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>No downloads yet.</p>}
              </div>
            </div>

            <div className="admin-resources-12">
              <h3 className="admin-resources-55">Storage by Department</h3>
              {storageByDept.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={storageByDept} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={3}>
                      {storageByDept.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => [`${v} GB`, 'Storage']} contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>No resources uploaded yet.</p>
              )}
            </div>
          </div>
        </>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="admin-resources-modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '1.5rem', width: '420px', maxWidth: '90vw' }}>
            <h3 className="admin-resources-14" style={{ marginBottom: '1rem' }}>Upload Resource</h3>
            {uploadError && <div style={{ color: '#dc2626', marginBottom: '0.75rem', fontSize: '0.875rem' }}>{uploadError}</div>}
            <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <Input label="Title" required value={uploadForm.title} onChange={(v) => setUploadForm((f) => ({ ...f, title: v }))} placeholder="e.g. DBMS Syllabus 2026" />
              <Input label="Subject" required value={uploadForm.subject} onChange={(v) => setUploadForm((f) => ({ ...f, subject: v }))} placeholder="e.g. DBMS" />
              <Select
                label="Department"
                required
                value={uploadForm.departmentId}
                onChange={(v) => setUploadForm((f) => ({ ...f, departmentId: v }))}
                options={[{ value: '', label: 'Select a department…' }, ...departments.map((d) => ({ value: d.id, label: d.name }))]}
              />
              <Select label="Type" required value={uploadForm.type} onChange={(v) => setUploadForm((f) => ({ ...f, type: v }))} options={TYPE_OPTIONS} />
              <div>
                <label className="index-36">File<span className="index-37">*</span></label>
                <input type="file" onChange={(e) => setUploadForm((f) => ({ ...f, file: e.target.files?.[0] || null }))} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <Btn variant="outline" type="button" onClick={() => { setShowUploadModal(false); setUploadError(''); }} disabled={uploading}>Cancel</Btn>
                <Btn variant="primary" type="submit" disabled={uploading}>{uploading ? 'Uploading…' : 'Upload'}</Btn>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}