import type { ApiUnitType } from "../shared/quantityFormatter";
import type { ApiWarning } from "../shared/warnings";

export interface BuildQueueMaterialRow {
  requirementId?: string;
  materialKey?: string;
  materialId?: string;
  materialGuid?: string;
  costId?: string;
  materialName?: string;
  displayName?: string;
  rawName?: string;
  sourceName?: string;
  sourceType?: string;
  quantity: number;
  selectedQuality?: number;
  unitType?: ApiUnitType;
  modifierName?: string;
  modifierType?: string;
  modifierValue?: number;
}

export interface BuildQueueRequirementItem {
  id: string;
  recipeId: string;
  itemId?: string;
  itemName?: string;
  finalProductQualityBand?: number;
  finalProductQualityAverage?: number;
  finalProductRarity?: string;
  quantity: number;
  allowLowerQuality?: boolean;
  status?: string;
  materialRequirements?: BuildQueueMaterialRow[];
  reservedAllocations?: Array<{
    materialId: string;
    quantityReserved: number;
    requirementId?: string;
    selectedQuality?: number;
    allowLowerQualityOverride?: boolean;
    unitType?: ApiUnitType;
  }>;
}

export interface BuildQueueRequirementsRequest {
  buildQueue?: BuildQueueRequirementItem[];
  recipeInputTemplates?: Record<string, BuildQueueMaterialRow[]>;
  inventoryEntries?: Array<{ materialId?: string; quantity: number; quality?: number }>;
}

export interface NormalizedRequirement {
  requirementKey: string;
  materialKey: string;
  materialId: string;
  materialName: string;
  displayName: string;
  normalizedName: string;
  slug: string;
  quantity: number;
  requiredQuantity: number;
  originalRequiredQuantity: number;
  selectedQuality?: number;
  unitType?: ApiUnitType;
  displayQuantity: string;
  modifierName?: string;
  modifierType?: string;
  modifierValue?: number;
  slots: string[];
  usedBy: Array<{
    requirementId: string;
    blueprintGuid: string;
    displayName: string;
    componentType: string;
    size: string;
    quantity: number;
    slot: string;
    materialQuantity: number;
    selectedQuality?: number;
    allowLowerQuality?: boolean;
    unitType?: ApiUnitType;
  }>;
}

export type BuildQueueWarning = ApiWarning;

export interface BuildQueueRequirementsResponse {
  requirements: NormalizedRequirement[];
  warnings: BuildQueueWarning[];
}
