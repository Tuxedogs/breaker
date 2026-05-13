import type { ApiWarning } from "../shared/warnings";

export type MaterialUnitType = "unit" | "SCU" | "scu" | "cscu";

export interface RequirementInput {
  materialKey?: string;
  materialId?: string;
  materialName?: string;
  displayName?: string;
  normalizedName?: string;
  slug?: string;
  requiredQuantity: number;
  selectedQuality?: number;
  unitType?: MaterialUnitType;
  usedBy?: Array<{
    selectedQuality?: number;
    unitType?: MaterialUnitType;
    materialQuantity?: number;
  }>;
}

export interface RecommendRequest {
  requiredMaterials?: RequirementInput[];
  buildQueue?: Array<{ requiredMaterials?: RequirementInput[] }>;
  materialRequirements?: RequirementInput[];
  favoriteLocationIds?: string[];
  filters?: { showOnlyStarred?: boolean };
}

export interface AggregatedRequirement {
  materialKey: string;
  materialId: string;
  materialName: string;
  displayName: string;
  normalizedName: string;
  slug: string;
  requiredQuantity: number;
  selectedQuality?: number;
  unitType?: MaterialUnitType;
}

export type RecommenderWarning = ApiWarning;

export interface ApiSource {
  materialId?: string;
  materialName?: string;
  system?: string;
  location?: string;
  locationType?: string;
  spawnType?: string;
  providerName?: string;
  providerGuid?: string;
  groupName?: string;
  harvestableGuid?: string;
  harvestableName?: string;
  clusteringGuid?: string;
  clusteringName?: string;
  entityClass?: string;
  mineableEntity?: string;
  compositionGuid?: string;
  compositionName?: string;
  probability?: number;
  relativeProbability?: number;
  materialProbability?: number;
  groupProbability?: number;
  composition?: {
    minPercentage?: number;
    maxPercentage?: number;
    averagePercentage?: number;
    qualityScale?: number;
  };
  quality?: {
    min?: number | null;
    max?: number | null;
    mean?: number | null;
    qualityTier?: string;
    distributionName?: string;
    distributionPath?: string;
    thresholdChances?: Record<string, number>;
  };
  estimatedHighQualityPotential?: number;
  scoreInputs?: {
    probabilityScore?: number;
    compositionScore?: number;
    qualityScore?: number;
    spawnTypeWeight?: number;
  };
  overallScore?: number;
  reason?: string;
  sourceResolverPath?: string;
  perLocationOverrideApplied?: boolean;
  overrideFieldsApplied?: string[];
  sourceLocationRawName?: string;
  sourceLocationKey?: string;
  sourceLocationId?: string;
  systemLocationId?: string;
  sourceLocationParentIds?: string[];
  materialKeyResolved?: string;
  materialAliasApplied?: boolean;
  originalMaterialName?: string;
  originalMaterialKey?: string;
  canonicalMaterialName?: string;
  canonicalMaterialKey?: string;
}

export type RouteTargetabilityLabel = "Excellent" | "Strong" | "Good" | "Weak" | "Poor";

export interface MaterialRouteScore {
  materialKey: string;
  materialId: string;
  materialName: string;
  displayName: string;
  selectedQuality?: number;
  qualityRouteScore: number | null;
  yieldRouteScore: number;
  demandMatchScore: number;
  overallTargetabilityScore: number;
  label: RouteTargetabilityLabel;
  comparison?: string;
  reasons: string[];
  specialSignals?: Array<{
    label: string;
    reason?: string;
  }>;
  signals: {
    qualityFit: number | null;
    yieldPotential: number;
    sourceWeight: number;
    routeTargetability: number;
    competingSources?: number;
    materialName?: string;
    canonicalMaterialName?: string;
    locationName?: string;
    qualityChance?: number | null;
    qualityIgnored?: boolean;
    compositionScore?: number | null;
    encounterScore?: number | null;
    proxyEncounterScore?: boolean;
    recommendationScore?: number;
    selectedQuality?: number;
    thresholdChance?: number | null;
    compositionAverage?: number | null;
    compositionMax?: number | null;
    probability?: number | null;
    groupProbability?: number | null;
    relativeProbability?: number | null;
    materialProbability?: number | null;
    providerWeightedSignal?: number | null;
    materialBiasSignal?: number | null;
    normalizedWithinMethodSignal?: number | null;
    sourceStrength?: number | null;
    sourceRowCount?: number;
    confidence?: number;
    missingComponents?: string[];
    sourceFieldsUsed?: string[];
  };
}

