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
  getStantonLagrangeGroupForLocationCode,
  loadStantonLagrangeGroupData,
} from "../locations/stantonLagrangeChildren";
import {
  displayMiningMethod,
  getStaticDensityScore,
  getStaticMaterialKey,
  getStaticMaterialQualityRow,
  loadStaticMiningIndex,
  type StaticLocationMaterialRow,
  type StaticMiningIndex,
} from "./staticMiningIndex";
import { rankEvidence, type MiningRankingMode } from "./rankingContract";

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
  | { type: "invalid-response"; status: number; contentType: string; detail: string; bodyPreview?: string }
  | { type: "scorer-unavailable"; detail: string };

function hasScorerUnavailableWarning(warnings: RecommenderWarning[]): boolean {
  return warnings.some((warning) => {
    if (warning.code === "api_file_unreadable") return true;
    const text = `${warning.code} ${warning.message} ${warning.path ?? ""}`.toLowerCase();
    return text.includes("enoent") || text.includes("unable to read api file");
  });
}

function hasZeroScorerDiagnostics(response: RecommendationResponse): boolean {
  const coverage = response.diagnostics?.materialCoverage ?? [];
  if (coverage.length === 0) return true;
  return coverage.every((entry) => entry.sourceCount === 0 && entry.candidateLocations.length === 0);
}

function shouldUseStaticFallbackForPostResponse(
  response: RecommendationResponse,
  demandCount: number,
): boolean {
  if (demandCount === 0) return false;
  if (response.recommendations.length > 0) return false;
  if (response.warnings.some((warning) => warning.code === "requirements_empty")) return false;

  if (hasScorerUnavailableWarning(response.warnings)) return true;

  return hasZeroScorerDiagnostics(response)
    && response.warnings.some((warning) => warning.code === "api_field_missing");
}

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
  if (reason.type === "scorer-unavailable") return reason.detail;
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

function staticEncounterPct(row: StaticLocationMaterialRow, index: StaticMiningIndex): number {
  return clampPct(getStaticDensityScore(row, index) ?? row.materialEncounterScore ?? row.encounterScore);
}

function getRankingMode(request: MiningRecommendationRequest): MiningRankingMode | undefined {
  return request.rankingMode;
}

function staticMiningMethod(row: StaticLocationMaterialRow): string {
  const value = row.resolvedMineableClass.toLowerCase();
  if (value.includes("ship") || value.includes("orbit")) return "ship";
  if (value.includes("geo") || value.includes("vehicle") || value.includes("ground")) return "ground";
  if (value.includes("hand")) return "hand";
  if (value.includes("harvest")) return "harvestable";
  return value;
}

type StaticLocationRowsGroup = {
  rows: StaticLocationMaterialRow[];
  locationKey: string;
  locationName: string;
  matchedLocationCodes?: string[];
};

export function groupStaticMiningBrowseRows(rows: StaticLocationMaterialRow[]): StaticLocationRowsGroup[] {
  const groups = new Map<string, StaticLocationRowsGroup>();

  for (const row of rows) {
    const systemName = row.systemDisplayName ?? row.system ?? "";
    const locationCode = row.locationKey ?? row.location ?? "";
    const lagrangeGroup = systemName.toLowerCase() === "stanton"
      ? getStantonLagrangeGroupForLocationCode(locationCode)
      : null;
    const locationKey = lagrangeGroup
      ? `stanton|${lagrangeGroup.label}`
      : row.locationKey;
    const locationName = lagrangeGroup?.label ?? (row.locationDisplayName || row.location);
    const groupKey = lagrangeGroup
      ? locationKey
      : `${row.systemKey}::${row.locationKey}`;
    const group = groups.get(groupKey);

    if (group) {
      group.rows.push(row);
      continue;
    }

    groups.set(groupKey, {
      rows: [row],
      locationKey,
      locationName,
      matchedLocationCodes: lagrangeGroup?.locations,
    });
  }

  return [...groups.values()];
}

