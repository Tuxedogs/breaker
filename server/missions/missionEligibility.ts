import type {
  MissionConditionStatus,
  MissionEligibilityContext,
  MissionEligibilityExplanation,
  MissionEligibilityResult,
  MissionPrerequisiteEdge,
  MissionSolverVariant,
  PlayerMissionState,
} from "./missionSolverTypes.js";

type ConditionEvaluation = {
  matches: boolean | null;
  code: string;
  message: string;
  expected?: unknown;
  actual?: unknown;
};

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const nested = object(value);
  return nested && typeof nested.value === "number" && Number.isFinite(nested.value)
    ? nested.value
    : null;
}

function completionTagCondition(
  edge: MissionPrerequisiteEdge,
  state: PlayerMissionState,
): ConditionEvaluation {
  const constraint = object(edge.payload?.completionTagConstraint);
  const memberTags = Array.isArray(constraint?.memberCompletionTags)
    ? constraint.memberCompletionTags.filter((value): value is string => typeof value === "string" && Boolean(value))
    : [];
  const requiredCount = finiteNumber(constraint?.threshold);
  if (!constraint || !stringValue(constraint.groupId) || memberTags.length === 0) {
    return {
      matches: null,
      code: "completion_tag_group_unresolved",
      message: "The completion-tag prerequisite has no resolved logical group.",
    };
  }
  if (requiredCount === null) {
    return {
      matches: null,
      code: "completion_tag_count_unresolved",
      message: "The completion-tag prerequisite has no resolved count threshold.",
      expected: { memberTags },
    };
  }
  const knownCounts = memberTags.map((tag) => state.completionTags.countsByTag[tag]);
  const actualCount = knownCounts.reduce(
    (sum, count) => sum + (typeof count === "number" && Number.isFinite(count) ? count : 0),
    0,
  );
  const hasUnknownMembers = state.completionTags.knowledge === "partial"
    && knownCounts.some((count) => count === undefined);
  if (actualCount < requiredCount && hasUnknownMembers) {
    return {
      matches: null,
      code: "completion_tag_state_partial",
      message: "Known completion-tag counts do not meet the threshold, but player history is partial.",
      expected: { memberTags, count: requiredCount },
      actual: { knownCount: actualCount },
    };
  }
  return {
    matches: actualCount >= requiredCount,
    code: "completion_tag_group_count",
    message: `Completion-tag group requires count ${requiredCount}; player count is ${actualCount}.`,
    expected: { memberTags, count: requiredCount },
    actual: { count: actualCount },
  };
}

function crimeStatCondition(
  edge: MissionPrerequisiteEdge,
  state: PlayerMissionState,
): ConditionEvaluation {
  const minimum = finiteNumber(edge.bounds?.minCrimeStat);
  const maximum = finiteNumber(edge.bounds?.maxCrimeStat);
  if (state.crimeStat.status === "unknown") {
    return {
      matches: null,
      code: "crime_stat_state_missing",
      message: "CrimeStat is required to evaluate this prerequisite.",
      expected: { minimum, maximum },
    };
  }
  if (minimum === null && maximum === null) {
    return {
      matches: null,
      code: "crime_stat_bounds_unresolved",
      message: "The CrimeStat prerequisite has no resolved bounds.",
      actual: state.crimeStat,
    };
  }
  const matchesMinimum = minimum === null || state.crimeStat.value >= minimum;
  const matchesMaximum = maximum === null || state.crimeStat.value <= maximum;
  return {
    matches: matchesMinimum && matchesMaximum,
    code: "crime_stat_range",
    message: `CrimeStat ${state.crimeStat.value} was checked against the authored inclusive range.`,
    expected: { minimum, maximum },
    actual: state.crimeStat.value,
  };
}

function locationCondition(
  edge: MissionPrerequisiteEdge,
  state: PlayerMissionState,
): ConditionEvaluation {
  const requiredLocation = stringValue(edge.identifiers?.locationAvailable);
  if (!requiredLocation) {
    return {
      matches: null,
      code: "location_identifier_missing",
      message: "The location prerequisite has no resolved location identifier.",
    };
  }
  if (state.location.status === "unknown") {
    return {
      matches: null,
      code: "location_state_missing",
      message: "Current location or system is required to evaluate this prerequisite.",
      expected: requiredLocation,
    };
  }
  const currentLocations = [state.location.locationId, state.location.systemId]
    .filter((value): value is string => typeof value === "string" && Boolean(value));
  if (currentLocations.includes(requiredLocation)) {
    return {
      matches: true,
      code: "location_match",
      message: "The authored offer location was compared with the player's explicit location state.",
      expected: requiredLocation,
      actual: currentLocations,
    };
  }
  if (currentLocations.length === 0 || state.location.membershipKnowledge === "partial") {
    return {
      matches: null,
      code: "location_state_missing",
      message: "Current location or system is required to evaluate this prerequisite.",
      expected: requiredLocation,
    };
  }
  return {
    matches: false,
    code: "location_match",
    message: "The authored offer location was compared with the player's explicit location state.",
    expected: requiredLocation,
    actual: currentLocations,
  };
}

