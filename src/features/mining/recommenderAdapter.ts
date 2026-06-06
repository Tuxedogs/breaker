import type {
  BuildQueueRecommendationFixture,
  MiningPlannerIntentPayload,
  MiningRecommendationRequest,
  PublicLocationEntry,
  RequiredMaterial,
} from "./types";
import { canonicalMiningMaterial } from "./materialIdentity";
import { apiUrl } from "../../lib/apiUrl";
import { JsonResponseError, parseJsonResponse } from "../../lib/safeJson";
import {
  displayMiningMethod,
  getStaticDensityScore,
  getStaticMaterialKey,
  getStaticMaterialQualityRow,
  loadStaticMiningIndex,
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

type MiningRankingMode = NonNullable<MiningRecommendationRequest["rankingMode"]>;

const weightsByMode: Record<MiningRankingMode, { encounter: number; quality: number; composition: number; methodFit: number }> = {
  quality: { encounter: 0.35, quality: 0.45, composition: 0.10, methodFit: 0.10 },
  quantity: { encounter: 0.55, quality: 0.10, composition: 0.25, methodFit: 0.10 },
  balanced: { encounter: 0.40, quality: 0.25, composition: 0.20, methodFit: 0.15 },
};

type FallbackReason =
  | { type: "status"; status: number }
  | { type: "invalid-response"; status: number; contentType: string; detail: string; bodyPreview?: string };

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

function clampPct(value: number | null | undefined): number {
  if (value === null || value === undefined || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function getCompositionPct(row: StaticLocationMaterialRow): number {
  const value = row.compositionAveragePercentage;
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return clampPct(value > 1 ? value : value * 100);
}

function getMethodFitPct(row: StaticLocationMaterialRow): number {
  const value = row.methodFit ?? row.locationClassDistributionShare;
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return clampPct(value > 1 ? value : value * 100);
}

function getRankingMode(request: MiningRecommendationRequest): MiningRankingMode {
  return request.rankingMode === "quantity" || request.rankingMode === "balanced" ? request.rankingMode : "quality";
}

function buildStaticRouteScore(
  row: StaticLocationMaterialRow,
  demand: CanonicalDemand,
  index: StaticMiningIndex,
  rankingMode: MiningRankingMode,
): NonNullable<PublicLocationEntry["routeScores"]>[number] {
  const threshold = demand.selectedQuality ?? 800;
  const qualityRow = getStaticMaterialQualityRow(row, index);
  const qualityChance = getRowQualityChance(row, index, threshold);
  const encounterPct = clampPct(getStaticDensityScore(row, index));
  const qualityPct = qualityChance == null ? 0 : clampPct(qualityChance * 100);
  const qualityFit = qualityChance == null ? null : Math.round(qualityPct);
  const compositionPct = getCompositionPct(row);
  const methodFitPct = getMethodFitPct(row);
  const weights = weightsByMode[rankingMode];
  // Coverage is a gate at the location level. Full coverage does not add points;
  // per-material fit is weighted from real indexed density, quality, composition,
  // and the selected material's mining-method share at this location.
  const materialFitScore = (
    encounterPct * weights.encounter +
    qualityPct * weights.quality +
    compositionPct * weights.composition +
    methodFitPct * weights.methodFit
  );
  const overallTargetabilityScore = Math.round(materialFitScore);

  return {
    materialKey: demand.materialKey,
    materialId: demand.materialId,
    materialName: demand.materialName,
    displayName: demand.displayName,
    selectedQuality: threshold,
    qualityRouteScore: qualityChance == null ? null : Math.round(qualityPct),
    yieldRouteScore: Math.round(encounterPct),
    demandMatchScore: Math.max(1, Number(demand.requiredQuantity) || 1),
    overallTargetabilityScore,
    label: targetabilityLabel(overallTargetabilityScore),
    reasons: ["Static recommendation index fallback"],
    signals: {
      qualityFit,
      yieldPotential: Math.round(encounterPct),
      sourceWeight: encounterPct,
      routeTargetability: overallTargetabilityScore,
      encounterPct,
      qualityPct: qualityChance == null ? null : qualityPct,
      compositionPct,
      methodFitPct,
      selectedMethod: displayMiningMethod(row.resolvedMineableClass),
      locationMethodShare: row.methodFit ?? row.locationClassDistributionShare,
      materialName: row.materialName,
      canonicalMaterialName: demand.displayName,
      locationName: row.locationDisplayName,
      qualityChance,
      selectedQuality: threshold,
      thresholdChance: qualityChance,
      qualitySourceScope: qualityRow?.qualitySourceScope ?? null,
      qualitySourceFamily: qualityRow?.qualitySourceFamily ?? null,
      qualityDistributionName: qualityRow?.qualityDistributionSourceName ?? qualityRow?.qualityDistributionSourceNames?.[0] ?? null,
      compositionAverage: row.compositionAveragePercentage,
      probability: row.sourceProbabilitySum,
      encounterScore: row.materialEncounterScore ?? row.encounterScore,
      compositionScore: compositionPct,
      sourceStrength: encounterPct,
      sourceRowCount: row.sourceCount,
      sourceFieldsUsed: [
        "location_material_index.json",
        "materialEncounterScore or encounterScore",
        "compositionAveragePercentage",
        "locationClassDistributionShare/methodFit",
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
  const rankingMode = getRankingMode(request);

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
      .map((material) => buildStaticRouteScore(rowByMaterialKey.get(material.materialKey)!, material, index, rankingMode))
      .sort((left, right) => right.overallTargetabilityScore - left.overallTargetabilityScore);

    const weightedDemandScore = routeScores.reduce((sum, score) => {
      const qty = demandByKey.get(score.materialKey)?.requiredQuantity ?? 1;
      return sum + score.overallTargetabilityScore * Math.max(1, Number(qty) || 1);
    }, 0);
    const demandWeight = coveredDemand.reduce((sum, material) => sum + Math.max(1, Number(material.requiredQuantity) || 1), 0);
    const locationFitScore = demandWeight > 0 ? weightedDemandScore / demandWeight : 0;
    // Fit describes how good the indexed covered material matches are.
    // Coverage is exposed separately so impossible multi-material combinations
    // do not make every valid single-material location look intrinsically worse.
    const routeTargetabilityScore = Math.round(locationFitScore);

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
    bodyPreview: reason.type === "invalid-response" ? reason.bodyPreview : undefined,
  });

  const fallbackResponse = await getStaticMiningRecommendations(request);
  logRecommendationDiagnostic("static-fallback", fallbackResponse, request.requiredMaterials.length, reason);
  return fallbackResponse;
}

async function parseRecommendationResponse(
  response: Response,
  url: string,
): Promise<RecommendationResponse | FallbackReason> {
  let parsed: unknown;
  try {
    parsed = await parseJsonResponse<unknown>(response, {
      label: "mining recommender POST",
      url,
    });
  } catch (error) {
    if (error instanceof JsonResponseError) {
      return {
        type: "invalid-response",
        status: error.status,
        contentType: error.contentType,
        detail: error.message,
        bodyPreview: error.bodyPreview,
      };
    }
    return {
      type: "invalid-response",
      status: response.status,
      contentType: response.headers.get("content-type") ?? "",
      detail: "POST returned invalid JSON",
    };
  }

  if (!isValidRecommendationResponse(parsed)) {
    return {
      type: "invalid-response",
      status: response.status,
      contentType: response.headers.get("content-type") ?? "",
      detail: "POST returned an invalid RecommendationResponse",
    };
  }

  return parsed;
}

let recommenderUnavailable = false;

export async function getMiningRecommendations(
  request: MiningRecommendationRequest,
  signal?: AbortSignal,
): Promise<RecommendationResponse> {
  const url = apiUrl("/api/recommender/recommendations");

  if (recommenderUnavailable) {
    return getStaticMiningRecommendations(request);
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(toRecommenderApiRequest(request)),
    signal,
  });

  const parsedResponse = await parseRecommendationResponse(response, url);
  if ("type" in parsedResponse) {
    if (response.status === 404 || response.status === 405 || parsedResponse.type === "invalid-response") {
      recommenderUnavailable = response.status === 404 || response.status === 405;
      return getFallbackMiningRecommendations(request, url, parsedResponse);
    }
    throw new Error(`Recommender API failed with ${response.status}`);
  }

  if (!response.ok) {
    if (response.status === 404 || response.status === 405) {
      recommenderUnavailable = true;
      return getFallbackMiningRecommendations(request, url, {
        type: "status",
        status: response.status,
      });
    }
    throw new Error(`Recommender API failed with ${response.status}`);
  }

  logRecommendationDiagnostic("post", parsedResponse, request.requiredMaterials.length);
  return parsedResponse;
}

export function buildRecommendationRequest(
  intentPayload: MiningPlannerIntentPayload,
  fixture: BuildQueueRecommendationFixture | null,
  queuedRequirements?: MiningRecommendationRequest["requiredMaterials"],
  rankingMode: MiningRecommendationRequest["rankingMode"] = "quality",
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
    rankingMode,
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
