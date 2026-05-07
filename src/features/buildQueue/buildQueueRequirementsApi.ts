import type { RecipeInputTemplate } from "../../data/logistics/seed";
import type { BuildQueueItem, InventoryEntry } from "../../types/logistics";

export interface BuildQueueRequirementWarning {
  code: string;
  message: string;
  path?: string;
  materialId?: string;
  materialName?: string;
}

export interface ServerBuildQueueRequirement {
  requirementKey: string;
  materialId: string;
  materialName: string;
  requiredQuantity: number;
  originalRequiredQuantity: number;
  selectedQuality?: number;
  unitType?: "unit" | "SCU" | "scu" | "cscu";
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
    unitType?: "unit" | "SCU" | "scu" | "cscu";
  }>;
}

export interface BuildQueueRequirementsResponse {
  requirements: ServerBuildQueueRequirement[];
  warnings: BuildQueueRequirementWarning[];
}

export async function getBuildQueueRequirements(input: {
  buildQueue: BuildQueueItem[];
  recipeInputTemplates: Record<string, RecipeInputTemplate[]>;
  inventoryEntries: InventoryEntry[];
}): Promise<BuildQueueRequirementsResponse> {
  const response = await fetch("/api/build-queue/requirements", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(`Build queue requirements API failed with ${response.status}`);
  }

  return response.json() as Promise<BuildQueueRequirementsResponse>;
}
