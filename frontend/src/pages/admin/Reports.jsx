import './Reports.css';
import { useEffect, useState } from 'react';
import { ClipboardList, TrendingUp, FileText, Briefcase, AlertTriangle, GitBranch, MessageSquare, Download, RefreshCw, CheckCircle, Loader2 } from 'lucide-react';
import { Card, SectionHeader, Btn } from '../../components/ui/index';
import { reportsApi, fileUrl, ApiError } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

const reportTypes = [{
  id: 'attendance',
  title: 'Attendance Report',
  description: 'Comprehensive attendance analysis by department, course, and student',
  icon: <ClipboardList className="reports-1" />,
  color: 'text-blue-600',
  iconBg: 'bg-blue-50'
}, {
  id: 'performance',
  title: 'Performance Report',
  description: 'Academic performance trends, marks analysis, and grade distribution',
  icon: <TrendingUp className="reports-1" />,
  color: 'text-green-600',
  iconBg: 'bg-green-50'
}, {
  id: 'assignment',
  title: 'Assignment Report',
  description: 'Assignment submission rates, completion trends, and deadline analysis',
  icon: <FileText className="reports-1" />,
  color: 'text-violet-600',
  iconBg: 'bg-violet-50'
}, {
  id: 'workload',
  title: 'Faculty Workload',
  description: 'Faculty class distribution, workload index, and engagement metrics',
  icon: <Briefcase className="reports-1" />,
  color: 'text-amber-600',
  iconBg: 'bg-amber-50'
}, {
  id: 'risk',
  title: 'Academic Risk Report',
  description: 'At-risk student analysis, intervention history, and risk score trends',
  icon: <AlertTriangle className="reports-1" />,
  color: 'text-red-600',
  iconBg: 'bg-red-50'
}, {
  id: 'department',
  title: 'Department Report',
  description: 'Department-wise comparison of all academic and engagement metrics',
  icon: <GitBranch className="reports-1" />,
  color: 'text-cyan-600',
  iconBg: 'bg-cyan-50'
}, {
  id: 'feedback',
  title: 'Feedback Summary',
  description: 'Compiled student and faculty feedback with sentiment analysis',
  icon: <MessageSquare className="reports-1" />,
  color: 'text-pink-600',
  iconBg: 'bg-pink-50'
}];

// Every report is generated as CSV today (see backend/src/controllers/
// reports.controller.js) — the format buttons still record the user's
// preferred label, it's just not honored for the actual file yet.
const formatOptions = ['PDF', 'CSV', 'Excel'];

function formatDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function Reports() {
  const { token } = useAuth();

  const [formats, setFormats] = useState(Object.fromEntries(reportTypes.map(r => [r.id, 'PDF'])));
  const [generating, setGenerating] = useState(null);
  const [generated, setGenerated] = useState([]);
  const [genError, setGenError] = useState('');

  const [recentReports, setRecentReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  async function loadRecent() {
    const { reports } = await reportsApi.listRecent(token, 10);
    setRecentReports(reports);
  }

  useEffect(() => {
    async function load() {
      setLoading(true);
      setLoadError('');
      try {
        await loadRecent();
      } catch (err) {
        setLoadError(err instanceof ApiError ? err.message : 'Failed to load recent reports');
      } finally {
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleGenerate(id) {
    setGenerating(id);
    setGenError('');
    try {
      await reportsApi.generateReport(token, { type: id.toUpperCase(), format: formats[id] });
      await loadRecent();
      setGenerated(prev => [...prev, id]);
      setTimeout(() => setGenerated(prev => prev.filter(x => x !== id)), 3000);
    } catch (err) {
      setGenError(err instanceof ApiError ? err.message : `Failed to generate ${id} report`);
    } finally {
      setGenerating(null);
    }
  }

  function handleDownload(report) {
    // Generated report files are served as public static assets — no auth
    // header needed, so just open the absolute URL directly.
    window.open(fileUrl(report.fileUrl), '_blank', 'noopener');
  }

  return <div className="reports-2">
      {/* Header */}
      <div className="reports-3">
        <div>
          <h1 className="reports-4">Reports</h1>
          <p className="reports-5">Generate and download institution reports in your preferred format</p>
        </div>
      </div>

      {genError && <div style={{ color: '#dc2626', marginBottom: '1rem' }}>{genError}</div>}

      {/* Report Types Grid */}
      <div className="reports-6">
        {reportTypes.map(report => <Card key={report.id} className="reports-7">
            <div className="reports-8">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${report.iconBg} ${report.color}`}>
                {report.icon}
              </div>
              <div className="reports-9">
                <h3 className="reports-10">{report.title}</h3>
                <p className="reports-11">{report.description}</p>
              </div>
            </div>

            <div className="reports-12">
              {/* Format selector */}
              <div className="reports-13">
                {formatOptions.map(fmt => <button key={fmt} onClick={() => setFormats(prev => ({
              ...prev,
              [report.id]: fmt
            }))} className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${formats[report.id] === fmt ? 'bg-white text-slate-800 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}>
                    {fmt}
                  </button>)}
              </div>

              {/* Generate button */}
              <button onClick={() => handleGenerate(report.id)} disabled={generating === report.id} className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-semibold rounded-lg transition-colors ${generated.includes(report.id) ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'} disabled:opacity-60 disabled:cursor-not-allowed`}>
                {generating === report.id ? <>
                    <RefreshCw className="reports-14" />
                    Generating...
                  </> : generated.includes(report.id) ? <>
                    <CheckCircle className="reports-15" />
                    Ready to Download
                  </> : <>
                    <FileText className="reports-15" />
                    Generate {formats[report.id]}
                  </>}
              </button>
            </div>
          </Card>)}
      </div>

      {/* Recent Reports */}
      <Card className="reports-7">
        <SectionHeader title="Recent Reports" sub="Previously generated reports available for download" />
        {loadError && <div style={{ color: '#dc2626', marginBottom: '1rem' }}>{loadError}</div>}
        {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
            <Loader2 className="animate-spin" />
          </div> : recentReports.length === 0 ? <p className="reports-11">No reports generated yet — generate one above.</p> : <div className="reports-16">
          {recentReports.map(report => <div key={report.id} className="reports-17">
              <div className="reports-18">
                <FileText className="reports-19" />
              </div>
              <div className="reports-9">
                <div className="reports-20">{report.title}</div>
                <div className="reports-21">
                  <span className="reports-22">{formatDateTime(report.generatedAt)}</span>
                  <span className="reports-23">·</span>
                  <span className="reports-22">by {report.generatedBy}</span>
                  <span className="reports-23">·</span>
                  <span className="reports-24">{report.format}</span>
                  <span className="reports-22">{report.size}</span>
                </div>
              </div>
              <Btn variant="outline" size="sm" icon={<Download className="reports-25" />} onClick={() => handleDownload(report)}>
                Download
              </Btn>
            </div>)}
        </div>}
      </Card>
    </div>;
}