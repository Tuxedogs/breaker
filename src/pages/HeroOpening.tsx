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
  const [isExiting, setIsExiting] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  const moveToFramework = useCallback(() => {
    if (isNavigatingRef.current) return;

    isNavigatingRef.current = true;
    sessionStorage.setItem(ENTRY_STORAGE_KEY, "true");
    setIsExiting(true);

    window.setTimeout(() => {
      navigate("/framework");
    }, 260);
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
    <section
      className={`hero-transition min-h-[calc(100vh-7.5rem)] items-center lg:grid lg:grid-cols-[1fr_1fr] lg:gap-8 ${isExiting ? "hero-transition-exit" : ""}`}
    >
      <div className="max-w-xl">
        <p className="title-font text-xs uppercase tracking-[0.3em] text-slate-300">Field Manual v1.0</p>
        <h1 className="title-font mt-4 text-4xl leading-tight text-white sm:text-5xl lg:text-6xl">
          A DOCTRINE-FIRST FRAMEWORK
        </h1>
        <p className="title-font mt-4 text-xl uppercase tracking-[0.18em] text-slate-300 sm:text-2xl">
          FOR MULTI-CREW COMBAT
        </p>

        <button
          type="button"
          onClick={moveToFramework}
          className="mt-10 rounded-xl border border-amber-200/60 bg-amber-300/12 px-7 py-3 text-sm uppercase tracking-[0.22em] text-amber-100 transition hover:-translate-y-0.5 hover:bg-amber-300/20"
        >
          Enter
        </button>
      </div>

      <div className="mt-10 lg:mt-0">
        <div className="hero-art-slot h-[48vh] min-h-[360px] rounded-3xl border border-white/18 bg-white/5 backdrop-blur-sm" />
      </div>
    </section>
  );
}
