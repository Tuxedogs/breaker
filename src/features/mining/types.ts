export interface RecommendationSummary {
  queueItems: number;
  requiredMaterials: number;
  matchedMaterials: number;
  unmatchedMaterials: number;
  missingBlueprints: number;
  recommendedRoutes: number;
  limitSources?: number;
  limitRoutes?: number;
}

export interface QueueItem {
  blueprintGuid: string;
  quantity: number;
  targetQualities: Record<string, unknown>;
}

export interface UsedByBlueprint {
  requirementId?: string;
  blueprintGuid: string;
  displayName: string;
  componentType: string;
  size: string;
  quantity: number;
  slot: string;
  materialQuantity: number;
  selectedQuality?: number;
  unitType?: "unit" | "SCU" | "scu" | "cscu";
}

export interface RequiredMaterial {
  materialKey?: string;
  materialId: string;
  materialName: string;
  displayName?: string;
  normalizedName?: string;
  slug?: string;
  quantity?: number;
  originalRequiredQuantity?: number;
  requiredQuantity: number;
  selectedQuality?: number;
  unitType?: "unit" | "SCU" | "scu" | "cscu";
  estimatedRawOreNeeded?: number;
  usedBy: UsedByBlueprint[];
  slots: string[];
}

export interface ScoreInputs {
  probabilityScore: number;
  compositionScore: number;
  qualityScore: number;
  spawnTypeWeight: number;
}

export interface Composition {
  minPercentage: number;
  maxPercentage: number;
  averagePercentage: number;
  curveExponent: number;
  qualityScale: number;
}

export interface BestSource {
  materialId: string;
  materialName: string;
  system: string;
  location: string;
  locationType: string;
  spawnType: string;
  providerGuid?: string;
  providerName?: string;
  groupName?: string;
  probability?: number;
  composition?: Composition;
  scoreInputs?: ScoreInputs;
  overallScore: number;
  reason: string;
}

export interface BestSourcesByMaterial {
  materialId: string;
  materialName: string;
  requiredQuantity: number;
  slots: string[];
  usedBy: UsedByBlueprint[];
  sourceCount: number;
  bestSources: BestSource[];
}

export interface BestRoute {
  system: string;
  location: string;
  spawnType: string;
  materialsCovered?: string[];
  queuedMaterialsCovered: string[];
  queuedCoverageRatio: number;
  routeScore: number;
  queueRouteScore: number;
  sourceCount: number;
  bestSourceScore: number;
  averageSourceScore: number;
  reason: string;
  bestSources?: BestSource[];
}

export interface UnmatchedMaterial {
  materialId: string;
  materialName: string;
  requiredQuantity: number;
}

export interface MissingBlueprint {
  blueprintGuid: string;
  quantity: number;
}

export interface BuildQueueRecommendationFixture {
  summary: RecommendationSummary;
  queueItems: QueueItem[];
  requiredMaterials: RequiredMaterial[];
  bestSourcesByMaterial: BestSourcesByMaterial[];
  bestRoutes: BestRoute[];
  unmatchedMaterials: UnmatchedMaterial[];
  missingBlueprints: MissingBlueprint[];
}

// ── Planner intent types (Phase 2) ──────────────────────────────────────────

export interface MiningPriorityItem {
  id: string;
  materialId: string | null;
  materialName: string;
  priorityRank: number;
  pinned: boolean;
  source: "requiredMaterial" | "manual";
  createdAt: string;
}

export interface ManualMiningDemandItem {
  id: string;
  materialName: string;
  desiredQuantity: number;
  sourceType: "ore" | "raw" | "refined" | "unknown";
  notes: string;
  addToPriority: boolean;
  createdAt: string;
}

export interface FavoriteMiningLocation {
  key: string;
  system: string;
  location: string;
  spawnType: string;
  starredAt: string;
}

export interface MiningPlannerFilters {
  showOnlyStarred: boolean;
}

export interface MiningPlannerIntentPayload {
  priorityStack: MiningPriorityItem[];
  manualDemand: ManualMiningDemandItem[];
  favoriteLocationIds: string[];
  filters: MiningPlannerFilters;
}

// ── Public explorer types (Phase 3B) ────────────────────────────────────────

/**
 * Sanitized location entry safe for public display.
 * All scoring, probability, composition, and quality fields are intentionally
 * absent — advanced intelligence requires Discord auth (future phase).
 */
export interface PublicLocationEntry {
  locationKey: string; // deduplication key: normalized system + canonical location
  locationName: string;
  systemName: string;
  matchedLocationCodes?: string[];
  locationKind: string;
  spawnType: string;
  nearbyStations: string[];
  materials: string[]; // materialNames present at this location
  indexedResources?: Array<{
    materialId?: string;
    materialName: string;
    miningType: string;
  }>;
  score: number;
  routeTargetabilityScore?: number;
  routeTargetabilityLabel?: "Excellent" | "Strong" | "Good" | "Weak" | "Poor";
  routeScores?: Array<{
    materialKey: string;
    materialId: string;
    materialName: string;
    displayName: string;
    selectedQuality?: number;
    qualityRouteScore: number | null;
    yieldRouteScore: number;
    demandMatchScore: number;
    overallTargetabilityScore: number;
    label: "Excellent" | "Strong" | "Good" | "Weak" | "Poor";
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
      sourceStrength?: number | null;
      sourceRowCount?: number;
      confidence?: number;
      missingComponents?: string[];
      sourceFieldsUsed?: string[];
    };
  }>;
  requiredMaterials?: Array<{
    materialKey?: string;
    materialId: string;
    materialName: string;
    displayName?: string;
    normalizedName?: string;
    slug?: string;
    requiredQuantity: number;
    selectedQuality?: number;
    unitType?: "unit" | "SCU" | "scu" | "cscu";
    displayQuantity: string;
  }>;
}

// ── Recommender request contract (Phase 3) ───────────────────────────────────

export interface MiningRecommendationRequest {
  /** Semver-style contract version so the backend script can validate compatibility. */
  version: "1.0";
  generatedAt: string;
  /** Derived from the active build queue fixture — populated when data is loaded. */
  requiredMaterials: Array<{
    materialKey?: string;
    materialId: string;
    materialName: string;
    displayName?: string;
    normalizedName?: string;
    slug?: string;
    requiredQuantity: number;
    selectedQuality?: number;
    unitType?: "unit" | "SCU" | "scu" | "cscu";
    modifierName?: string;
    modifierType?: string;
    modifierValue?: number;
  }>;
  priorityStack: MiningPriorityItem[];
  manualDemand: ManualMiningDemandItem[];
  favoriteLocationIds: string[];
  filters: MiningPlannerFilters;
  /** Placeholder for future refinery context (active refinery, processing speed, etc.). */
  refineryContext: null;
  /** Snapshot of the fixture the request was built against — for traceability. */
  currentFixtureSummary: {
    queueItems: number;
    requiredMaterials: number;
    recommendedRoutes: number;
  } | null;
}
