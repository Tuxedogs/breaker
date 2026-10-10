import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMiningCompetitionTargets,
  formatMiningCompetitionDecimalProbability,
  formatMiningCompetitionPercentagePoints,
  miningCompetitionEvidenceMessage,
  miningCompetitionEmptyMessage,
  miningCompetitionMaterialColor,
  miningCompetitionProbabilitySummary,
  miningCompetitionSourceLabel,
} from "./miningCompetitionPresentation";
import type { StaticLocationMaterialRow } from "../../../features/mining/staticMiningIndex";

test("formats delivered spawn competition units without converting percentage points twice", () => {
  assert.equal(formatMiningCompetitionPercentagePoints(20.8), "20.8%");
  assert.equal(formatMiningCompetitionPercentagePoints(7.5), "7.5%");
  assert.equal(formatMiningCompetitionDecimalProbability(1), "100%");
  assert.equal(formatMiningCompetitionDecimalProbability(0.0156), "1.56%");
});

test("keeps zero distinct from unavailable competition probabilities", () => {
  assert.equal(formatMiningCompetitionPercentagePoints(0), "0%");
  assert.equal(formatMiningCompetitionDecimalProbability(0), "0%");
  assert.equal(formatMiningCompetitionPercentagePoints(undefined), "Unavailable");
  assert.equal(formatMiningCompetitionDecimalProbability(null), "Unavailable");
});

test("exposes all four delivered probability semantics to assistive technology", () => {
  assert.equal(miningCompetitionProbabilitySummary({
    materialKey: "copper",
    materialName: "Copper",
    relativeProbability: 20.8,
    groupProbability: 7.5,
    materialProbability: 1,
    sourceProbability: 0.0156,
  }), "Pool share: 20.8%. Group probability: 7.5%. Material probability: 100%. Source probability: 1.56%");
});

test("distinguishes selection-needed from unavailable source-group data", () => {
  assert.equal(miningCompetitionEmptyMessage(false), "Select a material to inspect its direct-spawn source-group competition.");
  assert.equal(miningCompetitionEmptyMessage(true), "Source-group competition is unavailable for the selected material at this location.");
});

test("keeps multi-material competition states material-specific instead of inventing an aggregate", () => {
  assert.equal(
    miningCompetitionEvidenceMessage("Copper", "not-at-location"),
    "Copper is not represented in the source-backed material records for this location.",
  );
  assert.equal(
    miningCompetitionEvidenceMessage("Gold", "no-direct-spawn-evidence"),
    "No direct-spawn source-group competition evidence is published for Gold at this location.",
  );
  assert.equal(
    miningCompetitionEvidenceMessage("Beryl", "reference-unavailable"),
    "Direct-spawn competition evidence for Beryl is unavailable because the location reference index could not load.",
  );
  assert.equal(
    miningCompetitionEvidenceMessage("Laranite", "loading"),
    "Direct-spawn competition evidence for Laranite is loading.",
  );
});

test("builds a per-material competition view for every selected material", () => {
  const rows = [
    { materialId: "copper", materialName: "Copper", sources: [{ materialKey: "copper", materialName: "Copper", groupName: "ship", relativeProbability: 60 }] },
    { materialId: "gold", materialName: "Gold", sources: [{ materialKey: "gold", materialName: "Gold", groupName: "ship", relativeProbability: 40 }] },
  ] as StaticLocationMaterialRow[];
  const targets = buildMiningCompetitionTargets({
    selectedMaterialKeys: ["copper", "gold", "beryl"],
    selectedMaterialNames: new Map([["beryl", "Beryl"]]),
    focusedMaterialKey: "gold",
    staticResourceRows: rows,
    staticIndexStatus: "loaded",
  });

  assert.deepEqual(targets.map((target) => [target.materialKey, target.materialName, target.evidenceState]), [
    ["gold", "Gold", null],
    ["beryl", "Beryl", "not-at-location"],
    ["copper", "Copper", null],
  ]);
  assert.deepEqual(targets.map((target) => target.pools.length), [1, 0, 1]);
});

test("presents delivered competition source groups as user-facing mining pools", () => {
  assert.equal(miningCompetitionSourceLabel("spaceship_surface"), "Surface-ship spawn pool");
  assert.equal(miningCompetitionSourceLabel("ground_vehicle"), "Vehicle-mining spawn pool");
  assert.equal(miningCompetitionSourceLabel("fps_hand"), "Hand-mining spawn pool");
  assert.equal(miningCompetitionSourceLabel("unknown_source"), "unknown source");
});

test("derives competition colors from canonical material identity instead of member order", () => {
  assert.equal(miningCompetitionMaterialColor("Iron"), "#A89A8D");
  assert.equal(miningCompetitionMaterialColor("Corundum"), "#A54857");
  assert.equal(miningCompetitionMaterialColor("Carinite"), "#C45A7A");
  assert.equal(miningCompetitionMaterialColor("Bexalite"), "#71818A");
});
