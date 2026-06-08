export type RefineryMaterialId =
  | "agricium"
  | "aluminum"
  | "beryl"
  | "bexalite"
  | "borase"
  | "copper"
  | "corundum"
  | "gold"
  | "hephaestanite"
  | "iron"
  | "laranite"
  | "lindinium"
  | "quantanium"
  | "quartz"
  | "savrilium"
  | "taranite"
  | "titanium"
  | "torite"
  | "tungsten";

export interface RefineryMaterialDefinition {
  id: RefineryMaterialId;
  code: string;
  displayName: string;
}

export interface RefineryRecord {
  id: string;
  name: string;
  systemCode: string;
  materialBonuses: Record<RefineryMaterialId, number>;
}

export interface RefineryDataset {
  schemaVersion: 1;
  generatedAt: string;
  sourceName: string;
  baseRefineryYield: 0.4;
  materials: RefineryMaterialDefinition[];
  refineries: RefineryRecord[];
}

export interface RefineryTarget {
  materialId: RefineryMaterialId;
  desiredRefinedAmount: number;
}

export interface RefineryMaterialCalculation extends RefineryTarget {
  refineryId: string;
  refineryName: string;
  bonusPercent: number;
  finalYieldMultiplier: number;
  rawRequired: number;
}

export interface RefineryOptimizationResult {
  calculations: RefineryMaterialCalculation[];
  totalRawRequired: number;
}

export interface RefinerySingleScore extends RefineryOptimizationResult {
  refineryId: string;
  refineryName: string;
}
