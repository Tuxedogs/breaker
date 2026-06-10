export type RefineryMaterialId = string;

export interface RefineryMaterialDefinition {
  id: RefineryMaterialId;
  code: string;
  displayName: string;
}

export interface RefineryCanonicalMaterial {
  id: RefineryMaterialId;
  displayName: string;
  materialForm: string;
  unitType: string;
  sourceMaterialKeys: string[];
}

export interface RefineryRecord {
  id: string;
  name: string;
  systemCode: string;
  materialBonuses: Record<string, number>;
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
  rawInputScu: number;
}

export interface RefineryMaterialCalculation extends RefineryTarget {
  refineryId: string;
  refineryName: string;
  bonusPercent: number;
  hasRefineryBonus: boolean;
  baseYieldScu: number;
  refinedOutputScu: number;
}

export interface RefineryOptimizationResult {
  calculations: RefineryMaterialCalculation[];
  totalRefinedOutputScu: number;
}

export interface RefinerySingleScore extends RefineryOptimizationResult {
  refineryId: string;
  refineryName: string;
}
