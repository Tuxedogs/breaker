import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

const ENTRY_STORAGE_KEY = "ares:entered-framework";

type HeroOpeningProps = {
  autoAdvance?: boolean;
  autoAdvanceDelayMs?: number;
};

type SequencePhase =
  | "hidden"
  | "stack"
  | "swap-in"
  | "page-hold"
  | "swap-back"
  | "spin-out"
  | "spin-return"
  | "done";

export default function HeroOpening({ autoAdvance = false, autoAdvanceDelayMs = 1200 }: HeroOpeningProps) {
  const navigate = useNavigate();
  const isNavigatingRef = useRef(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [phase, setPhase] = useState<SequencePhase>("hidden");
  const [imageIndex, setImageIndex] = useState(0);
  const [isSequenceComplete, setIsSequenceComplete] = useState(false);

  const deckImages = ["/images/bg-states/micropreview.png", "/images/bg-states/micropreview.png"];
  const deckPreviewA = "/images/bg-states/shrug.png";
  const deckPreviewB = "/images/bg-states/idrishero.png";
  const briefingPreview = "/images/bg-states/shrug.png";

  const moveToFramework = useCallback(() => {
    if (isNavigatingRef.current) return;

    isNavigatingRef.current = true;
    sessionStorage.setItem(ENTRY_STORAGE_KEY, "true");
    navigate("/framework");
  }, [navigate]);

  useEffect(() => {
    const timers: number[] = [];

    timers.push(window.setTimeout(() => setPhase("stack"), 120));
    timers.push(window.setTimeout(() => setPhase("spin-out"), 620));
    timers.push(window.setTimeout(() => setPhase("swap-in"), 1180));
    timers.push(window.setTimeout(() => setPhase("page-hold"), 1760));
    timers.push(window.setTimeout(() => setPhase("swap-back"), 3760));
    timers.push(window.setTimeout(() => setPhase("spin-return"), 4220));
    timers.push(window.setTimeout(() => setImageIndex(1), 4460));
    timers.push(window.setTimeout(() => setPhase("done"), 4780));
    timers.push(window.setTimeout(() => setIsSequenceComplete(true), 4840));

    return () => timers.forEach((id) => window.clearTimeout(id));
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
    if (!autoAdvance || hasInteracted || !isSequenceComplete) return;

    const timerId = window.setTimeout(() => {
      moveToFramework();
    }, autoAdvanceDelayMs);

    return () => window.clearTimeout(timerId);
  }, [autoAdvance, autoAdvanceDelayMs, hasInteracted, isSequenceComplete, moveToFramework]);

  const imageX =
    phase === "spin-out" || phase === "swap-in" || phase === "page-hold"
      ? -320
      : phase === "spin-return" || phase === "done"
        ? 14
      : 0;
  const imageY = 0;
  const imageScale = 1;
  const imageRotation =
    phase === "spin-out" || phase === "swap-in" || phase === "page-hold" || phase === "swap-back"
      ? -360
      : phase === "spin-return" || phase === "done"
        ? 540
        : 0;
  const imageZ =
    phase === "stack" || phase === "spin-out"
      ? 6
      : phase === "swap-in" || phase === "page-hold" || phase === "swap-back" || phase === "spin-return" || phase === "done"
        ? 1
        : 6;

  const pageX = phase === "swap-in" || phase === "page-hold" ? 280 : 620;

  return (
    <section className="hero-transition flex min-h-[calc(100vh-7.5rem)] items-center justify-center">
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center px-4 py-10">
        <div className="relative h-[430px] w-[430px]">
          <div className="absolute left-1/2 top-1/2 h-[320px] w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-[40%_56%_46%_58%/54%_42%_58%_46%] bg-black blur-xl" />

          <div
            className="absolute left-1/2 top-1/2 h-[250px] w-[250px] border border-slate-200/30 bg-black"
            style={{
              opacity: phase === "hidden" ? 0 : 1,
              transform: "translate(-50%, -50%) translate(-10px, 8px) rotate(-40deg)",
              borderRadius: "64px",
              overflow: "hidden",
              zIndex: 2,
              transition: "opacity 320ms ease",
            }}
          >
            <img src={deckPreviewA} alt="Ship preview" className="absolute inset-0 h-full w-full object-cover" />
          </div>
          <div
            className="absolute left-1/2 top-1/2 h-[250px] w-[250px] border border-slate-200/35 bg-black"
            style={{
              opacity: phase === "hidden" ? 0 : 1,
              transform: "translate(-50%, -50%) translate(-6px, 4px) rotate(-20deg)",
              borderRadius: "64px",
              overflow: "hidden",
              zIndex: 3,
              transition: "opacity 320ms ease",
            }}
          >
            <img src={deckPreviewB} alt="Systems preview" className="absolute inset-0 h-full w-full object-cover" />
          </div>

          <div
            className="absolute left-1/2 top-1/2 h-[250px] w-[250px] overflow-hidden border border-cyan-200/40 bg-black shadow-[0_16px_36px_rgba(0,0,0,0.35)]"
            style={{
              opacity: phase === "hidden" ? 0 : 1,
              transform: `translate(-50%, -50%) translateX(${imageX}px) translateY(${imageY}px) scale(${imageScale}) rotate(${imageRotation}deg)`,
              borderRadius: "64px",
              zIndex: imageZ,
              transition:
                phase === "spin-out" || phase === "spin-return"
                  ? "transform 560ms cubic-bezier(0.16,0.84,0.32,1), opacity 300ms ease"
                  : "transform 420ms cubic-bezier(0.16,0.84,0.32,1), opacity 300ms ease",
            }}
          >
            <img
              src={deckImages[imageIndex]}
              alt="Hero preview"
              className="absolute inset-0 h-full w-full object-cover"
              style={{ transform: "scale(3)", transformOrigin: "center center" }}
            />
            <div className="absolute inset-[11%] rounded-full border border-white/18 bg-black/20" />
          </div>

          <div
            className="absolute left-1/2 top-1/2 h-[750px] w-[750px] border border-transparent bg-transparent p-5 text-transparent"
            style={{
              opacity: phase === "swap-in" || phase === "page-hold" || phase === "swap-back" ? 1 : 0,
              transform:
                phase === "swap-in"
                  ? `translate(-50%, -50%) translateX(${pageX}px) perspective(900px) rotateY(-18deg) scaleX(0.88)`
                  : phase === "swap-back"
                    ? `translate(-50%, -50%) translateX(${pageX}px) perspective(900px) rotateY(16deg) scaleX(0.9)`
                    : `translate(-50%, -50%) translateX(${pageX}px) perspective(900px) rotateY(0deg) scaleX(1)`,
              clipPath:
                phase === "swap-in"
                  ? "inset(0 22% 0 0 round 64px)"
                  : phase === "swap-back"
                    ? "inset(0 0 0 22% round 64px)"
                    : "inset(0 0 0 0 round 64px)",
              borderRadius: "64px",
              transformOrigin: "right center",
              zIndex: 5,
              transition:
                "transform 440ms cubic-bezier(0.16,0.84,0.32,1), opacity 280ms ease, clip-path 440ms cubic-bezier(0.16,0.84,0.32,1)",
            }}
          >
            <div className="h-full w-full overflow-hidden rounded-[34px] border border-transparent bg-transparent">
              <div
                className="origin-top-left"
                style={{
                  transform: "scale(0.3)",
                  width: "333.333%",
                  height: "333.333%",
                }}
              >
                <div className="relative h-full w-full overflow-hidden rounded-[24px] border border-transparent bg-transparent">
                  <img src={briefingPreview} alt="Next page preview" className="absolute inset-0 h-full w-full object-cover" />
                  <div className="absolute left-10 top-10">
                    <p className="title-font text-xl uppercase tracking-[0.26em] text-transparent">Systems Preview</p>
                    <p className="mt-3 max-w-[520px] text-base text-transparent">
                      Sub-Targeting, Keybinds, and Additional Settings.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          className="mt-10 text-center transition-opacity duration-500 ease-out"
          style={{ opacity: isSequenceComplete ? 1 : 0 }}
        >
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
            className="mt-10 rounded-xl border border-amber-400/90 bg-amber-300/12 px-7 py-3 text-sm uppercase tracking-[0.22em] text-amber-100 transition hover:-translate-y-0.5 hover:bg-amber-300/20"
          >
            Enter
          </button>
        </div>
      </div>
    </section>
  );
}
