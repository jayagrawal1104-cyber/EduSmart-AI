import './NoticeCenter.css';
import { useEffect, useState } from 'react';
import { Plus, Trash2, Bell, X, Calendar, Loader2 } from 'lucide-react';
import { Badge, SectionHeader, Btn } from '../../components/ui';
import { noticeApi, ApiError } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

const categoryColors = {
  Academic: 'bg-blue-50 text-blue-700 border-blue-100',
  Examination: 'bg-purple-50 text-purple-700 border-purple-100',
  Assignment: 'bg-amber-50 text-amber-700 border-amber-100',
  Holiday: 'bg-green-50 text-green-700 border-green-100',
  General: 'bg-slate-50 text-slate-600 border-slate-100',
  Emergency: 'bg-red-50 text-red-700 border-red-100',
};

// Backend NoticePriority enum only has LOW/MEDIUM/HIGH — no "Urgent" tier.
const priorityBorder = { LOW: 'border-l-green-400', MEDIUM: 'border-l-blue-400', HIGH: 'border-l-amber-400' };
const priorityDot = { LOW: 'bg-green-400', MEDIUM: 'bg-blue-400', HIGH: 'bg-amber-400' };
const priorityLabel = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High' };

const categoryOptions = ['Academic', 'Examination', 'Assignment', 'Holiday', 'General', 'Emergency'];
const priorityOptions = ['LOW', 'MEDIUM', 'HIGH'];
const audienceOptions = ['All Students', 'All Faculty', 'All'];

const categoryFilters = ['All', ...categoryOptions];
const priorityFilters = ['All', ...priorityOptions];
const audienceFilters = ['All', ...audienceOptions];

const initialForm = {
  title: '',
  description: '',
  category: 'Academic',
  audience: 'All Students',
  priority: 'MEDIUM',
  expiryDate: '',
};

