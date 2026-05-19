import type { PublicLocationEntry, RequiredMaterial } from "./types";

export type MiningCoverageMode = "complete-set" | "best-single" | "rare-first" | "quality-hunt";

export type CoverageLocationRole =
  | "Anchor Route"
  | "Gap Filler"
  | "Rare Source"
  | "Quality Upgrade"
  | "Optional Overlap";

export type CoveragePlanLocation = {
  entry: PublicLocationEntry;
  role: CoverageLocationRole;
  newCoverage: string[];
  duplicateCoverage: string[];
  coveredMaterialKeys: string[];
  cumulativeCovered: number;
  cumulativeCoveragePct: number;
  isCompletionLocation: boolean;
  isAfterCompletion: boolean;
};

export type CoverageMaterialRow = {
  materialKey: string;
  displayName: string;
  candidateCount: number;
  coveredByLocationKeys: string[];
  firstLocationKey: string | null;
  status: "covered" | "missing";
};

export type CoveragePlanSummary = {
  headline: string;
  detail: string;
  completionText: string | null;
  missingText: string | null;
  noSingleLocationText: string | null;
};

export type CoveragePlan = {
  mode: MiningCoverageMode;
  totalMaterials: number;
  coveredCount: number;
  coveredPct: number;
  completionLocationKey: string | null;
  locations: CoveragePlanLocation[];
  materialRows: CoverageMaterialRow[];
  summary: CoveragePlanSummary;
};

type CoveragePlanInput = {
  mode: MiningCoverageMode;
  demandMaterials: RequiredMaterial[];
  locations: PublicLocationEntry[];
  locationMaterialKeysByLocationKey: Map<string, string[]>;
};

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function demandKey(material: RequiredMaterial): string {
  return material.materialKey ?? material.materialId;
}

function demandLabel(material: RequiredMaterial): string {
  return material.displayName ?? material.materialName ?? demandKey(material);
}

function locationFitScore(location: PublicLocationEntry): number {
  if (Number.isFinite(location.routeTargetabilityScore)) return location.routeTargetabilityScore ?? 0;
  if (Number.isFinite(location.score)) return location.score;
  return 0;
}

function locationDemandKeys(
  location: PublicLocationEntry,
  demandKeys: Set<string>,
  locationMaterialKeysByLocationKey: Map<string, string[]>,
): string[] {
  return unique(locationMaterialKeysByLocationKey.get(location.locationKey) ?? [])
    .filter((key) => demandKeys.has(key));
}

