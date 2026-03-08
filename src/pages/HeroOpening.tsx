import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import SectionHubCard from "../components/SectionHubCard";

const ENTRY_STORAGE_KEY = "ares:entered-framework";

type HeroOpeningProps = {
  autoAdvance?: boolean;
  autoAdvanceDelayMs?: number;
};

export default function HeroOpening({ autoAdvance = false, autoAdvanceDelayMs = 1200 }: HeroOpeningProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isNavigatingRef = useRef(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  const moveToFramework = useCallback(() => {
    if (isNavigatingRef.current) return;

    isNavigatingRef.current = true;
    sessionStorage.setItem(ENTRY_STORAGE_KEY, "true");
    navigate("/framework");
  }, [navigate]);

  useEffect(() => {
    if (!autoAdvance) return;

    const markInteracted = () => setHasInteracted(true);
    window.addEventListener("pointermove", markInteracted, { once: true });
    window.addEventListener("keydown", markInteracted, { once: true });
    window.addEventListener("wheel", markInteracted, { once: true });

    return () => {
      window.removeEventListener("pointermove", markInteracted);
      window.removeEventListener("keydown", markInteracted);
      window.removeEventListener("wheel", markInteracted);
    };
  }, [autoAdvance]);

  useEffect(() => {
    if (!autoAdvance || hasInteracted) return;

    const timerId = window.setTimeout(() => {
      moveToFramework();
    }, autoAdvanceDelayMs);

    return () => window.clearTimeout(timerId);
  }, [autoAdvance, autoAdvanceDelayMs, hasInteracted, moveToFramework]);

  return (
    <section className="hero-transition relative left-[calc(50%-50vw)] flex min-h-[calc(100vh-7.5rem)] w-screen items-center justify-start overflow-hidden px-0 py-4 sm:py-6">
      <div className="relative z-10 w-full px-3 sm:px-5 lg:px-8 xl:px-10 translate-x-[6vw]">
        <div className="max-w-[72rem]">
          <p className="title-font text-xs uppercase tracking-[0.34em] text-cyan-100/75">Field Manual v2.0</p>
          <h1 className="title-font mt-4 text-4xl leading-[0.95] text-white sm:text-5xl lg:text-7xl">
            Not that button,
            <br />
            <span className="hero-trend-gradient-text">that button.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base text-slate-200/85 sm:text-lg">
            Onboarding to Ship Boarding.
          </p>

          <div className="mt-10 max-w-4xl">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <SectionHubCard
                title="Onboarding"
                subtitle="Systems, maps, and operational guides"
                href="/wip/onboarding"
                accentColor="#60f2ff"
                isActive={pathname.startsWith("/wip/onboarding")}
                icon={(
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="section-hub-icon">
                    <path d="M5.5 8.5L12 5l6.5 3.5v5.5c0 2.9-2 5.7-6.5 7-4.5-1.3-6.5-4.1-6.5-7V8.5z" />
                    <path d="M9.5 12.5a2.5 2.5 0 1 1 5 0v1.5h-5v-1.5z" />
                  </svg>
                )}
              />
              <SectionHubCard
                title="Framework"
                subtitle="Entry point for systems, ships, and doctrine lanes"
                href="/framework"
                accentColor="#a78bfa"
                isActive={pathname === "/framework"}
                icon={(
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="section-hub-icon">
                    <path d="M5 6.5h14M5 12h14M5 17.5h14" />
                    <circle cx="8" cy="6.5" r="1.5" />
                    <circle cx="12" cy="12" r="1.5" />
                    <circle cx="16" cy="17.5" r="1.5" />
                  </svg>
                )}
              />
            </div>
            <div className="mt-5 flex justify-center md:w-1/2 md:translate-x-1/2">
              <div className="w-full max-w-[22rem]">
                <SectionHubCard
                  title="Maps"
                  subtitle="Deck views, overlays, and ship reference layouts"
                  href="/maps"
                  accentColor="#f59e0b"
                  isActive={pathname.startsWith("/maps")}
                  icon={(
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="section-hub-icon">
                      <path d="M4.5 6.5l5-2 5 2 5-2v13l-5 2-5-2-5 2v-13z" />
                      <path d="M9.5 4.5v13M14.5 6.5v13" />
                    </svg>
                  )}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
