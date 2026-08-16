export type MissionEligibilityStatus =
  | "eligible"
  | "blocked"
  | "unavailable"
  | "unresolved"
  | "excluded";

export type MissionConditionStatus =
  | "satisfied"
  | "blocked"
  | "unresolved"
  | "excluded"
  | "unavailable"
  | "informational";

export type MissionSourceProvenance = {
  sourceRef: string;
  sourceElement?: string | null;
  referencePath?: string | null;
};

export type MissionPrerequisiteEdge = {
  edgeId: string;
  variantId: string;
  ownerScope?: string;
  ownerId?: string;
  type: string;
  polarity?: "required" | "excluded";
  identifiers?: Record<string, unknown>;
  bounds?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  resolution?: string;
  provenance: MissionSourceProvenance;
};

export type MissionOutcomeEdge = {
  edgeId: string;
  variantId: string;
  type: string;
  payload?: Record<string, unknown>;
  provenance: MissionSourceProvenance;
};

export type MissionSolverVariant = {
  identity: {
    variantId: string;
    familyId: string;
    templateGuid: string | null;
  };
  availability: {
    notForRelease: boolean;
    workInProgress: boolean;
  };
  prerequisites: MissionPrerequisiteEdge[];
  outcomes: MissionOutcomeEdge[];
};

export type PlayerReputationState = {
  factionId: string;
  scopeId: string;
  status: "known" | "unknown";
  standingId?: string | null;
  reputationValue?: number | null;
};

export type PlayerMissionState = {
  completedContracts: {
    knowledge: "complete" | "partial";
    countsByContract: Record<string, number>;
  };
  completionTags: {
    knowledge: "complete" | "partial";
    countsByTag: Record<string, number>;
  };
  reputation: PlayerReputationState[];
  crimeStat: { status: "known"; value: number } | { status: "unknown" };
  location: {
    status: "known";
    locationId?: string | null;
    systemId?: string | null;
    localityIds: string[];
    membershipKnowledge: "complete" | "partial";
  } | {
    status: "unknown";
  };
};

export type MissionEligibilityContext = {
  /** Source-backed standing GUID to minimum reputation threshold mapping. */
  standingThresholdsById?: Record<string, number>;
  /** Authoritative runtime bindings keyed by `${locationLevelType}:${propertyVariableName}`. */
  locationPropertyBindings?: Record<string, boolean>;
};

export type MissionEligibilityExplanation = {
  code: string;
  status: MissionConditionStatus;
  edgeId: string | null;
  prerequisiteType: string | "availability";
  message: string;
  expected?: unknown;
  actual?: unknown;
  provenance?: MissionSourceProvenance;
};

export type MissionEligibilityResult = {
  variantId: string;
  status: MissionEligibilityStatus;
  explanations: MissionEligibilityExplanation[];
  blockers: MissionEligibilityExplanation[];
  unavailable: MissionEligibilityExplanation[];
  unresolved: MissionEligibilityExplanation[];
  exclusions: MissionEligibilityExplanation[];
};

export type MissionGraphDependency = {
  prerequisiteEdgeId: string;
  consumerVariantId: string;
  completionTag: string;
  producerVariantIds: string[];
  resolution: string;
};

export type MissionGraphArc = {
  producerVariantId: string;
  consumerVariantId: string;
  completionTag: string;
  prerequisiteEdgeId: string;
};

export type MissionGraphCycle = {
  variantIds: string[];
  arcs: MissionGraphArc[];
};

export type MissionSolverGraph = {
  schemaVersion: 2 | 3;
  sourceContractVersion: 3 | 4;
  offerSchemaVersion?: 1;
  generationId: string;
  nodeCount: number;
  dependencies: MissionGraphDependency[];
  arcs: MissionGraphArc[];
};

export type MissionGraphValidationReport = {
  schemaVersion: 2 | 3;
  sourceContractVersion: 3 | 4;
  offerSchemaVersion?: 1;
  generationId: string;
  summary: {
    requiredTagCount: number;
    danglingRequiredTagCount: number;
    excludedTagCount: number;
    danglingExcludedTagCount: number;
    alternateProducerTagCount: number;
    branchRequiredTagCount: number;
    danglingBranchTagCount: number;
    cycleComponentCount: number;
  };
  cycles: MissionGraphCycle[];
};

export type MissionPathGoal =
  | { type: "completion_tag"; completionTag: string; requiredCount?: number }
  | { type: "variant_eligibility"; variantId: string };

export type MissionPathStep = {
  ordinal: number;
  variantId: string;
  eligibility: MissionEligibilityResult;
  grantedCompletionTags: Record<string, number>;
  prerequisiteEdgeIds: string[];
  outcomeEdgeIds: string[];
  assumptions: string[];
};

export type MissionPathPlan = {
  missionCount: number;
  steps: MissionPathStep[];
};

export type MissionPathFailure = {
  code: string;
  message: string;
  variantId?: string;
  completionTag?: string;
  eligibility?: MissionEligibilityResult;
};

export type MissionPathSolveResult = {
  generationId: string;
  goal: MissionPathGoal;
  costModel: {
    type: "mission_count";
    unit: "mission_completion";
  };
  status:
    | "satisfied"
    | "path_found"
    | "blocked"
    | "unavailable"
    | "excluded"
    | "unresolved";
  minimumMissionCount: number | null;
  primaryPlan: MissionPathPlan | null;
  alternatePlans: MissionPathPlan[];
  alternatePlansTruncated: boolean;
  exploredStateCount: number;
  failures: MissionPathFailure[];
  relevantCycles: MissionGraphCycle[];
};

export type MissionPathSolveOptions = {
  maxAlternates?: number;
  maxStates?: number;
};
