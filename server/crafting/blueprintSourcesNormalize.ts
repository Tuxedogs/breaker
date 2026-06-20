type JsonRecord = Record<string, unknown>;

export type BlueprintRewardItem = {
  rewardKey: string;
  blueprintGuid?: string;
  displayName: string;
  componentType?: string;
  size?: string;
  grade?: string;
  itemClass?: string;
  blueprintName?: string;
  poolGuid?: string;
  poolName?: string;
  poolChance?: number;
  rewardChance?: number;
  chance?: number;
  weight?: number;
};

export type MissionBlueprintReward = {
  missionId: string;
  title: string;
  description?: string;
  factionName: string;
  missionType?: string;
  category?: string;
  location?: string;
  system?: string;
  planet?: string;
  station?: string;
  missionGiver?: string;
  xp?: number | string;
  payment?: number | string;
  minStanding?: string;
  maxStanding?: string;
  prerequisites: string[];
  rewardPools: string[];
  rewards: BlueprintRewardItem[];
  reputationRewards: string[];
  creditRewards: string[];
  isDisabled?: boolean;
  isWorkInProgress?: boolean;
  debugName?: string;
  generatorName?: string;
  generatorPath?: string;
};

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null ? value as JsonRecord : null;
}

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim().replace(/\\n/g, "\n");
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function asFiniteNumber(value: unknown): number | undefined {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(number) ? number : undefined;
}

function normalizeKey(value: string | undefined, fallback = "unknown"): string {
  return (value ?? fallback).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || fallback;
}

function normalizeMissionTitle(title: string): string {
  return title.replace(/~mission\(([^)]+)\)/g, "$1");
}

function isTruthyFlag(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true";
}

export function isMissionDisabledRecord(mission: JsonRecord): boolean {
  const debugName = asNonEmptyString(mission.debugName) ?? asNonEmptyString(mission.contractDebugName);
  const title = asNonEmptyString(mission.title) ?? asNonEmptyString(mission.contractTitle);
  return isTruthyFlag(mission.notForRelease) || /\bdisabled\b/i.test([debugName, title].filter(Boolean).join(" "));
}

function formatRecordName(value: unknown): string | undefined {
  const raw = asNonEmptyString(value);
  if (!raw) return undefined;
  const local = raw.split(".").at(-1) ?? raw;
  return local
    .replace(/^(BP_REWARDS_|BP_REWARD_|BP_MISSIONREWARD_|ContractGenerator\.)/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z0-9])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

function describeStanding(value: unknown): string | undefined {
  const standing = asRecord(value);
  if (!standing) return undefined;
  const name = asNonEmptyString(standing.displayName) ?? asNonEmptyString(standing.name);
  const minRep = asFiniteNumber(standing.minReputation);
  return [name, minRep !== undefined ? `${minRep} rep` : null].filter(Boolean).join(" / ") || undefined;
}

function describePrerequisite(value: unknown): string | null {
  const prereq = asRecord(value);
  if (!prereq) return null;
  const type = formatRecordName(prereq.type) ?? "Prerequisite";
  const resolved = Array.isArray(prereq.resolved)
    ? prereq.resolved
        .map((item) => {
          const record = asRecord(item);
          return record ? asNonEmptyString(record.displayName) ?? asNonEmptyString(record.name) : undefined;
        })
        .filter(Boolean)
        .join(", ")
    : "";
  const attrs = asRecord(prereq.attributes);
  const attrText = attrs
    ? Object.entries(attrs)
        .map(([key, val]) => `${key}: ${asNonEmptyString(val) ?? "Unknown"}`)
        .join(", ")
    : "";
  return [type, resolved || attrText].filter(Boolean).join(" - ");
}

function describeReputationReward(value: unknown): string | null {
  const reward = asRecord(value);
  if (!reward) return null;
  const amount = asFiniteNumber(reward.reputationAmount);
  const nested = asRecord(reward.reward);
  const nestedAmount = nested ? asFiniteNumber(nested.reputationAmount) : undefined;
  const finalAmount = amount ?? nestedAmount;
  if (finalAmount === undefined) return formatRecordName(reward.type) ?? null;
  return `${finalAmount > 0 ? "+" : ""}${finalAmount} reputation`;
}

function describeCreditReward(value: unknown): string | null {
  const reward = asRecord(value);
  if (!reward) return null;
  const attrs = asRecord(reward.attributes);
  const amount = attrs
    ? asFiniteNumber(attrs.amount) ?? asFiniteNumber(attrs.reward) ?? asFiniteNumber(attrs.value)
    : undefined;
  if (amount !== undefined) return `${amount.toLocaleString()} UEC`;
  return formatRecordName(reward.type) ?? null;
}

function firstParamText(params: unknown, names: string[]): string | undefined {
  const record = asRecord(params);
  if (!record) return undefined;
  for (const name of names) {
    const param = asRecord(record[name]);
    const text = param ? asNonEmptyString(param.text) ?? asNonEmptyString(param.raw) : undefined;
    if (text) return text;
  }
  return undefined;
}

function extractLocation(mission: JsonRecord): string | undefined {
  return firstParamText(mission.stringParams, [
    "Location",
    "LocationName",
    "Destination",
    "DestinationName",
    "PickupLocation",
    "DropOffLocation",
  ]);
}

