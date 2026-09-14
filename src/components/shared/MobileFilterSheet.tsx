import { useEffect, useId, useRef, type ReactNode } from "react";

type MobileFilterSheetProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

/** A responsive wrapper: ordinary in-flow content on desktop and an accessible
 * bottom sheet at the shared compact breakpoint. */
export default function MobileFilterSheet({
  open,
  title,
  onClose,
  children,
  footer,
  className = "",
}: MobileFilterSheetProps) {
  const titleId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const controls = sheetRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])',
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
    const frame = requestAnimationFrame(() => sheetRef.current?.querySelector<HTMLElement>("button, input, select")?.focus());
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [onClose, open]);

  return (
    <div className={`mobile-filter-shell${open ? " is-open" : ""}${className ? ` ${className}` : ""}`}>
      <button type="button" className="mobile-filter-backdrop" aria-label={`Close ${title}`} onClick={onClose} />
      <div
        ref={sheetRef}
        className="mobile-filter-sheet"
        role={open ? "dialog" : undefined}
        aria-modal={open ? "true" : undefined}
        aria-labelledby={open ? titleId : undefined}
      >
        <header className="mobile-filter-sheet__header">
          <span className="mobile-filter-sheet__handle" aria-hidden="true" />
          <h2 id={titleId}>{title}</h2>
          <button type="button" onClick={onClose} aria-label={`Close ${title}`}>Close</button>
        </header>
        <div className="mobile-filter-sheet__body">{children}</div>
        {footer ? <footer className="mobile-filter-sheet__footer">{footer}</footer> : null}
      </div>
    </div>
  );
}
