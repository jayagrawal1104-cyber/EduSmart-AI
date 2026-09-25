import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { AlertCircle } from 'lucide-react';

/**
 * Opens the device camera and decodes QR codes from the live feed using
 * jsQR. Calls `onScan(text)` once with the decoded string as soon as a QR
 * code is found (the parent is responsible for unmounting/hiding the
 * scanner after that — this component does not loop after a successful
 * scan).
 *
 * Usage:
 *   {scanning && (
 *     <QRCodeScanner
 *       className="w-full h-full rounded-2xl object-cover"
 *       onScan={(text) => { setCode(text); setScanning(false); }}
 *     />
 *   )}
 */
export default function QRCodeScanner({ onScan, className = '' }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const scannedRef = useRef(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    function tick() {
      const video = videoRef.current;
      if (!video || cancelled) return;

      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const result = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });

        if (result && result.data && !scannedRef.current) {
          scannedRef.current = true;
          onScan(result.data.trim());
          return; // stop the scan loop — parent should hide/unmount us now
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
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
        rafRef.current = requestAnimationFrame(tick);
      } catch (err) {
        if (!cancelled) {
          setError(
            err?.name === 'NotAllowedError'
              ? 'Camera access was denied. Please allow camera access, or enter the code manually.'
              : 'Could not access the camera on this device. Please enter the code manually.'
          );
        }
      }
    }

    start();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  return <video ref={videoRef} playsInline muted className={className} />;
}