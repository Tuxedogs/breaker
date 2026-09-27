import { displayMiningMethodLabel } from "./miningFormatters";

export type MiningMethodIconKey = "hand" | "ship" | "vehicle";

export type MiningMethodPresentation = {
  iconKey: MiningMethodIconKey | null;
  visibleLabel: string | null;
};

export function miningMethodPresentation(method: string): MiningMethodPresentation {
  switch (displayMiningMethodLabel(method)) {
    case "Hand":
      return { iconKey: "hand", visibleLabel: null };
    case "Vehicle":
    case "Surface Vehicle":
      return { iconKey: "vehicle", visibleLabel: null };
    case "Asteroid":
    case "Ship":
    case "Surface Ship":
      return { iconKey: "ship", visibleLabel: null };
  }
  return { iconKey: null, visibleLabel: method };
}
