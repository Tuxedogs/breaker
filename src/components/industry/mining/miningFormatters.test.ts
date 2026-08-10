import assert from "node:assert/strict";
import test from "node:test";
import type { StaticLocationMaterialRow } from "../../../features/mining/staticMiningIndex";
import {
  buildOccurrenceDisplay,
  formatMiningProbability,
  usesSpecificLocationOccurrence,
} from "./miningFormatters";

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
