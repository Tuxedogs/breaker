import { useMemo } from "react";
import ShipMapTemplate, { type ShipMapViewState } from "../components/maps/ShipMapTemplate";
import { perseusDeckFloors } from "../data/maps/perseusDeckFloorRegistry";
import { perseusDeckMapConfig } from "../data/maps/perseusDeckMaps";

const defaultPerseusView: ShipMapViewState = {
  position: [-3.165, 1.389, 0.111],
  target: [0, 0, 0],
};

export default function MapsPage() {
  const enabledDecks = useMemo(
    () => perseusDeckFloors.filter((deck) => deck.enabled).sort((a, b) => a.deckMin - b.deckMin),
    [],
  );

  const deckOverlayConfig = useMemo(
    () => ({
      decks: enabledDecks.map((deck, index) => {
        const nextDeck = enabledDecks[index + 1];
        const deckMax = nextDeck ? nextDeck.deckMin - 0.006 : deck.deckMin + 0.2;
        const mappedDeck = perseusDeckMapConfig.decks[index];
        return {
          id: mappedDeck?.id ?? deck.id,
          title: mappedDeck?.name ?? deck.label,
          deckMin: deck.deckMin,
          deckMax: mappedDeck?.deckMax ?? deckMax,
          svgPath: mappedDeck?.svgPath ?? deck.svgUrl,
          annotations: mappedDeck?.annotations,
          viewBox: mappedDeck?.viewBox ?? deck.nativeViewBox,
          rotationDeg: deck.overlayAdjustments?.rotationDeg ?? 0,
          offsetY: deck.overlayAdjustments?.offsetY ?? 0,
          offsetX: deck.overlayAdjustments?.offsetX ?? 0,
          offsetZ: deck.overlayAdjustments?.offsetZ ?? 0.5,
          scaleMultiplier: deck.overlayAdjustments?.scaleMultiplier ?? 1,
        };
      }),
    }),
    [enabledDecks],
  );

  return (
    <ShipMapTemplate
      title="RSI Perseus Holo Viewer"
      subtitle="Template ship map viewer. Drag to rotate, right-drag to pan, and scroll to zoom."
      modelPath="/models/perctex.glb"
      viewStorageKey="ship-map:perseus:default-view"
      fallbackView={defaultPerseusView}
      showHeader={false}
      deckOverlayConfig={deckOverlayConfig}
    />
  );
}
