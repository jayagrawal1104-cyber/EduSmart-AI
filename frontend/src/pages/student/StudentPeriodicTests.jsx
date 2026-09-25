import './StudentPeriodicTests.css';
import { useEffect, useState } from 'react';
import { FileText, TrendingUp, Award, Calendar, MapPin, AlertCircle, CheckCircle, Clock, Download, ChevronRight } from 'lucide-react';
import { Card, Badge, StatusBadge, SectionHeader, ProgressBar, Btn } from '../../components/ui/index';
import { useAuth } from '../../context/AuthContext';
import { studentApi } from '../../lib/api';
const filterTabs = ['All', 'Upcoming', 'Completed', 'Missed'];
const typeColor = {
  'Unit Test': 'info',
  'Class Test': 'default',
  'Mid-Semester': 'ai',
  Quiz: 'success'
};
function gradeColor(grade) {
  if (grade === 'A+' || grade === 'A') return 'text-green-600';
  if (grade === 'B+' || grade === 'B') return 'text-blue-600';
  if (grade === 'C') return 'text-amber-600';
  return 'text-slate-400';
}
function CompletedTestCard({
  test
}) {
  const pct = Math.round(test.marksObtained / test.totalMarks * 100);
  return <Card className="student-periodic-tests-1">
      <div className="student-periodic-tests-2">
        <div className="student-periodic-tests-3">
          <div className="student-periodic-tests-4">
            <Badge variant={typeColor[test.type] || 'default'} size="xs">{test.type}</Badge>
            {test.missed && <Badge variant="danger" size="xs">Missed</Badge>}
          </div>
          <p className="student-periodic-tests-5">{test.title}</p>
          <p className="student-periodic-tests-6">{test.subject} ({test.code})</p>
        </div>
        <div className="student-periodic-tests-7">
          {test.missed ? <p className="student-periodic-tests-8">—</p> : <p className={`text-lg font-bold ${gradeColor(test.grade)}`}>{test.marksObtained}/{test.totalMarks}</p>}
          <p className="student-periodic-tests-9">{new Date(test.date).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short'
          })}</p>
        </div>
      </div>

      {!test.missed && <div className="student-periodic-tests-10">
          <div className="student-periodic-tests-11">
            <span>Your Score</span>
            <span className="student-periodic-tests-12">{pct}%</span>
          </div>
          <ProgressBar value={pct} color={pct >= 80 ? 'green' : pct >= 60 ? 'blue' : 'amber'} />
          <p className="student-periodic-tests-13">Class average: {test.classAverage}/{test.totalMarks}</p>
        </div>}

      {test.missed && <div className="student-periodic-tests-14">
          <AlertCircle className="student-periodic-tests-15" />
          <p className="student-periodic-tests-16">You missed this test. Contact your faculty about re-examination eligibility.</p>
        </div>}

      {!test.missed && <div className="student-periodic-tests-17">
          <button className="student-periodic-tests-18">
            View Answer Sheet <ChevronRight className="student-periodic-tests-19" />
          </button>
        </div>}
    </Card>;
}
function UpcomingTestCard({
  test
}) {
  const daysLeft = Math.ceil((new Date(test.date).getTime() - Date.now()) / 86400000);
  return <Card className="student-periodic-tests-1">
      <div className="student-periodic-tests-20">
        <div className="student-periodic-tests-3">
          <Badge variant={typeColor[test.type] || 'default'} size="xs">{test.type}</Badge>
          <p className="student-periodic-tests-21">{test.title}</p>
          <p className="student-periodic-tests-6">{test.subject} ({test.code})</p>
        </div>
        <div className="student-periodic-tests-7">
          <p className="student-periodic-tests-22">{daysLeft}d</p>
          <p className="student-periodic-tests-23">left</p>
        </div>
      </div>
      <div className="student-periodic-tests-24">
        <div className="student-periodic-tests-25">
          <Calendar className="student-periodic-tests-26" />
          {new Date(test.date).toLocaleDateString('en-IN', {
          weekday: 'short',
          day: 'numeric',
          month: 'short'
        })} • {test.time}
        </div>
        <div className="student-periodic-tests-25">
          <MapPin className="student-periodic-tests-26" />
          {test.venue}
        </div>
        <div className="student-periodic-tests-27">
          <FileText className="student-periodic-tests-28" />
          <span>{test.syllabus}</span>
        </div>
      </div>
      <div className="student-periodic-tests-29">
        <span className="student-periodic-tests-9">Total Marks: {test.totalMarks}</span>
        <Btn variant="outline" size="sm">Prepare with AI</Btn>
      </div>
    </Card>;
}
export default function StudentPeriodicTests() {
  const { token } = useAuth();
  const [periodicTests, setPeriodicTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('All');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    studentApi
      .getPeriodicTests(token)
      .then((res) => {
        if (!cancelled) setPeriodicTests(res.tests || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load periodic tests');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) return <div className="student-periodic-tests-30"><p>Loading periodic tests…</p></div>;
  if (error) return <div className="student-periodic-tests-30"><Card className="student-periodic-tests-1"><p>Couldn't load periodic tests: {error}</p></Card></div>;

  const completedTests = periodicTests.filter(t => t.status === 'Completed' && !t.missed);
  const missedTests = periodicTests.filter(t => t.missed);
  const upcomingTests = periodicTests.filter(t => t.status === 'Upcoming');
  const avgPct = completedTests.length ? Math.round(completedTests.reduce((sum, t) => sum + t.marksObtained / t.totalMarks * 100, 0) / completedTests.length) : 0;
  const bestTest = completedTests.reduce((best, t) => t.marksObtained / t.totalMarks > (best ? best.marksObtained / best.totalMarks : 0) ? t : best, null);
  const filteredTests = periodicTests.filter(t => {
    if (activeTab === 'All') return true;
    if (activeTab === 'Missed') return t.missed;
    if (activeTab === 'Completed') return t.status === 'Completed' && !t.missed;
    return t.status === activeTab;
  });
  return <div className="student-periodic-tests-30">
      <SectionHeader title="Periodic Tests" sub="Track your unit tests, class tests, and mid-semester exam performance." />

      {/* Stats */}
      <div className="student-periodic-tests-31">
        <Card className="student-periodic-tests-1">
          <div className="student-periodic-tests-32">
            <TrendingUp className="student-periodic-tests-33" />
          </div>
          <p className="student-periodic-tests-34">{avgPct}%</p>
          <p className="student-periodic-tests-35">Average Score</p>
        </Card>
        <Card className="student-periodic-tests-1">
          <div className="student-periodic-tests-36">
            <CheckCircle className="student-periodic-tests-33" />
          </div>
          <p className="student-periodic-tests-34">{completedTests.length}</p>
          <p className="student-periodic-tests-35">Tests Completed</p>
        </Card>
        <Card className="student-periodic-tests-1">
          <div className="student-periodic-tests-37">
            <Clock className="student-periodic-tests-33" />
          </div>
          <p className="student-periodic-tests-34">{upcomingTests.length}</p>
          <p className="student-periodic-tests-35">Upcoming Tests</p>
        </Card>
        <Card className="student-periodic-tests-1">
          <div className="student-periodic-tests-38">
            <Award className="student-periodic-tests-33" />
          </div>
          <p className="student-periodic-tests-39">{bestTest ? bestTest.code : '—'}</p>
          <p className="student-periodic-tests-35">Best Subject</p>
        </Card>
      </div>

      {missedTests.length > 0 && <div className="student-periodic-tests-40">
          <AlertCircle className="student-periodic-tests-41" />
          <div>
            <p className="student-periodic-tests-42">
              You missed {missedTests.length} {missedTests.length === 1 ? 'test' : 'tests'}
            </p>
            <p className="student-periodic-tests-43">
              Reach out to your faculty as soon as possible about re-examination eligibility.
            </p>
          </div>
        </div>}

      {/* Upcoming tests strip */}
      {upcomingTests.length > 0 && <div>
          <div className="student-periodic-tests-44">
            <h3 className="student-periodic-tests-45">Upcoming Tests</h3>
            <Badge variant="info" size="xs">{upcomingTests.length} scheduled</Badge>
          </div>
          <div className="student-periodic-tests-46">
            {upcomingTests.map(t => <UpcomingTestCard key={t.id} test={t} />)}
          </div>
        </div>}

      {/* All tests with filters */}
      <div>
        <div className="student-periodic-tests-47">
          <h3 className="student-periodic-tests-45">Test History</h3>
          <div className="student-periodic-tests-48">
            {filterTabs.map(tab => <button key={tab} onClick={() => setActiveTab(tab)} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === tab ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {tab}
              </button>)}
          </div>
        </div>

        {filteredTests.length === 0 ? <Card className="student-periodic-tests-49">
            <FileText className="student-periodic-tests-50" />
            <p className="student-periodic-tests-51">No tests in this category</p>
          </Card> : <div className="student-periodic-tests-46">
            {filteredTests.map(t => t.status === 'Upcoming' ? <UpcomingTestCard key={t.id} test={t} /> : <CompletedTestCard key={t.id} test={t} />)}
          </div>}
      </div>

      {/* Report download */}
      <Card className="student-periodic-tests-52">
        <div className="student-periodic-tests-53">
          <div className="student-periodic-tests-54">
            <Download className="student-periodic-tests-33" />
          </div>
          <div>
            <p className="student-periodic-tests-45">Consolidated Test Report</p>
            <p className="student-periodic-tests-55">Download a PDF summary of all your periodic test scores this semester.</p>
          </div>
        </div>
        <Btn variant="outline" size="sm">Download Report</Btn>
      </Card>
    </div>;
}