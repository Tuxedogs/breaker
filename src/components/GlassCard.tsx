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
        "glass-accent-card relative flex h-full flex-col overflow-hidden rounded-3xl p-6",
        // richer base: darker glass so glow has contrast
        "bg-black/40 backdrop-blur-2xl",
        // secondary outer frame with dark moat
        "outline outline-2 outline-offset-[9px]",
        // motion
        "transition-all duration-300 ease-out will-change-transform",
        "hover:-translate-y-1 hover:scale-[1.005]",
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
        className="pointer-events-none absolute inset-0 opacity-[0.045]"
        style={{ backgroundColor: "var(--accent)" }}
      />

      {/* Accent wash across panel (adds "rich color" inside the glass) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0"
        style={{
          background:
            `radial-gradient(105% 82% at ${centerBloom ? "50% 14%" : "20% 12%"}, var(--accent-soft) 0%, rgba(0,0,0,0) 48%),` +
            "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0.65) 100%)",
        }}
      />

      {/* Big ambient bloom (soft, wide) */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-12 opacity-0"
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
        className="pointer-events-none absolute inset-x-10 top-[10px] h-[3px] rounded-full opacity-0"
        style={{
          background: "linear-gradient(90deg, rgba(0,0,0,0), var(--accent), rgba(0,0,0,0))",
          boxShadow: "0 0 6px 1px var(--accent-soft), 0 0 14px 2px var(--accent-soft)",
        }}
      />

      {/* Rim + edge glow (tighter, brighter, less fog) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-3xl opacity-90"
        style={{
          boxShadow:
            // inner rim
            "0 0 0 1px rgba(255,255,255,0.14) inset, " +
            // neutral rim at rest (no accent glow)
            "0 0 0 1px rgba(255,255,255,0.1) inset, " +
            // depth shadow for lift
            "0 30px 90px -25px rgba(0,0,0,0.90)",
        }}
      />
      {shipsStyle ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-3xl opacity-70"
          style={{
            boxShadow:
              "0 0 0 1px color-mix(in srgb, var(--accent-soft) 58%, rgba(255,255,255,0.22) 42%) inset, " +
              "0 0 20px 2px rgba(255, 181, 70, 0.12)",
          }}
        />
      ) : null}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-3xl opacity-0"
        style={{
          boxShadow:
            "0 0 0 1px color-mix(in srgb, var(--accent-soft) 60%, rgba(255,255,255,0.25) 40%) inset, " +
            "0 0 18px 2px var(--accent-soft), " +
            // depth shadow for lift
            "0 30px 90px -25px rgba(0,0,0,0.90)",
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
            className="mx-auto mb-3 h-8 w-8 bg-white"
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
          className="title-font text-3xl tracking-[0.2em]"
          style={{
            color: "color-mix(in srgb, var(--accent) 86%, white 14%)",
            textShadow: "0 0 18px rgba(0,0,0,0.55)",
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

      <div className="relative z-10 mt-auto px-3 pt-3">
        <Link
          to={ctaTo}
          className={`accent-cta group/cta relative block w-full px-[80px] py-3 text-center text-lg font-bold uppercase tracking-[0.2em] transition-transform duration-300 hover:translate-y-[1px] ${shipsStyle ? "rounded-md" : "rounded-xl"}`}
          style={{
            boxShadow: shipsStyle
              ? "0 0 0 1px color-mix(in srgb, var(--accent) 65%, rgba(255,255,255,0.2) 35%) inset, 0 0 0 1px rgba(0,0,0,0.42)"
              : "0 0 0 1px rgba(255,255,255,0.06) inset",
            background: shipsStyle
              ? "linear-gradient(180deg, color-mix(in srgb, var(--accent) 22%, rgba(6,8,14,0.94) 78%) 0%, color-mix(in srgb, var(--accent) 14%, rgba(3,4,8,0.96) 86%) 100%)"
              : undefined,
          }}
        >
          {/* CTA glow wash */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300 group-hover/cta:opacity-35"
            style={{
              background:
                "radial-gradient(70% 120% at 50% 0%, var(--accent-soft) 0%, rgba(0,0,0,0) 60%)",
            }}
          />
          <span className="relative z-10">{ctaLabel}</span>
        </Link>
      </div>
    </article>
  );
}
