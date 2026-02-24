import ShipMapTemplate, { type ShipMapViewState } from "../../components/maps/ShipMapTemplate";

const defaultPerseusView: ShipMapViewState = {
  position: [4.486, 3.601, 0.483],
  target: [0, 0, 0],
};

export default function PerseusHoloViewerPage() {
  return (
    <ShipMapTemplate
      title="RSI Perseus Holo Viewer"
      subtitle="Template ship map viewer. Drag to rotate, right-drag to pan, and scroll to zoom."
      modelPath="/models/perseus-holo.ctm"
      viewStorageKey="ship-map:perseus:default-view"
      fallbackView={defaultPerseusView}
    />
  );
}