function getCandidateCounts(
  demandKeys: string[],
  locations: PublicLocationEntry[],
  locationMaterialKeysByLocationKey: Map<string, string[]>,
): Map<string, number> {
  const demandSet = new Set(demandKeys);
  const counts = new Map(demandKeys.map((key) => [key, 0]));
  for (const location of locations) {
    for (const key of locationDemandKeys(location, demandSet, locationMaterialKeysByLocationKey)) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

function weightedCoverageScore(keys: string[], candidateCounts: Map<string, number>, mode: MiningCoverageMode): number {
  return keys.reduce((sum, key) => {
    const candidates = candidateCounts.get(key) ?? 1;
    if (mode === "rare-first") return sum + 1 / Math.max(1, candidates);
    return sum + 1;
  }, 0);
}

function pickGreedyLocations(
  mode: MiningCoverageMode,
  locations: PublicLocationEntry[],
  demandKeys: string[],
  candidateCounts: Map<string, number>,
  locationMaterialKeysByLocationKey: Map<string, string[]>,
): PublicLocationEntry[] {
  if (mode === "best-single" || demandKeys.length === 0) return locations;

  const demandSet = new Set(demandKeys);
  const remaining = [...locations];
  const selected: PublicLocationEntry[] = [];
  const selectedKeys = new Set<string>();
  const covered = new Set<string>();

  while (covered.size < demandKeys.length && remaining.length > 0) {
    const best = remaining
      .filter((location) => !selectedKeys.has(location.locationKey))
      .map((location) => {
        const locationKeys = locationDemandKeys(location, demandSet, locationMaterialKeysByLocationKey);
        const newKeys = locationKeys.filter((key) => !covered.has(key));
        const coverageScore = weightedCoverageScore(newKeys, candidateCounts, mode);
        const fitScore = locationFitScore(location);
        const qualityBias = mode === "quality-hunt" ? fitScore / 100 : 0;
        return { location, newKeys, coverageScore: coverageScore + qualityBias, fitScore };
      })
      .sort((left, right) =>
        right.coverageScore - left.coverageScore ||
        right.newKeys.length - left.newKeys.length ||
        right.fitScore - left.fitScore ||
        left.location.locationName.localeCompare(right.location.locationName)
      )[0];

    if (!best || best.newKeys.length === 0) break;
    selected.push(best.location);
    selectedKeys.add(best.location.locationKey);
    for (const key of best.newKeys) covered.add(key);
  }

  const rest = locations.filter((location) => !selectedKeys.has(location.locationKey));
  return [...selected, ...rest];
}

function roleForLocation(args: {
  newCoverage: string[];
  duplicateCoverage: string[];
  candidateCounts: Map<string, number>;
  selectedIndex: number;
  completionReached: boolean;
  entry: PublicLocationEntry;
}): CoverageLocationRole {
  const { newCoverage, duplicateCoverage, candidateCounts, selectedIndex, completionReached, entry } = args;
  if (completionReached && newCoverage.length === 0 && locationFitScore(entry) >= 65) return "Quality Upgrade";
  if (completionReached || newCoverage.length === 0) return "Optional Overlap";
  if (newCoverage.some((key) => (candidateCounts.get(key) ?? 0) <= 2)) return "Rare Source";
  if (selectedIndex === 0 && newCoverage.length >= Math.max(2, duplicateCoverage.length)) return "Anchor Route";
  return "Gap Filler";
}

function buildSummary(args: {
  totalMaterials: number;
  coveredCount: number;
  completionIndex: number;
  maxSingleCoverage: number;
  materialRows: CoverageMaterialRow[];
}): CoveragePlanSummary {
  const { totalMaterials, coveredCount, completionIndex, maxSingleCoverage, materialRows } = args;
  if (totalMaterials === 0) {
    return {
      headline: "No build queue mining demand selected.",
      detail: "Select Build Queue or material filters to build a route coverage plan.",
      completionText: null,
      missingText: null,
      noSingleLocationText: null,
    };
  }

  const coveredPct = Math.round((coveredCount / totalMaterials) * 100);
  const missingRows = materialRows.filter((row) => row.status === "missing");
  const completionText = completionIndex >= 0
    ? `Complete after ${completionIndex + 1} location${completionIndex === 0 ? "" : "s"}`
    : null;
  const missingText = missingRows.length > 0
    ? `Missing: ${missingRows.slice(0, 4).map((row) => row.displayName).join(", ")}${missingRows.length > 4 ? ` +${missingRows.length - 4} more` : ""}`
    : null;
  const noSingleLocationText = maxSingleCoverage > 0 && maxSingleCoverage < totalMaterials
    ? `No single location covers more than ${maxSingleCoverage} / ${totalMaterials}`
    : null;

  if (coveredCount === totalMaterials) {
    return {
      headline: `${coveredCount} / ${totalMaterials} materials covered`,
      detail: completionText
        ? `Route set reaches ${coveredPct}% coverage. Remaining rows are alternates, quality upgrades, or overlap.`
        : `Current recommendations reach ${coveredPct}% coverage.`,
      completionText,
      missingText,
      noSingleLocationText,
    };
  }

  return {
    headline: `${coveredCount} / ${totalMaterials} materials covered`,
    detail: `Current recommendations reach ${coveredPct}% coverage. ${missingText ?? "Some materials may require clearing filters or missing index data."}`,
    completionText,
    missingText,
    noSingleLocationText,
  };
}

export function buildCoveragePlan(input: CoveragePlanInput): CoveragePlan {
  const demandEntries = input.demandMaterials
    .map((material) => ({ key: demandKey(material), label: demandLabel(material) }))
    .filter((material) => material.key);
  const demandKeys = unique(demandEntries.map((material) => material.key));
  const demandSet = new Set(demandKeys);
  const labelsByKey = new Map(demandEntries.map((material) => [material.key, material.label]));
  const candidateCounts = getCandidateCounts(demandKeys, input.locations, input.locationMaterialKeysByLocationKey);
  const orderedLocations = pickGreedyLocations(
    input.mode,
    input.locations,
    demandKeys,
    candidateCounts,
    input.locationMaterialKeysByLocationKey,
  );

  const covered = new Set<string>();
  let completionLocationKey: string | null = null;
  let completionIndex = -1;
  let maxSingleCoverage = 0;
  const locations: CoveragePlanLocation[] = [];

  orderedLocations.forEach((entry, index) => {
    const coveredMaterialKeys = locationDemandKeys(entry, demandSet, input.locationMaterialKeysByLocationKey);
    maxSingleCoverage = Math.max(maxSingleCoverage, coveredMaterialKeys.length);
    const newCoverage = coveredMaterialKeys.filter((key) => !covered.has(key));
    const duplicateCoverage = coveredMaterialKeys.filter((key) => covered.has(key));
    const wasComplete = covered.size >= demandKeys.length && demandKeys.length > 0;
    for (const key of newCoverage) covered.add(key);
    const isCompletionLocation = completionLocationKey === null && demandKeys.length > 0 && covered.size >= demandKeys.length;
    if (isCompletionLocation) {
      completionLocationKey = entry.locationKey;
      completionIndex = index;
    }
    locations.push({
      entry,
      role: roleForLocation({
        newCoverage,
        duplicateCoverage,
        candidateCounts,
        selectedIndex: index,
        completionReached: wasComplete,
        entry,
      }),
      newCoverage,
      duplicateCoverage,
      coveredMaterialKeys,
      cumulativeCovered: covered.size,
      cumulativeCoveragePct: demandKeys.length > 0 ? Math.round((covered.size / demandKeys.length) * 100) : 0,
      isCompletionLocation,
      isAfterCompletion: wasComplete,
    });
  });

  const coveredByMaterial = new Map<string, string[]>();
  for (const plannedLocation of locations) {
    for (const key of plannedLocation.coveredMaterialKeys) {
      const locationKeys = coveredByMaterial.get(key) ?? [];
      locationKeys.push(plannedLocation.entry.locationKey);
      coveredByMaterial.set(key, locationKeys);
    }
  }

  const materialRows = demandKeys.map((key): CoverageMaterialRow => {
    const coveredByLocationKeys = coveredByMaterial.get(key) ?? [];
    return {
      materialKey: key,
      displayName: labelsByKey.get(key) ?? key,
      candidateCount: candidateCounts.get(key) ?? 0,
      coveredByLocationKeys,
      firstLocationKey: coveredByLocationKeys[0] ?? null,
      status: coveredByLocationKeys.length > 0 ? "covered" : "missing",
    };
  });
  const coveredCount = materialRows.filter((row) => row.status === "covered").length;

  return {
    mode: input.mode,
    totalMaterials: demandKeys.length,
    coveredCount,
    coveredPct: demandKeys.length > 0 ? Math.round((coveredCount / demandKeys.length) * 100) : 0,
    completionLocationKey,
    locations,
    materialRows,
    summary: buildSummary({
      totalMaterials: demandKeys.length,
      coveredCount,
      completionIndex,
      maxSingleCoverage,
      materialRows,
    }),
  };
}
