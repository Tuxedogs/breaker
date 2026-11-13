import assert from "node:assert/strict";
import test from "node:test";
import type { StaticLocationMaterialRow } from "../../../features/mining/staticMiningIndex";
import {
  buildDemandRows,
  buildOccurrenceDisplay,
  getLocationSelectedCoverage,
  formatMiningProbability,
  usesSpecificLocationOccurrence,
} from "./miningFormatters";
import type { PublicLocationEntry, RequiredMaterial } from "../../../features/mining/types";

function staticRow(overrides: Partial<StaticLocationMaterialRow> = {}): StaticLocationMaterialRow {
  return {
    materialId: "gold",
    materialName: "Gold",
    system: "Pyro",
    systemKey: "Pyro",
    systemDisplayName: "Pyro",
    location: "Pyro5a",
    locationKey: "Pyro5a",
    locationDisplayName: "Ignis",
    parents: [],
    parentDisplayNames: [],
    resolvedMineableClass: "Shipborne",
    sourceCount: 1,
    sourceProbabilitySum: 0.0135,
    sourceProbabilityMax: 0.0135,
    compositionAveragePercentage: 3.5,
    qualityThresholdChancesWeighted: {},
    qualityOverrideApplied: false,
    qualityOverrideRecordNames: [],
    qualityDistributionSourceNames: [],
    locationClassDistributionShare: 0.3658536585,
    encounterScore: 0.0135,
    providerWeightedSignal: 0.0135,
    primaryRockShare: 0.18,
    methodFit: 0.3658536585,
    traceMaterials: ["Borase"],
    traceMaterialDetails: [{
      materialName: "Borase",
      minPercentage: 2,
      maxPercentage: 5,
      qualityScale: 0.789,
      qualityFloor: 395.289,
      qualityCeiling: 789,
    }],
    ...overrides,
  };
}

test("formats provider probabilities without hiding small values", () => {
  assert.equal(formatMiningProbability(0.18), "18%");
  assert.equal(formatMiningProbability(0.0135), "1.35%");
  assert.equal(formatMiningProbability(0.00027), "0.027%");
});

test("builds separate occurrence signals and trace material ranges", () => {
  const occurrence = buildOccurrenceDisplay(staticRow(), null);
  assert.deepEqual(occurrence, {
    mode: "probability",
    primaryRockShareLabel: "18%",
    spawnRollProbabilityLabel: "1.35%",
    locationRankLabel: "Not ranked",
    methodAvailabilityLabel: "36.6%",
    traceMaterialsLabel: "Borase · 2–5% composition · Quality 395–789",
    traceMaterials: [{
      name: "Borase",
      compositionRangeLabel: "2–5% composition",
      qualityRangeLabel: "Quality 395–789",
    }],
  });
});

test("preserves legacy occurrence presentation for specific-location materials", () => {
  for (const key of ["carinite-pure", "pure carinite", "saldynium", "jaclium", "sadaryx"]) {
    assert.equal(usesSpecificLocationOccurrence(key), true, key);
  }
  const occurrence = buildOccurrenceDisplay(staticRow({ materialId: "sadaryx", materialName: "Sadaryx" }), null);
  assert.equal(occurrence.mode, "legacy");
  assert.equal(occurrence.locationRankLabel, "Location-specific");
});

test("retains one selected-material row per delivered mining-method association", () => {
  const entry = {
    locationKey: "pyro:ignis",
    locationName: "Ignis",
    systemName: "Pyro",
    locationKind: "moon",
    spawnType: "mixed",
    nearbyStations: [],
    materials: ["Gold"],
    score: 1,
  } as PublicLocationEntry;
  const required = new Map<string, RequiredMaterial>([["gold", {
    materialId: "gold",
    materialName: "Gold",
    requiredQuantity: 1,
    usedBy: [],
    slots: [],
  }]]);
  const rows = buildDemandRows(
    entry,
    new Set(["gold"]),
    ["gold"],
    required,
    [staticRow({ resolvedMineableClass: "Shipborne" }), staticRow({ resolvedMineableClass: "Handborne" })],
    null,
  );
  assert.deepEqual(rows.map((row) => [row.materialKey, row.miningType]), [["gold", "Surface Ship"], ["gold", "Hand"]]);
  assert.notEqual(rows[0].associationKey, rows[1].associationKey);
});

const partialEntry = {
  locationKey: "pyro:ignis", locationName: "Ignis", systemName: "Pyro",
  locationKind: "moon", spawnType: "mixed", nearbyStations: [], materials: ["Copper", "Gold"], score: 1,
  requiredMaterials: [{ materialId: "copper", materialKey: "copper", materialName: "Copper", requiredQuantity: 1, usedBy: [], slots: [] }],
} as PublicLocationEntry;
const selected = new Set(["copper", "gold", "beryl"]);

