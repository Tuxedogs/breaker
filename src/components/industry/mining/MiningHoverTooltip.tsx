import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { createPortal } from "react-dom";

type TooltipAlign = "center" | "end";

export function useMiningHoverTooltip(
  label: string,
  options?: {
    delayMs?: number;
    align?: TooltipAlign;
  },
) {
  const delayMs = options?.delayMs ?? 560;
  const align = options?.align ?? "center";
  const tooltipId = useId();
  const openTimerRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [triggerElement, setTriggerElement] = useState<HTMLElement | null>(null);
  const [tooltipElement, setTooltipElement] = useState<HTMLDivElement | null>(null);

  const clearOpenTimer = useCallback(() => {
    if (openTimerRef.current !== null && typeof window !== "undefined") {
      window.clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
  }, []);

  const closeTooltip = useCallback(() => {
    clearOpenTimer();
    setOpen(false);
  }, [clearOpenTimer]);

  const openTooltip = useCallback(() => {
    clearOpenTimer();
    setOpen(true);
  }, [clearOpenTimer]);

  const scheduleOpen = useCallback(() => {
    if (typeof window === "undefined") return;
    clearOpenTimer();
    openTimerRef.current = window.setTimeout(() => {
      setOpen(true);
      openTimerRef.current = null;
    }, delayMs);
  }, [clearOpenTimer, delayMs]);

  useEffect(() => () => clearOpenTimer(), [clearOpenTimer]);

  useEffect(() => {
    if (!open || !triggerElement || typeof window === "undefined") return;

    const updatePosition = () => {
      const rect = triggerElement.getBoundingClientRect();
      const tooltipWidth = tooltipElement?.offsetWidth ?? 96;
      const tooltipHeight = tooltipElement?.offsetHeight ?? 30;
      const gutter = 10;
      const padding = 12;
      const unclampedLeft = align === "end"
        ? rect.right - tooltipWidth
        : rect.left + rect.width / 2 - tooltipWidth / 2;
      const left = Math.min(
        Math.max(padding, unclampedLeft),
        Math.max(padding, window.innerWidth - tooltipWidth - padding),
      );
      const preferredTop = rect.top - tooltipHeight - gutter;
      const top = preferredTop >= padding
        ? preferredTop
        : Math.min(window.innerHeight - tooltipHeight - padding, rect.bottom + gutter);
      setPosition({ top, left });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [align, open, tooltipElement, triggerElement]);

  const tooltip = open && typeof document !== "undefined" && position
    ? createPortal(
      <div
        ref={setTooltipElement}
        id={tooltipId}
        className="mine-hover-tooltip"
        role="tooltip"
        style={{ top: `${position.top}px`, left: `${position.left}px` }}
      >
        {label}
      </div>,
      document.body,
    )
    : null;

  return {
    open,
    tooltipId,
    tooltip,
    triggerProps: {
      onMouseEnter: (event: MouseEvent<HTMLElement>) => {
        setTriggerElement(event.currentTarget);
        scheduleOpen();
      },
      onMouseLeave: closeTooltip,
      onFocus: (event: FocusEvent<HTMLElement>) => {
        setTriggerElement(event.currentTarget);
        openTooltip();
      },
      onBlur: closeTooltip,
      onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
        if (event.key === "Escape") closeTooltip();
      },
    },
  };
}
