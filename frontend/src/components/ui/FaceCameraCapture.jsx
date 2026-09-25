import { useEffect, useRef, useState } from 'react';
import { AlertCircle } from 'lucide-react';

/**
 * Opens the front-facing camera and shows a live preview. Unlike
 * QRCodeScanner, this does not loop/auto-detect — it just keeps the stream
 * open and hands the live <video> element to `onCapture` whenever the
 * caller clicks the capture button (or calls it externally via captureRef).
 * The parent runs face-api.js extraction on that video element — this
 * component knows nothing about faces.
 *
 * Usage:
 *   <FaceCameraCapture
 *     className="w-full aspect-video rounded-2xl object-cover"
 *     buttonLabel="Capture Photo"
 *     busy={submitting}
 *     onCapture={(videoEl) => extractSingleDescriptor(videoEl).then(...)}
 *   />
 */
export default function FaceCameraCapture({ onCapture, buttonLabel = 'Capture', className = '', busy = false }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false,
        });
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
          setError(
            err?.name === 'NotAllowedError'
              ? 'Camera access was denied. Please allow camera access to use Face ID.'
              : 'Could not access the camera on this device.'
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

  if (error) {
    return (
      <div className={className}>
        <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-center px-3 text-red-500">
          <AlertCircle className="w-6 h-6" />
          <span className="text-xs">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <video ref={videoRef} playsInline muted className={className} />
      <button
        type="button"
        onClick={() => onCapture(videoRef.current)}
        disabled={!ready || busy}
        className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium disabled:opacity-50"
      >
        {busy ? 'Processing…' : buttonLabel}
      </button>
    </div>
  );
}
