export type FittingFocusTarget = {
  shipId: string;
  slotId: string;
  componentId?: string;
  anchorId?: string;
  source: "real-anchor" | "missing-anchor" | "placeholder";
};

export type FittingTerminalTab =
  | "overview"
  | "loadout"
  | "compare"
  | "hardpoints"
  | "shopping-list"
  | "damage-lab"
  | "weapon-stats";

export type PipCategory =
  | "weapons"
  | "shields"
  | "engines"
  | "quantum"
  | "systems"
  | "utility"
  | "reserved";

export type PipAssignment = Record<PipCategory, number>;

export const DEFAULT_PIP_ASSIGNMENT: PipAssignment = {
  weapons: 25,
  shields: 20,
  engines: 20,
  quantum: 10,
  systems: 15,
  utility: 5,
  reserved: 5,
};

export type CraftQualityOverride = {
  portId: string;
  componentId: string;
  materialQualities: Record<string, number>;
  appliedAt: number;
};
