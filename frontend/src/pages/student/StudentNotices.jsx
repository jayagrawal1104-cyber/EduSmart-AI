import './StudentNotices.css';
import { useEffect, useMemo, useState } from 'react';
import { Bell, ChevronDown, ChevronUp, CheckCheck, AlertTriangle, Info, CalendarDays, User, Users } from 'lucide-react';
import { Badge, Card, Btn } from '../../components/ui/index';
import { useAuth } from '../../context/AuthContext';
import { studentApi } from '../../lib/api';

const categoryTabs = ['All', 'Academic', 'Examination', 'Assignment', 'Holiday', 'General', 'Emergency'];
// The Notice model's priority enum is LOW / MEDIUM / HIGH — there's no
// "Urgent" tier in the backend, so it's left out of this filter list.
const priorityOptions = ['All Priorities', 'High', 'Medium', 'Low'];

function priorityBadgeVariant(priority) {
  const map = { High: 'danger', Medium: 'warning', Low: 'neutral' };
  return map[priority] || 'neutral';
}
function categoryBadgeVariant(cat) {
  const map = { Academic: 'info', Examination: 'warning', Assignment: 'ai', Holiday: 'success', General: 'neutral', Emergency: 'danger' };
  return map[cat] || 'neutral';
}
function priorityIcon(priority) {
  if (priority === 'High') return <AlertTriangle className="student-notices-1" />;
  return <Info className="student-notices-1" />;
}

/** A notice is treated as "new" if published within the last 3 days and not yet opened locally. */
function isRecentlyPublished(publishDate) {
  const days = (Date.now() - new Date(publishDate).getTime()) / 86400000;
  return days <= 3;
}

function NoticeCard({ notice, expanded, onToggle }) {
  return (
    <div className={`bg-white border rounded-xl shadow-sm overflow-hidden transition-all ${notice.isUnread ? 'border-blue-200' : 'border-slate-200'}`}>
      <button className="student-notices-2" onClick={onToggle}>
        <div className="student-notices-3">
          {notice.isUnread && <span className="student-notices-4" />}
          {!notice.isUnread && <span className="student-notices-5" />}
        </div>

        <div className="student-notices-6">
          <div className="student-notices-7">
            <div className="student-notices-6">
              <div className="student-notices-8">
                <Badge variant={priorityBadgeVariant(notice.priority)} size="xs">
                  {priorityIcon(notice.priority)}
                  {notice.priority}
                </Badge>
                <Badge variant={categoryBadgeVariant(notice.category)} size="xs">{notice.category}</Badge>
              </div>
              <h3 className="student-notices-9">{notice.title}</h3>
              {!expanded && <p className="student-notices-10">{notice.description}</p>}
            </div>
            <div className="student-notices-11">
              {expanded ? <ChevronUp className="student-notices-12" /> : <ChevronDown className="student-notices-12" />}
            </div>
          </div>

          <div className="student-notices-13">
            <span className="student-notices-14">
              <User className="student-notices-15" />
              {notice.author}
            </span>
            <span className="student-notices-14">
              <CalendarDays className="student-notices-15" />
              {notice.publishDate}
            </span>
            <span className="student-notices-14">
              <Users className="student-notices-15" />
              {notice.audience}
            </span>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="student-notices-16">
          <p className="student-notices-17">{notice.description}</p>
        </div>
      )}
    </div>
  );
}

export default function StudentNotices() {
  const { token } = useAuth();
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeCategory, setActiveCategory] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All Priorities');
  const [expandedId, setExpandedId] = useState(null);
  const [readIds, setReadIds] = useState(new Set());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    studentApi
      .getNotices(token)
      .then((res) => {
        if (!cancelled) setNotices(res.notices);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load notices');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const isUnread = (n) => isRecentlyPublished(n.publishDate) && !readIds.has(n.id);

  const markAllRead = () => setReadIds(new Set(notices.map((n) => n.id)));

  const filtered = useMemo(
    () =>
      notices.filter((n) => {
        const matchCat = activeCategory === 'All' || n.category === activeCategory;
        const matchPriority = priorityFilter === 'All Priorities' || n.priority === priorityFilter;
        return matchCat && matchPriority;
      }),
    [notices, activeCategory, priorityFilter]
  );

  function handleToggle(id) {
    setExpandedId((prev) => (prev === id ? null : id));
    setReadIds((prev) => new Set([...prev, id]));
  }

  if (loading) return <div className="student-notices-18"><p className="student-notices-23">Loading notices…</p></div>;
  if (error) return <div className="student-notices-18"><Card className="student-notices-31"><p className="student-notices-23">Couldn't load notices: {error}</p></Card></div>;

  const unreadCount = notices.filter(isUnread).length;

  return (
    <div className="student-notices-18">
      <div className="student-notices-19">
        <div>
          <div className="student-notices-20">
            <h2 className="student-notices-21">Notice Board</h2>
            {unreadCount > 0 && <span className="student-notices-22">{unreadCount} new</span>}
          </div>
          <p className="student-notices-23">Stay updated with all institutional announcements</p>
        </div>
        <Btn variant="outline" size="sm" icon={<CheckCheck className="student-notices-12" />} onClick={markAllRead}>
          Mark All as Read
        </Btn>
      </div>

      <div className="student-notices-24">
        <div className="student-notices-25">
          {categoryTabs.map((tab) => {
            const count = notices.filter((n) => (tab === 'All' ? true : n.category === tab)).length;
            return (
              <button
                key={tab}
                onClick={() => setActiveCategory(tab)}
                className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeCategory === tab ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {tab}
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${activeCategory === tab ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="student-notices-26">
          {priorityOptions.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </div>

      <div className="student-notices-27">
        <Bell className="student-notices-12" />
        <span>
          Showing <span className="student-notices-28">{filtered.length}</span> notices
          {unreadCount > 0 && (
            <span> · <span className="student-notices-29">{unreadCount} unread</span></span>
          )}
        </span>
      </div>

      <div className="student-notices-30">
        {filtered.length > 0 ? (
          filtered.map((notice) => (
            <NoticeCard
              key={notice.id}
              notice={{ ...notice, isUnread: isUnread(notice) }}
              expanded={expandedId === notice.id}
              onToggle={() => handleToggle(notice.id)}
            />
          ))
        ) : (
          <Card className="student-notices-31">
            <Bell className="student-notices-32" />
            <p className="student-notices-33">No notices found</p>
            <p className="student-notices-34">Try a different category or priority filter.</p>
          </Card>
        )}
      </div>
    </div>
  );
}