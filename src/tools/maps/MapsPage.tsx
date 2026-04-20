import DeckFloorViewport from "./components/DeckFloorViewport";
import { perseusDeckFloors } from "./data/perseusDeckFloorRegistry";

export default function MapsPage() {
  return (
    <DeckFloorViewport
      title="RSI Perseus Deck Maps"
      subtitle="Static deck references for quick layout checks without loading the 3D viewer."
      deckDefinitions={perseusDeckFloors}
    />
  );
}