function localityCondition(
  edge: MissionPrerequisiteEdge,
  state: PlayerMissionState,
): ConditionEvaluation {
  const requiredLocality = stringValue(edge.identifiers?.localityAvailable);
  if (!requiredLocality) {
    return {
      matches: null,
      code: "locality_identifier_missing",
      message: "The locality prerequisite has no resolved locality identifier.",
    };
  }
  if (state.location.status === "unknown") {
    return {
      matches: null,
      code: "locality_state_missing",
      message: "Current locality is required to evaluate this prerequisite.",
      expected: requiredLocality,
    };
  }
  const matches = state.location.localityIds.includes(requiredLocality);
  if (!matches && state.location.membershipKnowledge === "partial") {
    return {
      matches: null,
      code: "locality_state_partial",
      message: "The known locality list does not match, but player location membership is partial.",
      expected: requiredLocality,
      actual: state.location.localityIds,
    };
  }
  return {
    matches,
    code: "locality_match",
    message: "The authored offer locality was compared with the player's explicit locality state.",
    expected: requiredLocality,
    actual: state.location.localityIds,
  };
}

function locationPropertyCondition(
  edge: MissionPrerequisiteEdge,
  context: MissionEligibilityContext,
): ConditionEvaluation {
  const variableName = stringValue(edge.identifiers?.propertyVariableName);
  const levelType = stringValue(edge.identifiers?.locationLevelType);
  if (!variableName || !levelType) {
    return {
      matches: null,
      code: "location_property_identifier_missing",
      message: "The generated location-property prerequisite is incomplete.",
    };
  }
  const bindingKey = `${levelType}:${variableName}`;
  const binding = context.locationPropertyBindings?.[bindingKey];
  if (binding === undefined) {
    return {
      matches: null,
      code: "location_property_binding_missing",
      message: "This generated location prerequisite needs an explicit runtime binding.",
      expected: { bindingKey },
    };
  }
  return {
    matches: binding,
    code: "location_property_binding",
    message: "The generated location prerequisite used an explicit runtime binding.",
    expected: { bindingKey, value: true },
    actual: binding,
  };
}

function reputationCondition(
  edge: MissionPrerequisiteEdge,
  state: PlayerMissionState,
  context: MissionEligibilityContext,
): ConditionEvaluation {
  const factionId = stringValue(edge.identifiers?.factionReputation);
  const scopeId = stringValue(edge.identifiers?.scope);
  const minimumStandingId = stringValue(edge.identifiers?.minStanding);
  const maximumStandingId = stringValue(edge.identifiers?.maxStanding);
  if (!factionId || !scopeId) {
    return {
      matches: null,
      code: "reputation_scope_missing",
      message: "The reputation prerequisite has no resolved faction and scope.",
    };
  }
  const current = state.reputation.find(
    (entry) => entry.factionId === factionId && entry.scopeId === scopeId,
  );
  if (!current) {
    return {
      matches: null,
      code: "reputation_state_missing",
      message: "Player reputation state is missing for the authored faction and scope.",
      expected: { factionId, scopeId, minimumStandingId, maximumStandingId },
    };
  }
  if (
    current.status === "unknown"
    || current.reputationValue === undefined
    || current.reputationValue === null
    || !context.standingThresholdsById
  ) {
    return {
      matches: null,
      code: "reputation_ordering_missing",
      message: "A source-backed standing ordering is required; standing GUIDs are never ordered by the solver.",
      expected: { factionId, scopeId, minimumStandingId, maximumStandingId },
      actual: {
        standingId: current.standingId ?? null,
        reputationValue: current.reputationValue ?? null,
      },
    };
  }
  if (!minimumStandingId && !maximumStandingId) {
    return {
      matches: null,
      code: "reputation_threshold_missing",
      message: "The reputation prerequisite has no authored standing thresholds.",
      expected: { factionId, scopeId },
      actual: {
        reputationValue: current.reputationValue,
        standingId: current.standingId ?? null,
      },
    };
  }
  const minimum = minimumStandingId
    ? context.standingThresholdsById[minimumStandingId.toLowerCase()]
    : undefined;
  const maximum = maximumStandingId
    ? context.standingThresholdsById[maximumStandingId.toLowerCase()]
    : undefined;
  if (
    (minimumStandingId && minimum === undefined)
    || (maximumStandingId && maximum === undefined)
  ) {
    return {
      matches: null,
      code: "reputation_threshold_unresolved",
      message: "The supplied standing ordering does not resolve every authored threshold.",
      expected: { minimumStandingId, maximumStandingId },
      actual: { reputationValue: current.reputationValue },
    };
  }
  const matchesMinimum = minimum === undefined || current.reputationValue >= minimum;
  const matchesMaximum = maximum === undefined || current.reputationValue <= maximum;
  return {
    matches: matchesMinimum && matchesMaximum,
    code: "reputation_range",
    message: "Player reputation value was checked against source-backed standing thresholds.",
    expected: { minimum, maximum, minimumStandingId, maximumStandingId },
    actual: {
      reputationValue: current.reputationValue,
      standingId: current.standingId ?? null,
    },
  };
}

