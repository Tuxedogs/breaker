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
  const baseClass = "h-8 w-8 md:h-9 md:w-9 lg:h-11 lg:w-11";
  const strokeProps = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (kind === "pilot") {
    return (
      <svg viewBox="0 0 24 24" className={baseClass} aria-hidden>
        <path {...strokeProps} d="M3.5 12h17M12 3.5v17M5.5 6.5l13 11M18.5 6.5l-13 11" />
        <circle cx="12" cy="12" r="2.7" {...strokeProps} />
      </svg>
    );
  }

  if (kind === "crew") {
    return (
      <svg viewBox="0 0 24 24" className={baseClass} aria-hidden>
        <rect x="4.5" y="4.5" width="15" height="10.5" rx="1.8" {...strokeProps} />
        <path {...strokeProps} d="M12 8.2v5.6M9.2 11h5.6" />
        <path {...strokeProps} d="M8 19.2h8M9.2 15v4.2M14.8 15v4.2" />
      </svg>
    );
  }

  if (kind === "threat") {
    return (
      <svg viewBox="0 0 24 24" className={baseClass} aria-hidden>
        <path {...strokeProps} d="M4.5 12h15M12 4.5v15M6.2 6.2l11.6 11.6M17.8 6.2 6.2 17.8" />
        <circle cx="12" cy="12" r="7.5" {...strokeProps} />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className={baseClass} aria-hidden>
      <path {...strokeProps} d="M12 4v8.2M12 16.6v.1M6 6l12 12M18 6 6 18" />
      <circle cx="12" cy="12" r="8" {...strokeProps} />
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
