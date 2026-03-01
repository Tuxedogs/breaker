import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import type { DeckFloorDefinition } from "../../data/maps/perseusDeckFloorRegistry";

type DeckFloorViewportProps = {
  title: string;
  subtitle: string;
  deckDefinitions: DeckFloorDefinition[];
};

function labelizeRegion(id: string): string {
  return id
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function DeckFloorViewport({ title, subtitle, deckDefinitions }: DeckFloorViewportProps) {
  const enabledDecks = useMemo(() => deckDefinitions.filter((deck) => deck.enabled), [deckDefinitions]);
  const canonicalViewBox = useMemo(() => {
    const source = enabledDecks.length > 0 ? enabledDecks : deckDefinitions;
    return source.reduce<[number, number]>(
      (max, deck) => [Math.max(max[0], deck.nativeViewBox[0]), Math.max(max[1], deck.nativeViewBox[1])],
      [1, 1]
    );
  }, [deckDefinitions, enabledDecks]);

  const firstEnabledDeck = deckDefinitions.find((deck) => deck.enabled)?.id ?? deckDefinitions[0]?.id;
  const [activeDeckId, setActiveDeckId] = useState<DeckFloorDefinition["id"] | undefined>(firstEnabledDeck);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const svgHostRef = useRef<HTMLDivElement | null>(null);

  const activeDeck = useMemo(
    () => deckDefinitions.find((deck) => deck.id === activeDeckId) ?? deckDefinitions[0],
    [activeDeckId, deckDefinitions]
  );

  function handleDeckSwitch(deckId: DeckFloorDefinition["id"]) {
    setActiveDeckId(deckId);
    setSelectedRegionId(null);
  }

  function handleSvgClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as Element | null;
    const regionElement = target?.closest("path, polygon, rect, circle, ellipse");
    if (!regionElement) {
      setSelectedRegionId(null);
      return;
    }

    const regionId = regionElement.getAttribute("id");
    setSelectedRegionId(regionId && regionId.trim() ? regionId : null);
  }

  useEffect(() => {
    const root = svgHostRef.current;
    if (!root) return;

    root.querySelectorAll("[data-region-selected='true']").forEach((node) => {
      node.removeAttribute("data-region-selected");
    });

    if (!selectedRegionId) return;

    const escapedId = CSS.escape(selectedRegionId);
    const selected = root.querySelector(`#${escapedId}`);
    selected?.setAttribute("data-region-selected", "true");
  }, [selectedRegionId, activeDeck.id]);

  if (!activeDeck) return null;

  const ActiveDeckComponent = activeDeck.Component;
  const activeWidthPercent = (activeDeck.nativeViewBox[0] / canonicalViewBox[0]) * 100;
  const activeHeightPercent = (activeDeck.nativeViewBox[1] / canonicalViewBox[1]) * 100;

  return (
    <section className="route-fade pb-8 pt-2">
      <article className="framework-modern-card framework-modern-card-ships rounded-[1.9rem] border border-amber-300/35 bg-black/35 p-4 backdrop-blur sm:p-6">
        <header className="framework-modern-card-head rounded-[1.2rem] border border-white/15 p-5">
          <p className="framework-modern-kicker">Floor Maps</p>
          <h2 className="title-font mt-2 text-3xl tracking-[0.07em] text-amber-200 sm:text-4xl">{title}</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-200 sm:text-base">{subtitle}</p>
        </header>

        <div className="mt-4 flex flex-wrap gap-2">
          {deckDefinitions.map((deck) => {
            const isActive = deck.id === activeDeck.id;
            return (
              <button
                key={deck.id}
                type="button"
                disabled={!deck.enabled}
                onClick={() => handleDeckSwitch(deck.id)}
                className={[
                  "min-h-11 rounded-md border px-3 py-2 text-xs uppercase tracking-[0.14em] transition",
                  deck.enabled
                    ? isActive
                      ? "border-amber-300/55 bg-black/55 text-amber-100"
                      : "border-white/35 bg-black/40 text-white hover:bg-black/55"
                    : "cursor-not-allowed border-white/20 bg-black/20 text-slate-500",
                ].join(" ")}
              >
                {deck.label}
              </button>
            );
          })}
        </div>

        <div className="mt-4 overflow-hidden rounded-[1.2rem] border border-white/15 bg-black/30 p-3">
          <div
            ref={svgHostRef}
            className="deck-floor-viewport relative mx-auto w-full max-w-[960px]"
            style={{ aspectRatio: `${canonicalViewBox[0]} / ${canonicalViewBox[1]}` }}
            onClick={handleSvgClick}
            data-selected-region={selectedRegionId ?? ""}
          >
            <div
              className="absolute left-0 top-0"
              style={{ width: `${activeWidthPercent}%`, height: `${activeHeightPercent}%` }}
            >
              <ActiveDeckComponent
                className="h-full w-full"
                preserveAspectRatio="xMinYMin meet"
                role="img"
                aria-label={`${activeDeck.label} floor map`}
              />
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-md border border-white/20 bg-black/40 px-3 py-2 text-[11px] leading-relaxed text-slate-200">
          <p>deck: {activeDeck.label}</p>
          <p>deckMin: {activeDeck.deckMin.toFixed(3)}</p>
          <p>selected region: {selectedRegionId ? labelizeRegion(selectedRegionId) : "none"}</p>
        </div>
      </article>
    </section>
  );
}
