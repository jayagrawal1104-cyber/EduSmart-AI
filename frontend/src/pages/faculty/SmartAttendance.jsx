import './SmartAttendance.css';
import { useEffect, useRef, useState } from 'react';
import { ChevronRight, Users, Check, X, Clock, RotateCcw, Shield, CheckCircle, Camera, Upload, Info } from 'lucide-react';
import { Card, SectionHeader, Select, Input, Btn, StatusBadge, Table, ProgressBar, AIBadge } from '../../components/ui/index';
import { useAuth } from '../../context/AuthContext';
import { facultyApi } from '../../lib/api';
import { extractAllDescriptors } from '../../lib/faceApi';

const steps = ['Select Class', 'Capture / Upload', 'AI Detection', 'Summary & Confirm'];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function toTitleCase(status) {
  if (!status) return status;
  return status.charAt(0) + status.slice(1).toLowerCase();
}

// Every timetable slot (if any) that runs on the given date's weekday, for a
// class that may meet more than once a day. Real data only — never a
// placeholder — so this returns [] rather than inventing a period.
function periodsForDate(selectedClass, dateStr) {
  if (!selectedClass?.slots?.length || !dateStr) return [];
  const dayOfWeek = new Date(`${dateStr}T00:00:00`).getDay();
  return selectedClass.slots
    .filter((s) => s.dayOfWeek === dayOfWeek)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

function formatSlot(slot) {
  return `${slot.startTime} – ${slot.endTime}${slot.room ? ` · ${slot.room}` : ''}`;
}

// Turns a face-api.js Euclidean distance into a rough 0-100 "confidence" for
// display only — the actual match/no-match call is made server-side against
// MATCH_THRESHOLD (see backend/src/utils/faceMatch.js). 1.2 is just a
// display ceiling so near-misses still show a believable non-zero number
// instead of clamping straight to 0.
function confidenceFromDistance(distance) {
  if (typeof distance !== 'number') return null;
  const pct = Math.round((1 - distance / 1.2) * 100);
  return Math.max(0, Math.min(100, pct));
}

/** Live classroom camera with a capture button — styled to match the AI scan frame. */
function ClassroomCamera({ onCapture, busy }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setReady(true);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err?.name === 'NotAllowedError'
              ? 'Camera access was denied. Please allow camera access to take attendance.'
              : 'Could not access a camera on this device.'
          );
        }
      });
    return () => {
      cancelled = true;
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <Card className="smart-attendance-26">
      <p className="smart-attendance-30" style={{ textAlign: 'left', marginBottom: '0.75rem' }}>Camera Capture</p>
      <div className="smart-attendance-16">
        <video ref={videoRef} playsInline muted className={`absolute inset-0 w-full h-full object-cover ${ready && !error ? '' : 'opacity-0'}`} />
        <div className="smart-attendance-17" />
        {!ready && !error && <div className="relative flex flex-col items-center">
          <Camera className="smart-attendance-18" />
          <p className="smart-attendance-19">Starting camera…</p>
        </div>}
        {error && <div className="relative flex flex-col items-center gap-2 text-center px-4">
          <Camera className="smart-attendance-18" />
          <p className="smart-attendance-19">{error}</p>
        </div>}
        <div className="smart-attendance-21" />
        <div className="smart-attendance-22" />
        <div className="smart-attendance-23" />
        <div className="smart-attendance-24" />
      </div>
      <button type="button" onClick={() => onCapture(videoRef.current)} disabled={!ready || !!error || busy} className="smart-attendance-25">
        <Camera className="smart-attendance-14" />
        {busy ? 'Detecting…' : 'Capture Classroom'}
      </button>
    </Card>
  );
}

