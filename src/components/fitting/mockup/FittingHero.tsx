import { useState, type ReactNode } from "react";
import type { HeroInspectView, ShipHeroAssetView } from "../../../lib/fitting/mockup/fittingMockupViewTypes";

function ShipHeroSilhouette() {
  return (
    <svg className="fm-hero-svg" viewBox="0 0 800 400" aria-hidden>
      <defs>
        <linearGradient id="fm-hull-top" x1="0.5" x2="0.5" y1="0" y2="1">
          <stop offset="0%" stopColor="rgba(90, 98, 108, 0.55)" />
          <stop offset="100%" stopColor="rgba(35, 40, 48, 0.35)" />
        </linearGradient>
        <linearGradient id="fm-hull-rim" x1="0" x2="1" y1="0.5" y2="0.5">
          <stop offset="0%" stopColor="rgba(255,255,255,0.05)" />
          <stop offset="50%" stopColor="rgba(255,255,255,0.14)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.05)" />
        </linearGradient>
      </defs>
      <ellipse cx="400" cy="340" rx="280" ry="22" fill="rgba(255,140,40,0.12)" />
      <path d="M400 40 L680 175 L630 310 L400 360 L170 310 L120 175 Z" fill="url(#fm-hull-top)" stroke="url(#fm-hull-rim)" strokeWidth="1.2" />
    </svg>
  );
}

type FittingHeroProps = {
  asset: ShipHeroAssetView;
  inspect: HeroInspectView;
  onExitInspect: () => void;
  onViewDetails: () => void;
  selectorDrawer?: ReactNode;
};

export default function FittingHero({
  asset,
  inspect,
  onExitInspect,
  onViewDetails,
  selectorDrawer,
}: FittingHeroProps) {
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [candidates, setCandidates] = useState(asset.candidates);

  if (asset.candidates !== candidates) {
    setCandidates(asset.candidates);
    setCandidateIndex(0);
  }

  const activeCandidate = asset.candidates[candidateIndex] ?? null;

  return (
    <section className="fm-hero" aria-label="Ship viewer">
      <div className="fm-hero-stage">
        <div className="fm-hero-lighting" aria-hidden />
        <div className="fm-hero-floor" aria-hidden />

        <div className="fm-hero-ship">
          {activeCandidate ? (
            <img
              className="fm-hero-ship-img"
              src={activeCandidate.src}
              alt={activeCandidate.alt}
              draggable={false}
              onError={() => {
                if (candidateIndex < asset.candidates.length - 1) {
                  setCandidateIndex((index) => index + 1);
                }
              }}
            />
          ) : (
            <ShipHeroSilhouette />
          )}
        </div>

        {inspect.slotTitle ? (
          <div className="fm-hero-inspect">
            <strong className="fm-hero-inspect-slot">{inspect.slotTitle}</strong>
            {inspect.itemName ? <span className="fm-hero-inspect-item">{inspect.itemName}</span> : null}
            {inspect.pilotTag ? <span className="fm-hero-inspect-pilot">{inspect.pilotTag}</span> : null}
            {inspect.meta ? <p className="fm-hero-inspect-meta">{inspect.meta}</p> : null}
            <button type="button" className="fm-hero-inspect-btn" onClick={onViewDetails}>View Details</button>
          </div>
        ) : null}

        <button type="button" className="fm-hero-nav fm-hero-nav--prev" aria-label="Previous view">‹</button>
        <button type="button" className="fm-hero-nav fm-hero-nav--next" aria-label="Next view">›</button>

        {inspect.selectorOpen ? (
          <button type="button" className="fm-hero-exit" onClick={onExitInspect}>
            <span aria-hidden>⌕</span> Exit Inspect Mode
          </button>
        ) : null}

        {selectorDrawer}
      </div>
    </section>
  );
}
