import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

const ENTRY_STORAGE_KEY = "ares:entered-framework";

type HeroOpeningProps = {
  autoAdvance?: boolean;
  autoAdvanceDelayMs?: number;
};

export default function HeroOpening({ autoAdvance = false, autoAdvanceDelayMs = 1200 }: HeroOpeningProps) {
  const navigate = useNavigate();
  const isNavigatingRef = useRef(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const moveToFramework = useCallback(() => {
    if (isNavigatingRef.current) return;

    isNavigatingRef.current = true;
    sessionStorage.setItem(ENTRY_STORAGE_KEY, "true");
    navigate("/framework");
  }, [navigate]);

  useEffect(() => {
    const timerId = window.setTimeout(() => setIsReady(true), 1450);
    return () => window.clearTimeout(timerId);
  }, []);

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
    if (!autoAdvance || hasInteracted || !isReady) return;

    const timerId = window.setTimeout(() => {
      moveToFramework();
    }, autoAdvanceDelayMs);

    return () => window.clearTimeout(timerId);
  }, [autoAdvance, autoAdvanceDelayMs, hasInteracted, isReady, moveToFramework]);

  return (
    <section className="hero-transition relative flex min-h-[calc(100vh-7.5rem)] items-center justify-center overflow-hidden py-8">
      <div className="hero-trend-mesh absolute inset-0" />

      <div className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
        <div
          className={[
            "transition-all duration-700 ease-out",
            isReady ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
          ].join(" ")}
        >
          <p className="title-font text-xs uppercase tracking-[0.34em] text-cyan-100/75">Field Manual v2.0</p>
          <h1 className="title-font mt-4 text-4xl leading-[0.95] text-white sm:text-5xl lg:text-7xl">
            DOCTRINE-DRIVEN
            <br />
            <span className="hero-trend-gradient-text">MULTI-CREW FLOW</span>
          </h1>
          <p className="mt-5 max-w-xl text-base text-slate-200/85 sm:text-lg">
            Fast onboarding for ship roles, targeting discipline, and comms habits in one living playbook.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={moveToFramework}
              className="rounded-xl border border-cyan-200/55 bg-cyan-200/10 px-7 py-3 text-sm uppercase tracking-[0.22em] text-cyan-50 transition hover:-translate-y-0.5 hover:bg-cyan-200/20"
            >
              Enter Framework
            </button>
            <span className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.18em] text-slate-200/75 backdrop-blur-md">
              Systems + Ships
            </span>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[460px]">
          <div className="hero-trend-ring absolute left-1/2 top-1/2 h-[360px] w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-100/25" />
          <div className="hero-trend-ring hero-trend-ring-reverse absolute left-1/2 top-1/2 h-[290px] w-[290px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-100/20" />

          <div
            className={[
              "hero-trend-card relative overflow-hidden rounded-[2.2rem] border border-white/20 bg-black/35 p-3 shadow-[0_30px_80px_rgba(2,8,26,0.55)] backdrop-blur-xl transition-all duration-700",
              isReady ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0",
            ].join(" ")}
          >
            <div className="relative overflow-hidden rounded-[1.7rem] border border-white/20">
              <img
                src="/images/bg-states/idrishero.png"
                alt="Hero ship preview"
                className="hero-trend-image h-[360px] w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-950/10 to-slate-950/70" />
              <div className="absolute bottom-5 left-5 right-5 rounded-2xl border border-white/20 bg-slate-900/35 px-4 py-3 backdrop-blur-md">
                <p className="title-font text-[0.63rem] uppercase tracking-[0.26em] text-cyan-100/85">Live Playbook</p>
                <p className="mt-1 text-sm text-slate-100/90">Sub-targeting, keybinds, and ship doctrine synced.</p>
              </div>
            </div>
          </div>

          <div className="hero-trend-chip absolute -left-6 top-10 rounded-full border border-cyan-100/25 bg-cyan-100/10 px-3 py-1 text-[0.62rem] uppercase tracking-[0.18em] text-cyan-50/90 backdrop-blur-xl">
            Targeting
          </div>
          <div className="hero-trend-chip hero-trend-chip-delay absolute -right-5 bottom-14 rounded-full border border-amber-100/30 bg-amber-200/10 px-3 py-1 text-[0.62rem] uppercase tracking-[0.18em] text-amber-50/95 backdrop-blur-xl">
            Gunnery
          </div>
        </div>
      </div>
    </section>
  );
}