/** Upload-a-photo alternative to the live camera, using the same detection pipeline. */
function ClassroomUpload({ onCapture, busy }) {
  const fileInputRef = useRef(null);
  const imgRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [imgLoaded, setImgLoaded] = useState(false);

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImgLoaded(false);
    setPreviewUrl(URL.createObjectURL(file));
  }

  return (
    <Card className="smart-attendance-26">
      <p className="smart-attendance-30" style={{ textAlign: 'left', marginBottom: '0.75rem' }}>Upload Image</p>
      <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleFileChange} />
      <div className="smart-attendance-27" onClick={() => fileInputRef.current?.click()}>
        {previewUrl ? <>
          <img ref={imgRef} src={previewUrl} alt="Classroom upload preview" onLoad={() => setImgLoaded(true)} className="max-h-40 rounded-lg object-contain mb-2" />
          <p className="smart-attendance-32">Click to choose a different photo</p>
        </> : <>
          <div className="smart-attendance-28">
            <Upload className="smart-attendance-29" />
          </div>
          <p className="smart-attendance-30">Upload Classroom Image</p>
          <p className="smart-attendance-31">Drag & drop or click to browse</p>
          <p className="smart-attendance-32">PNG, JPG up to 10MB</p>
        </>}
      </div>
      <div className="smart-attendance-33">
        <Info className="smart-attendance-34" />
        <p className="smart-attendance-35">AI will detect and match student faces from the registered roster for this class.</p>
      </div>
      <button type="button" onClick={() => onCapture(imgRef.current)} disabled={!previewUrl || !imgLoaded || busy} className="smart-attendance-36">
        <Upload className="smart-attendance-14" />
        {busy ? 'Detecting…' : 'Upload & Detect'}
      </button>
    </Card>
  );
}

