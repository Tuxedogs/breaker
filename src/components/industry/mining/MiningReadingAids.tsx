import { useEffect, useId, useRef, useState } from "react";
import type { MiningOccurrenceBand, MiningOccurrenceRating } from "./miningCompetitionPresentation";
import { miningOccurrenceRatingTitle, type MiningDetailView } from "./miningDetailView";

export function MiningDetailViewToggle({ view, onChange }: { view: MiningDetailView; onChange: (view: MiningDetailView) => void }) {
  return (
    <div className="mdet-view-toggle" role="group" aria-label="Detail level">
      {(["simple", "detailed"] as const).map((value) => (
        <button key={value} type="button" className={view === value ? "is-active" : undefined} aria-pressed={view === value} onClick={() => onChange(value)}>
          {value === "simple" ? "Simple" : "Detailed"}
        </button>
      ))}
    </div>
  );
}

const BAND_LEVEL: Record<MiningOccurrenceBand, number> = { none: 0, "very-low": 1, low: 2, average: 3, high: 4, "very-high": 5 };

/** Full-width five-step bar used by the Simple-view material cards. */
export function MiningOccurrencePips({ rating }: { rating: MiningOccurrenceRating }) {
  const level = rating.band ? BAND_LEVEL[rating.band] : 0;
  return (
    <span className={`mining-occurrence-pips${rating.band ? ` is-${rating.band}` : " is-unrated"}`} aria-hidden="true">
      {[1, 2, 3, 4, 5].map((step) => <i key={step} className={step <= level ? "is-on" : undefined} />)}
    </span>
  );
}

/** Five-step meter plus the word. The word always carries the meaning. */
export function MiningOccurrenceRatingLabel({ rating, materialName }: { rating: MiningOccurrenceRating; materialName: string }) {
  const level = rating.band ? BAND_LEVEL[rating.band] : 0;
  return (
    <span className={`mining-occurrence-rating${rating.band ? ` is-${rating.band}` : " is-unrated"}`} title={miningOccurrenceRatingTitle(rating, materialName)}>
      <span className="mining-occurrence-meter" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((step) => <span key={step} className={rating.band && step <= level ? "is-on" : undefined} />)}
      </span>
      <span className="mining-occurrence-word">{rating.label}</span>
    </span>
  );
}

const GLOSSARY: Array<[string, string]> = [
  ["Encounter", "How common a material is in its spawn pool, compared with an even split between every material in that pool: Very low, Low, Average, High or Very high. “Not rated” means part of the pool is not published, so no fair comparison is possible. Detailed view adds the pool share percentage."],
  ["Quality 800+ / 900+", "Chance that a rock of this material rolls at Quality 800 or higher, or Quality 900 or higher."],
  ["Signature · ×2 · ×3", "Scanner signature for one, two or three rocks of this material."],
  ["Best location", "This location ranks first of all locations for that material."],
  ["Hand, Ship, Vehicle", "How this location’s rocks split between mining methods."],
  ["Spawn pool bars", "Materials that compete for the same spawns. A wider segment is a larger share of the pool. The hatched segment is the share no published record accounts for."],
  ["Composition", "Detailed view only. The average share of a material inside a rock where it is found. It is not a chance to find it."],
  ["Ranks", "1, 2, 3 are modeled ranks. T-4 means tied with other locations at rank 4. R1, R2 are stop order on a Queue route."],
];

export function MiningGlossary() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const panelId = useId();
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && wrapRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);
  return (
    <div className="mdet-glossary" ref={wrapRef}>
      <button type="button" className="mdet-glossary-button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((current) => !current)}>
        <span aria-hidden="true">?</span> How to read this
      </button>
      <div id={panelId} className="mdet-glossary-panel" role="region" aria-label="How to read this location profile" hidden={!open}>
        <dl>
          {GLOSSARY.map(([term, description]) => (
            <div key={term}><dt>{term}</dt><dd>{description}</dd></div>
          ))}
        </dl>
      </div>
    </div>
  );
}
