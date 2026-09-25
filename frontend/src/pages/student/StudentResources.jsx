import './StudentResources.css';
import { useEffect, useMemo, useState } from 'react';
import { Video, BookOpen, Download, Search, Clock, File, FolderOpen } from 'lucide-react';
import { Badge, Card, SectionHeader } from '../../components/ui/index';
import { useAuth } from '../../context/AuthContext';
import { studentApi, fileUrl } from '../../lib/api';

const categoryTabs = ['All', 'Syllabus', 'Notes', 'Videos', 'Previous Year Papers', 'Reference Materials'];

function typeIcon(type) {
  if (type === 'Video') return <Video className="student-resources-1" />;
  return <File className="student-resources-3" />;
}
function typeBadgeVariant(type) {
  if (type === 'Video') return 'danger';
  if (type === 'DOCX') return 'info';
  return 'neutral';
}
function categoryBadgeVariant(cat) {
  const map = {
    Syllabus: 'info',
    Notes: 'success',
    Videos: 'warning',
    'Previous Year Papers': 'ai',
    'Reference Materials': 'neutral',
  };
  return map[cat] || 'neutral';
}

function ResourceCard({ resource, onOpen }) {
  return (
    <div className="student-resources-4">
      <div className="student-resources-5">
        <div className="student-resources-6">{typeIcon(resource.type)}</div>
        <div className="student-resources-7">
          <h3 className="student-resources-8">{resource.title}</h3>
          <p className="student-resources-9">{resource.subject}</p>
        </div>
      </div>

      <div className="student-resources-10">
        <Badge variant={typeBadgeVariant(resource.type)}>{resource.type}</Badge>
        <Badge variant={categoryBadgeVariant(resource.category)}>{resource.category}</Badge>
      </div>

      <div className="student-resources-11">
        <div className="student-resources-12">
          <BookOpen className="student-resources-13" />
          <span>{resource.uploadedBy}</span>
        </div>
        <div className="student-resources-12">
          <Clock className="student-resources-13" />
          <span>{resource.date}{resource.size ? ` · ${resource.size}` : ''}</span>
        </div>
      </div>

      <button className="student-resources-14" onClick={() => onOpen(resource)}>
        <Download className="student-resources-15" />
        {resource.type === 'Video' ? 'Open Video' : 'Download'}
      </button>
    </div>
  );
}

export default function StudentResources() {
  const { token } = useAuth();
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeCategory, setActiveCategory] = useState('All');
  const [subjectFilter, setSubjectFilter] = useState('All Subjects');
  const [search, setSearch] = useState('');
  const [recentIds, setRecentIds] = useState([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    studentApi
      .getResources(token)
      .then((res) => {
        if (!cancelled) setResources(res.resources);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load resources');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const subjectOptions = useMemo(
    () => ['All Subjects', ...Array.from(new Set(resources.map((r) => r.subject)))],
    [resources]
  );

  const filtered = resources.filter((r) => {
    const matchCategory = activeCategory === 'All' || r.category === activeCategory;
    const matchSubject = subjectFilter === 'All Subjects' || r.subject === subjectFilter;
    const matchSearch = !search || r.title.toLowerCase().includes(search.toLowerCase()) || r.subject.toLowerCase().includes(search.toLowerCase());
    return matchCategory && matchSubject && matchSearch;
  });

  const recentlyAccessed = resources.filter((r) => recentIds.includes(r.id)).slice(0, 3);

  function handleOpen(resource) {
    setRecentIds((prev) => [resource.id, ...prev.filter((id) => id !== resource.id)]);
    studentApi.registerResourceDownload(token, resource.id).catch(() => {});
    window.open(fileUrl(resource.fileUrl), '_blank', 'noopener,noreferrer');
  }

  if (loading) return <div className="student-resources-16"><p className="student-resources-19">Loading resources…</p></div>;
  if (error) return <div className="student-resources-16"><Card className="student-resources-26"><p className="student-resources-19">Couldn't load resources: {error}</p></Card></div>;

  return (
    <div className="student-resources-16">
      {/* Header */}
      <div className="student-resources-17">
        <div>
          <h2 className="student-resources-18">Learning Resource Hub</h2>
          <p className="student-resources-19">{resources.length} resources available for your department</p>
        </div>
      </div>

      {/* Search + filters */}
      <div className="student-resources-20">
        <div className="student-resources-21">
          <Search className="student-resources-22" />
          <input type="text" placeholder="Search resources by title or subject..." value={search} onChange={(e) => setSearch(e.target.value)} className="student-resources-23" />
        </div>
        <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} className="student-resources-24">
          {subjectOptions.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Category tabs */}
      <div className="student-resources-25">
        {categoryTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveCategory(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeCategory === tab ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Recently Accessed */}
      {recentlyAccessed.length > 0 && (
        <Card className="student-resources-26">
          <SectionHeader title="Recently Accessed" sub="Resources you opened this session" badge={<Badge variant="info">{recentlyAccessed.length} items</Badge>} />
          <div className="student-resources-27">
            {recentlyAccessed.map((r) => (
              <div key={r.id} className="student-resources-28">
                <div className="student-resources-29">{typeIcon(r.type)}</div>
                <div className="student-resources-7">
                  <p className="student-resources-30">{r.title}</p>
                  <p className="student-resources-31">{r.subject} · {r.date}</p>
                </div>
                <button className="student-resources-32" onClick={() => handleOpen(r)}>
                  <Download className="student-resources-33" />
                  {r.type === 'Video' ? 'Open' : 'Download'}
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Resource count */}
      <div className="student-resources-34">
        <p className="student-resources-35">
          Showing <span className="student-resources-36">{filtered.length}</span> resources
          {activeCategory !== 'All' && <span> in <span className="student-resources-36">{activeCategory}</span></span>}
        </p>
      </div>

      {/* Resource grid */}
      {filtered.length > 0 ? (
        <div className="student-resources-37">
          {filtered.map((r) => (
            <ResourceCard key={r.id} resource={r} onOpen={handleOpen} />
          ))}
        </div>
      ) : (
        <div className="student-resources-38">
          <FolderOpen className="student-resources-39" />
          <p className="student-resources-40">No resources found</p>
          <p className="student-resources-41">
            {resources.length === 0 ? 'No resources have been uploaded for your department yet.' : 'Try a different category, subject, or search term.'}
          </p>
        </div>
      )}
    </div>
  );
}