export default function SmartAttendance() {
  const { token } = useAuth();

  const [classOptions, setClassOptions] = useState([]);
  const [form, setForm] = useState({ classKey: '', date: todayStr() });
  const [periodIndex, setPeriodIndex] = useState(0);

  const [step, setStep] = useState(0);
  const [rows, setRows] = useState([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [confirmed, setConfirmed] = useState(false);

  // AI detection results for the current scan: { facesDetected, enrolledInSection,
  // matched: [{ studentId, name, rollId, confidence, accepted }],
  // unmatched: [{ confidence, dismissed }] }
  const [detection, setDetection] = useState(null);
  const [detectBusy, setDetectBusy] = useState(false);
  const [detectError, setDetectError] = useState('');

  useEffect(() => {
    facultyApi.getMyClasses(token).then(res => {
      setClassOptions((res.classes || []).filter(c => c.section));
    }).catch(() => {
      // Non-fatal: the subject dropdown just stays empty.
    });
  }, [token]);

  const selectedClass = classOptions.find(c => `${c.subjectId}::${c.section}` === form.classKey);
  const dayPeriods = periodsForDate(selectedClass, form.date);
  const selectedPeriod = dayPeriods[periodIndex] || null;

  // Reset to the first period whenever the chosen class or date changes, so
  // a stale index from a previous class (which may have had more periods)
  // never silently points at nothing.
  useEffect(() => {
    setPeriodIndex(0);
  }, [form.classKey, form.date]);

  function loadRoster() {
    if (!selectedClass || !form.date) return;
    setRosterLoading(true);
    setRosterError(null);
    facultyApi.getAttendanceRoster(token, {
      subjectId: selectedClass.subjectId,
      section: selectedClass.section,
      date: form.date
    }).then(res => {
      setRows((res.students || []).map(s => ({
        id: s.id,
        name: s.name,
        rollId: s.rollId,
        // AI-first flow: only faces the scan actually matches get flipped to
        // PRESENT in step 3 — everyone else defaults to ABSENT unless this
        // date was already marked, in which case we keep that.
        status: s.status || 'ABSENT'
      })));
      setDetection(null);
      setDetectError('');
      setStep(1);
    }).catch(err => {
      setRosterError(err.message || 'Failed to load roster');
    }).finally(() => {
      setRosterLoading(false);
    });
  }

  function updateStatus(id, status) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, status } : r));
  }

  function markAllPresent() {
    setRows(prev => prev.map(r => ({ ...r, status: 'PRESENT' })));
  }

  // Runs entirely client-side (face-api.js) except for the final match
  // lookup, which only ever sends numeric descriptors — never the photo —
  // to /api/faculty/attendance/face-recognize. Works the same whether the
  // input came from the live camera or an uploaded image. Students capture
  // Face ID during their join request before an admin ever approves them,
  // so this covers everyone who joined after that flow shipped — anyone
  // still missing it (or matched below threshold) shows up as Unknown for
  // the faculty to handle manually in the summary step.
  function runDetection(inputEl) {
    if (!selectedClass || !inputEl) return;
    setDetectBusy(true);
    setDetectError('');
    extractAllDescriptors(inputEl)
      .then((descriptors) => {
        if (descriptors.length === 0) {
          throw new Error('No faces detected in that frame. Make sure the whole classroom is in view.');
        }
        return facultyApi.recognizeFaces(token, { section: selectedClass.section, descriptors });
      })
      .then((res) => {
        setDetection({
          facesDetected: res.facesDetected,
          enrolledInSection: res.enrolledInSection,
          matched: res.matched.map((m) => ({
            studentId: m.studentId,
            name: m.name,
            rollId: m.rollId,
            confidence: confidenceFromDistance(m.distance),
            accepted: true,
          })),
          unmatched: (res.unmatched || []).map((u) => ({
            confidence: confidenceFromDistance(u.distance),
            dismissed: false,
          })),
        });
        setStep(2);
      })
      .catch((err) => setDetectError(err.message || 'Face scan failed'))
      .finally(() => setDetectBusy(false));
  }

  function toggleMatchAccept(studentId, accepted) {
    setDetection((d) => d && ({ ...d, matched: d.matched.map((m) => (m.studentId === studentId ? { ...m, accepted } : m)) }));
  }

  function toggleUnmatchedDismiss(idx, dismissed) {
    setDetection((d) => d && ({ ...d, unmatched: d.unmatched.map((u, i) => (i === idx ? { ...u, dismissed } : u)) }));
  }

  function applyDetectionToRoster() {
    if (detection) {
      const acceptedIds = new Set(detection.matched.filter((m) => m.accepted).map((m) => m.studentId));
      setRows((prev) => prev.map((r) => (acceptedIds.has(r.id) ? { ...r, status: 'PRESENT' } : r)));
    }
    setStep(3);
  }

  function handleConfirm() {
    if (!selectedClass) return;
    setSubmitting(true);
    setSubmitError(null);
    facultyApi.markAttendance(token, {
      subjectId: selectedClass.subjectId,
      section: selectedClass.section,
      date: form.date,
      records: rows.map(r => ({ studentId: r.id, status: r.status }))
    }).then(() => {
      setConfirmed(true);
    }).catch(err => {
      setSubmitError(err.message || 'Failed to submit attendance');
    }).finally(() => {
      setSubmitting(false);
    });
  }

  function startOver() {
    setStep(0);
    setConfirmed(false);
    setRows([]);
    setDetection(null);
    setDetectError('');
    setSubmitError(null);
  }

  const present = rows.filter(r => r.status === 'PRESENT').length;
  const absent = rows.filter(r => r.status === 'ABSENT').length;
  const late = rows.filter(r => r.status === 'LATE').length;
  const unknownFaces = detection ? detection.unmatched.filter((u) => !u.dismissed).length : 0;
  const matchedVisible = detection ? detection.matched.filter((m) => m.accepted).length : 0;

  const classSelectOptions = [{ value: '', label: 'Select subject...' }, ...classOptions.map(c => ({
    value: `${c.subjectId}::${c.section}`,
    label: `${c.subject} — ${c.section}`
  }))];

  return <div className="smart-attendance-1">
      {/* Header */}
      <div className="smart-attendance-2">
        <div>
          <h1 className="smart-attendance-3">
            Smart Attendance <AIBadge label="AI Face Recognition" />
          </h1>
          <p className="smart-attendance-4">AI-assisted classroom attendance with face detection</p>
        </div>
      </div>

      {/* Step Indicators */}
      <div className="smart-attendance-5">
        {steps.map((label, i) => <div key={label} className="smart-attendance-6">
            <button onClick={() => i < step && setStep(i)} className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${i === step ? 'text-violet-700' : i < step ? 'text-green-600 cursor-pointer' : 'text-slate-400'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 ${i < step ? 'bg-green-500 border-green-500 text-white' : i === step ? 'bg-violet-600 border-violet-600 text-white' : 'border-slate-300 text-slate-400'}`}>
                {i < step ? <Check className="smart-attendance-7" /> : i + 1}
              </div>
              <span className={`text-sm font-medium hidden sm:inline ${i === step ? 'text-violet-700' : i < step ? 'text-green-700' : 'text-slate-400'}`}>{label}</span>
            </button>
            {i < steps.length - 1 && <ChevronRight className={`w-4 h-4 mx-1 ${i < step ? 'text-green-400' : 'text-slate-200'}`} />}
          </div>)}
      </div>

      {/* Step 1: Select Class */}
      {step === 0 && <Card className="smart-attendance-8">
          <SectionHeader title="Select Class Details" sub="Choose the class you want to take attendance for" />
          {rosterError && <p className="smart-attendance-4">{rosterError}</p>}
          <div className="smart-attendance-9">
            <Select label="Subject" value={form.classKey} onChange={v => setForm(f => ({ ...f, classKey: v }))} required options={classSelectOptions} />
            <Input label="Date" type="date" value={form.date} onChange={v => setForm(f => ({ ...f, date: v }))} required />
            <div>
              <label className="smart-attendance-4" style={{ display: 'block', marginBottom: '0.25rem' }}>Period</label>
              {dayPeriods.length > 1 ? (
                <Select
                  value={String(periodIndex)}
                  onChange={(v) => setPeriodIndex(Number(v))}
                  options={dayPeriods.map((slot, i) => ({ value: String(i), label: formatSlot(slot) }))}
                />
              ) : (
                <p className="smart-attendance-12">{selectedPeriod ? formatSlot(selectedPeriod) : (selectedClass ? 'No class on this date' : '—')}</p>
              )}
            </div>
          </div>
          <div className="smart-attendance-10">
            <div className="smart-attendance-11">
              {selectedClass ? <><span className="smart-attendance-12">{selectedClass.subject}</span> · Section {selectedClass.section} · {form.date}</> : 'Pick a subject to continue'}
            </div>
            <Btn onClick={loadRoster} disabled={!selectedClass || !form.date || rosterLoading} className="smart-attendance-13" icon={<Users className="smart-attendance-14" />}>
              {rosterLoading ? 'Loading…' : 'Start Attendance'}
            </Btn>
          </div>
        </Card>}

      {/* Step 2: Capture / Upload */}
      {step === 1 && <div className="smart-attendance-37">
          <SectionHeader title="Capture / Upload" sub={selectedClass ? `${selectedClass.subject} · Section ${selectedClass.section} · ${form.date}` : ''} />
          {detectError && <p className="smart-attendance-4">{detectError}</p>}
          <div className="smart-attendance-15">
            <ClassroomCamera onCapture={runDetection} busy={detectBusy} />
            <ClassroomUpload onCapture={runDetection} busy={detectBusy} />
          </div>
          <div className="smart-attendance-62">
            <button onClick={() => setStep(3)} className="smart-attendance-78">
              Skip — mark attendance manually
            </button>
          </div>
        </div>}

      {/* Step 3: AI Detection */}
      {step === 2 && !detection && <Card className="smart-attendance-8">
          <SectionHeader title="No scan yet" sub="Run a camera capture or image upload first to see AI detection results." />
          <div className="smart-attendance-62">
            <Btn onClick={() => setStep(1)} className="smart-attendance-13" icon={<Camera className="smart-attendance-14" />}>
              Go to Capture / Upload
            </Btn>
          </div>
        </Card>}

      {step === 2 && detection && <div className="smart-attendance-37">
          <div className="smart-attendance-45">
            <div className="smart-attendance-46">
              <div className="smart-attendance-47">{detection.facesDetected}</div>
              <div className="smart-attendance-48">Detected</div>
            </div>
            <div className="smart-attendance-49">
              <div className="smart-attendance-50">{matchedVisible}</div>
              <div className="smart-attendance-48">Matched</div>
            </div>
            <div className="smart-attendance-67">
              <div className="smart-attendance-68">{unknownFaces}</div>
              <div className="smart-attendance-48">Unknown</div>
            </div>
          </div>

          <Card className="smart-attendance-53">
            <SectionHeader title="Recognition Results" sub="Review AI detections and adjust as needed" badge={<AIBadge label="AI Detected" />} />
            <Table headers={['Student', 'Student ID', 'Confidence', 'Status', 'Actions']}>
              {detection.matched.map(m => <tr key={m.studentId} className="hover:bg-slate-50/50 transition-colors">
                  <td className="smart-attendance-54">
                    <div className="smart-attendance-55">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold bg-violet-100 text-violet-700">
                        {(m.name || '?').split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <p className="smart-attendance-56">{m.name}</p>
                    </div>
                  </td>
                  <td className="smart-attendance-57">{m.rollId}</td>
                  <td className="smart-attendance-54">
                    <div className="smart-attendance-58">
                      <div className="smart-attendance-59"><ProgressBar value={m.confidence ?? 0} color={m.confidence >= 60 ? 'green' : 'amber'} /></div>
                      <span className="smart-attendance-57" style={{ padding: 0 }}>{m.confidence ?? '—'}%</span>
                    </div>
                  </td>
                  <td className="smart-attendance-54">
                    <StatusBadge status={m.accepted ? 'Present' : 'Pending'} />
                  </td>
                  <td className="smart-attendance-54">
                    <div className="smart-attendance-60">
                      <button onClick={() => toggleMatchAccept(m.studentId, true)} className={`p-1.5 rounded-lg transition-colors ${m.accepted ? 'bg-green-100 text-green-700' : 'hover:bg-green-50 text-slate-400 hover:text-green-600'}`} title="Confirm match">
                        <Check className="smart-attendance-61" />
                      </button>
                      <button onClick={() => toggleMatchAccept(m.studentId, false)} className={`p-1.5 rounded-lg transition-colors ${!m.accepted ? 'bg-red-100 text-red-700' : 'hover:bg-red-50 text-slate-400 hover:text-red-600'}`} title="Reject match">
                        <X className="smart-attendance-61" />
                      </button>
                    </div>
                  </td>
                </tr>)}
              {detection.unmatched.map((u, idx) => !u.dismissed && <tr key={`unknown-${idx}`} className="bg-amber-50/40 hover:bg-amber-50/70 transition-colors">
                  <td className="smart-attendance-54">
                    <div className="smart-attendance-55">
                      <div className="smart-attendance-72">??</div>
                      <div>
                        <p className="smart-attendance-56">Unknown Student</p>
                        <p className="smart-attendance-4" style={{ marginTop: 0, fontSize: '0.7rem' }}>Review required</p>
                      </div>
                    </div>
                  </td>
                  <td className="smart-attendance-57">—</td>
                  <td className="smart-attendance-54">
                    <div className="smart-attendance-58">
                      <div className="smart-attendance-59"><ProgressBar value={u.confidence ?? 0} color="red" /></div>
                      <span className="smart-attendance-57" style={{ padding: 0 }}>{u.confidence ?? '—'}%</span>
                    </div>
                  </td>
                  <td className="smart-attendance-54">
                    <StatusBadge status="Pending" />
                  </td>
                  <td className="smart-attendance-54">
                    <div className="smart-attendance-60">
                      <button disabled className="p-1.5 rounded-lg text-slate-300 cursor-not-allowed" title="No matching student to confirm">
                        <Check className="smart-attendance-61" />
                      </button>
                      <button onClick={() => toggleUnmatchedDismiss(idx, true)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors" title="Dismiss detection">
                        <X className="smart-attendance-61" />
                      </button>
                    </div>
                  </td>
                </tr>)}
            </Table>
          </Card>

          <div className="smart-attendance-77">
            <button onClick={() => setStep(1)} className="smart-attendance-78">
              <RotateCcw className="smart-attendance-61" /> Rescan
            </button>
            <Btn onClick={applyDetectionToRoster} className="smart-attendance-13" icon={<ChevronRight className="smart-attendance-14" />}>
              Continue to Summary
            </Btn>
          </div>
        </div>}

      {/* Step 4: Summary & Confirm */}
      {step === 3 && <div className="smart-attendance-37">
          {confirmed ? <Card className="smart-attendance-38">
              <div className="smart-attendance-63">
                <CheckCircle className="smart-attendance-64" />
              </div>
              <h3 className="smart-attendance-41">Attendance Submitted!</h3>
              <p className="smart-attendance-42">Attendance for <strong>{selectedClass?.subject} — {selectedClass?.section}</strong> has been recorded.</p>
              <button onClick={startOver} className="smart-attendance-65">
                <RotateCcw className="smart-attendance-14" /> Take Another Attendance
              </button>
            </Card> : <>
              <div className="smart-attendance-66">
                <div className="smart-attendance-49">
                  <div className="smart-attendance-50">{present}</div>
                  <div className="smart-attendance-48">Present</div>
                </div>
                <div className="smart-attendance-67">
                  <div className="smart-attendance-68">{absent}</div>
                  <div className="smart-attendance-48">Absent</div>
                </div>
                <div className="smart-attendance-51">
                  <div className="smart-attendance-52">{late}</div>
                  <div className="smart-attendance-48">Late</div>
                </div>
                <div className="smart-attendance-46">
                  <div className="smart-attendance-70">{unknownFaces}</div>
                  <div className="smart-attendance-48">Unknown</div>
                </div>
              </div>

              <Card className="smart-attendance-53">
                <SectionHeader title="Attendance Summary" sub="Final review before submission" action={<Btn variant="outline" size="sm" onClick={markAllPresent}>Mark All Present</Btn>} />
                {submitError && <p className="smart-attendance-4">{submitError}</p>}
                {rows.length === 0 ? <p className="smart-attendance-4">No students found for this section.</p> : <Table headers={['Student', 'Roll No', 'Status', 'Actions']}>
                  {rows.map(row => <tr key={row.id} className="smart-attendance-71">
                      <td className="smart-attendance-54">
                        <div className="smart-attendance-55">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold bg-violet-100 text-violet-700">
                            {row.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </div>
                          <span className="smart-attendance-56">{row.name}</span>
                        </div>
                      </td>
                      <td className="smart-attendance-57">{row.rollId}</td>
                      <td className="smart-attendance-54">
                        <StatusBadge status={toTitleCase(row.status)} />
                      </td>
                      <td className="smart-attendance-54">
                        <div className="smart-attendance-60">
                          <button onClick={() => updateStatus(row.id, 'PRESENT')} className={`p-1.5 rounded-lg transition-colors ${row.status === 'PRESENT' ? 'bg-green-100 text-green-700' : 'hover:bg-green-50 text-slate-400 hover:text-green-600'}`} title="Mark Present">
                            <Check className="smart-attendance-61" />
                          </button>
                          <button onClick={() => updateStatus(row.id, 'LATE')} className={`p-1.5 rounded-lg transition-colors ${row.status === 'LATE' ? 'bg-amber-100 text-amber-700' : 'hover:bg-amber-50 text-slate-400 hover:text-amber-600'}`} title="Mark Late">
                            <Clock className="smart-attendance-61" />
                          </button>
                          <button onClick={() => updateStatus(row.id, 'ABSENT')} className={`p-1.5 rounded-lg transition-colors ${row.status === 'ABSENT' ? 'bg-red-100 text-red-700' : 'hover:bg-red-50 text-slate-400 hover:text-red-600'}`} title="Mark Absent">
                            <X className="smart-attendance-61" />
                          </button>
                        </div>
                      </td>
                    </tr>)}
                </Table>}
              </Card>

              <div className="smart-attendance-73">
                <Shield className="smart-attendance-74" />
                <div>
                  <p className="smart-attendance-75">Final Review Required</p>
                  <p className="smart-attendance-76">
                    Please review all records above before confirming — this will save attendance for the class.
                  </p>
                </div>
              </div>

              <div className="smart-attendance-77">
                <button onClick={() => setStep(detection ? 2 : 1)} className="smart-attendance-78">
                  <RotateCcw className="smart-attendance-61" /> {detection ? 'Back to Detection' : 'Back to Capture'}
                </button>
                <Btn onClick={handleConfirm} disabled={submitting} className="smart-attendance-13" icon={<CheckCircle className="smart-attendance-14" />}>
                  {submitting ? 'Submitting…' : 'Confirm Attendance'}
                </Btn>
              </div>
            </>}
        </div>}
    </div>;
}