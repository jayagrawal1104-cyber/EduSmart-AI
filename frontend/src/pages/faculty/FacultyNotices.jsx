import './FacultyNotices.css';
import { useEffect, useState } from 'react';
import { Bell, Calendar } from 'lucide-react';
import { Badge } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { facultyApi } from '../../lib/api';

const priorityConfig = {
  High: { variant: 'warning', dot: 'bg-amber-500' },
  Medium: { variant: 'info', dot: 'bg-blue-500' },
  Low: { variant: 'neutral', dot: 'bg-slate-300' }
};

export default function FacultyNotices() {
  const { token } = useAuth();

  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    facultyApi.getNotices(token).then(res => {
      setNotices(res.notices || []);
      setError(null);
    }).catch(err => {
      setError(err.message || 'Failed to load notices');
    }).finally(() => {
      setLoading(false);
    });
  }, [token]);

  return <div className="faculty-notices-1">
      {/* Header */}
      <div className="faculty-notices-2">
        <div>
          <h1 className="faculty-notices-3">Notice Board</h1>
          <p className="faculty-notices-4">Announcements from administration</p>
        </div>
      </div>

      {/* Posting notices as faculty isn't available yet — the Notice model
          only supports an admin author today, so this needs a schema
          decision (adding a facultyId) before that can be wired up. */}
      <div className="faculty-notices-9">
        <p className="faculty-notices-14">
          Posting your own notices isn't available yet — that needs a small schema change on the backend first. Let me know if you'd like that built out next.
        </p>
      </div>

      {loading && <p className="faculty-notices-4">Loading notices…</p>}
      {error && !loading && <p className="faculty-notices-4">Couldn't load notices: {error}</p>}

      {!loading && !error && <div className="faculty-notices-8">
          {notices.length === 0 && <div className="faculty-notices-20">
              <Bell className="faculty-notices-21" />
              <p>No notices from administration yet.</p>
            </div>}
          {notices.map(n => {
        const pc = priorityConfig[n.priority] || priorityConfig.Medium;
        return <div key={n.id} className="faculty-notices-9">
                <div className="faculty-notices-10">
                  <div className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${pc.dot}`} />
                  <div className="faculty-notices-11">
                    <div className="faculty-notices-12">
                      <Badge variant="neutral">{n.category}</Badge>
                      <Badge variant={pc.variant}>{n.priority}</Badge>
                      <Badge variant="neutral">{n.audience}</Badge>
                    </div>
                    <h3 className="faculty-notices-13">{n.title}</h3>
                    <p className="faculty-notices-14">{n.description}</p>
                    <div className="faculty-notices-15">
                      <span className="faculty-notices-16">
                        <Calendar className="faculty-notices-17" />
                        {n.publishDate}
                      </span>
                      <span>·</span>
                      <span>By {n.author}</span>
                    </div>
                  </div>
                </div>
              </div>;
      })}
        </div>}
    </div>;
}