function evaluateCondition(
  edge: MissionPrerequisiteEdge,
  state: PlayerMissionState,
  context: MissionEligibilityContext,
): ConditionEvaluation {
  if (edge.resolution && edge.resolution !== "source_backed") {
    return {
      matches: null,
      code: "prerequisite_source_unresolved",
      message: `Prerequisite resolution is ${edge.resolution}.`,
    };
  }
  switch (edge.type) {
    case "completion_tag": return completionTagCondition(edge, state);
    case "crime_stat": return crimeStatCondition(edge, state);
    case "location": return locationCondition(edge, state);
    case "locality": return localityCondition(edge, state);
    case "location_property": return locationPropertyCondition(edge, context);
    case "reputation": return reputationCondition(edge, state, context);
    default:
      return {
        matches: null,
        code: "prerequisite_type_unsupported",
        message: `Prerequisite type ${edge.type} is not supported by this solver version.`,
      };
  }
}

function explanationFor(
  edge: MissionPrerequisiteEdge,
  evaluation: ConditionEvaluation,
): MissionEligibilityExplanation {
  let status: MissionConditionStatus;
  if (evaluation.matches === null) {
    status = "unresolved";
  } else if (edge.polarity === "excluded") {
    status = evaluation.matches ? "excluded" : "satisfied";
  } else if ((edge.type === "location" || edge.type === "locality") && !evaluation.matches) {
    status = "unavailable";
  } else {
    status = evaluation.matches ? "satisfied" : "blocked";
  }
  return {
    code: evaluation.code,
    status,
    edgeId: edge.edgeId,
    prerequisiteType: edge.type,
    message: evaluation.message,
    expected: evaluation.expected,
    actual: evaluation.actual,
    provenance: edge.provenance,
  };
}

export function evaluateMissionEligibility(
  variant: MissionSolverVariant,
  state: PlayerMissionState,
  context: MissionEligibilityContext = {},
): MissionEligibilityResult {
  const explanations: MissionEligibilityExplanation[] = [];
  if (variant.availability.notForRelease) {
    explanations.push({
      code: "not_for_release",
      status: "unavailable",
      edgeId: null,
      prerequisiteType: "availability",
      message: "This exact variant is authored as not for release.",
      actual: variant.availability,
    });
  }
  if (variant.availability.workInProgress) {
    explanations.push({
      code: "work_in_progress",
      status: "informational",
      edgeId: null,
      prerequisiteType: "availability",
      message: "This exact variant is authored as work in progress; that flag alone does not prove unavailability.",
      actual: variant.availability,
    });
  }

  const evaluatedCompletionGroups = new Set<string>();
  for (const edge of variant.prerequisites) {
    if (edge.ownerScope && edge.ownerScope !== "parent_eligibility") continue;
    if (edge.type === "completion_tag") {
      const constraint = object(edge.payload?.completionTagConstraint);
      const groupId = stringValue(constraint?.groupId);
      if (groupId && evaluatedCompletionGroups.has(groupId)) continue;
      if (groupId) evaluatedCompletionGroups.add(groupId);
    }
    explanations.push(explanationFor(edge, evaluateCondition(edge, state, context)));
  }

  const unavailable = explanations.filter((entry) => entry.status === "unavailable");
  const exclusions = explanations.filter((entry) => entry.status === "excluded");
  const blockers = explanations.filter((entry) => entry.status === "blocked");
  const unresolved = explanations.filter((entry) => entry.status === "unresolved");
  const status = unavailable.length > 0
    ? "unavailable"
    : exclusions.length > 0
      ? "excluded"
      : blockers.length > 0
        ? "blocked"
        : unresolved.length > 0
          ? "unresolved"
          : "eligible";

  return {
    variantId: variant.identity.variantId,
    status,
    explanations,
    blockers,
    unavailable,
    unresolved,
    exclusions,
  };
}
