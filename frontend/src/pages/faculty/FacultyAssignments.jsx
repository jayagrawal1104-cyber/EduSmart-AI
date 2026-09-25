import './FacultyAssignments.css';
import { useEffect, useState } from 'react';
import { Plus, ClipboardList, Clock, CheckCircle, AlertTriangle, X, Flag, Eye, GitCompare, FileText, Upload, BarChart2, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, SectionHeader, Btn, Badge, AIBadge, Table, Input, Select, StatusBadge, ProgressBar } from '../../components/ui/index';
import { useAuth } from '../../context/AuthContext';
import { facultyApi } from '../../lib/api';

// Similarity detection has no backend support yet (no plagiarism-check
// endpoint exists on the faculty API), so this tab stays a static preview
// until that's built.
const similarityFlags = [{
  student: 'Riya Patel',
  studentId: 'CSE21002',
  score: 86,
  comparedWith: 'Arjun Mehta (CSE21003)',
  status: 'Flagged'
}, {
  student: 'Dev Kulkarni',
  studentId: 'CSE24001',
  score: 63,
  comparedWith: 'Aarav Sharma (CSE21001)',
  status: 'Under Review'
}, {
  student: 'Nikhil Joshi',
  studentId: 'CSE22007',
  score: 51,
  comparedWith: 'Kavya Reddy (CSE21006)',
  status: 'Cleared'
}];

