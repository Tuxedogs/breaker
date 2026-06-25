import { useMemo, useState } from "react";
import { getShipThumbnailCandidates } from "../../../tools/alpha-threshold/lib/ships/thumbnail";
import type { FittingFocusTarget } from "../../../lib/fitting/fittingTerminalTypes";

type ShipHeroPanelProps = {
  shipId: string | null;
  manufacturer: string | null;
  shipName: string;
  focusTarget: FittingFocusTarget | null;
  selectedLabel: string | null;
};

function ShipStageSilhouette() {
  return (
    <svg className="fit-term-hero-svg" viewBox="0 0 640 320" aria-hidden>
      <defs>
        <linearGradient id="fit-ship-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgba(148, 158, 168, 0.22)" />
          <stop offset="100%" stopColor="rgba(70, 78, 88, 0.12)" />
        </linearGradient>
      </defs>
      <path
        d="M320 36 L560 150 L520 248 L320 286 L120 248 L80 150 Z"
        fill="url(#fit-ship-fill)"
        stroke="rgba(180, 190, 200, 0.28)"
        strokeWidth="1.5"
      />
      <path
        d="M320 72 L470 150 L450 220 L320 248 L190 220 L170 150 Z"
        fill="none"
        stroke="rgba(120, 130, 140, 0.22)"
        strokeWidth="1"
      />
      <line x1="320" y1="36" x2="320" y2="286" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
    </svg>
  );
}

export default function ShipHeroPanel({
  shipId,
  manufacturer,
  shipName,
  focusTarget,
  selectedLabel,
}: ShipHeroPanelProps) {
  const [imageFailed, setImageFailed] = useState(false);

  const heroImage = useMemo(() => {
    const candidates = getShipThumbnailCandidates({
      id: shipId ?? shipName,
      manufacturer: manufacturer ?? "",
      name: shipName,
      imageSrc: null,
      imageAlt: null,
    });
    return candidates.find((candidate) => candidate.source !== "placeholder") ?? null;
  }, [manufacturer, shipId, shipName]);

  const showImage = heroImage && !imageFailed;
  const anchorState = focusTarget?.source === "real-anchor"
    ? "Focused"
    : focusTarget
      ? "Anchor unavailable"
      : null;

  return (
    <section className="fit-term-hero" aria-label="Ship viewer">
      {/* TODO: integrate real portPath → worldPosition anchor mapping when available */}
      <div className="fit-term-hero-stage" role="img" aria-label={`${shipName} fitting view`}>
        <div className="fit-term-hero-grid" aria-hidden />
        <div className="fit-term-hero-visual">
          {showImage ? (
            <img
              className="fit-term-hero-image"
              src={heroImage.src}
              alt={heroImage.alt}
              onError={() => setImageFailed(true)}
            />
          ) : (
            <>
              <ShipStageSilhouette />
              <div className="fit-term-hero-unavailable">
                <span className="fit-term-hero-unavailable-label">Ship render unavailable</span>
                <span className="fit-term-hero-unavailable-meta">Top-down schematic placeholder</span>
              </div>
            </>
          )}
        </div>
        {selectedLabel && (
          <div className="fit-term-hero-focus">
            <span className="fit-term-meta-label">Selected</span>
            <strong>{selectedLabel}</strong>
            {anchorState && (
              <span className={focusTarget?.source === "real-anchor" ? "fit-term-focus-ok" : "fit-term-focus-missing"}>
                {anchorState}
              </span>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
