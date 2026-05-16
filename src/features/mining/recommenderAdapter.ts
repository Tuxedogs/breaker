import type {
  BuildQueueRecommendationFixture,
  MiningPlannerIntentPayload,
  MiningRecommendationRequest,
  PublicLocationEntry,
  RequiredMaterial,
} from "./types";
import { canonicalMiningMaterial } from "./materialIdentity";
import { apiUrl } from "../../lib/apiUrl";
import {
  displayMiningMethod,
  getStaticEncounterRankingRow,
  getStaticMaterialKey,
  getStaticMaterialQualityRow,
  loadStaticMiningIndex,
  sourceWeightFromEncounterRank,
  type StaticLocationMaterialRow,
  type StaticMiningIndex,
} from "./staticMiningIndex";

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
  diagnostics?: {
    materialCoverage: Array<{
      materialKey: string;
      materialId: string;
      displayName: string;
      miningType?: string;
      unitType?: "unit" | "SCU" | "scu" | "cscu";
      sourceCount: number;
      candidateLocations: Array<{
        locationKey: string;
        locationName: string;
        systemName: string;
        spawnType: string;
        miningType: string;
      }>;
      matchingResourceKeys: string[];
    }>;
  };
}

type RecommenderApiRequest = Omit<MiningRecommendationRequest, "requiredMaterials"> & {
  materialRequirements: MiningRecommendationRequest["requiredMaterials"];
};

type CanonicalDemand = RequiredMaterial & {
  materialKey: string;
  materialId: string;
  materialName: string;
  displayName: string;
};

type RecommenderSource = "post" | "static-fallback";

type FallbackReason =
  | { type: "status"; status: number }
  | { type: "invalid-response"; status: number; contentType: string; detail: string };

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidRecommendationResponse(value: unknown): value is RecommendationResponse {
  if (!isRecord(value)) return false;
  if (!Array.isArray(value.recommendations)) return false;
  if (!Array.isArray(value.warnings)) return false;
  if (
    value.diagnostics !== undefined &&
    (!isRecord(value.diagnostics) || !Array.isArray(value.diagnostics.materialCoverage))
  ) {
    return false;
  }

  return value.recommendations.every((entry) =>
    isRecord(entry) &&
    typeof entry.locationKey === "string" &&
    typeof entry.locationName === "string" &&
    typeof entry.systemName === "string" &&
    typeof entry.score === "number" &&
    Array.isArray(entry.materials)
  );
}

function formatFallbackReason(reason?: FallbackReason): string | null {
  if (!reason) return null;
  if (reason.type === "status") return `status ${reason.status}`;
  return `${reason.detail} (${reason.status}, ${reason.contentType || "unknown content-type"})`;
}

function logRecommendationDiagnostic(
  source: RecommenderSource,
  response: RecommendationResponse,
  demandCount: number,
  fallbackReason?: FallbackReason,
): void {
  if (!import.meta.env.DEV) return;

  console.info("[mining] recommender diagnostic", {
    source,
    fallbackReason: formatFallbackReason(fallbackReason),
    topRoutes: response.recommendations.slice(0, 5).map((entry) => ({
      locationKey: entry.locationKey,
      coverageCount: entry.requiredMaterials?.length ?? 0,
      coverage: `${entry.requiredMaterials?.length ?? 0} / ${demandCount}`,
    })),
  });
}

function toRecommenderApiRequest(request: MiningRecommendationRequest): RecommenderApiRequest {
  const { requiredMaterials, ...rest } = request;
  return {
    ...rest,
    materialRequirements: requiredMaterials.map((material) => ({
      materialKey: canonicalMiningMaterial(material).key,
      materialId: canonicalMiningMaterial(material).key,
      materialName: canonicalMiningMaterial(material).label,
      displayName: canonicalMiningMaterial(material).label,
      normalizedName: material.normalizedName,
      slug: material.slug,
      requiredQuantity: material.requiredQuantity,
      selectedQuality: material.selectedQuality,
      unitType: material.unitType,
      modifierName: material.modifierName,
      modifierType: material.modifierType,
      modifierValue: material.modifierValue,
    })),
  };
}

function toCanonicalDemand(material: MiningRecommendationRequest["requiredMaterials"][number]): CanonicalDemand {
  const canonical = canonicalMiningMaterial(material);
  return {
    ...material,
    materialKey: canonical.key,
    materialId: canonical.key,
    materialName: canonical.label,
    displayName: canonical.label,
    usedBy: [],
    slots: [],
  };
}

function targetabilityLabel(score: number): NonNullable<PublicLocationEntry["routeTargetabilityLabel"]> {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Strong";
  if (score >= 40) return "Good";
  if (score >= 20) return "Weak";
  return "Poor";
}

function miningTypeFromRows(rows: StaticLocationMaterialRow[]): string {
  const method = rows.find((row) => row.resolvedMineableClass)?.resolvedMineableClass;
  return displayMiningMethod(method || "Unclassified");
}

