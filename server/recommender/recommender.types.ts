import type { ApiWarning } from "../shared/warnings";

export type MaterialUnitType = "unit" | "SCU" | "scu" | "cscu";

export interface RequirementInput {
  materialId?: string;
  materialName?: string;
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
  materialId: string;
  materialName: string;
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
  probability?: number;
  composition?: {
    minPercentage?: number;
    maxPercentage?: number;
    averagePercentage?: number;
    qualityScale?: number;
  };
  quality?: {
    mean?: number | null;
    qualityTier?: string;
    thresholdChances?: Record<string, number>;
  };
  scoreInputs?: { qualityScore?: number };
  overallScore?: number;
  reason?: string;
}

export interface MaterialSourceGroup {
  materialId?: string;
  materialName?: string;
  bestSources?: ApiSource[];
  sources?: ApiSource[];
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
  spawnType: string;
  nearbyStations: string[];
  materials: string[];
  score: number;
  coveredRequirements: AggregatedRequirement[];
  bestSources: ApiSource[];
}

export interface Recommendation {
  locationKey: string;
  locationName: string;
  locationKind: string;
  systemName: string;
  spawnType: string;
  nearbyStations: string[];
  materials: string[];
  score: number;
  reason: string;
  requiredMaterials: Array<{
    materialId: string;
    materialName: string;
    requiredQuantity: number;
    selectedQuality?: number;
    unitType?: MaterialUnitType;
    displayQuantity: string;
  }>;
}

export interface RecommendResponse {
  recommendations: Recommendation[];
  warnings: RecommenderWarning[];
}
