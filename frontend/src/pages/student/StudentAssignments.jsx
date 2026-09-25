import './StudentAssignments.css';
import { useEffect, useState } from 'react';
import { ClipboardList, Upload, X, FileText, CheckCircle, Clock, AlertCircle, BookOpen } from 'lucide-react';
import { Card, Badge, StatusBadge, Btn, SectionHeader } from '../../components/ui/index';
import { useAuth } from '../../context/AuthContext';
import { studentApi } from '../../lib/api';

const filterTabs = ['All', 'Pending', 'Submitted', 'Graded', 'Late'];

function getDaysLabel(dueDate, status) {
  if (status === 'Graded' || status === 'Submitted') return { text: 'Submitted', color: 'text-green-600' };
  const due = new Date(dueDate);
  const today = new Date();
  const diff = Math.ceil((due.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, color: 'text-red-600' };
  if (diff === 0) return { text: 'Due today', color: 'text-red-600' };
  if (diff <= 3) return { text: `Due in ${diff}d`, color: 'text-amber-600' };
  return { text: `Due in ${diff}d`, color: 'text-slate-500' };
}

const statusIcon = {
  Pending: <Clock className="student-assignments-1" />,
  Submitted: <CheckCircle className="student-assignments-2" />,
  Graded: <CheckCircle className="student-assignments-3" />,
  Late: <AlertCircle className="student-assignments-4" />,
};

// NOTE: there is no backend endpoint yet for a student to actually upload a
// submission file — this modal still simulates the upload locally. Wire it
// to a real POST /api/student/assignments/:id/submit (multipart) once that
// route exists.
function SubmitModal({ assignment, onClose }) {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f.name);
  }
  function handleSubmit() {
    if (!file) return;
    setSubmitted(true);
  }
  return (
    <div className="student-assignments-5">
      <div className="student-assignments-6" onClick={onClose} />
      <div className="student-assignments-7">
        <div className="student-assignments-8">
          <div>
            <h3 className="student-assignments-9">Submit Assignment</h3>
            <p className="student-assignments-10">{assignment.title}</p>
          </div>
          <button onClick={onClose} className="student-assignments-11">
            <X className="student-assignments-12" />
          </button>
        </div>

        {submitted ? (
          <div className="student-assignments-13">
            <div className="student-assignments-14">
              <CheckCircle className="student-assignments-15" />
            </div>
            <h4 className="student-assignments-16">Submitted Successfully!</h4>
            <p className="student-assignments-17">Your assignment has been submitted. You will be notified when it is graded.</p>
            <Btn className="student-assignments-18" onClick={onClose}>Close</Btn>
          </div>
        ) : (
          <div className="student-assignments-19">
            <div className="student-assignments-20">
              {[
                { label: 'Subject', value: assignment.subject },
                { label: 'Faculty', value: assignment.faculty },
                { label: 'Due Date', value: assignment.dueDate },
                { label: 'Total Marks', value: `${assignment.totalMarks} marks` },
              ].map((r) => (
                <div key={r.label} className="student-assignments-21">
                  <span className="student-assignments-22">{r.label}</span>
                  <span className="student-assignments-23">{r.value}</span>
                </div>
              ))}
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 transition-colors cursor-pointer ${
                dragging ? 'border-blue-400 bg-blue-50' : file ? 'border-green-400 bg-green-50' : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/30'
              }`}
              onClick={() => setFile('assignment_submission.pdf')}
            >
              {file ? (
                <>
                  <FileText className="student-assignments-24" />
                  <p className="student-assignments-25">{file}</p>
                  <button
                    className="student-assignments-26"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                    }}
                  >
                    Remove file
                  </button>
                </>
              ) : (
                <>
                  <Upload className="student-assignments-27" />
                  <div className="student-assignments-28">
                    <p className="student-assignments-29">Drag & drop or click to upload</p>
                    <p className="student-assignments-30">Supported: PDF, DOCX, ZIP, TXT · Max 20 MB</p>
                  </div>
                </>
              )}
            </div>

            <div>
              <label className="student-assignments-31">Note to faculty (optional)</label>
              <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} placeholder="Any additional notes about your submission..." className="student-assignments-32" />
            </div>

            <div className="student-assignments-33">
              <Btn variant="outline" onClick={onClose} className="student-assignments-34">Cancel</Btn>
              <Btn onClick={handleSubmit} disabled={!file} className="student-assignments-34" icon={<Upload className="student-assignments-35" />}>
                Submit Assignment
              </Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function StudentAssignments() {
  const { token } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('All');
  const [submitting, setSubmitting] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    studentApi
      .getAssignments(token)
      .then((res) => {
        if (!cancelled) setAssignments(res.assignments);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load assignments');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) return <div className="student-assignments-36"><p className="student-assignments-39">Loading assignments…</p></div>;
  if (error) return <div className="student-assignments-36"><Card className="student-assignments-64"><p className="student-assignments-39">Couldn't load assignments: {error}</p></Card></div>;

  const filtered = activeTab === 'All' ? assignments : assignments.filter((a) => a.status === activeTab);
  const counts = {
    All: assignments.length,
    Pending: assignments.filter((a) => a.status === 'Pending').length,
    Submitted: assignments.filter((a) => a.status === 'Submitted').length,
    Graded: assignments.filter((a) => a.status === 'Graded').length,
    Late: assignments.filter((a) => a.status === 'Late').length,
  };

  return (
    <div className="student-assignments-36">
      <div className="student-assignments-37">
        <div>
          <h2 className="student-assignments-38">Assignments</h2>
          <p className="student-assignments-39">Track, submit, and review all your assignments</p>
        </div>
      </div>

      <div className="student-assignments-40">
        {[
          { label: 'Total Assignments', value: counts.All, color: 'text-slate-800', bg: 'bg-slate-100' },
          { label: 'Pending', value: counts.Pending, color: 'text-amber-700', bg: 'bg-amber-50' },
          { label: 'Submitted / Graded', value: counts.Submitted + counts.Graded, color: 'text-green-700', bg: 'bg-green-50' },
          { label: 'Late / Overdue', value: counts.Late, color: 'text-red-700', bg: 'bg-red-50' },
        ].map((s) => (
          <Card key={s.label} className="student-assignments-41">
            <p className={`text-2xl font-bold font-display ${s.color}`}>{s.value}</p>
            <p className="student-assignments-42">{s.label}</p>
          </Card>
        ))}
      </div>

      <div className="student-assignments-43">
        {filterTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {tab}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
              {counts[tab]}
            </span>
          </button>
        ))}
      </div>

      <div className="student-assignments-44">
        {filtered.map((a) => {
          const dueLabel = getDaysLabel(a.dueDate, a.status);
          return (
            <Card key={a.id} className="student-assignments-45">
              <div className="student-assignments-46">
                <div className="student-assignments-47">
                  <BookOpen className="student-assignments-48" />
                </div>
                <div className="student-assignments-49">
                  <div className="student-assignments-50">
                    <div>
                      <h3 className="student-assignments-51">{a.title}</h3>
                      <p className="student-assignments-42">{a.subject} · {a.faculty}</p>
                    </div>
                    <div className="student-assignments-52">
                      {statusIcon[a.status]}
                      <StatusBadge status={a.status} />
                    </div>
                  </div>

                  {a.description && <p className="student-assignments-53">{a.description}</p>}

                  <div className="student-assignments-54">
                    <span className={`text-xs font-medium ${dueLabel.color}`}>
                      <Clock className="student-assignments-55" />
                      {dueLabel.text} · {a.dueDate}
                    </span>
                    <Badge variant="neutral">/{a.totalMarks} marks</Badge>
                    {a.marks !== undefined && (
                      <Badge variant="success">
                        Scored: {a.marks}/{a.totalMarks} ({Math.round((a.marks / a.totalMarks) * 100)}%)
                      </Badge>
                    )}
                  </div>

                  {a.status === 'Pending' && (
                    <div className="student-assignments-56">
                      <Btn size="sm" icon={<Upload className="student-assignments-57" />} onClick={() => setSubmitting(a)}>
                        Submit Assignment
                      </Btn>
                    </div>
                  )}
                  {a.status === 'Late' && (
                    <div className="student-assignments-56">
                      <Btn size="sm" variant="outline" icon={<Upload className="student-assignments-57" />} onClick={() => setSubmitting(a)}>
                        Submit Late
                      </Btn>
                    </div>
                  )}
                  {a.status === 'Submitted' && (
                    <div className="student-assignments-58">
                      <p className="student-assignments-59">
                        <CheckCircle className="student-assignments-60" />
                        Submitted — awaiting evaluation by {a.faculty}
                      </p>
                    </div>
                  )}
                  {a.status === 'Graded' && a.marks !== undefined && (
                    <div className="student-assignments-58">
                      <div className="student-assignments-61">
                        <CheckCircle className="student-assignments-62" />
                        <span className="student-assignments-63">
                          Graded: {a.marks}/{a.totalMarks} — {Math.round((a.marks / a.totalMarks) * 100)}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}

        {filtered.length === 0 && (
          <Card className="student-assignments-64">
            <ClipboardList className="student-assignments-65" />
            <p className="student-assignments-66">No {activeTab} assignments</p>
            <p className="student-assignments-30">All assignments in this category will appear here.</p>
          </Card>
        )}
      </div>

      {submitting && <SubmitModal assignment={submitting} onClose={() => setSubmitting(null)} />}
    </div>
  );
}