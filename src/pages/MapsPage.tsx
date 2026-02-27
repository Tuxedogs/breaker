import ShipMapTemplate, { type ShipMapViewState } from "../components/maps/ShipMapTemplate";
import DeckMapRenderer from "../components/maps/DeckMapRenderer";
import { perseusDeckMapConfig } from "../data/maps/perseusDeckMaps";

const defaultPerseusView: ShipMapViewState = {
  position: [4.486, 3.601, 0.483],
  target: [0, 0, 0],
};

export default function MapsPage() {
  return (
    <>
      <ShipMapTemplate
        title="RSI Perseus Holo Viewer"
        subtitle="Template ship map viewer. Drag to rotate, right-drag to pan, and scroll to zoom."
        modelPath="/models/perseus-holo.ctm"
        viewStorageKey="ship-map:perseus:default-view"
        fallbackView={defaultPerseusView}
        showHeader={false}
      />
      <DeckMapRenderer config={perseusDeckMapConfig} />
    </>
  );
}
