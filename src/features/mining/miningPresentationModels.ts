import type {
  StaticLocationDescription,
  StaticLocationMaterialRow,
} from "./staticMiningIndex";

type DeliveredProbability = number | null | undefined;

export type MiningEnvironmentPresentation = {
  sourceKey?: string | null;
  sourceText?: string | null;
  atmosphere: string | null;
  climate: string | null;
  habitability: string | null;
};

export type MiningSpawnCompetitionMember = {
  materialKey: string;
  materialName: string;
  groupProbability: DeliveredProbability;
  relativeProbability: DeliveredProbability;
  materialProbability: DeliveredProbability;
  sourceProbability: DeliveredProbability;
};

export type MiningSpawnCompetitionPool = {
  sourceGroup: string;
  target: MiningSpawnCompetitionMember;
  members: MiningSpawnCompetitionMember[];
  competitors: MiningSpawnCompetitionMember[];
  competitorCount: number;
};

type StaticSource = NonNullable<StaticLocationMaterialRow["sources"]>[number];

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function materialIdentity(source: StaticSource, row: StaticLocationMaterialRow): string {
  return normalize(source.materialKey ?? source.materialId ?? source.materialName ?? row.materialId ?? row.materialName);
}

function sourceMatchesMaterial(source: StaticSource, row: StaticLocationMaterialRow, target: string): boolean {
  return [
    source.materialKey,
    source.materialId,
    source.materialName,
    row.materialId,
    row.materialName,
  ].some((candidate) => normalize(candidate) === target);
}

function materialName(source: StaticSource, row: StaticLocationMaterialRow): string {
  return source.materialName?.trim() || row.materialName.trim() || source.materialKey?.trim() || row.materialId;
}

function asCompetitionMember(source: StaticSource, row: StaticLocationMaterialRow): MiningSpawnCompetitionMember {
  return {
    materialKey: source.materialKey?.trim() || materialIdentity(source, row),
    materialName: materialName(source, row),
    groupProbability: source.groupProbability,
    relativeProbability: source.relativeProbability,
    materialProbability: source.materialProbability,
    sourceProbability: source.sourceProbability,
  };
}

function comparePoolShare(left: MiningSpawnCompetitionMember, right: MiningSpawnCompetitionMember): number {
  const leftShare = left.relativeProbability;
  const rightShare = right.relativeProbability;
  const leftKnown = typeof leftShare === "number" && Number.isFinite(leftShare);
  const rightKnown = typeof rightShare === "number" && Number.isFinite(rightShare);
  if (leftKnown && rightKnown && rightShare !== leftShare) return rightShare - leftShare;
  if (leftKnown !== rightKnown) return leftKnown ? -1 : 1;
  return compareText(normalize(left.materialName), normalize(right.materialName))
    || compareText(normalize(left.materialKey), normalize(right.materialKey));
}

function selectUniqueMembers(rows: StaticLocationMaterialRow[], sourceGroup: string): Map<string, MiningSpawnCompetitionMember> {
  const members = new Map<string, MiningSpawnCompetitionMember>();
  const normalizedGroup = normalize(sourceGroup);
  for (const row of rows) {
    for (const source of row.sources ?? []) {
      if (normalize(source.groupName) !== normalizedGroup) continue;
      const identity = materialIdentity(source, row);
      if (!identity) continue;
      const candidate = asCompetitionMember(source, row);
      const existing = members.get(identity);
      if (!existing || comparePoolShare(candidate, existing) < 0) members.set(identity, candidate);
    }
  }
  return members;
}

function extractDescriptionPhrase(text: string | null | undefined, pattern: RegExp): string | null {
  if (typeof text !== "string") return null;
  const match = text.match(pattern);
  return match?.[1] ?? null;
}

function displayDescriptionPhrase(value: string | null): string | null {
  return value ? `${value[0].toLocaleUpperCase()}${value.slice(1)}` : null;
}

/**
 * Projects only language explicitly present in the delivered location text.
 * It intentionally does not infer hazards, density, or any undocumented
 * environmental condition.
 */
export function buildMiningEnvironmentPresentation(
  description: StaticLocationDescription | null,
): MiningEnvironmentPresentation {
  const sourceText = description?.sourceText;
  const explicitClimate = extractDescriptionPhrase(sourceText, /\b([a-z][a-z-]*(?:\s+than\s+[a-z][a-z-]*)?)\s+climate\b/i)
    ?? extractDescriptionPhrase(sourceText, /\bis\s+(?:an?\s+)?([a-z][a-z-]*),\s+[a-z][a-z-]*-habitable\s+(?:planet|world|moon)\b/i);
  const explicitHabitability = extractDescriptionPhrase(sourceText, /\b([a-z][a-z-]*)-habitable\b/i);
  return {
    sourceKey: description?.sourceKey,
    sourceText,
    atmosphere: displayDescriptionPhrase(extractDescriptionPhrase(sourceText, /\b(?:an?\s+)?([a-z][a-z-]*)\s+atmosphere\b/i)),
    climate: displayDescriptionPhrase(explicitClimate),
    habitability: explicitHabitability ? `${displayDescriptionPhrase(explicitHabitability)} habitable` : null,
  };
}

/**
 * Builds source-group-specific material pools. Every probability field is a
 * directly delivered value: relativeProbability is the pool share, while the
 * group, material, and source probabilities retain their independent meaning.
 */
export function buildMiningSpawnCompetitionPools(
  rows: StaticLocationMaterialRow[],
  targetMaterial: string,
  sourceGroup?: string,
): MiningSpawnCompetitionPool[] {
  const targetIdentity = normalize(targetMaterial);
  if (!targetIdentity) return [];

  const groups = new Map<string, { sourceGroup: string; targetIdentities: Set<string> }>();
  for (const row of rows) {
    for (const source of row.sources ?? []) {
      if (!sourceMatchesMaterial(source, row, targetIdentity) || !source.groupName?.trim()) continue;
      if (sourceGroup && normalize(source.groupName) !== normalize(sourceGroup)) continue;
      const groupKey = normalize(source.groupName);
      const group = groups.get(groupKey) ?? {
        sourceGroup: source.groupName.trim(),
        targetIdentities: new Set<string>(),
      };
      group.targetIdentities.add(materialIdentity(source, row));
      groups.set(groupKey, group);
    }
  }

  const pools: MiningSpawnCompetitionPool[] = [];
  for (const group of [...groups.values()].sort((left, right) => compareText(normalize(left.sourceGroup), normalize(right.sourceGroup)))) {
    const membersByIdentity = selectUniqueMembers(rows, group.sourceGroup);
    const target = [...group.targetIdentities]
      .map((identity) => membersByIdentity.get(identity))
      .filter((member): member is MiningSpawnCompetitionMember => Boolean(member))
      .sort(comparePoolShare)[0];
    if (!target) continue;
    const members = [...membersByIdentity.values()].sort(comparePoolShare);
    const competitors = members.filter((member) => member !== target);
    pools.push({
      sourceGroup: group.sourceGroup,
      target,
      members,
      competitors,
      competitorCount: competitors.length,
    });
  }
  return pools;
}
