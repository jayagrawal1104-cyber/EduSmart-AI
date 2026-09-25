import './FacultyStudentPerformance.css';
import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Users } from 'lucide-react';
import { StatCard, RiskBadge, Badge } from '../../components/ui';
import { useNav } from '../../context/NavigationContext';
import { useAuth } from '../../context/AuthContext';
import { facultyApi } from '../../lib/api';

function TrendIcon({ t }) {
  if (t === 'up') return <TrendingUp className="faculty-student-performance-1" />;
  if (t === 'down') return <TrendingDown className="faculty-student-performance-2" />;
  return <Minus className="faculty-student-performance-3" />;
}

export default function FacultyStudentPerformance() {
  const { navParams } = useNav();
  const { token } = useAuth();

  const [classKey, setClassKey] = useState(
    navParams?.subjectId ? (navParams.section ? `${navParams.subjectId}::${navParams.section}` : navParams.subjectId) : ''
  );
  // Only used when this page is opened with no subject preselected (e.g. a
  // direct link) — there's no picker anymore, so we fall back to whichever
  // subject this faculty teaches first. Every subject shares the same
  // roster (same department + course), so any one of them works.
  const [resolvingDefault, setResolvingDefault] = useState(!classKey);
  const [noClasses, setNoClasses] = useState(false);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (classKey) return;
    let cancelled = false;
    facultyApi.getMyClasses(token).then(res => {
      if (cancelled) return;
      const first = (res.classes || [])[0];
      if (first) {
        setClassKey(first.section ? `${first.subjectId}::${first.section}` : first.subjectId);
      } else {
        setNoClasses(true);
      }
    }).catch(() => {
      if (!cancelled) setNoClasses(true);
    }).finally(() => {
      if (!cancelled) setResolvingDefault(false);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!classKey) return;
    const [subjectId, section] = classKey.split('::');
    setLoading(true);
    setError(null);
    facultyApi.getStudentPerformance(token, { subjectId, section: section || undefined }).then(res => {
      setData(res);
    }).catch(err => {
      setError(err.message || 'Failed to load performance data');
    }).finally(() => {
      setLoading(false);
    });
  }, [classKey, token]);

  return <div className="faculty-student-performance-4">
      {/* Header */}
      <div>
        <h1 className="faculty-student-performance-5">Student Performance</h1>
        <p className="faculty-student-performance-6">Attendance, assignment and test analytics for your classes</p>
      </div>

      {noClasses && !resolvingDefault && <div className="faculty-student-performance-7">
          <p className="faculty-student-performance-6">You don't have any classes yet.</p>
        </div>}

      {(resolvingDefault || (classKey && loading)) && <div className="faculty-student-performance-7">
          <p className="faculty-student-performance-6">Loading performance data…</p>
        </div>}

      {classKey && error && !loading && <div className="faculty-student-performance-7">
          <p className="faculty-student-performance-6">Couldn't load performance data: {error}</p>
        </div>}

      {classKey && data && !loading && !error && <>
          <div>
            <div className="faculty-student-performance-42">
              {data.section && <Badge variant="neutral">Section {data.section}</Badge>}
            </div>
            <h2 className="faculty-student-performance-27">{data.subject}</h2>
            <p className="faculty-student-performance-28">{data.students.length} students</p>
          </div>

          {/* Overview stats */}
          <div className="faculty-student-performance-11">
            <StatCard label="Class Average" value={data.summary.classAverage != null ? `${data.summary.classAverage}%` : '—'} icon={<TrendingUp className="faculty-student-performance-12" />} color="violet" sub="Assignments + tests" />
            <StatCard label="Highest Score" value={data.summary.highest != null ? `${data.summary.highest}%` : '—'} icon={<TrendingUp className="faculty-student-performance-12" />} color="green" />
            <StatCard label="Lowest Score" value={data.summary.lowest != null ? `${data.summary.lowest}%` : '—'} icon={<TrendingDown className="faculty-student-performance-12" />} color="red" />
            <StatCard label="Pass Rate" value={data.summary.passRate != null ? `${data.summary.passRate}%` : '—'} icon={<Users className="faculty-student-performance-12" />} color="blue" sub="≥50% threshold" />
          </div>

          {/* Student table */}
          <div className="faculty-student-performance-25">
            <div className="faculty-student-performance-26">
              <div>
                <h2 className="faculty-student-performance-27">Student Performance Table</h2>
                <p className="faculty-student-performance-28">{data.students.length} students</p>
              </div>
            </div>
            <div className="faculty-student-performance-31">
              <table className="faculty-student-performance-32">
                <thead>
                  <tr className="faculty-student-performance-33">
                    <th className="faculty-student-performance-34">Student</th>
                    <th className="faculty-student-performance-35">Attendance</th>
                    <th className="faculty-student-performance-35">Test Avg</th>
                    <th className="faculty-student-performance-35">Assignments</th>
                    <th className="faculty-student-performance-35">Risk</th>
                    <th className="faculty-student-performance-35">Trend</th>
                  </tr>
                </thead>
                <tbody className="faculty-student-performance-36">
                  {data.students.map(s => <tr key={s.id} className={`hover:bg-slate-50 transition-colors ${s.risk === 'High' ? 'bg-red-50/40' : s.risk === 'Medium' ? 'bg-amber-50/30' : ''}`}>
                      <td className="faculty-student-performance-37">
                        <div className="faculty-student-performance-38">{s.name}</div>
                        <div className="faculty-student-performance-39">{s.rollId}</div>
                      </td>
                      <td className="faculty-student-performance-40">
                        {s.attendancePct != null ? <span className={`font-medium ${s.attendancePct >= 80 ? 'text-green-700' : s.attendancePct >= 60 ? 'text-amber-700' : 'text-red-700'}`}>
                            {s.attendancePct}%
                          </span> : <span className="faculty-student-performance-39">No data</span>}
                      </td>
                      <td className="faculty-student-performance-40">
                        {s.testPct != null ? <span className={`font-medium ${s.testPct >= 60 ? 'text-slate-900' : 'text-red-600'}`}>
                            {s.testPct}%
                          </span> : <span className="faculty-student-performance-39">No data</span>}
                      </td>
                      <td className="faculty-student-performance-40">
                        {s.assignmentPct != null ? <span className={`font-medium ${s.assignmentPct >= 70 ? 'text-slate-900' : 'text-amber-600'}`}>
                            {s.assignmentPct}%
                          </span> : <span className="faculty-student-performance-39">No data</span>}
                      </td>
                      <td className="faculty-student-performance-40">
                        <RiskBadge level={s.risk} />
                      </td>
                      <td className="faculty-student-performance-40">
                        <TrendIcon t={s.trend} />
                      </td>
                    </tr>)}
                </tbody>
              </table>
            </div>
          </div>
        </>}
    </div>;
}