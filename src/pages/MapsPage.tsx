import ShipMapTemplate, { type ShipMapViewState } from "../components/maps/ShipMapTemplate";
import { perseusDeckFloors } from "../data/maps/perseusDeckFloorRegistry";

const defaultPerseusView: ShipMapViewState = {
  position: [-3.165, 1.389, 0.111],
  target: [0, 0, 0],
};

export default function MapsPage() {
  const enabledDecks = perseusDeckFloors
    .filter((deck) => deck.enabled)
    .sort((a, b) => a.deckMin - b.deckMin);

  const deckOverlayConfig = {
    decks: enabledDecks.map((deck, index) => {
      const nextDeck = enabledDecks[index + 1];
      const deckMax = nextDeck ? nextDeck.deckMin - 0.006 : deck.deckMin + 0.2;
      return {
        id: deck.id,
        title: deck.label,
        deckMin: deck.deckMin,
        deckMax,
        svgPath: deck.svgUrl,
        viewBox: deck.nativeViewBox,
        rotationDeg: deck.overlayAdjustments?.rotationDeg ?? 0,
        offsetY: deck.overlayAdjustments?.offsetY ?? 0,
        offsetX: deck.overlayAdjustments?.offsetX ?? 0,
        offsetZ: deck.overlayAdjustments?.offsetZ ?? 0.5,
        scaleMultiplier: deck.overlayAdjustments?.scaleMultiplier ?? 1,
      };
    }),
  };

  return (
    <ShipMapTemplate
      title="RSI Perseus Holo Viewer"
      subtitle="Template ship map viewer. Drag to rotate, right-drag to pan, and scroll to zoom."
      modelPath="/models/perseus-holo.ctm"
      viewStorageKey="ship-map:perseus:default-view"
      fallbackView={defaultPerseusView}
      showHeader={false}
      deckOverlayConfig={deckOverlayConfig}
    />
  );
}
