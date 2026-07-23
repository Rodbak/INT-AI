import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  title: string;
  hint?: string;
  onClose: () => void;
  children: ReactNode;
}

/** A modal on desktop, a bottom sheet on phones. Closes on Esc or backdrop tap.
 *  Rendered through a portal to document.body so it sits above the fixed bottom
 *  nav on mobile (otherwise the app's stacking context traps it underneath). */
export default function BizSheet({ title, hint, onClose, children }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return createPortal(
    <div className="biz__overlay" onClick={onClose}>
      <div className="biz__sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <h2 className="biz__sheet-title">{title}</h2>
        {hint && <p className="biz__sheet-hint">{hint}</p>}
        {children}
      </div>
    </div>,
    document.body,
  );
}