test("partial coverage retains present-ineligible and confirmed-absent selections with truthful data", () => {
  const gold = staticRow({ qualityThresholdChancesWeighted: { "800": 0.25, "900": 0 } });
  const rows = buildDemandRows(partialEntry, selected, ["copper"], new Map(), [
    staticRow({ materialId: "copper", materialName: "Copper" }), gold,
  ], null, "loaded");
  assert.equal(rows.length, 3);
  assert.equal(rows[0].coverage, "Covered");
  assert.equal(rows[1].coverage, "Indexed · Not eligible");
  assert.equal(rows[1].status, "missing");
  assert.equal(rows[1].miningType, "Surface Ship");
  assert.equal(rows[1].occurrence.primaryRockShareLabel, "18%");
  assert.equal(rows[1].compositionLabel, "3.5%");
  assert.equal(rows[1].targetQualityChanceLabel, "25%");
  assert.equal(rows[1].quality900Label, "0%");
  assert.equal(rows[2].coverage, "Not present");
  assert.equal(rows[2].status, "missing");
  assert.equal(rows[2].miningType, "Unknown");
  assert.equal(rows[2].targetQualityChanceLabel, "Unknown");
  assert.equal(rows[2].compositionLabel, "Unknown");
  assert.equal(rows[2].sourceWeight, undefined);
  assert.deepEqual(getLocationSelectedCoverage({ entry: partialEntry, locationMaterialKeys: ["copper", "gold"], selectedMaterials: selected, buildQueueMaterialKeys: new Set() }), { covered: 1, total: 3 });
});

test("failed, loading, and unresolved location sources stay Unknown rather than confirming absence", () => {
  for (const status of ["error", "loading", "loaded"] as const) {
    const rows = buildDemandRows(partialEntry, new Set(["gold"]), [], new Map(), [], null, status);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].coverage, "Unknown");
    assert.equal(rows[0].status, "missing");
    assert.equal(rows[0].miningType, "Unknown");
    assert.equal(rows[0].occurrence.primaryRockShareLabel, "Unknown");
  }
});

test("all ineligible method associations survive and cannot gain coverage from raw membership", () => {
  const rows = buildDemandRows(partialEntry, new Set(["gold"]), ["copper", "gold"], new Map(), [
    staticRow({ resolvedMineableClass: "Shipborne" }), staticRow({ resolvedMineableClass: "Handborne" }),
  ], null, "loaded");
  assert.deepEqual(rows.map((row) => [row.miningType, row.coverage, row.status]), [
    ["Surface Ship", "Indexed · Not eligible", "missing"], ["Hand", "Indexed · Not eligible", "missing"],
  ]);
  assert.notEqual(rows[0].associationKey, rows[1].associationKey);
});

test("delivered indexed methods remain available when the detailed static source cannot resolve", () => {
  const entry = { ...partialEntry, indexedResources: [
    { materialId: "gold", materialName: "Gold", miningType: "Shipborne" },
    { materialId: "gold", materialName: "Gold", miningType: "Handborne" },
  ] };
  const rows = buildDemandRows(entry, new Set(["gold"]), [], new Map(), [], null, "error");
  assert.deepEqual(rows.map((row) => row.miningType), ["Surface Ship", "Hand"]);
  assert.ok(rows.every((row) => row.coverage === "Indexed · Not eligible" && row.compositionLabel === "Unknown" && row.targetQualityChanceLabel === "Unknown"));
});


test("coverage includes all active sidebar and queue selections without counting presence", () => {
  const entry = { requiredMaterials: [{ materialId: "gold" }] } as PublicLocationEntry;
  assert.deepEqual(getLocationSelectedCoverage({ entry, locationMaterialKeys: ["gold", "silver"], selectedMaterials: new Set(["gold", "silver"]), buildQueueMaterialKeys: new Set(["copper", "gold"]) }), { covered: 1, total: 3 });
  assert.deepEqual(getLocationSelectedCoverage({ entry: { ...entry, requiredMaterials: undefined }, locationMaterialKeys: ["gold"], selectedMaterials: new Set(["gold"]), buildQueueMaterialKeys: new Set() }), { covered: 0, total: 1 });
});

test("route sentence reads the existing coverage plan order", async () => {
  const { miningRouteSentence } = await import("./miningFormatters");
  const stop = (name: string, newCoverage: string[], isAfterCompletion = false) => ({
    entry: { locationName: name } as PublicLocationEntry, newCoverage, isAfterCompletion,
  });
  const plan = (locations: ReturnType<typeof stop>[], coveredCount: number, totalMaterials: number) =>
    ({ locations, coveredCount, totalMaterials } as unknown as Parameters<typeof miningRouteSentence>[0]);
  const name = (entry: PublicLocationEntry) => entry.locationName;
  assert.equal(miningRouteSentence(plan([stop("Bloom", ["a", "b"]), stop("Daymar", ["c"]), stop("Yela", [], true)], 3, 3), name),
    "Visit Bloom, then Daymar: covers all 3 materials.");
  assert.equal(miningRouteSentence(plan([stop("Bloom", ["a"])], 1, 1), name), "Visit Bloom: covers your material.");
  assert.equal(miningRouteSentence(plan([stop("A", ["a"]), stop("B", ["b"]), stop("C", ["c"]), stop("D", ["d"]), stop("E", [])], 4, 6), name),
    "Visit A, B, C, then 1 more stop: covers 4 of 6 materials.");
  assert.equal(miningRouteSentence(plan([], 0, 0), name), null);
  assert.equal(miningRouteSentence(null, name), null);
});