function getRowQualityChance(
  row: StaticLocationMaterialRow,
  index: StaticMiningIndex,
  threshold: number,
): number | null {
  const qualityRow = getStaticMaterialQualityRow(row, index);
  const chances = qualityRow?.qualityThresholdChancesWeighted
    ?? qualityRow?.thresholdChances
    ?? row.qualityThresholdChancesWeighted;
  const chance = chances?.[String(threshold)];
  return typeof chance === "number" && Number.isFinite(chance) ? chance : null;
}

function buildStaticRouteScore(
  row: StaticLocationMaterialRow,
  demand: CanonicalDemand,
  index: StaticMiningIndex,
): NonNullable<PublicLocationEntry["routeScores"]>[number] {
  const ranking = getStaticEncounterRankingRow(row, index);
  const sourceWeight = sourceWeightFromEncounterRank(ranking?.encounterRank, ranking?.encounterRankOutOf) ?? 0;
  const threshold = demand.selectedQuality ?? 800;
  const qualityChance = getRowQualityChance(row, index, threshold);
  const qualityFit = qualityChance == null ? null : Math.round(qualityChance * 100);
  const yieldPotential = Math.round(sourceWeight);
  const overallTargetabilityScore = Math.round((sourceWeight * 0.55) + ((qualityChance ?? 0) * 100 * 0.45));

  return {
    materialKey: demand.materialKey,
    materialId: demand.materialId,
    materialName: demand.materialName,
    displayName: demand.displayName,
    selectedQuality: threshold,
    qualityRouteScore: qualityFit,
    yieldRouteScore: yieldPotential,
    demandMatchScore: Math.max(1, Number(demand.requiredQuantity) || 1),
    overallTargetabilityScore,
    label: targetabilityLabel(overallTargetabilityScore),
    reasons: ["Static recommendation index fallback"],
    signals: {
      qualityFit,
      yieldPotential,
      sourceWeight,
      routeTargetability: overallTargetabilityScore,
      materialName: row.materialName,
      canonicalMaterialName: demand.displayName,
      locationName: row.locationDisplayName,
      qualityChance,
      selectedQuality: threshold,
      thresholdChance: qualityChance,
      compositionAverage: row.compositionAveragePercentage,
      probability: row.sourceProbabilitySum,
      sourceStrength: sourceWeight,
      sourceRowCount: row.sourceCount,
      sourceFieldsUsed: [
        "location_material_index.json",
        "material_quality_index.json",
        "material_encounter_rankings.json",
      ],
    },
  };
}

function buildStaticRecommendations(
  request: MiningRecommendationRequest,
  index: StaticMiningIndex,
): RecommendationResponse {
  const demand = request.requiredMaterials.map(toCanonicalDemand);
  const demandByKey = new Map(demand.map((material) => [material.materialKey, material]));
  const hasDemand = demand.length > 0;

  const groups = new Map<string, StaticLocationMaterialRow[]>();
  for (const row of index.rows) {
    const groupKey = `${row.systemKey}::${row.locationKey}`;
    const rows = groups.get(groupKey) ?? [];
    rows.push(row);
    groups.set(groupKey, rows);
  }

  const recommendations: PublicLocationEntry[] = [];
  const diagnosticsCoverage = new Map<string, NonNullable<RecommendationResponse["diagnostics"]>["materialCoverage"][number]>();

  for (const rows of groups.values()) {
    const first = rows[0];
    if (!first) continue;

    const rowByMaterialKey = new Map(rows.map((row) => [getStaticMaterialKey(row), row]));
    const coveredDemand = demand.filter((material) => rowByMaterialKey.has(material.materialKey));
    if (hasDemand && coveredDemand.length === 0) continue;

    const routeScores = coveredDemand
      .map((material) => buildStaticRouteScore(rowByMaterialKey.get(material.materialKey)!, material, index))
      .sort((left, right) => right.overallTargetabilityScore - left.overallTargetabilityScore);

    const coverageRatio = hasDemand ? coveredDemand.length / demand.length : 1;
    const weightedDemandScore = routeScores.reduce((sum, score) => {
      const qty = demandByKey.get(score.materialKey)?.requiredQuantity ?? 1;
      return sum + score.overallTargetabilityScore * Math.max(1, Number(qty) || 1);
    }, 0);
    const demandWeight = coveredDemand.reduce((sum, material) => sum + Math.max(1, Number(material.requiredQuantity) || 1), 0);
    const averageRouteScore = demandWeight > 0 ? weightedDemandScore / demandWeight : 0;
    const routeTargetabilityScore = Math.round((coverageRatio * 70) + (averageRouteScore * 0.3));

    recommendations.push({
      locationKey: first.locationKey,
      locationName: first.locationDisplayName || first.location,
      systemName: first.systemDisplayName || first.system,
      matchedLocationCodes: unique(rows.flatMap((row) => [row.locationKey, row.location]).filter(Boolean)),
      locationKind: first.parents?.[0] ?? "location",
      spawnType: miningTypeFromRows(rows),
      nearbyStations: [],
      materials: unique(rows.map((row) => row.materialName).filter(Boolean)),
      indexedResources: rows.map((row) => ({
        materialId: row.materialId,
        materialName: row.materialName,
        miningType: displayMiningMethod(row.resolvedMineableClass),
      })),
      score: routeTargetabilityScore,
      routeTargetabilityScore,
      routeTargetabilityLabel: targetabilityLabel(routeTargetabilityScore),
      routeScores,
      requiredMaterials: coveredDemand.map((material) => ({
        materialKey: material.materialKey,
        materialId: material.materialId,
        materialName: material.materialName,
        displayName: material.displayName,
        requiredQuantity: material.requiredQuantity,
        selectedQuality: material.selectedQuality,
        unitType: material.unitType,
        displayQuantity: String(material.requiredQuantity),
      })),
    });

    for (const material of coveredDemand) {
      const coverage = diagnosticsCoverage.get(material.materialKey) ?? {
        materialKey: material.materialKey,
        materialId: material.materialId,
        displayName: material.displayName,
        miningType: material.unitType,
        unitType: material.unitType,
        sourceCount: 0,
        candidateLocations: [],
        matchingResourceKeys: [],
      };
      coverage.sourceCount += 1;
      coverage.candidateLocations.push({
        locationKey: first.locationKey,
        locationName: first.locationDisplayName || first.location,
        systemName: first.systemDisplayName || first.system,
        spawnType: miningTypeFromRows(rows),
        miningType: miningTypeFromRows(rows),
      });
      coverage.matchingResourceKeys.push(`${first.systemKey}::${first.locationKey}::${material.materialKey}`);
      diagnosticsCoverage.set(material.materialKey, coverage);
    }
  }

  recommendations.sort((left, right) =>
    (right.routeTargetabilityScore ?? right.score) - (left.routeTargetabilityScore ?? left.score) ||
    (right.requiredMaterials?.length ?? 0) - (left.requiredMaterials?.length ?? 0) ||
    left.locationName.localeCompare(right.locationName)
  );

  return {
    recommendations,
    warnings: [{
      code: "STATIC_RECOMMENDER_FALLBACK",
      message: "Using static recommendation indexes because the recommender POST endpoint is unavailable.",
      path: "/api/recommendations/location_material_index.json",
    }],
    diagnostics: {
      materialCoverage: [...diagnosticsCoverage.values()],
    },
  };
}

