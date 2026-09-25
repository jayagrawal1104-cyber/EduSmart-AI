import './AdminFeedback.css';
import { useEffect, useState } from 'react';
import { Star, MessageSquare, Trash2, Loader2 } from 'lucide-react';
import { StatCard, SectionHeader, Badge } from '../../components/ui';
import { feedbackApi, ApiError } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

// The old mock version of this page showed per-metric faculty rankings
// (clarity/knowledge/responsiveness), course satisfaction %, and syllabus
// themes — none of which exist in the backend. The real Feedback model is
// flat: subject, message, an optional 1-5 rating, and who it's from
// (a student or a faculty member). This page now shows that real data —
// a reviewable, deletable feed — rather than a dashboard the backend can't
// back up.

function StarDisplay({ rating }) {
  if (rating === null || rating === undefined) return <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>No rating</span>;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} size={14} className={s <= rating ? 'text-amber-400 fill-amber-400' : 'text-slate-200 fill-slate-200'} />
      ))}
    </div>
  );
}

export default function AdminFeedback() {
  const { token } = useAuth();

  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actingId, setActingId] = useState(null);
  const [minRating, setMinRating] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await feedbackApi.listFeedback(token, minRating ? { minRating } : {});
      setFeedback(data.feedback || []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load feedback');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, minRating]);

  async function handleDelete(item) {
    if (!window.confirm(`Delete feedback "${item.subject}"?`)) return;
    setActingId(item.id);
    try {
      await feedbackApi.deleteFeedback(token, item.id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete feedback');
    } finally {
      setActingId(null);
    }
  }

  const rated = feedback.filter((f) => f.rating !== null && f.rating !== undefined);
  const avgRating = rated.length ? (rated.reduce((s, f) => s + f.rating, 0) / rated.length).toFixed(1) : null;
  const fromStudents = feedback.filter((f) => f.studentId).length;
  const fromFaculty = feedback.filter((f) => f.facultyId).length;

  return (
    <div className="admin-feedback-6">
      <div className="admin-feedback-7">
        <SectionHeader title="Feedback Center" sub="Feedback submitted by students and faculty" />
        <select value={minRating} onChange={(e) => setMinRating(e.target.value)} className="admin-feedback-8">
          <option value="">All ratings</option>
          <option value="4">4★ and up</option>
          <option value="3">3★ and up</option>
          <option value="1">Any rating</option>
        </select>
      </div>

      {error && <div style={{ color: '#dc2626', marginBottom: '1rem' }}>{error}</div>}

      <div className="admin-feedback-9">
        <StatCard label="Total Submissions" value={feedback.length} sub="Matching current filter" icon={<MessageSquare className="admin-feedback-10" />} color="blue" />
        <StatCard label="Average Rating" value={avgRating ? `${avgRating}/5` : '—'} sub={`From ${rated.length} rated entries`} icon={<Star className="admin-feedback-10" />} color="amber" />
        <StatCard label="From Students" value={fromStudents} sub="Submissions" icon={<MessageSquare className="admin-feedback-10" />} color="green" />
        <StatCard label="From Faculty" value={fromFaculty} sub="Submissions" icon={<MessageSquare className="admin-feedback-10" />} color="violet" />
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <Loader2 className="animate-spin" />
        </div>
      ) : (
        <div className="admin-feedback-20">
          <div className="admin-feedback-21">
            <h3 className="admin-feedback-22">All Feedback</h3>
          </div>
          <div className="admin-feedback-23">
            <table className="admin-feedback-24">
              <thead>
                <tr className="admin-feedback-25">
                  {['From', 'Subject', 'Message', 'Rating', 'Date', 'Actions'].map((h) => (
                    <th key={h} className="admin-feedback-26">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="admin-feedback-27">
                {feedback.map((f) => (
                  <tr key={f.id} className="admin-feedback-28">
                    <td className="admin-feedback-29">
                      {f.student ? <Badge variant="info">{f.student.name}</Badge> : f.faculty ? <Badge variant="ai">{f.faculty.name}</Badge> : <Badge variant="neutral">Unknown</Badge>}
                    </td>
                    <td className="admin-feedback-34">{f.subject}</td>
                    <td className="admin-feedback-29" style={{ maxWidth: '320px' }}>{f.message}</td>
                    <td className="admin-feedback-29"><StarDisplay rating={f.rating} /></td>
                    <td className="admin-feedback-33">{new Date(f.createdAt).toLocaleDateString()}</td>
                    <td className="admin-feedback-29">
                      <button
                        title="Delete"
                        disabled={actingId === f.id}
                        onClick={() => handleDelete(f)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {feedback.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>No feedback found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
