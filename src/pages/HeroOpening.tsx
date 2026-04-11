import type { CSSProperties } from "react";
import { Link } from "react-router-dom";

const aresCards = [
  {
    title: "Onboarding",
    desc: "Systems, maps, and operational guides",
    to: "/wip/onboarding",
    accent: "var(--accent-cyan)",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5.5 8.5L12 5l6.5 3.5v5.5c0 2.9-2 5.7-6.5 7-4.5-1.3-6.5-4.1-6.5-7V8.5z" />
        <path d="M9.5 12.5a2.5 2.5 0 1 1 5 0v1.5h-5v-1.5z" />
      </svg>
    ),
  },
  {
    title: "Framework",
    desc: "Entry point for systems, ships, and doctrine lanes",
    to: "/framework",
    accent: "var(--accent-violet)",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 6.5h14M5 12h14M5 17.5h14" />
        <circle cx="8" cy="6.5" r="1.5" />
        <circle cx="12" cy="12" r="1.5" />
        <circle cx="16" cy="17.5" r="1.5" />
      </svg>
    ),
  },
  {
    title: "Maps",
    desc: "Deck views, overlays, and ship reference layouts",
    to: "/maps",
    accent: "var(--accent-gold)",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4.5 6.5l5-2 5 2 5-2v13l-5 2-5-2-5 2v-13z" />
        <path d="M9.5 4.5v13M14.5 6.5v13" />
      </svg>
    ),
  },
  {
    title: "Armor Threshold Mapping",
    desc: "Compare weapon alpha against armor damage thresholds",
    to: "/tools/alpha-threshold",
    accent: "var(--accent-teal)",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 18.5h14" />
        <path d="M7.5 18.5v-5.5M12 18.5V8.5M16.5 18.5v-9" />
        <path d="M6 9.5l4-3 3 2 5-4" />
      </svg>
    ),
  },
] as const;

export default function HeroOpening() {
  return (
    <section className="hero-transition relative left-[calc(50%-50vw)] flex min-h-[calc(100vh-7.5rem)] w-screen items-center justify-start overflow-hidden px-0 py-4 sm:py-6">
      <div className="relative z-10 w-full px-3 sm:px-5 lg:px-8 xl:px-10 translate-x-[6vw]">
        <div className="max-w-[64rem]">
          <div className="ares-hero-block">
            <p className="fw-eyebrow">Field Manual v2.0</p>
            <h1 className="ares-title">
              Not that button,
              <br />
              <span className="ares-title-accent">that button.</span>
            </h1>
            <p className="fw-descriptor mt-4 max-w-xl">Onboarding to Ship Boarding.</p>

            <div className="ares-card-grid mt-6">
              {aresCards.map((card) => (
                <Link
                  key={card.to}
                  to={card.to}
                  className="ares-card"
                  style={{ "--ares-accent": card.accent } as CSSProperties}
                >
                  <div className="ares-card-icon">{card.icon}</div>
                  <div className="ares-card-body">
                    <h2 className="ares-card-title">{card.title}</h2>
                    <p className="ares-card-desc">{card.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
