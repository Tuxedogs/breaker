import fixture from "../../data/recommendations/build_queue_recommendation_fixture.json";
import type {
  BuildQueueRecommendationFixture,
  MiningPlannerIntentPayload,
  MiningRecommendationRequest,
  PublicLocationEntry,
  MaterialExplorerExportRequest,
} from "./types";

/**
 * Returns the fixture unchanged.
 * When intentPayload is provided it is logged in dev for inspection — it does
 * NOT influence the returned scores.  Scoring is owned by the backend script.
 */
export async function getMiningRecommendations(
  intentPayload?: MiningPlannerIntentPayload
): Promise<BuildQueueRecommendationFixture> {
  if (intentPayload && import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug("[recommenderAdapter] intent payload (not used for scoring):", intentPayload);
  }
  return fixture as BuildQueueRecommendationFixture;
}

/** Builds the formal request object that the backend script will eventually consume. */
export function buildRecommendationRequest(
  intentPayload: MiningPlannerIntentPayload,
  fixture: BuildQueueRecommendationFixture | null
): MiningRecommendationRequest {
  return {
    version: "1.0",
    generatedAt: new Date().toISOString(),
    requiredMaterials: (fixture?.requiredMaterials ?? []).map((m) => ({
      materialId: m.materialId,
      materialName: m.materialName,
      requiredQuantity: m.requiredQuantity,
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

/**
 * Projects fixture data down to the sanitized public shape.
 * Strips all scoring, probability, composition, quality, and ranking fields.
 * Written as if this data arrives from a future sanitized public API endpoint.
 */
export function projectToPublicLocations(
  fixture: BuildQueueRecommendationFixture
): PublicLocationEntry[] {
  const map = new Map<string, PublicLocationEntry>();

  for (const matGroup of fixture.bestSourcesByMaterial) {
    for (const src of matGroup.bestSources) {
      const locationName = (src as unknown as Record<string, string>)["locationName"] ?? src.location;
      const systemName = (src as unknown as Record<string, string>)["systemName"] ?? src.system;
      const locationKind = (src as unknown as Record<string, string>)["locationKind"] ?? src.locationType;
      const nearbyStations: string[] = (src as unknown as Record<string, unknown>)["nearbyStations"] as string[] ?? [];
      const key = `${systemName}|${locationName}|${src.spawnType}`;

      const existing = map.get(key);
      if (existing) {
        if (!existing.materials.includes(matGroup.materialName)) {
          existing.materials.push(matGroup.materialName);
        }
      } else {
        map.set(key, {
          locationKey: key,
          locationName,
          systemName,
          locationKind,
          spawnType: src.spawnType,
          nearbyStations,
          materials: [matGroup.materialName],
        });
      }
    }
  }

  return Array.from(map.values());
}

/** Builds a public-safe explorer export request. */
export function buildExplorerRequest(
  locations: PublicLocationEntry[],
  selectedMaterial: string | null,
  totalMaterials: number
): MaterialExplorerExportRequest {
  return {
    mode: "material_explorer",
    version: "1.0",
    generatedAt: new Date().toISOString(),
    accessMode: "public",
    selectedMaterial,
    totalMaterials,
    totalLocations: locations.length,
    visibleLocations: locations.map((l) => ({
      locationName: l.locationName,
      systemName: l.systemName,
      locationKind: l.locationKind,
      spawnType: l.spawnType,
      nearbyStations: l.nearbyStations,
      materials: l.materials,
    })),
  };
}

/** Triggers a browser download of the explorer request as JSON. */
export function downloadExplorerRequest(request: MaterialExplorerExportRequest): void {
  const blob = new Blob([JSON.stringify(request, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "mining_explorer_request.json";
  a.click();
  URL.revokeObjectURL(url);
}

/** Triggers a browser download of the request payload as JSON. */
export function downloadRecommendationRequest(request: MiningRecommendationRequest): void {
  const blob = new Blob([JSON.stringify(request, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "mining_recommender_request.json";
  a.click();
  URL.revokeObjectURL(url);
}
