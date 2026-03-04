import { Link } from "react-router-dom";
import type { CSSProperties } from "react";

export type RoutingCardIcon = "pilot" | "crew" | "threat" | "recovery";
export type RoutingCardCtaVariant = "pilot" | "crew" | "threat" | "soon";

type RoutingCardProps = {
  title: string;
  subtitle: string;
  actionLabel: string;
  to: string;
  icon: RoutingCardIcon;
  ctaVariant: RoutingCardCtaVariant;
  disabled?: boolean;
  isActive?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onFocusCapture?: () => void;
  onBlurCapture?: () => void;
};

function EntryVectorIcon({ kind }: { kind: RoutingCardIcon }) {
  const baseClass = "h-12 w-12 md:h-14 md:w-14 lg:h-16 lg:w-16";
  const strokeProps = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (kind === "pilot") {
    return (
      <svg viewBox="0 0 24 24" className={baseClass} aria-hidden>
        <path {...strokeProps} d="M12 2.8v5.4M12 15.8v5.4M4.2 12h5.4M14.4 12h5.4" />
        <path {...strokeProps} d="M12 6.2l6.9 5.8L12 17.8 5.1 12 12 6.2z" />
        <path {...strokeProps} d="M12 9.4l3.1 2.6-3.1 2.6-3.1-2.6L12 9.4z" />
        <path {...strokeProps} d="M7.2 7.9l-1.6-2.4M16.8 7.9l1.6-2.4" />
      </svg>
    );
  }

  if (kind === "crew") {
    return (
      <svg viewBox="0 0 24 24" className={baseClass} aria-hidden>
        <circle cx="12" cy="12" r="7.6" {...strokeProps} />
        <circle cx="12" cy="12" r="3.1" {...strokeProps} />
        <path {...strokeProps} d="M12 2.8v3.1M12 18.1v3.1M2.8 12h3.1M18.1 12h3.1" />
        <path {...strokeProps} d="M5.3 5.3l2.2 2.2M16.5 16.5l2.2 2.2M18.7 5.3l-2.2 2.2M7.5 16.5l-2.2 2.2" />
      </svg>
    );
  }

  if (kind === "threat") {
    return (
      <svg viewBox="0 0 24 24" className={baseClass} aria-hidden>
        <path {...strokeProps} d="M12 3.2a8.8 8.8 0 0 1 8.8 8.8" />
        <path {...strokeProps} d="M12 6.4a5.6 5.6 0 0 1 5.6 5.6" />
        <path {...strokeProps} d="M12 9.6a2.4 2.4 0 0 1 2.4 2.4" />
        <path {...strokeProps} d="M4.2 18.6h5.2M4.2 21h9.3" />
        <circle cx="12" cy="12" r="1.6" {...strokeProps} />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className={baseClass} aria-hidden>
      <circle cx="8.3" cy="8.4" r="2.8" {...strokeProps} />
      <path {...strokeProps} d="M10.4 10.5l2.2 2.2M7.1 17.5l-2.6 2.6" />
      <path {...strokeProps} d="M13 7.2l1.4-1.4 2.8 2.8-1.4 1.4" />
      <path {...strokeProps} d="M11.1 9.1l4.7 4.7-3.9 3.9-4.7-4.7z" />
      <path {...strokeProps} d="M15.9 16.9l2.2 2.2M13.8 19l2.6 2.6" />
    </svg>
  );
}

const cardAccent: Record<RoutingCardCtaVariant, string> = {
  pilot: "#60f2ff",
  crew: "#3da9fc",
  threat: "#a78bfa",
  soon: "#f59e0b",
};

export default function RoutingCard({
  title,
  subtitle,
  actionLabel,
  to,
  icon,
  ctaVariant,
  disabled,
  isActive,
  onMouseEnter,
  onMouseLeave,
  onFocusCapture,
  onBlurCapture,
}: RoutingCardProps) {
  return (
    <article
      data-variant={ctaVariant}
      onMouseEnter={disabled ? undefined : onMouseEnter}
      onMouseLeave={disabled ? undefined : onMouseLeave}
      onFocusCapture={disabled ? undefined : onFocusCapture}
      onBlurCapture={disabled ? undefined : onBlurCapture}
      style={{ "--route-accent": cardAccent[ctaVariant] } as CSSProperties}
      className={[
        "entry-card group relative overflow-visible framework-modern-card framework-modern-card-systems framework-modern-card-compact rounded-[1.35rem] px-4 py-6 sm:px-5 sm:py-8 transition duration-200",
        isActive ? "is-active" : "",
        disabled ? "opacity-85 saturate-50" : "",
      ].join(" ")}
    >
      <div className="entry-card-glow pointer-events-none absolute inset-0 rounded-[1.35rem] opacity-0 transition-opacity duration-200" aria-hidden="true" />
      <div className="flex min-h-[340px] flex-1 flex-col items-center text-center">
        <div className="entry-icon-shell mt-2 inline-flex h-14 w-14 items-center justify-center rounded-full md:mt-4 md:h-16 md:w-16 lg:mt-6 lg:h-20 lg:w-20">
          <EntryVectorIcon kind={icon} />
        </div>

        <h2 className="title-font mt-8 text-2xl text-cyan-100">{title}</h2>
        {disabled ? (
          <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-amber-100/80">{"STATUS: Soon\u2122"}</p>
        ) : null}
        <p className="mt-4 text-sm font-normal text-slate-300/72">{subtitle}</p>

        <div className="mt-auto w-full pt-12">
          {disabled ? (
            <span
              aria-disabled="true"
              data-variant={ctaVariant}
              className="entry-cta framework-modern-cta mx-auto w-full max-w-[180px] cursor-not-allowed border-white/15 bg-white/5 text-slate-400"
            >
              {actionLabel}
            </span>
          ) : (
            <Link to={to} data-variant={ctaVariant} className="entry-cta framework-modern-cta mx-auto w-full max-w-[180px]">
              {actionLabel}
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
