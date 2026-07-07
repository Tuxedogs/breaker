import { useMemo, useState } from "react";
import { getShipThumbnailCandidates } from "../../../tools/alpha-threshold/lib/ships/thumbnail";
import type { FittingFocusTarget } from "../../../lib/fitting/fittingTerminalTypes";

type ShipHeroPanelProps = {
  shipId: string | null;
  manufacturer: string | null;
  shipName: string;
  focusTarget: FittingFocusTarget | null;
  selectedLabel: string | null;
  selectedMeta?: string | null;
};

function ShipStageSilhouette() {
  return (
    <svg className="fit-term-hero-svg" viewBox="0 0 800 400" aria-hidden>
      <defs>
        <linearGradient id="fit-hull-top" x1="0.5" x2="0.5" y1="0" y2="1">
          <stop offset="0%" stopColor="rgba(90, 98, 108, 0.55)" />
          <stop offset="100%" stopColor="rgba(35, 40, 48, 0.35)" />
        </linearGradient>
        <linearGradient id="fit-hull-rim" x1="0" x2="1" y1="0.5" y2="0.5">
          <stop offset="0%" stopColor="rgba(255,255,255,0.05)" />
          <stop offset="50%" stopColor="rgba(255,255,255,0.14)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.05)" />
        </linearGradient>
      </defs>
      <ellipse cx="400" cy="340" rx="280" ry="22" fill="rgba(255,140,40,0.12)" />
      <path
        d="M400 40 L680 175 L630 310 L400 360 L170 310 L120 175 Z"
        fill="url(#fit-hull-top)"
        stroke="url(#fit-hull-rim)"
        strokeWidth="1.2"
      />
      <path
        d="M400 95 L580 175 L555 265 L400 300 L245 265 L220 175 Z"
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth="1"
      />
    </svg>
  );
}

export default function ShipHeroPanel({
  shipId,
  manufacturer,
  shipName,
  selectedLabel,
  selectedMeta,
}: ShipHeroPanelProps) {
  const [imageFailed, setImageFailed] = useState(false);

  const heroImage = useMemo(() => {
    const candidates = getShipThumbnailCandidates({
      id: shipId ?? shipName,
      manufacturer: manufacturer ?? "",
      name: shipName,
    });
    return candidates.find((candidate) => candidate.source !== "placeholder") ?? null;
  }, [manufacturer, shipId, shipName]);

  const showImage = heroImage && !imageFailed;

  return (
    <section className="fit-term-hero" aria-label="Ship viewer">
      <div className="fit-term-hero-stage" role="img" aria-label={`${shipName} fitting view`}>
        <div className="fit-term-hero-spotlight" aria-hidden />
        <div className="fit-term-hero-floor" aria-hidden />
        <div className="fit-term-hero-visual">
          {showImage ? (
            <img
              className="fit-term-hero-image"
              src={heroImage.src}
              alt={heroImage.alt}
              onError={() => setImageFailed(true)}
            />
          ) : (
            <ShipStageSilhouette />
          )}
        </div>

        {selectedLabel && (
          <div className="fit-term-hero-detail-card">
            <span className="fit-term-detail-kicker">{selectedMeta ?? "Component"}</span>
            <strong>{selectedLabel}</strong>
            <p className="fit-term-detail-desc">Selected loadout component · prototype inspect overlay</p>
            <button type="button" className="fit-term-detail-btn">View Details</button>
          </div>
        )}

        <button type="button" className="fit-term-hero-nav fit-term-hero-nav--prev" aria-label="Previous view">‹</button>
        <button type="button" className="fit-term-hero-nav fit-term-hero-nav--next" aria-label="Next view">›</button>

        {selectedLabel && (
          <button type="button" className="fit-term-hero-exit">
            <span aria-hidden>⌕</span> Exit Inspect Mode
          </button>
        )}
      </div>
    </section>
  );
}
