import './StudentFeedback.css';
import { useEffect, useState } from 'react';
import { Star, CheckCircle, EyeOff, ChevronDown, MessageSquare, Lock } from 'lucide-react';
import { Badge, Card, Btn, SectionHeader } from '../../components/ui/index';
import { useAuth } from '../../context/AuthContext';
import { studentApi } from '../../lib/api';

const feedbackTabs = ['Faculty Feedback'];

function StarRating({
  label,
  value,
  onChange
}) {
  const [hovered, setHovered] = useState(0);
  return <div className="student-feedback-1">
      <label className="student-feedback-2">{label}</label>
      <div className="student-feedback-3">
        {[1, 2, 3, 4, 5].map(star => <button key={star} type="button" onMouseEnter={() => setHovered(star)} onMouseLeave={() => setHovered(0)} onClick={() => onChange(star)} className="student-feedback-4">
            <Star className={`w-6 h-6 transition-colors ${star <= (hovered || value) ? 'fill-amber-400 text-amber-400' : 'text-slate-200 fill-slate-200'}`} />
          </button>)}
        {value > 0 && <span className="student-feedback-5">{value}/5</span>}
      </div>
    </div>;
}

export default function StudentFeedback() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState('Faculty Feedback');
  const [facultyOptions, setFacultyOptions] = useState([]);
  const [pastFeedback, setPastFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [selectedFaculty, setSelectedFaculty] = useState('');
  const [ratings, setRatings] = useState({
    clarity: 0,
    knowledge: 0,
    responsiveness: 0,
    overall: 0
  });
  const [comment, setComment] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  function loadPastFeedback() {
    return studentApi.getMyFeedback(token).then((res) => setPastFeedback(res.feedback || []));
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([studentApi.getFeedbackFacultyOptions(token), studentApi.getMyFeedback(token)])
      .then(([facultyRes, feedbackRes]) => {
        if (cancelled) return;
        setFacultyOptions(facultyRes.faculty || []);
        setPastFeedback(feedbackRes.feedback || []);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message || 'Failed to load feedback data');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  function setRating(key, val) {
    setRatings(prev => ({
      ...prev,
      [key]: val
    }));
  }

  function handleSubmit() {
    if (!selectedFaculty || ratings.overall === 0) return;
    const faculty = facultyOptions.find((f) => f.id === selectedFaculty);

    // The Feedback table only has one `rating` column, so the overall score
    // is what's stored as `rating`; the three sub-scores get folded into the
    // message text rather than silently dropped (no dedicated columns for
    // them yet).
    const subScores = `Teaching Clarity: ${ratings.clarity || '—'}/5, Subject Knowledge: ${ratings.knowledge || '—'}/5, Responsiveness: ${ratings.responsiveness || '—'}/5`;
    const message = comment ? `${subScores}\n\n${comment}` : subScores;

    setSubmitting(true);
    setSubmitError(null);
    studentApi
      .submitFeedback(token, {
        facultyId: selectedFaculty,
        subject: faculty?.subjects?.[0] || 'General',
        message,
        rating: ratings.overall,
        anonymous,
      })
      .then(() => loadPastFeedback())
      .then(() => setSubmitted(true))
      .catch((err) => setSubmitError(err.message || 'Failed to submit feedback'))
      .finally(() => setSubmitting(false));
  }

  function handleReset() {
    setSubmitted(false);
    setSubmitError(null);
    setSelectedFaculty('');
    setRatings({
      clarity: 0,
      knowledge: 0,
      responsiveness: 0,
      overall: 0
    });
    setComment('');
    setAnonymous(false);
  }

  const canSubmit = selectedFaculty && ratings.overall > 0 && !submitting;

  if (loading) {
    return (
      <div className="student-feedback-11">
        <p className="student-feedback-13">Loading feedback…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="student-feedback-11">
        <p className="student-feedback-13">Couldn't load feedback: {loadError}</p>
      </div>
    );
  }

  return <div className="student-feedback-11">
      {/* Header */}
      <div>
        <h2 className="student-feedback-12">Feedback Portal</h2>
        <p className="student-feedback-13">Share your experience to help improve academic quality</p>
      </div>

      {/* Info banner */}
      <div className="student-feedback-14">
        <Lock className="student-feedback-15" />
        <div>
          <p className="student-feedback-16">Your feedback is confidential</p>
          <p className="student-feedback-17">All responses are anonymized and used only for academic improvement. Faculty cannot see individual responses.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="student-feedback-18">
        {feedbackTabs.map(tab => <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {tab}
          </button>)}
      </div>

      {submitted ? (/* Success state */
    <Card className="student-feedback-19">
          <div className="student-feedback-20">
            <CheckCircle className="student-feedback-21" />
          </div>
          <h3 className="student-feedback-22">Thank you for your feedback!</h3>
          <p className="student-feedback-23">
            Your response has been recorded{anonymous ? ' anonymously' : ''}. It will be reviewed by the academic quality team.
          </p>
          <div className="student-feedback-24">
            <Btn variant="outline" onClick={handleReset}>Submit Another</Btn>
            <Btn onClick={handleReset}>Done</Btn>
          </div>
        </Card>) : (/* Faculty feedback form */
    <div className="student-feedback-25">
          <div className="student-feedback-26">
            <Card className="student-feedback-27">
              <SectionHeader title="Faculty Feedback" sub="Rate your faculty across key teaching dimensions" />

              {/* Faculty selector */}
              <div>
                <label className="student-feedback-28">
                  Select Faculty <span className="student-feedback-29">*</span>
                </label>
                <div className="student-feedback-30">
                  <select value={selectedFaculty} onChange={e => setSelectedFaculty(e.target.value)} className="student-feedback-31">
                    <option value="">-- Choose a faculty member --</option>
                    {facultyOptions.map(f => <option key={f.id} value={f.id}>{f.name} · {f.subjects.join(', ')}</option>)}
                  </select>
                  <ChevronDown className="student-feedback-32" />
                </div>
                {facultyOptions.length === 0 && <p className="student-feedback-45">No faculty found teaching your section yet.</p>}
              </div>

              {/* Ratings */}
              <div className="student-feedback-33">
                <div className="student-feedback-34">
                  <StarRating label="Teaching Clarity" value={ratings.clarity} onChange={v => setRating('clarity', v)} />
                </div>
                <div className="student-feedback-34">
                  <StarRating label="Subject Knowledge" value={ratings.knowledge} onChange={v => setRating('knowledge', v)} />
                </div>
                <div className="student-feedback-34">
                  <StarRating label="Responsiveness to Doubts" value={ratings.responsiveness} onChange={v => setRating('responsiveness', v)} />
                </div>
                <div className="student-feedback-35">
                  <StarRating label="Overall Rating" value={ratings.overall} onChange={v => setRating('overall', v)} />
                </div>
              </div>

              {/* Comment */}
              <div>
                <label className="student-feedback-28">
                  Additional Comments <span className="student-feedback-36">(optional)</span>
                </label>
                <textarea value={comment} onChange={e => setComment(e.target.value)} rows={4} placeholder="Share specific feedback, suggestions, or appreciation..." className="student-feedback-37" />
              </div>

              {/* Anonymous toggle */}
              <div className="student-feedback-38">
                <div className="student-feedback-39">
                  <EyeOff className="student-feedback-40" />
                  <div>
                    <p className="student-feedback-41">Submit Anonymously</p>
                    <p className="student-feedback-42">Your name will not be attached to this feedback</p>
                  </div>
                </div>
                <button type="button" onClick={() => setAnonymous(v => !v)} className={`relative w-11 h-6 rounded-full transition-colors focus:outline-none ${anonymous ? 'bg-blue-600' : 'bg-slate-200'}`}>
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${anonymous ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              {submitError && <p className="student-feedback-45">{submitError}</p>}

              {/* Submit */}
              <div className="student-feedback-43">
                <Btn onClick={handleSubmit} disabled={!canSubmit} className="student-feedback-44" size="lg">
                  {submitting ? 'Submitting…' : anonymous ? 'Submit Anonymously' : 'Submit Feedback'}
                </Btn>
              </div>

              {!canSubmit && !submitting && <p className="student-feedback-45">Please select a faculty member and provide an overall rating to submit.</p>}
            </Card>
          </div>

          {/* Sidebar: previous feedback */}
          <div className="student-feedback-46">
            <Card className="student-feedback-47">
              <SectionHeader title="My Previous Feedback" sub="Your past submissions" />
              <div className="student-feedback-48">
                {pastFeedback.length === 0 && <p className="student-feedback-42">You haven't submitted any feedback yet.</p>}
                {pastFeedback.map(fb => <div key={fb.id} className="student-feedback-49">
                    <div className="student-feedback-50">
                      <div>
                        <p className="student-feedback-51">{fb.target}</p>
                        <p className="student-feedback-42">{fb.subject} · {fb.date}</p>
                      </div>
                      <Badge variant={fb.anonymous ? 'neutral' : 'info'} size="xs">
                        {fb.anonymous ? 'Anonymous' : 'Named'}
                      </Badge>
                    </div>
                    <div className="student-feedback-52">
                      {[1, 2, 3, 4, 5].map(s => <Star key={s} className={`w-4 h-4 ${fb.rating && s <= fb.rating ? 'fill-amber-400 text-amber-400' : 'fill-slate-100 text-slate-100'}`} />)}
                      {fb.rating != null && <span className="student-feedback-53">{fb.rating}/5</span>}
                    </div>
                    {fb.message ? <p className="student-feedback-55">{fb.message}</p> : <p className="student-feedback-56">No comment provided.</p>}
                  </div>)}
              </div>
            </Card>

            <Card className="student-feedback-47">
              <div className="student-feedback-57">
                <div className="student-feedback-58">
                  <MessageSquare className="student-feedback-59" />
                </div>
                <div>
                  <p className="student-feedback-51">Feedback Guidelines</p>
                  <ul className="student-feedback-60">
                    <li>Be honest and constructive</li>
                    <li>Focus on teaching quality, not personal traits</li>
                    <li>Feedback is reviewed once per semester</li>
                    <li>Anonymous options are fully private</li>
                  </ul>
                </div>
              </div>
            </Card>
          </div>
        </div>)}
    </div>;
}