export default function NoticeCenter() {
  const { token } = useAuth();

  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actingId, setActingId] = useState(null);

  const [categoryFilter, setCategoryFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [audienceFilter, setAudienceFilter] = useState('All');

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function loadNotices() {
    setLoading(true);
    setError('');
    try {
      const data = await noticeApi.listNotices(token);
      setNotices(data.notices || []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load notices');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNotices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleFormChange = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  async function handlePublish() {
    setFormError('');
    if (!form.title.trim() || !form.description.trim()) {
      setFormError('Title and description are required');
      return;
    }
    setSubmitting(true);
    try {
      await noticeApi.createNotice(token, {
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        audience: form.audience,
        priority: form.priority,
        expiryDate: form.expiryDate || null,
      });
      setShowModal(false);
      setForm(initialForm);
      await loadNotices();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to publish notice');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(notice) {
    if (!window.confirm(`Delete "${notice.title}"? This cannot be undone.`)) return;
    setActingId(notice.id);
    try {
      await noticeApi.deleteNotice(token, notice.id);
      await loadNotices();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete notice');
    } finally {
      setActingId(null);
    }
  }

  const filteredNotices = notices.filter((n) => {
    const matchCat = categoryFilter === 'All' || n.category === categoryFilter;
    const matchPri = priorityFilter === 'All' || n.priority === priorityFilter;
    const matchAud = audienceFilter === 'All' || n.audience === audienceFilter;
    return matchCat && matchPri && matchAud;
  });

  return (
    <div className="notice-center-1">
      <SectionHeader
        title="Notice Center"
        sub="Create and manage institutional notices and announcements"
        action={
          <Btn variant="primary" icon={<Plus className="notice-center-2" />} onClick={() => setShowModal(true)}>
            Post Notice
          </Btn>
        }
      />

      {error && <div style={{ color: '#dc2626', marginBottom: '1rem' }}>{error}</div>}

      {/* Filter Bar */}
      <div className="notice-center-4">
        <span className="notice-center-5">Filter by:</span>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="notice-center-6">
          {categoryFilters.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="notice-center-6">
          {priorityFilters.map((p) => <option key={p} value={p}>{p === 'All' ? 'All' : priorityLabel[p]}</option>)}
        </select>
        <select value={audienceFilter} onChange={(e) => setAudienceFilter(e.target.value)} className="notice-center-6">
          {audienceFilters.map((a) => <option key={a}>{a}</option>)}
        </select>
        <span className="notice-center-5">{filteredNotices.length} notices</span>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <Loader2 className="animate-spin" />
        </div>
      ) : (
        <div className="notice-center-7">
          {filteredNotices.map((notice) => {
            const prio = notice.priority;
            const cat = notice.category;
            return (
              <div key={notice.id} className={`bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden border-l-4 ${priorityBorder[prio] || ''}`}>
                <div className="notice-center-8">
                  <div className="notice-center-9">
                    <div className="notice-center-10">
                      <div className="notice-center-11">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${categoryColors[cat] || categoryColors.General}`}>
                          {notice.category}
                        </span>
                        <Badge variant={prio === 'HIGH' ? 'warning' : prio === 'MEDIUM' ? 'info' : 'neutral'}>
                          <span className={`w-1.5 h-1.5 rounded-full ${priorityDot[prio] || ''}`} />
                          {priorityLabel[prio] || prio}
                        </Badge>
                        <Badge variant="neutral">{notice.audience}</Badge>
                      </div>
                      <h3 className="notice-center-12">{notice.title}</h3>
                      <p className="notice-center-13">{notice.description}</p>
                      <div className="notice-center-14">
                        <span>By {notice.admin?.name || 'Admin'}</span>
                        <span>·</span>
                        <span className="notice-center-15">
                          <Calendar className="notice-center-16" />
                          {new Date(notice.publishDate).toLocaleDateString()}
                        </span>
                        {notice.expiryDate && <span>· Expires {new Date(notice.expiryDate).toLocaleDateString()}</span>}
                      </div>
                    </div>
                    <div className="notice-center-17">
                      <button
                        className="notice-center-21"
                        title="Delete"
                        disabled={actingId === notice.id}
                        onClick={() => handleDelete(notice)}
                      >
                        <Trash2 className="notice-center-19" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {filteredNotices.length === 0 && (
            <div className="notice-center-22">
              <Bell className="notice-center-23" />
              <p className="notice-center-24">No notices found</p>
              <p className="notice-center-25">Notices you publish will appear here</p>
            </div>
          )}
        </div>
      )}

      {/* Create Notice Modal */}
      {showModal && (
        <div className="notice-center-26">
          <div className="notice-center-27">
            <div className="notice-center-28">
              <div className="notice-center-29">
                <div className="notice-center-30"><Bell className="notice-center-31" /></div>
                <h3 className="notice-center-32">Post Notice</h3>
              </div>
              <button onClick={() => { setShowModal(false); setFormError(''); }} className="notice-center-33">
                <X className="notice-center-34" />
              </button>
            </div>

            <div className="notice-center-35">
              {formError && <div style={{ color: '#dc2626' }}>{formError}</div>}

              <div>
                <label className="notice-center-39">Title <span className="notice-center-40">*</span></label>
                <input className="notice-center-41" placeholder="Notice title..." value={form.title} onChange={(e) => handleFormChange('title', e.target.value)} />
              </div>

              <div>
                <label className="notice-center-39">Description <span className="notice-center-40">*</span></label>
                <textarea className="notice-center-42" rows={3} placeholder="Notice content..." value={form.description} onChange={(e) => handleFormChange('description', e.target.value)} />
              </div>

              <div className="notice-center-43">
                <div>
                  <label className="notice-center-39">Category</label>
                  <select className="notice-center-44" value={form.category} onChange={(e) => handleFormChange('category', e.target.value)}>
                    {categoryOptions.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="notice-center-39">Priority</label>
                  <select className="notice-center-44" value={form.priority} onChange={(e) => handleFormChange('priority', e.target.value)}>
                    {priorityOptions.map((p) => <option key={p} value={p}>{priorityLabel[p]}</option>)}
                  </select>
                </div>

                <div>
                  <label className="notice-center-39">Audience</label>
                  <select className="notice-center-44" value={form.audience} onChange={(e) => handleFormChange('audience', e.target.value)}>
                    {audienceOptions.map((a) => <option key={a}>{a}</option>)}
                  </select>
                </div>

                <div>
                  <label className="notice-center-39">Expiry Date <span className="notice-center-45">(optional)</span></label>
                  <input type="date" className="notice-center-41" value={form.expiryDate} onChange={(e) => handleFormChange('expiryDate', e.target.value)} />
                </div>
              </div>
            </div>

            <div className="notice-center-47">
              <Btn variant="outline" onClick={() => { setShowModal(false); setFormError(''); }} disabled={submitting}>Cancel</Btn>
              <Btn variant="primary" onClick={handlePublish} disabled={submitting}>
                {submitting ? 'Publishing…' : 'Publish Now'}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
