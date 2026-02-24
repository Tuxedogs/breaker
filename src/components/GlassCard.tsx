import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";

type GlassCardProps = {
  accentColor: string;
  accentSoft: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaTo: string;
  centerBloom?: boolean;
  centeredHeader?: boolean;
  showHeaderMarker?: boolean;
  shipsStyle?: boolean;
  dimmed?: boolean;
  children: ReactNode;
};

export default function GlassCard({
  accentColor,
  accentSoft,
  title,
  subtitle,
  ctaLabel,
  ctaTo,
  centerBloom = false,
  centeredHeader = false,
  showHeaderMarker = false,
  shipsStyle = false,
  dimmed = false,
  children,
}: GlassCardProps) {
  const accentStyle = {
    "--accent": accentColor,
    "--accent-soft": accentSoft,
    outlineColor: "color-mix(in srgb, var(--accent-soft) 88%, rgba(255,255,255,0.22) 12%)",
    boxShadow:
      "0 0 0 11px rgba(0,0,0,0.98), 0 10px 24px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(255,255,255,0.1), 0 24px 58px rgba(0,0,0,0.5)",
  } as CSSProperties;

  return (
    <article
      style={accentStyle}
      className={[
        "glass-accent-card group relative flex h-full flex-col overflow-hidden rounded-[2rem] p-6 sm:p-7",
        // richer base: darker glass so glow has contrast
        "bg-slate-950/42 backdrop-blur-2xl",
        // secondary outer frame with dark moat
        "outline outline-2 outline-offset-[8px]",
        // motion
        "transition-all duration-300 ease-out hover:-translate-y-1",
        dimmed ? "brightness-[0.58] saturate-75" : "brightness-100",
      ].join(" ")}
    >
      {shipsStyle ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            background:
              "radial-gradient(2px 2px at 14% 22%, rgba(255,255,255,0.10), transparent 70%), " +
              "radial-gradient(1px 1px at 70% 38%, color-mix(in srgb, var(--accent-soft) 75%, rgba(255,255,255,0.12) 25%), transparent 70%), " +
              "radial-gradient(1px 1px at 28% 64%, rgba(255,255,255,0.10), transparent 70%), " +
              "radial-gradient(1px 1px at 84% 78%, color-mix(in srgb, var(--accent-soft) 70%, rgba(255,255,255,0.1) 30%), transparent 70%)",
            backgroundSize: "220px 220px, 280px 280px, 260px 260px, 300px 300px",
          }}
        />
      ) : null}

      {/* Base interior tint: controls how much accent color mixes with background through the glass */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.2]"
        style={{ backgroundColor: "var(--accent)" }}
      />

      {/* Accent wash across panel (adds "rich color" inside the glass) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.24]"
        style={{
          background:
            `radial-gradient(105% 82% at ${centerBloom ? "50% 14%" : "20% 12%"}, var(--accent-soft) 0%, rgba(0,0,0,0) 48%),` +
            "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0.65) 100%)",
        }}
      />

      {/* Big ambient bloom (soft, wide) */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-12 opacity-[0.35]"
        style={{
          background:
            `radial-gradient(46% 36% at ${centerBloom ? "50% 14%" : "16% 12%"}, var(--accent-soft) 0%, rgba(0,0,0,0) 62%),` +
            "radial-gradient(45% 40% at 88% 22%, rgba(255,255,255,0.10) 0%, rgba(0,0,0,0) 60%)",
          filter: "blur(14px)",
        }}
      />

      {/* Top accent rail (crisp + bright like the reference) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-8 top-[11px] h-[3px] rounded-full opacity-85"
        style={{
          background: "linear-gradient(90deg, rgba(0,0,0,0), var(--accent), rgba(0,0,0,0))",
          boxShadow: "0 0 6px 1px var(--accent-soft), 0 0 14px 2px var(--accent-soft)",
        }}
      />

      {/* Rim + edge glow (tighter, brighter, less fog) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[2rem] opacity-90"
        style={{
          boxShadow:
            // inner rim
            "0 0 0 1px rgba(255,255,255,0.14) inset, " +
            // neutral rim at rest
            "0 0 0 1px rgba(255,255,255,0.18) inset, " +
            // depth shadow for lift
            "0 28px 90px -20px rgba(0,0,0,0.9)",
        }}
      />
      {shipsStyle ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[2rem] opacity-90"
          style={{
            boxShadow:
              "0 0 0 1px color-mix(in srgb, var(--accent-soft) 58%, rgba(255,255,255,0.22) 42%) inset, " +
              "0 0 22px 2px rgba(255, 181, 70, 0.22)",
          }}
        />
      ) : null}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[2rem] opacity-100"
        style={{
          boxShadow:
            "0 0 0 1px color-mix(in srgb, var(--accent-soft) 60%, rgba(255,255,255,0.25) 40%) inset, " +
            "0 0 22px 2px var(--accent-soft), " +
            // depth shadow for lift
            "0 30px 90px -25px rgba(0,0,0,0.9)",
        }}
      />
      {shipsStyle ? (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute left-0 top-0 h-16 w-16 rounded-tl-3xl opacity-80"
            style={{
              boxShadow: "inset 2px 2px 0 0 color-mix(in srgb, var(--accent) 70%, white 30%)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute right-0 top-0 h-16 w-16 rounded-tr-3xl opacity-80"
            style={{
              boxShadow: "inset -2px 2px 0 0 color-mix(in srgb, var(--accent) 70%, white 30%)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute bottom-0 left-0 h-16 w-16 rounded-bl-3xl opacity-80"
            style={{
              boxShadow: "inset 2px -2px 0 0 color-mix(in srgb, var(--accent) 70%, white 30%)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute bottom-0 right-0 h-16 w-16 rounded-br-3xl opacity-80"
            style={{
              boxShadow: "inset -2px -2px 0 0 color-mix(in srgb, var(--accent) 70%, white 30%)",
            }}
          />
        </>
      ) : null}

      {/* Top sheen to sell "glass" */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-24 opacity-65"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.05) 40%, rgba(255,255,255,0) 100%)",
        }}
      />

      {/* Content */}
      <header className={`relative z-10 pb-5 ${centeredHeader ? "text-center" : ""}`}>
        {showHeaderMarker ? (
          <div
            className="mx-auto mb-3 h-8 w-8 rounded-sm bg-white"
            style={
              shipsStyle
                ? {
                    boxShadow:
                      "0 0 0 2px rgba(0,0,0,0.55), 0 0 10px color-mix(in srgb, var(--accent-soft) 70%, white 30%)",
                  }
                : undefined
            }
          />
        ) : null}
        <h2
          className="title-font text-3xl tracking-[0.2em] sm:text-4xl"
          style={{
            color: "color-mix(in srgb, var(--accent) 86%, white 14%)",
            textShadow: "0 0 20px rgba(0,0,0,0.55)",
          }}
        >
          {title}
        </h2>
        <p
          className="mt-2 text-sm uppercase tracking-[0.18em]"
          style={{ color: "color-mix(in srgb, var(--accent) 74%, white 26%)" }}
        >
          {subtitle}
        </p>
      </header>

      {/* Ensure CTA pins cleanly and lists can grow */}
      <div className="relative z-10 flex-1 min-h-0">
        <div className="flex flex-col justify-start">
          {children}
        </div>
      </div>

      <div aria-hidden className="h-5 opacity-0" />

      <div className="relative z-10 mt-auto px-1 pt-4">
        <Link
          to={ctaTo}
          className={`accent-cta group/cta relative block w-full overflow-hidden px-8 py-3 text-center text-sm font-bold uppercase tracking-[0.2em] sm:text-base ${shipsStyle ? "rounded-lg" : "rounded-xl"}`}
          style={{
            boxShadow: shipsStyle
              ? "0 0 0 1px color-mix(in srgb, var(--accent) 65%, rgba(255,255,255,0.28) 35%) inset, 0 0 0 1px rgba(0,0,0,0.42)"
              : "0 0 0 1px rgba(255,255,255,0.2) inset",
            background: shipsStyle
              ? "linear-gradient(180deg, color-mix(in srgb, var(--accent) 28%, rgba(8,11,20,0.94) 72%) 0%, color-mix(in srgb, var(--accent) 16%, rgba(3,4,8,0.96) 84%) 100%)"
              : "linear-gradient(180deg, color-mix(in srgb, var(--accent) 24%, rgba(8,12,24,0.92) 76%) 0%, rgba(2,5,11,0.95) 100%)",
          }}
        >
          {/* CTA glow wash */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-xl opacity-35 transition-opacity duration-300 group-hover/cta:opacity-60"
            style={{
              background:
                "radial-gradient(70% 120% at 50% 0%, var(--accent-soft) 0%, rgba(0,0,0,0) 60%)",
            }}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute -left-1/3 top-0 h-full w-1/3 -skew-x-12 bg-white/25 opacity-0 blur-md transition-all duration-500 group-hover/cta:left-[110%] group-hover/cta:opacity-70"
          />
          <span className="relative z-10 inline-flex items-center gap-2">
            {ctaLabel}
            <span className="transition-transform duration-300 group-hover/cta:translate-x-1">{">"}</span>
          </span>
        </Link>
      </div>
    </article>
  );
}