function buildStaticRouteScore(
  row: StaticLocationMaterialRow,
  demand: CanonicalDemand,
  index: StaticMiningIndex,
  rankingMode: MiningRankingMode | undefined,
): NonNullable<PublicLocationEntry["routeScores"]>[number] {
  const threshold = demand.selectedQuality;
  const qualityRow = getStaticMaterialQualityRow(row, index);
  const qualityChance = threshold === undefined ? null : getRowQualityChance(row, index, threshold);
  // The published relative-density range may be absent in a partial/static
  // fixture. In that case use the delivered encounter signal directly rather
  // than collapsing every route to a fabricated zero.
  const encounterPct = staticEncounterPct(row, index);
  const qualityPct = qualityChance == null ? 0 : clampPct(qualityChance * 100);
  const qualityFit = qualityChance == null ? null : Math.round(qualityPct);
  const compositionPct = getCompositionPct(row);
  const methodFitPct = getMethodFitPct(row);
  // Explicit modes share the server's two-domain evidence contract. The
  // static fallback's yield input is its published encounter index; it is not
  // a validated mechanical yield calculation.
  const materialFitScore = rankingMode === undefined
    ? encounterPct * 0.35 + qualityPct * 0.45 + compositionPct * 0.10 + methodFitPct * 0.10
    : rankEvidence(rankingMode, qualityPct / 100, encounterPct / 100) * 100;
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

export function buildStaticRecommendations(
  request: MiningRecommendationRequest,
  index: StaticMiningIndex,
): RecommendationResponse {
  const demand = request.requiredMaterials.map(toCanonicalDemand);
  const demandByKey = new Map(demand.map((material) => [material.materialKey, material]));
  const hasDemand = demand.length > 0;
  const rankingMode = getRankingMode(request);
  const allowedMethods = request.allowedMiningMethods?.length
    ? new Set(request.allowedMiningMethods.map((method) => method.trim().toLowerCase()).filter(Boolean))
    : null;

  const groups = groupStaticMiningBrowseRows(index.rows);

  const recommendations: PublicLocationEntry[] = [];
  const diagnosticsCoverage = new Map<string, NonNullable<RecommendationResponse["diagnostics"]>["materialCoverage"][number]>();

  for (const group of groups) {
    const { rows } = group;
    const first = rows[0];
    if (!first) continue;

    const rowsByMaterialKey = new Map<string, StaticLocationMaterialRow[]>();
    for (const row of rows) {
      const key = getStaticMaterialKey(row);
      rowsByMaterialKey.set(key, [...(rowsByMaterialKey.get(key) ?? []), row]);
    }
    const coveredDemand = demand.filter((material) => rowsByMaterialKey.has(material.materialKey));
    if (hasDemand && coveredDemand.length === 0) continue;

    const eligibleRowByMaterialKey = new Map<string, StaticLocationMaterialRow>();
    for (const material of coveredDemand) {
      const eligible = (rowsByMaterialKey.get(material.materialKey) ?? []).filter((row) =>
        (!allowedMethods || allowedMethods.has(staticMiningMethod(row))) &&
        (material.selectedQuality === undefined || getRowQualityChance(row, index, material.selectedQuality) !== null)
      );
      // A material can have multiple methods at one physical location. Choose
      // the best eligible row; never let an ineligible sibling grant coverage.
      const best = eligible.sort((left, right) => staticEncounterPct(right, index) - staticEncounterPct(left, index))[0];
      if (best) eligibleRowByMaterialKey.set(material.materialKey, best);
    }
    const eligibleDemand = coveredDemand.filter((material) => eligibleRowByMaterialKey.has(material.materialKey));
    if (hasDemand && eligibleDemand.length === 0) continue;

    const routeScores = eligibleDemand
      .map((material) => buildStaticRouteScore(eligibleRowByMaterialKey.get(material.materialKey)!, material, index, rankingMode))
      .sort((left, right) => right.overallTargetabilityScore - left.overallTargetabilityScore);

    const weightedDemandScore = routeScores.reduce((sum, score) => {
      const qty = demandByKey.get(score.materialKey)?.requiredQuantity ?? 1;
      return sum + score.overallTargetabilityScore * Math.max(1, Number(qty) || 1);
    }, 0);
    const demandWeight = eligibleDemand.reduce((sum, material) => sum + Math.max(1, Number(material.requiredQuantity) || 1), 0);
    const locationFitScore = demandWeight > 0 ? weightedDemandScore / demandWeight : 0;
    // Fit describes how good the indexed covered material matches are.
    // Coverage is exposed separately so impossible multi-material combinations
    // do not make every valid single-material location look intrinsically worse.
    const routeTargetabilityScore = Math.round(locationFitScore);

    recommendations.push({
      locationKey: group.locationKey,
      locationName: group.locationName,
      systemName: first.systemDisplayName || first.system,
      matchedLocationCodes: group.matchedLocationCodes ?? unique(rows.flatMap((row) => [row.locationKey, row.location]).filter(Boolean)),
      locationKind: first.parents?.[0] ?? "location",
      spawnType: miningTypeFromRows(rows),
      nearbyStations: [],
      materials: unique(rows.map((row) => row.materialName).filter(Boolean)),
      indexedResources: unique(rows.map((row) => `${row.materialId ?? ""}|${row.materialName}|${row.resolvedMineableClass ?? ""}`)).map((identity) => {
        const row = rows.find((candidate) => `${candidate.materialId ?? ""}|${candidate.materialName}|${candidate.resolvedMineableClass ?? ""}` === identity)!;
        return {
        materialId: row.materialId,
        materialName: row.materialName,
        miningType: displayMiningMethod(row.resolvedMineableClass),
        };
      }),
      score: routeTargetabilityScore,
      routeTargetabilityScore,
      routeTargetabilityLabel: targetabilityLabel(routeTargetabilityScore),
      routeScores,
      // This is request-eligible, quality-supported coverage, not the full
      // physical material membership reported by the static index.
      requiredMaterials: eligibleDemand.map((material) => ({
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

    for (const material of eligibleDemand) {
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
        locationKey: group.locationKey,
        locationName: group.locationName,
        systemName: first.systemDisplayName || first.system,
        spawnType: miningTypeFromRows(rows),
        miningType: miningTypeFromRows(rows),
      });
      coverage.matchingResourceKeys.push(`${group.locationKey}::${material.materialKey}`);
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
      path: "/api/mining/location-materials",
    }],
    diagnostics: {
      materialCoverage: [...diagnosticsCoverage.values()],
    },
  };
}

async function getStaticMiningRecommendations(request: MiningRecommendationRequest): Promise<RecommendationResponse> {
  const [index] = await Promise.all([
    loadStaticMiningIndex(),
    loadStantonLagrangeGroupData(),
  ]);
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
    status: reason.type === "status" ? reason.status : undefined,
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
  if (request.requiredMaterials.length === 0) {
    // Browse mode has no demand input; use the static location index directly
    // so the Mining page still receives the full system/location collection.
    return getStaticMiningRecommendations(request);
  }

  const url = apiUrl("/api/mining/recommendations");

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

  const demandCount = request.requiredMaterials.length;
  if (shouldUseStaticFallbackForPostResponse(parsedResponse, demandCount)) {
    return getFallbackMiningRecommendations(request, url, {
      type: "scorer-unavailable",
      detail: "POST recommender returned no results because local Scintel scorer data is unavailable.",
    });
  }

  logRecommendationDiagnostic("post", parsedResponse, demandCount);
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