export default function FacultyAssignments() {
  const { token } = useAuth();

  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Subject/section pairs this faculty actually teaches, used to populate
  // the "Subject" dropdown in the create-assignment modal.
  const [classOptions, setClassOptions] = useState([]);

  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState('list');
  const [expandedId, setExpandedId] = useState(null);

  const [submissionsByAssignment, setSubmissionsByAssignment] = useState({});
  const [submissionsLoadingId, setSubmissionsLoadingId] = useState(null);
  const [submissionsError, setSubmissionsError] = useState(null);
  const [marksDraft, setMarksDraft] = useState({});

  const [form, setForm] = useState({
    title: '',
    classKey: '',
    description: '',
    dueDate: '',
    maxMarks: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  function loadAssignments() {
    setLoading(true);
    facultyApi.listAssignments(token).then(res => {
      setAssignments(res.assignments || []);
      setError(null);
    }).catch(err => {
      setError(err.message || 'Failed to load assignments');
    }).finally(() => {
      setLoading(false);
    });
  }

  useEffect(() => {
    loadAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    facultyApi.getMyClasses(token).then(res => {
      setClassOptions((res.classes || []).filter(c => c.section));
    }).catch(() => {
      // Non-fatal: create-assignment dropdown just stays empty.
    });
  }, [token]);

  function loadSubmissions(assignmentId) {
    setSubmissionsLoadingId(assignmentId);
    setSubmissionsError(null);
    facultyApi.listSubmissions(token, assignmentId).then(res => {
      setSubmissionsByAssignment(prev => ({
        ...prev,
        [assignmentId]: res.submissions || []
      }));
    }).catch(err => {
      setSubmissionsError(err.message || 'Failed to load submissions');
    }).finally(() => {
      setSubmissionsLoadingId(null);
    });
  }

  function toggleExpand(id) {
    const next = expandedId === id ? null : id;
    setExpandedId(next);
    if (next && !submissionsByAssignment[next]) {
      loadSubmissions(next);
    }
  }

  function handleSaveMarks(assignmentId, submissionId) {
    const value = marksDraft[submissionId];
    if (value === undefined || value === '') return;
    facultyApi.gradeSubmission(token, submissionId, Number(value)).then(() => {
      loadSubmissions(assignmentId);
      loadAssignments();
      setMarksDraft(prev => {
        const next = { ...prev };
        delete next[submissionId];
        return next;
      });
    }).catch(err => {
      setSubmissionsError(err.message || 'Failed to save marks');
    });
  }

  function toTitleCase(status) {
    if (!status) return status;
    return status.charAt(0) + status.slice(1).toLowerCase();
  }

  function resetForm() {
    setForm({ title: '', classKey: '', description: '', dueDate: '', maxMarks: '' });
    setSubmitError(null);
  }

  function handlePublish() {
    if (!form.title || !form.classKey || !form.dueDate || !form.maxMarks) {
      setSubmitError('Please fill in all required fields.');
      return;
    }
    const [subjectId, section] = form.classKey.split('::');
    setSubmitting(true);
    setSubmitError(null);
    facultyApi.createAssignment(token, {
      subjectId,
      section,
      title: form.title,
      description: form.description,
      totalMarks: Number(form.maxMarks),
      dueDate: form.dueDate
    }).then(() => {
      setShowModal(false);
      resetForm();
      loadAssignments();
    }).catch(err => {
      setSubmitError(err.message || 'Failed to create assignment');
    }).finally(() => {
      setSubmitting(false);
    });
  }

  if (loading) {
    return <div className="faculty-assignments-1">
        <p className="faculty-assignments-4">Loading assignments…</p>
      </div>;
  }

  if (error) {
    return <div className="faculty-assignments-1">
        <p className="faculty-assignments-4">Couldn't load assignments: {error}</p>
      </div>;
  }

  const classSelectOptions = [{ value: '', label: 'Select subject...' }, ...classOptions.map(c => ({
    value: `${c.subjectId}::${c.section}`,
    label: `${c.subject} — ${c.section}`
  }))];

  return <div className="faculty-assignments-1">
      {/* Header */}
      <div className="faculty-assignments-2">
        <div>
          <h1 className="faculty-assignments-3">Assignments</h1>
          <p className="faculty-assignments-4">Create, manage and review student submissions</p>
        </div>
        <Btn onClick={() => setShowModal(true)} className="faculty-assignments-5" icon={<Plus className="faculty-assignments-6" />}>
          Create Assignment
        </Btn>
      </div>

      {/* Tabs */}
      <div className="faculty-assignments-7">
        {['list', 'analytics', 'similarity'].map(tab => <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${activeTab === tab ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {tab === 'list' ? 'All Assignments' : tab === 'analytics' ? 'Analytics' : 'Similarity Detection'}
          </button>)}
      </div>

      {/* Assignment List */}
      {activeTab === 'list' && <div className="faculty-assignments-8">
          {assignments.length === 0 && <Card className="faculty-assignments-9">
              <p className="faculty-assignments-4">No assignments yet. Create one to get started.</p>
            </Card>}

          {assignments.map(asgn => {
        const status = new Date(asgn.dueDate) < new Date() ? 'Closed' : 'Active';
        const notSubmitted = asgn.totalStudents - asgn.submittedCount;
        const pendingEval = asgn.submittedCount - asgn.gradedCount;
        const submissions = submissionsByAssignment[asgn.id];
        return <Card key={asgn.id} className="faculty-assignments-9">
                <div className="faculty-assignments-10">
                  <div className="faculty-assignments-2">
                    <div className="faculty-assignments-11">
                      <div className="faculty-assignments-12">
                        <h3 className="faculty-assignments-13">{asgn.title}</h3>
                        <Badge variant={status === 'Active' ? 'success' : 'neutral'}>
                          {status}
                        </Badge>
                      </div>
                      <p className="faculty-assignments-14">{asgn.subject} · Due {asgn.dueDate} · Max {asgn.totalMarks} marks</p>
                    </div>
                    <button onClick={() => toggleExpand(asgn.id)} className="faculty-assignments-15">
                      {expandedId === asgn.id ? <ChevronUp className="faculty-assignments-6" /> : <ChevronDown className="faculty-assignments-6" />}
                    </button>
                  </div>

                  <div className="faculty-assignments-16">
                    <div className="faculty-assignments-17">
                      <p className="faculty-assignments-18">{asgn.submittedCount}</p>
                      <p className="faculty-assignments-19">Total Submitted</p>
                    </div>
                    <div className="faculty-assignments-20">
                      <p className="faculty-assignments-21">{pendingEval}</p>
                      <p className="faculty-assignments-19">Pending Eval.</p>
                    </div>
                    <div className="faculty-assignments-22">
                      <p className="faculty-assignments-23">{notSubmitted}</p>
                      <p className="faculty-assignments-19">Not Submitted</p>
                    </div>
                    <div className="faculty-assignments-24">
                      <p className="faculty-assignments-25">{asgn.gradedCount}</p>
                      <p className="faculty-assignments-19">Graded</p>
                    </div>
                  </div>
                </div>

                {expandedId === asgn.id && <div className="faculty-assignments-26">
                    {submissionsLoadingId === asgn.id && <p className="faculty-assignments-4">Loading submissions…</p>}
                    {submissionsError && submissionsLoadingId !== asgn.id && <p className="faculty-assignments-4">{submissionsError}</p>}
                    {submissions && submissions.length > 0 && <Table headers={['Student', 'Status', 'Marks', 'Grade']}>
                        {submissions.map(s => <tr key={s.id} className="faculty-assignments-44">
                            <td className="faculty-assignments-45">{s.studentName}</td>
                            <td className="faculty-assignments-45">
                              <StatusBadge status={toTitleCase(s.status)} />
                            </td>
                            <td className="faculty-assignments-45">{s.marks != null ? `${s.marks} / ${asgn.totalMarks}` : '—'}</td>
                            <td className="faculty-assignments-45">
                              {s.status === 'PENDING' ? <span className="faculty-assignments-39">Not submitted</span> : <div className="faculty-assignments-52">
                                  <input type="number" min="0" max={asgn.totalMarks} placeholder="Marks" value={marksDraft[s.id] ?? ''} onChange={e => setMarksDraft(prev => ({
                            ...prev,
                            [s.id]: e.target.value
                          }))} className="w-20 border border-slate-200 rounded-lg px-2 py-1 text-sm" />
                                  <Btn size="sm" variant="outline" onClick={() => handleSaveMarks(asgn.id, s.id)}>Save</Btn>
                                </div>}
                            </td>
                          </tr>)}
                      </Table>}
                    {submissions && submissions.length === 0 && <p className="faculty-assignments-4">No students in this section yet.</p>}
                  </div>}
              </Card>;
      })}
        </div>}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && <div className="faculty-assignments-29">
          <div className="faculty-assignments-30">
            {assignments.map(asgn => {
          const notSubmitted = asgn.totalStudents - asgn.submittedCount;
          const pendingEval = asgn.submittedCount - asgn.gradedCount;
          const submissionRate = asgn.totalStudents ? Math.round(asgn.submittedCount / asgn.totalStudents * 100) : 0;
          const evaluatedRate = asgn.submittedCount ? Math.round(asgn.gradedCount / asgn.submittedCount * 100) : 0;
          return <Card key={asgn.id} className="faculty-assignments-10">
                  <h3 className="faculty-assignments-31">{asgn.title}</h3>
                  <p className="faculty-assignments-32">{asgn.subject}</p>

                  <div className="faculty-assignments-33">
                    <div>
                      <div className="faculty-assignments-34">
                        <span>Submission Rate</span>
                        <span className="faculty-assignments-35">{submissionRate}%</span>
                      </div>
                      <ProgressBar value={submissionRate} color="violet" />
                    </div>
                    <div>
                      <div className="faculty-assignments-34">
                        <span>Evaluated</span>
                        <span className="faculty-assignments-35">{evaluatedRate}%</span>
                      </div>
                      <ProgressBar value={evaluatedRate} color="blue" />
                    </div>
                  </div>

                  <div className="faculty-assignments-36">
                    <div className="faculty-assignments-37">
                      <p className="faculty-assignments-38">{notSubmitted}</p>
                      <p className="faculty-assignments-39">Not Submitted</p>
                    </div>
                    <div className="faculty-assignments-37">
                      <p className="faculty-assignments-38">{pendingEval}</p>
                      <p className="faculty-assignments-39">Pending</p>
                    </div>
                  </div>
                </Card>;
        })}
          </div>
        </div>}

      {/* Similarity Detection — static preview, no backend yet */}
      {activeTab === 'similarity' && <div className="faculty-assignments-29">
          <Card className="faculty-assignments-10">
            <SectionHeader title="Similarity Detection" sub="AI-powered plagiarism analysis across student submissions" badge={<AIBadge label="AI Analysis" />} />

            <div className="faculty-assignments-40">
              <AlertTriangle className="faculty-assignments-41" />
              <p className="faculty-assignments-42">
                <span className="faculty-assignments-43">Preview data.</span> This tab isn't wired to live submissions yet — no plagiarism-check backend exists.
              </p>
            </div>

            <Table headers={['Student', 'Similarity Score', 'Compared With', 'Status', 'Actions']}>
              {similarityFlags.map((flag, i) => <tr key={i} className="faculty-assignments-44">
                  <td className="faculty-assignments-45">
                    <div className="faculty-assignments-46">
                      <div className="faculty-assignments-47">
                        {flag.student.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <p className="faculty-assignments-48">{flag.student}</p>
                        <p className="faculty-assignments-39">{flag.studentId}</p>
                      </div>
                    </div>
                  </td>
                  <td className="faculty-assignments-45">
                    <div className="faculty-assignments-49">
                      <div className="faculty-assignments-50">
                        <div className={`h-full rounded-full ${flag.score >= 80 ? 'bg-red-500' : flag.score >= 50 ? 'bg-amber-500' : 'bg-green-500'}`} style={{
                    width: `${flag.score}%`
                  }} />
                      </div>
                      <span className={`text-sm font-bold ${flag.score >= 80 ? 'text-red-600' : flag.score >= 50 ? 'text-amber-600' : 'text-green-600'}`}>
                        {flag.score}%
                      </span>
                      {flag.score >= 80 && <Badge variant="danger" size="xs">High</Badge>}
                    </div>
                  </td>
                  <td className="faculty-assignments-51">{flag.comparedWith}</td>
                  <td className="faculty-assignments-45">
                    <Badge variant={flag.status === 'Flagged' ? 'danger' : flag.status === 'Under Review' ? 'warning' : 'success'}>
                      {flag.status}
                    </Badge>
                  </td>
                  <td className="faculty-assignments-45">
                    <div className="faculty-assignments-52">
                      <button className="faculty-assignments-53" title="Compare Submissions">
                        <GitCompare className="faculty-assignments-28" />
                      </button>
                      <button className="faculty-assignments-54" title="Review">
                        <Eye className="faculty-assignments-28" />
                      </button>
                      <button className="faculty-assignments-55" title="Flag">
                        <Flag className="faculty-assignments-28" />
                      </button>
                      <button className="faculty-assignments-56" title="Dismiss">
                        <X className="faculty-assignments-28" />
                      </button>
                    </div>
                  </td>
                </tr>)}
            </Table>
          </Card>
        </div>}

      {/* Create Assignment Modal */}
      {showModal && <div className="faculty-assignments-57">
          <div className="faculty-assignments-58">
            <div className="faculty-assignments-59">
              <div>
                <h2 className="faculty-assignments-60">Create Assignment</h2>
                <p className="faculty-assignments-32">Fill in the details to publish a new assignment</p>
              </div>
              <button onClick={() => {
            setShowModal(false);
            resetForm();
          }} className="faculty-assignments-61">
                <X className="faculty-assignments-6" />
              </button>
            </div>
            <div className="faculty-assignments-62">
              {submitError && <p className="faculty-assignments-4">{submitError}</p>}
              <Input label="Assignment Title" placeholder="e.g. TCP/IP Protocol Analysis" value={form.title} onChange={v => setForm(f => ({
            ...f,
            title: v
          }))} required />
              <Select label="Subject" value={form.classKey} onChange={v => setForm(f => ({
            ...f,
            classKey: v
          }))} required options={classSelectOptions} />
              <div>
                <label className="faculty-assignments-63">Description</label>
                <textarea rows={3} placeholder="Assignment brief, requirements, submission format..." value={form.description} onChange={e => setForm(f => ({
              ...f,
              description: e.target.value
            }))} className="faculty-assignments-64" />
              </div>
              <div className="faculty-assignments-65">
                <Input label="Due Date" type="date" value={form.dueDate} onChange={v => setForm(f => ({
              ...f,
              dueDate: v
            }))} required />
                <Input label="Max Marks" type="number" placeholder="e.g. 30" value={form.maxMarks} onChange={v => setForm(f => ({
              ...f,
              maxMarks: v
            }))} required />
              </div>
              <div className="faculty-assignments-66">
                <Upload className="faculty-assignments-67" />
                <p className="faculty-assignments-68">Attach question paper / supporting files</p>
                <p className="faculty-assignments-39">File upload isn't wired to the backend yet</p>
              </div>
            </div>
            <div className="faculty-assignments-69">
              <Btn variant="outline" onClick={() => {
            setShowModal(false);
            resetForm();
          }}>Cancel</Btn>
              <Btn onClick={handlePublish} disabled={submitting} className="faculty-assignments-5" icon={<FileText className="faculty-assignments-6" />}>
                {submitting ? 'Publishing…' : 'Publish Assignment'}
              </Btn>
            </div>
          </div>
        </div>}
    </div>;
}