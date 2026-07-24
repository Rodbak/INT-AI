import { useEffect, useRef, useState } from 'react';
import './BarcodeScanner.css';

/**
 * Full-screen camera barcode scanner using the native BarcodeDetector API
 * (Chrome / Android). Calls onDetect with the first code found, then closes.
 * Falls back to a friendly message where the API isn't available.
 */
export default function BarcodeScanner({ onDetect, onClose }: { onDetect: (code: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let raf = 0;
    let cancelled = false;
    let stream: MediaStream | null = null;
    const Detector = (window as any).BarcodeDetector;
    if (!Detector) {
      setError('This phone or browser can’t scan with the camera. Type the code in the search box instead.');
      return;
    }
    const detector = new Detector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'] });

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        const v = videoRef.current;
        if (!v) return;
        v.srcObject = stream;
        await v.play();
        const scan = async () => {
          if (cancelled) return;
          try {
            const codes = await detector.detect(v);
            const val = codes && codes[0]?.rawValue;
            if (val) { onDetect(String(val)); return; }
          } catch { /* frame not ready — keep going */ }
          raf = requestAnimationFrame(scan);
        };
        raf = requestAnimationFrame(scan);
      } catch {
        setError('Could not open the camera. Please allow camera access and try again.');
      }
    })();

    return () => { cancelled = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); };
  }, [onDetect]);

  return (
    <div className="scanner" role="dialog" aria-label="Scan a barcode">
      <video ref={videoRef} className="scanner__video" playsInline muted />
      <div className="scanner__overlay">
        <div className="scanner__frame" />
        <div className="scanner__hint">{error || 'Point the camera at a barcode'}</div>
        <button className="scanner__close" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
