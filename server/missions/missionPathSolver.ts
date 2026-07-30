import { evaluateMissionEligibility } from "./missionEligibility.js";
import type {
  MissionEligibilityContext,
  MissionEligibilityResult,
  MissionGraphValidationReport,
  MissionPathFailure,
  MissionPathGoal,
  MissionPathPlan,
  MissionPathSolveOptions,
  MissionPathSolveResult,
  MissionPathStep,
  MissionSolverGraph,
  MissionSolverVariant,
  PlayerMissionState,
} from "./missionSolverTypes.js";

export type MissionPathSolverInput = {
  generationId: string;
  graph: MissionSolverGraph;
  validationReport: MissionGraphValidationReport;
  variants: ReadonlyMap<string, MissionSolverVariant>;
  playerState: PlayerMissionState;
  eligibilityContext?: MissionEligibilityContext;
  goal: MissionPathGoal;
  options?: MissionPathSolveOptions;
};

type SearchState = {
  playerState: PlayerMissionState;
  usedVariantIds: Set<string>;
  steps: MissionPathStep[];
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

function completionTagGrants(variant: MissionSolverVariant): {
  counts: Record<string, number>;
  edgeIds: string[];
} {
  const counts: Record<string, number> = {};
  const edgeIds: string[] = [];
  for (const outcome of variant.outcomes) {
    if (outcome.type !== "completion_tag") continue;
    const tag = stringValue(outcome.payload?.tag);
    const count = finiteNumber(outcome.payload?.count);
    if (!tag || count === null || count <= 0) continue;
    counts[tag] = (counts[tag] ?? 0) + count;
    edgeIds.push(outcome.edgeId);
  }
  return { counts, edgeIds };
}

function requiredTagGroups(variant: MissionSolverVariant): Array<{
  groupId: string;
  memberTags: string[];
  threshold: number;
}> {
  const groups = new Map<string, { groupId: string; memberTags: string[]; threshold: number }>();
  for (const edge of variant.prerequisites) {
    if (
      edge.type !== "completion_tag"
      || edge.polarity !== "required"
      || (edge.ownerScope && edge.ownerScope !== "parent_eligibility")
    ) continue;
    const constraint = object(edge.payload?.completionTagConstraint);
    const groupId = stringValue(constraint?.groupId);
    const memberTags = Array.isArray(constraint?.memberCompletionTags)
      ? constraint.memberCompletionTags.filter((value): value is string => typeof value === "string" && Boolean(value))
      : [];
    const threshold = finiteNumber(constraint?.threshold);
    if (groupId && memberTags.length > 0 && threshold !== null) {
      groups.set(groupId, { groupId, memberTags, threshold });
    }
  }
  return [...groups.values()];
}

function initialRelevantTags(
  goal: MissionPathGoal,
  variants: ReadonlyMap<string, MissionSolverVariant>,
): string[] {
  if (goal.type === "completion_tag") return [goal.completionTag];
  const target = variants.get(goal.variantId);
  return target ? requiredTagGroups(target).flatMap((group) => group.memberTags) : [];
}

function relevantClosure(
  goal: MissionPathGoal,
  graph: MissionSolverGraph,
  variants: ReadonlyMap<string, MissionSolverVariant>,
): { tags: Set<string>; variants: Set<string>; danglingTags: Set<string> } {
  const tags = new Set<string>();
  const relevantVariants = new Set<string>();
  const danglingTags = new Set<string>();
  const pending = [...initialRelevantTags(goal, variants)];
  const producersByTag = new Map<string, Set<string>>();
  for (const dependency of graph.dependencies) {
    let producers = producersByTag.get(dependency.completionTag);
    if (!producers) {
      producers = new Set<string>();
      producersByTag.set(dependency.completionTag, producers);
    }
    dependency.producerVariantIds.forEach((variantId) => producers?.add(variantId));
  }
  while (pending.length > 0) {
    const tag = pending.pop();
    if (!tag || tags.has(tag)) continue;
    tags.add(tag);
    const producers = producersByTag.get(tag);
    if (!producers || producers.size === 0) {
      danglingTags.add(tag);
      continue;
    }
    for (const variantId of producers) {
      if (relevantVariants.has(variantId)) continue;
      relevantVariants.add(variantId);
      const producer = variants.get(variantId);
      if (!producer) continue;
      for (const group of requiredTagGroups(producer)) {
        for (const memberTag of group.memberTags) pending.push(memberTag);
      }
    }
  }
  return { tags, variants: relevantVariants, danglingTags };
}

function applyMission(
  current: SearchState,
  variant: MissionSolverVariant,
  eligibility: MissionEligibilityResult,
): SearchState | null {
  const grants = completionTagGrants(variant);
  if (Object.keys(grants.counts).length === 0) return null;
  const countsByTag = { ...current.playerState.completionTags.countsByTag };
  for (const [tag, count] of Object.entries(grants.counts)) {
    countsByTag[tag] = (countsByTag[tag] ?? 0) + count;
  }
  const variantId = variant.identity.variantId;
  const countsByContract = {
    ...current.playerState.completedContracts.countsByContract,
    [variantId]: (current.playerState.completedContracts.countsByContract[variantId] ?? 0) + 1,
  };
  const step: MissionPathStep = {
    ordinal: current.steps.length + 1,
    variantId,
    eligibility,
    grantedCompletionTags: grants.counts,
    prerequisiteEdgeIds: eligibility.explanations
      .flatMap((entry) => entry.edgeId ? [entry.edgeId] : []),
    outcomeEdgeIds: grants.edgeIds,
    assumptions: [
      "The authored mission-result branch carrying these completion-tag outcomes occurs.",
      "Mission repeatability is not assumed; each exact variant is planned at most once.",
    ],
  };
  return {
    playerState: {
      ...current.playerState,
      completedContracts: {
        ...current.playerState.completedContracts,
        countsByContract,
      },
      completionTags: {
        ...current.playerState.completionTags,
        countsByTag,
      },
    },
    usedVariantIds: new Set([...current.usedVariantIds, variantId]),
    steps: [...current.steps, step],
  };
}

function goalEligibility(
  goal: MissionPathGoal,
  state: PlayerMissionState,
  variants: ReadonlyMap<string, MissionSolverVariant>,
  context: MissionEligibilityContext,
): { satisfied: boolean; eligibility?: MissionEligibilityResult } {
  if (goal.type === "completion_tag") {
    const requiredCount = goal.requiredCount ?? 1;
    return {
      satisfied: (state.completionTags.countsByTag[goal.completionTag] ?? 0) >= requiredCount,
    };
  }
  const target = variants.get(goal.variantId);
  if (!target) return { satisfied: false };
  const eligibility = evaluateMissionEligibility(target, state, context);
  return { satisfied: eligibility.status === "eligible", eligibility };
}

function stateKey(
  state: SearchState,
  relevantTags: Set<string>,
): string {
  const tags = [...relevantTags]
    .sort()
    .map((tag) => [tag, state.playerState.completionTags.countsByTag[tag] ?? 0]);
  return JSON.stringify({
    tags,
    used: [...state.usedVariantIds].sort(),
  });
}

function classifyFailure(
  eligibility: MissionEligibilityResult | undefined,
  hasCycle: boolean,
  hasDangling: boolean,
  hitLimit: boolean,
): MissionPathSolveResult["status"] {
  if (hitLimit || hasCycle || hasDangling || eligibility?.status === "unresolved") return "unresolved";
  if (eligibility?.status === "unavailable") return "unavailable";
  if (eligibility?.status === "excluded") return "excluded";
  return "blocked";
}

export function solveMissionPath(input: MissionPathSolverInput): MissionPathSolveResult {
  const context = input.eligibilityContext ?? {};
  const maxAlternates = Math.max(0, input.options?.maxAlternates ?? 4);
  const maxStates = Math.max(1, input.options?.maxStates ?? 10_000);
  const closure = relevantClosure(input.goal, input.graph, input.variants);
  const relevantCycles = input.validationReport.cycles.filter((cycle) =>
    cycle.variantIds.some((variantId) => closure.variants.has(variantId))
  );
  const initialUsed = new Set(
    Object.entries(input.playerState.completedContracts.countsByContract)
      .filter(([, count]) => count > 0)
      .map(([variantId]) => variantId),
  );
  const initial: SearchState = {
    playerState: input.playerState,
    usedVariantIds: initialUsed,
    steps: [],
  };
  const initialGoal = goalEligibility(input.goal, input.playerState, input.variants, context);
  const base = {
    generationId: input.generationId,
    goal: input.goal,
    costModel: { type: "mission_count" as const, unit: "mission_completion" as const },
    relevantCycles,
  };
  if (initialGoal.satisfied) {
    return {
      ...base,
      status: "satisfied",
      minimumMissionCount: 0,
      primaryPlan: { missionCount: 0, steps: [] },
      alternatePlans: [],
      alternatePlansTruncated: false,
      exploredStateCount: 1,
      failures: [],
    };
  }

  const missingVariants = [...closure.variants].filter((variantId) => !input.variants.has(variantId));
  const failures: MissionPathFailure[] = [
    ...[...closure.danglingTags].sort().map((completionTag) => ({
      code: "dangling_completion_tag",
      message: "No source-backed producer is published for this required completion tag.",
      completionTag,
    })),
    ...missingVariants.sort().map((variantId) => ({
      code: "producer_variant_missing",
      message: "A graph producer has no loaded canonical exact variant.",
      variantId,
    })),
  ];
  const queue: SearchState[] = [initial];
  const visited = new Set([stateKey(initial, closure.tags)]);
  const plans: MissionPathPlan[] = [];
  let minimumMissionCount: number | null = null;
  let exploredStateCount = 0;
  let hitLimit = false;
  const candidateFailureKeys = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    if (minimumMissionCount !== null && current.steps.length >= minimumMissionCount) continue;
    exploredStateCount += 1;
    if (exploredStateCount > maxStates) {
      hitLimit = true;
      break;
    }
    for (const variantId of [...closure.variants].sort()) {
      if (current.usedVariantIds.has(variantId)) continue;
      const candidate = input.variants.get(variantId);
      if (!candidate) continue;
      const eligibility = evaluateMissionEligibility(candidate, current.playerState, context);
      if (eligibility.status !== "eligible") {
        const failureKey = `${variantId}:${eligibility.status}`;
        if (!candidateFailureKeys.has(failureKey)) {
          candidateFailureKeys.add(failureKey);
          failures.push({
            code: `producer_${eligibility.status}`,
            message: "A source-backed producer is not currently eligible.",
            variantId,
            eligibility,
          });
        }
        continue;
      }
      const next = applyMission(current, candidate, eligibility);
      if (!next) continue;
      const goal = goalEligibility(input.goal, next.playerState, input.variants, context);
      if (goal.satisfied) {
        minimumMissionCount ??= next.steps.length;
        if (next.steps.length === minimumMissionCount) {
          plans.push({ missionCount: next.steps.length, steps: next.steps });
        }
        continue;
      }
      const key = stateKey(next, closure.tags);
      if (!visited.has(key)) {
        visited.add(key);
        queue.push(next);
      }
    }
  }

  plans.sort((left, right) => {
    const leftKey = left.steps.map((step) => step.variantId).join("|");
    const rightKey = right.steps.map((step) => step.variantId).join("|");
    return leftKey.localeCompare(rightKey);
  });
  if (plans.length > 0) {
    return {
      ...base,
      status: "path_found",
      minimumMissionCount,
      primaryPlan: plans[0] ?? null,
      alternatePlans: plans.slice(1, maxAlternates + 1),
      alternatePlansTruncated: Math.max(0, plans.length - 1) > maxAlternates,
      exploredStateCount,
      failures,
    };
  }

  if (hitLimit) {
    failures.push({
      code: "search_limit_reached",
      message: `The bounded mission-count search reached ${maxStates} states.`,
    });
  }
  if (relevantCycles.length > 0) {
    failures.push({
      code: "relevant_cycle",
      message: "The relevant proven dependency closure contains a cycle and no entry path was found.",
    });
  }
  const finalGoal = goalEligibility(input.goal, input.playerState, input.variants, context);
  return {
    ...base,
    status: classifyFailure(
      finalGoal.eligibility,
      relevantCycles.length > 0,
      closure.danglingTags.size > 0 || missingVariants.length > 0,
      hitLimit,
    ),
    minimumMissionCount: null,
    primaryPlan: null,
    alternatePlans: [],
    alternatePlansTruncated: false,
    exploredStateCount,
    failures,
  };
}
