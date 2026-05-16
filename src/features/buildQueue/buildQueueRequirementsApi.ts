import type { RecipeInputTemplate } from "../../data/logistics/seed";
import type { BuildQueueItem, InventoryEntry } from "../../types/logistics";
import { apiUrl } from "../../lib/apiUrl";
import { parseJsonResponse } from "../../lib/safeJson";

export interface BuildQueueRequirementWarning {
  code: string;
  message: string;
  path?: string;
  sourceField?: string;
  materialId?: string;
  materialName?: string;
}

export interface ServerBuildQueueRequirement {
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
    allowLowerQuality?: boolean;
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
  const url = apiUrl("/api/build-queue/requirements");
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await parseJsonResponse<BuildQueueRequirementsResponse>(response, {
    label: "build queue requirements",
    url,
  });

  if (!response.ok) {
    throw new Error(`Build queue requirements API failed with ${response.status}`);
  }

  return data;
}
