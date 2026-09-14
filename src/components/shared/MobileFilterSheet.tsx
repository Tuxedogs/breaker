import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

type MobileFilterSheetProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
};

export default function MobileFilterSheet({ open, title, onClose, children, footer }: MobileFilterSheetProps) {
  const titleId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const controls = sheetRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])',
      );
      if (!controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.classList.add("mobile-filter-sheet-open");
    const frame = requestAnimationFrame(() => sheetRef.current?.querySelector<HTMLElement>("button, input")?.focus());
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      document.body.classList.remove("mobile-filter-sheet-open");
      previousFocus?.focus();
    };
  }, [onClose, open]);

  if (!open) return null;

  return createPortal((
    <div className="mobile-filter-shell is-open">
      <button type="button" className="mobile-filter-backdrop" aria-label={`Close ${title}`} onClick={onClose} />
      <div ref={sheetRef} className="mobile-filter-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="mobile-filter-sheet__header">
          <span className="mobile-filter-sheet__handle" aria-hidden="true" />
          <h2 id={titleId}>{title}</h2>
          <button type="button" onClick={onClose} aria-label={`Close ${title}`}>×</button>
        </header>
        <div className="mobile-filter-sheet__body">{children}</div>
        {footer ? <footer className="mobile-filter-sheet__footer">{footer}</footer> : null}
      </div>
    </div>
  ), document.body);
}
