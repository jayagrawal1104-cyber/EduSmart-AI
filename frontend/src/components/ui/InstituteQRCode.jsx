import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { AlertCircle } from 'lucide-react';

/**
 * Renders a real, scannable QR code for the given `value` onto a <canvas>.
 * Exposes a ref API so parent components can grab the image for
 * download/print/share buttons:
 *
 *   const qrRef = useRef(null);
 *   <InstituteQRCode ref={qrRef} value={institutionCode} />
 *   qrRef.current.getDataURL()      // 'data:image/png;base64,...'
 *   qrRef.current.getCanvas()       // the underlying <canvas> element
 */
const InstituteQRCode = forwardRef(function InstituteQRCode({ value, size = 192, className = '' }, ref) {
  const canvasRef = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setError('');
    if (!value || !canvasRef.current) return;

    QRCode.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' },
    }).catch((err) => {
      if (!cancelled) setError(err.message || 'Could not generate QR code');
    });

    return () => {
      cancelled = true;
    };
  }, [value, size]);

  useImperativeHandle(ref, () => ({
    getDataURL(type = 'image/png') {
      return canvasRef.current ? canvasRef.current.toDataURL(type) : null;
    },
    getCanvas() {
      return canvasRef.current;
    },
  }));

  if (!value) {
    return (
      <div
        className={className}
        style={{ width: size, height: size }}
      >
        <div className="w-full h-full flex items-center justify-center text-xs text-slate-400 text-center px-2">
          No institute code available yet
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={className} style={{ width: size, height: size }}>
        <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-red-500 text-center px-2">
          <AlertCircle className="w-5 h-5" />
          <span className="text-xs">{error}</span>
        </div>
      </div>
    );
  }

  return <canvas ref={canvasRef} width={size} height={size} className={className} />;
});

export default InstituteQRCode;

/** Triggers a browser download of a data URL. */
export function downloadDataUrl(dataUrl, filename) {
  if (!dataUrl) return;
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Opens a print-friendly window containing just the QR image. */
export function printDataUrl(dataUrl, title = 'Institute QR Code') {
  if (!dataUrl) return;
  const win = window.open('', '_blank', 'width=420,height=520');
  if (!win) return;
  win.document.write(`
    <html>
      <head><title>${title}</title></head>
      <body style="margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;">
        <img src="${dataUrl}" style="width:280px;height:280px;" />
        <p style="margin-top:16px;color:#334155;">${title}</p>
        <script>
          window.onload = function () { window.print(); };
        </script>
      </body>
    </html>
  `);
  win.document.close();
}

/** Shares the QR image via the Web Share API when available, otherwise copies the value. */
export async function shareDataUrl(dataUrl, value, title = 'Institute QR Code') {
  try {
    if (navigator.share && dataUrl) {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], 'institute-qr-code.png', { type: blob.type });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ title, text: value, files: [file] });
        return;
      }
      await navigator.share({ title, text: value });
      return;
    }
  } catch {
    // fall through to clipboard fallback below
  }
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    // no-op — clipboard access can be blocked; nothing else we can do silently
  }
}