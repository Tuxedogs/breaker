import type { ReactNode } from "react";

export type EquipmentRowTone =
  | "pilot"
  | "turret"
  | "turret-alt"
  | "turret-alt-2"
  | "missile"
  | "emp"
  | "utility"
  | "shield"
  | "armor"
  | "power"
  | "support";

export type EquipmentRowView = {
  id: string;
  iconSrc: string;
  quantity: string;
  title: string;
  subtitle: string | null;
  tag: string | null;
  tone: EquipmentRowTone;
  selected: boolean;
};

export type SystemsGroupView = {
  key: string;
  label: string;
  count: number;
  rows: EquipmentRowView[];
};

export type StatRowView = {
  label: string;
  value: string;
  tone?: "default" | "accent" | "muted";
};

export type StatMiniGridView = {
  columns: string[];
  rows: Array<{ label: string; values: string[] }>;
};

export type ResistanceGridView = {
  title: string;
  columns: string[];
  rows: Array<{ label: string; values: string[] }>;
};

export type ThresholdReadoutView = {
  label: string;
  valueLabel: string;
  fillPct: number;
};

export type StatSectionView = {
  title: string;
  rows: StatRowView[];
  miniGrid?: StatMiniGridView;
  resistanceGrid?: ResistanceGridView;
  thresholdReadout?: ThresholdReadoutView;
};

export type StatCardView = {
  key: string;
  title: string;
  actionLabel?: string;
  actionDisabled?: boolean;
  rows?: StatRowView[];
  sections?: StatSectionView[];
  footer?: ReactNode;
};

export type ResourceMetricView = {
  label: string;
  value: string;
  highlighted?: boolean;
};

export type ResourceBlockView = {
  key: string;
  title: string;
  metrics: ResourceMetricView[];
  barFillPct?: number;
  barKind?: "power" | "cooling";
  stacked?: boolean;
};

export type ResourceSummaryView = {
  fittingValid: boolean;
  blocks: ResourceBlockView[];
};

export type ShipHeroAssetView = {
  candidates: Array<{ src: string; alt: string }>;
  fallback: "silhouette";
};

export type HeroInspectView = {
  slotTitle: string | null;
  itemName: string | null;
  pilotTag: string | null;
  meta: string | null;
  selectorOpen: boolean;
};

export type TopBarView = {
  manufacturer: string | null;
  shipName: string;
  roleLine: string;
  activeTab: string;
  tabs: string[];
  ships: Array<{ shipKey: string; name: string }>;
  selectedShipKey: string | null;
  shipsLoading: boolean;
  isModified: boolean;
  showShipTools?: boolean;
};
