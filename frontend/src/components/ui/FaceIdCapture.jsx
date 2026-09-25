import { useEffect, useRef, useState } from 'react';
import { Check, AlertCircle, RotateCcw, ScanFace } from 'lucide-react';
import { loadFaceModels, extractSingleDescriptor } from '../../lib/faceApi';

// The 8 poses walked through during enrollment. Capturing several angles
// and expressions (rather than one static photo) gives Smart Attendance a
// far more reliable descriptor to match against later — a single front-on
// shot is brittle against real classroom lighting/angle variation.
const POSES = [
  { key: 'center', label: 'Look straight ahead', instruction: 'Center your face in the frame and look directly at the camera.' },
  { key: 'left', label: 'Turn slightly left', instruction: 'Slowly turn your head to your left, just a little.' },
  { key: 'right', label: 'Turn slightly right', instruction: 'Slowly turn your head to your right, just a little.' },
  { key: 'up', label: 'Tilt chin up', instruction: 'Tilt your head up slightly, keeping your face in frame.' },
  { key: 'down', label: 'Tilt chin down', instruction: 'Tilt your head down slightly, keeping your face in frame.' },
  { key: 'smile', label: 'Smile', instruction: 'Give a natural smile, looking at the camera.' },
  { key: 'neutral', label: 'Neutral expression', instruction: 'Relax your face back to a neutral expression.' },
  { key: 'closer', label: 'Move a little closer', instruction: 'Lean in slightly so your face fills more of the frame.' },
];

/**
 * Guided multi-pose Face ID capture. Opens the camera once and keeps the
 * same stream open across all 8 poses (no re-prompting for camera access
 * between steps). Each pose is extracted to its own 128-length descriptor
 * client-side via face-api.js; on the final pose all 8 are averaged into
 * one descriptor and handed to onComplete — nothing but that single
 * number[128] ever leaves the browser.
 *
 * Usage:
 *   <FaceIdCapture onComplete={(descriptor) => ...} onCancel={() => ...} />
 */
export default function FaceIdCapture({ onComplete, onCancel }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [captured, setCaptured] = useState([]); // descriptors collected so far, one per pose
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cameraError, setCameraError] = useState('');
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const [stream] = await Promise.all([
          navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false }),
          loadFaceModels(),
        ]);
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setReady(true);
      } catch (err) {
        if (!cancelled) {
          setCameraError(
            err?.name === 'NotAllowedError'
              ? 'Camera access was denied. Please allow camera access to set up Face ID.'
              : 'Could not access the camera on this device, or the face recognition models failed to load.'
          );
        }
      }
    }

    start();

    return () => {
      cancelled = true;
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const pose = POSES[stepIndex];
  const isLastStep = stepIndex === POSES.length - 1;

  async function handleCapture() {
    setBusy(true);
    setError('');
    try {
      const descriptor = await extractSingleDescriptor(videoRef.current);
      const next = [...captured, descriptor];
      setCaptured(next);

      if (isLastStep) {
        setFinishing(true);
        const averaged = averageDescriptors(next);
        if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
        onComplete(averaged);
      } else {
        setStepIndex((i) => i + 1);
      }
    } catch (err) {
      setError(err.message || 'Could not capture that pose. Try again.');
    } finally {
      setBusy(false);
    }
  }

  function handleRetakeAll() {
    setCaptured([]);
    setStepIndex(0);
    setError('');
  }

  if (cameraError) {
    return (
      <div className="flex flex-col items-center gap-2 text-center px-3 py-6 text-red-500">
        <AlertCircle className="w-6 h-6" />
        <span className="text-sm">{cameraError}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Progress dots */}
      <div className="flex items-center gap-1.5">
        {POSES.map((p, i) => (
          <div
            key={p.key}
            className={`w-2.5 h-2.5 rounded-full transition-colors ${
              i < stepIndex || finishing ? 'bg-green-500' : i === stepIndex ? 'bg-violet-600' : 'bg-slate-200'
            }`}
            title={p.label}
          />
        ))}
      </div>

      <div className="text-center">
        <div className="text-sm font-semibold text-slate-800">
          Step {stepIndex + 1} of {POSES.length}: {pose.label}
        </div>
        <p className="text-xs text-slate-500 mt-0.5 max-w-xs mx-auto">{pose.instruction}</p>
      </div>

      <div className="relative w-64 h-64 rounded-2xl overflow-hidden bg-slate-100">
        <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-400 bg-slate-100">
            Starting camera…
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-500 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleCapture}
          disabled={!ready || busy || finishing}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium disabled:opacity-50"
        >
          <ScanFace className="w-4 h-4" />
          {busy || finishing ? 'Processing…' : isLastStep ? 'Capture & Finish' : 'Capture Pose'}
        </button>
        {stepIndex > 0 && !finishing && (
          <button
            type="button"
            onClick={handleRetakeAll}
            disabled={busy}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Start over
          </button>
        )}
        {onCancel && !finishing && (
          <button type="button" onClick={onCancel} disabled={busy} className="px-3 py-2 rounded-lg text-slate-500 text-sm disabled:opacity-50">
            Cancel
          </button>
        )}
      </div>

      <div className="flex items-center gap-1 text-[11px] text-slate-400">
        <Check className="w-3 h-3" /> {captured.length} of {POSES.length} poses captured
      </div>
    </div>
  );
}

/** Element-wise mean of several 128-length descriptors into one. */
function averageDescriptors(descriptors) {
  const length = descriptors[0].length;
  const sum = new Array(length).fill(0);
  for (const d of descriptors) {
    for (let i = 0; i < length; i++) sum[i] += d[i];
  }
  return sum.map((v) => v / descriptors.length);
}