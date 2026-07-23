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
  | "engines"
  | "quantum"
  | "radar"
  | "shields"
  | "lifeSupport"
  | "cooler1"
  | "cooler2";

export type PipAssignment = Record<PipCategory, number>;

export const PIP_MAX_PER_CATEGORY = 10;

export const DEFAULT_PIP_ASSIGNMENT: PipAssignment = {
  weapons: 0,
  engines: 0,
  quantum: 0,
  radar: 0,
  shields: 0,
  lifeSupport: 0,
  cooler1: 0,
  cooler2: 0,
};

export type CraftQualityOverride = {
  portId: string;
  componentId: string;
  materialQualities: Record<string, number>;
  appliedAt: number;
};
