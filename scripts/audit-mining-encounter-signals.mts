import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type JsonObject = Record<string, unknown>;

const root = process.cwd();
const materialSourceScoresPath = path.join(root, "public/api/recommendations/material_source_scores.json");
const materialRankingsPath = path.join(root, "public/api/recommendations/material_encounter_rankings.json");
const enrichedSourcesPath = path.join(root, "public/api/mining/material_sources_quality_enriched.json");
const auditReportPath = path.join(root, "scripts/reports/recommendations/encounter_signal_audit.json");

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function cleanKey(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function sourceSignal(source: JsonObject): number | null {
  if (isFiniteNumber(source.probability)) return source.probability;
  if (
    isFiniteNumber(source.groupProbability) &&
    isFiniteNumber(source.relativeProbability) &&
    isFiniteNumber(source.materialProbability)
  ) {
    return (source.groupProbability * source.relativeProbability * source.materialProbability) / 10000;
  }
  return null;
}

function materialBiasSignal(source: JsonObject): number | null {
  if (!isFiniteNumber(source.relativeProbability) || !isFiniteNumber(source.materialProbability)) return null;
  return source.relativeProbability * source.materialProbability;
}

function withSourceAuditSignals(source: JsonObject): JsonObject {
  return {
    ...source,
    providerWeightedSignal: sourceSignal(source),
    materialBiasSignal: materialBiasSignal(source),
    normalizedWithinMethodSignal: null,
  };
}

function sourceIndexKey(material: JsonObject, source: JsonObject): string {
  return [
    cleanKey(material.materialId ?? source.materialId),
    cleanKey(material.materialName ?? source.materialName),
    cleanKey(source.system),
    cleanKey(source.location),
  ].join("|");
}

function rankingIndexKey(row: JsonObject): string {
  return [
    cleanKey(row.materialId),
    cleanKey(row.materialName),
    cleanKey(row.system),
    cleanKey(row.location),
  ].join("|");
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

function annotateSourceGroups<T extends JsonObject>(groups: T[]): T[] {
  return groups.map((group) => {
    const sources = Array.isArray(group.sources) ? group.sources as JsonObject[] : undefined;
    const bestSources = Array.isArray(group.bestSources) ? group.bestSources as JsonObject[] : undefined;
    return {
      ...group,
      ...(sources ? { sources: sources.map(withSourceAuditSignals) } : {}),
      ...(bestSources ? { bestSources: bestSources.map(withSourceAuditSignals) } : {}),
    };
  });
}

function buildSourceIndex(groups: JsonObject[]): Map<string, JsonObject[]> {
  const index = new Map<string, JsonObject[]>();
  for (const group of groups) {
    const sources = Array.isArray(group.sources) ? group.sources as JsonObject[] : [];
    for (const source of sources) {
      const key = sourceIndexKey(group, source);
      const list = index.get(key) ?? [];
      list.push(source);
      index.set(key, list);
    }
  }
  return index;
}

function pickRankingSource(row: JsonObject, sources: JsonObject[]): JsonObject | null {
  if (sources.length === 0) return null;
  const targetSignal = isFiniteNumber(row.sourceProbabilityMax)
    ? row.sourceProbabilityMax
    : isFiniteNumber(row.encounterScore)
      ? row.encounterScore
      : null;
  if (targetSignal === null) return sources[0] ?? null;
  return [...sources].sort((left, right) =>
    Math.abs((sourceSignal(left) ?? 0) - targetSignal) - Math.abs((sourceSignal(right) ?? 0) - targetSignal)
  )[0] ?? null;
}

function annotateRankings(rows: JsonObject[], sourceIndex: Map<string, JsonObject[]>): JsonObject[] {
  return rows.map((row) => {
    const source = pickRankingSource(row, sourceIndex.get(rankingIndexKey(row)) ?? []);
    const normalizedWithinMethodSignal = isFiniteNumber(row.locationClassDistributionShare)
      ? row.locationClassDistributionShare
      : null;
    return {
      ...row,
      groupProbability: source && isFiniteNumber(source.groupProbability) ? source.groupProbability : null,
      relativeProbability: source && isFiniteNumber(source.relativeProbability) ? source.relativeProbability : null,
      materialProbability: source && isFiniteNumber(source.materialProbability) ? source.materialProbability : null,
      providerWeightedSignal: isFiniteNumber(row.encounterScore) ? row.encounterScore : sourceSignal(source ?? {}),
      materialBiasSignal: source ? materialBiasSignal(source) : null,
      normalizedWithinMethodSignal,
    };
  });
}

function stileronRows(rows: JsonObject[]): JsonObject[] {
  return rows.filter((row) => cleanKey(row.materialName) === "stileron");
}

async function main(): Promise<void> {
  const enrichedGroups = await readJson<JsonObject[]>(enrichedSourcesPath);
  const sourceScores = await readJson<{ materials?: JsonObject[] }>(materialSourceScoresPath);
  const rankings = await readJson<JsonObject[]>(materialRankingsPath);

  const sourceIndex = buildSourceIndex(enrichedGroups);
  const annotatedRankings = annotateRankings(rankings, sourceIndex);
  const annotatedSourceScores = {
    ...sourceScores,
    materials: annotateSourceGroups(sourceScores.materials ?? []),
  };

  await writeFile(materialRankingsPath, `${JSON.stringify(annotatedRankings, null, 2)}\n`);
  await writeFile(materialSourceScoresPath, `${JSON.stringify(annotatedSourceScores, null, 2)}\n`);

  await mkdir(path.dirname(auditReportPath), { recursive: true });
  await writeFile(auditReportPath, `${JSON.stringify({
    encounterScoreFormula: "groupProbability * relativeProbability * materialProbability / 10000",
    providerWeightedSignal: "Existing encounterScore/probability signal; includes provider groupProbability.",
    materialBiasSignal: "relativeProbability * materialProbability; excludes provider groupProbability.",
    normalizedWithinMethodSignal: "Uses material_encounter_rankings.locationClassDistributionShare when present; null for source rows.",
    currentRanking: "material_encounter_rankings.encounterRank is still based on providerWeightedSignal/encounterScore.",
    rankingOptions: [
      "provider-weighted global rank: keep current encounterRank semantics.",
      "method-scoped rank: rank within resolvedMineableClass/provider method before comparing methods.",
      "material-bias rank: rank by materialBiasSignal to avoid cross-provider groupProbability semantics.",
    ],
    stileron: stileronRows(annotatedRankings),
  }, null, 2)}\n`);
}

void main();