function normalizeReward(
  raw: unknown,
  pool: JsonRecord,
  missionReward: JsonRecord,
): BlueprintRewardItem | null {
  const reward = asRecord(raw);
  if (!reward) return null;
  const blueprintGuid = asNonEmptyString(reward.blueprintGuid);
  const displayName =
    asNonEmptyString(reward.displayName) ??
    formatRecordName(reward.blueprintName) ??
    blueprintGuid ??
    "Unknown Blueprint Source";
  const poolGuid = asNonEmptyString(pool.poolGuid) ?? asNonEmptyString(missionReward.blueprintPoolGuid);
  const poolChance = asFiniteNumber(reward.poolChance);
  const rewardChance = asFiniteNumber(missionReward.chance);
  const chance =
    poolChance !== undefined && rewardChance !== undefined
      ? poolChance * rewardChance
      : poolChance ?? rewardChance;

  return {
    rewardKey: blueprintGuid ?? `${poolGuid ?? "pool"}::${normalizeKey(displayName)}`,
    blueprintGuid,
    displayName,
    componentType: asNonEmptyString(reward.componentType),
    size: asNonEmptyString(reward.size),
    grade: asNonEmptyString(reward.grade),
    itemClass: asNonEmptyString(reward.class),
    blueprintName: asNonEmptyString(reward.blueprintName),
    poolGuid,
    poolName: asNonEmptyString(pool.displayName) ?? formatRecordName(pool.poolName),
    poolChance,
    rewardChance,
    chance,
    weight: asFiniteNumber(reward.weight),
  };
}

export function normalizeMissionBlueprintReward(raw: unknown): MissionBlueprintReward | null {
  const mission = asRecord(raw);
  if (!mission) return null;
  const missionId = asNonEmptyString(mission.contractId);
  if (!missionId) return null;

  const title = normalizeMissionTitle(
    asNonEmptyString(mission.title) ?? asNonEmptyString(mission.debugName) ?? "Unknown Mission",
  );
  const rewardMap = new Map<string, BlueprintRewardItem>();
  const rewardPools = new Set<string>();

  for (const item of Array.isArray(mission.blueprintRewards) ? mission.blueprintRewards : []) {
    const missionReward = asRecord(item);
    const pool = missionReward ? asRecord(missionReward.pool) : null;
    if (!missionReward || !pool) continue;
    const poolName = asNonEmptyString(pool.displayName) ?? formatRecordName(pool.poolName);
    if (poolName) rewardPools.add(poolName);
    for (const rawReward of Array.isArray(pool.rewards) ? pool.rewards : []) {
      const reward = normalizeReward(rawReward, pool, missionReward);
      if (!reward) continue;
      const key = reward.blueprintGuid ?? normalizeKey(reward.displayName);
      if (!rewardMap.has(key)) rewardMap.set(key, reward);
    }
  }

  if (rewardMap.size === 0) return null;

  return {
    missionId,
    title,
    description: asNonEmptyString(mission.description),
    factionName: asNonEmptyString(mission.factionName) ?? "Unknown Faction",
    missionType: asNonEmptyString(mission.missionType) ?? formatRecordName(mission.handlerType),
    category: asNonEmptyString(mission.contractType),
    location: extractLocation(mission),
    system: firstParamText(mission.stringParams, ["System", "SystemName"]),
    planet: firstParamText(mission.stringParams, ["Planet", "PlanetName"]),
    station: firstParamText(mission.stringParams, ["Station", "StationName"]),
    missionGiver: firstParamText(mission.stringParams, ["Contractor", "MissionGiver", "Giver"]),
    xp: asFiniteNumber(mission.xpReward) ?? asNonEmptyString(mission.xpReward),
    payment: asFiniteNumber(mission.uecReward) ?? asNonEmptyString(mission.payment),
    minStanding: describeStanding(mission.minStanding),
    maxStanding: describeStanding(mission.maxStanding),
    prerequisites: (Array.isArray(mission.prerequisites) ? mission.prerequisites : [])
      .map(describePrerequisite)
      .filter((value): value is string => Boolean(value)),
    rewardPools: Array.from(rewardPools),
    rewards: Array.from(rewardMap.values()).sort((a, b) => a.displayName.localeCompare(b.displayName)),
    reputationRewards: (Array.isArray(mission.reputationRewards) ? mission.reputationRewards : [])
      .map(describeReputationReward)
      .filter((value): value is string => Boolean(value)),
    creditRewards: (Array.isArray(mission.creditRewardTypes) ? mission.creditRewardTypes : [])
      .map(describeCreditReward)
      .filter((value): value is string => Boolean(value)),
    isDisabled: isMissionDisabledRecord(mission),
    isWorkInProgress: isTruthyFlag(mission.workInProgress),
    debugName: asNonEmptyString(mission.debugName),
    generatorName: asNonEmptyString(mission.generatorName),
    generatorPath: asNonEmptyString(mission.generatorPath),
  };
}

export function buildReleaseStateMap(missions: unknown[]): Record<string, boolean> {
  const states: Record<string, boolean> = {};
  for (const raw of missions) {
    const mission = asRecord(raw);
    const contractId = mission ? asNonEmptyString(mission.contractId) : undefined;
    if (mission && contractId) {
      states[contractId] = isMissionDisabledRecord(mission);
    }
  }
  return states;
}