export interface MaterialCoverageDiagnostic {
  materialKey: string;
  materialId: string;
  displayName: string;
  miningType?: string;
  unitType?: MaterialUnitType;
  sourceCount: number;
  candidateLocations: Array<{
    locationKey: string;
    locationName: string;
    systemName: string;
    spawnType: string;
    miningType: string;
  }>;
  matchingResourceKeys: string[];
}

export interface ScoreContributionDiagnostic {
  materialKey: string;
  materialId: string;
  materialName: string;
  displayName: string;
  locationKey: string;
  locationName: string;
  systemName: string;
  baseScore: number;
  overallScore?: number;
  compositionAverageUsed?: number;
  compositionMaxUsed?: number;
  selectedQuality?: number;
  thresholdChanceUsed?: number;
  qualityFit: number;
  requirementWeight: number;
  finalContribution: number;
  compositionMissing: boolean;
  thresholdDataMissing: boolean;
  sourceResolverPath?: string;
  perLocationOverrideApplied: boolean;
  overrideFieldsApplied: string[];
  sourceLocationRawName?: string;
  sourceLocationKey?: string;
  materialKeyResolved: string;
  materialAliasApplied: boolean;
  originalMaterialName?: string;
  originalMaterialKey?: string;
  canonicalMaterialName: string;
  canonicalMaterialKey: string;
}

export interface MaterialSourceGroup {
  materialId?: string;
  materialName?: string;
  bestSources?: ApiSource[];
  sources?: ApiSource[];
  locationOverrides?: unknown[];
  perLocationOverrides?: unknown[];
  locations?: unknown[];
  providers?: unknown[];
}

export interface RecommenderApiData {
  materialGroups: MaterialSourceGroup[];
  locationMetadata: Record<string, {
    locationName?: string;
    locationKind?: string;
    systemName?: string;
    nearbyStations?: string[];
  }>;
  consumedFiles: string[];
}

export interface ScoredLocation {
  locationKey: string;
  locationName: string;
  locationKind: string;
  systemName: string;
  matchedLocationCodes?: string[];
  spawnType: string;
  nearbyStations: string[];
  materials: string[];
  indexedResources: Array<{
    materialId?: string;
    materialName: string;
    miningType: string;
  }>;
  score: number;
  coveredRequirements: AggregatedRequirement[];
  bestSources: ApiSource[];
  scoreDiagnostics?: ScoreContributionDiagnostic[];
  routeScores?: MaterialRouteScore[];
}

export interface Recommendation {
  locationKey: string;
  locationName: string;
  locationKind: string;
  systemName: string;
  matchedLocationCodes?: string[];
  spawnType: string;
  nearbyStations: string[];
  materials: string[];
  indexedResources: Array<{
    materialId?: string;
    materialName: string;
    miningType: string;
  }>;
  score: number;
  routeTargetabilityScore?: number;
  routeTargetabilityLabel?: RouteTargetabilityLabel;
  routeScores?: MaterialRouteScore[];
  reason: string;
  requiredMaterials: Array<{
    materialId: string;
    materialName: string;
    displayName: string;
    materialKey: string;
    normalizedName: string;
    slug: string;
    requiredQuantity: number;
    selectedQuality?: number;
    unitType?: MaterialUnitType;
    displayQuantity: string;
  }>;
}

export interface RecommendResponse {
  recommendations: Recommendation[];
  warnings: RecommenderWarning[];
  diagnostics?: {
    materialCoverage: MaterialCoverageDiagnostic[];
    scoreContributions?: ScoreContributionDiagnostic[];
  };
}