async function getStaticMiningRecommendations(request: MiningRecommendationRequest): Promise<RecommendationResponse> {
  const index = await loadStaticMiningIndex();
  return buildStaticRecommendations(request, index);
}

async function getFallbackMiningRecommendations(
  request: MiningRecommendationRequest,
  url: string,
  reason: FallbackReason,
): Promise<RecommendationResponse> {
  console.warn("Recommender POST unavailable, falling back to static indexes", {
    url,
    reason: formatFallbackReason(reason),
    status: reason.status,
  });

  const fallbackResponse = await getStaticMiningRecommendations(request);
  logRecommendationDiagnostic("static-fallback", fallbackResponse, request.requiredMaterials.length, reason);
  return fallbackResponse;
}

async function parseRecommendationResponse(
  response: Response,
): Promise<RecommendationResponse | FallbackReason> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.toLowerCase().includes("text/html")) {
    return {
      type: "invalid-response",
      status: response.status,
      contentType,
      detail: "POST returned HTML",
    };
  }

  const body = await response.text();
  const trimmedBody = body.trim();
  if (!trimmedBody) {
    return {
      type: "invalid-response",
      status: response.status,
      contentType,
      detail: "POST returned an empty response",
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmedBody);
  } catch {
    return {
      type: "invalid-response",
      status: response.status,
      contentType,
      detail: "POST returned invalid JSON",
    };
  }

  if (!isValidRecommendationResponse(parsed)) {
    return {
      type: "invalid-response",
      status: response.status,
      contentType,
      detail: "POST returned an invalid RecommendationResponse",
    };
  }

  return parsed;
}

export async function getMiningRecommendations(
  request: MiningRecommendationRequest,
  signal?: AbortSignal,
): Promise<RecommendationResponse> {
  const url = apiUrl("/api/recommender/recommendations");
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(toRecommenderApiRequest(request)),
    signal,
  });

  if (!response.ok) {
    if (response.status === 404 || response.status === 405) {
      return getFallbackMiningRecommendations(request, url, {
        type: "status",
        status: response.status,
      });
    }
    throw new Error(`Recommender API failed with ${response.status}`);
  }

  const parsedResponse = await parseRecommendationResponse(response);
  if ("type" in parsedResponse) {
    return getFallbackMiningRecommendations(request, url, parsedResponse);
  }

  logRecommendationDiagnostic("post", parsedResponse, request.requiredMaterials.length);
  return parsedResponse;
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
      materialId: canonicalMiningMaterial(m).key,
      materialKey: canonicalMiningMaterial(m).key,
      materialName: canonicalMiningMaterial(m).label,
      displayName: canonicalMiningMaterial(m).label,
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

export function downloadRecommendationRequest(request: MiningRecommendationRequest): void {
  const blob = new Blob([JSON.stringify(request, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "mining_recommender_request.json";
  a.click();
  URL.revokeObjectURL(url);
}
