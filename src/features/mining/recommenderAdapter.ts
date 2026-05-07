import type {
  BuildQueueRecommendationFixture,
  MaterialExplorerExportRequest,
  MiningPlannerIntentPayload,
  MiningRecommendationRequest,
  PublicLocationEntry,
} from "./types";

export interface RecommenderWarning {
  code: string;
  message: string;
  path?: string;
  materialId?: string;
  materialName?: string;
}

export interface RecommendationResponse {
  recommendations: PublicLocationEntry[];
  warnings: RecommenderWarning[];
}

type RecommenderApiRequest = Omit<MiningRecommendationRequest, "requiredMaterials"> & {
  materialRequirements: MiningRecommendationRequest["requiredMaterials"];
};

function toRecommenderApiRequest(request: MiningRecommendationRequest): RecommenderApiRequest {
  const { requiredMaterials, ...rest } = request;
  return {
    ...rest,
    materialRequirements: requiredMaterials.map((material) => ({
      materialId: material.materialId,
      materialName: material.materialName,
      requiredQuantity: material.requiredQuantity,
      selectedQuality: material.selectedQuality,
      unitType: material.unitType,
      modifierName: material.modifierName,
      modifierType: material.modifierType,
      modifierValue: material.modifierValue,
    })),
  };
}

export async function getMiningRecommendations(
  request: MiningRecommendationRequest,
): Promise<RecommendationResponse> {
  const response = await fetch("/api/recommender/recommendations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(toRecommenderApiRequest(request)),
  });

  if (!response.ok) {
    throw new Error(`Recommender API failed with ${response.status}`);
  }

  return response.json() as Promise<RecommendationResponse>;
}

export function buildRecommendationRequest(
  intentPayload: MiningPlannerIntentPayload,
  fixture: BuildQueueRecommendationFixture | null,
  queuedRequirements?: MiningRecommendationRequest["requiredMaterials"],
): MiningRecommendationRequest {
  return {
    version: "1.0",
    generatedAt: new Date().toISOString(),
    requiredMaterials: queuedRequirements ?? (fixture?.requiredMaterials ?? []).map((m) => ({
      materialId: m.materialId,
      materialName: m.materialName,
      requiredQuantity: m.requiredQuantity,
      selectedQuality: m.selectedQuality,
      unitType: m.unitType,
    })),
    priorityStack: intentPayload.priorityStack,
    manualDemand: intentPayload.manualDemand,
    favoriteLocationIds: intentPayload.favoriteLocationIds,
    filters: intentPayload.filters,
    refineryContext: null,
    currentFixtureSummary: fixture
      ? {
          queueItems: fixture.summary.queueItems,
          requiredMaterials: fixture.summary.requiredMaterials,
          recommendedRoutes: fixture.summary.recommendedRoutes,
        }
      : null,
  };
}

export function buildExplorerRequest(
  locations: PublicLocationEntry[],
  selectedMaterial: string | null,
  totalMaterials: number,
): MaterialExplorerExportRequest {
  return {
    mode: "material_explorer",
    version: "1.0",
    generatedAt: new Date().toISOString(),
    accessMode: "public",
    selectedMaterial,
    totalMaterials,
    totalLocations: locations.length,
    visibleLocations: locations.map((location) => ({
      locationName: location.locationName,
      systemName: location.systemName,
      locationKind: location.locationKind,
      spawnType: location.spawnType,
      nearbyStations: location.nearbyStations,
      materials: location.materials,
    })),
  };
}

export function downloadExplorerRequest(request: MaterialExplorerExportRequest): void {
  const blob = new Blob([JSON.stringify(request, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "mining_explorer_request.json";
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadRecommendationRequest(request: MiningRecommendationRequest): void {
  const blob = new Blob([JSON.stringify(request, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "mining_recommender_request.json";
  a.click();
  URL.revokeObjectURL(url);
}
