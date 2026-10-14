import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMiningLocationCompetitionPools,
  formatMiningCompetitionDecimalProbability,
  formatMiningCompetitionPercentagePoints,
  miningCompetitionMaterialColor,
  miningCompetitionPoolCoverage,
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

test("does not normalize a partial source pool to look complete", () => {
  const coverage = miningCompetitionPoolCoverage([
    { materialKey: "beradom", materialName: "Beradom", relativeProbability: 8, groupProbability: 12.5, materialProbability: 1, sourceProbability: 0.01 },
    { materialKey: "glacosite", materialName: "Glacosite", relativeProbability: 4, groupProbability: 12.5, materialProbability: 1, sourceProbability: 0.005 },
    { materialKey: "feynmaline", materialName: "Feynmaline", relativeProbability: 0.5, groupProbability: 12.5, materialProbability: 1, sourceProbability: 0.000625 },
  ]);

  assert.deepEqual(coverage, { knownShare: 12.5, unrepresentedShare: 87.5, hasUnavailableShare: false });
});

test("retains an unavailable pool share instead of manufacturing a remainder", () => {
  const coverage = miningCompetitionPoolCoverage([
    { materialKey: "beradom", materialName: "Beradom", relativeProbability: 8, groupProbability: 12.5, materialProbability: 1, sourceProbability: 0.01 },
    { materialKey: "unknown", materialName: "Unknown", relativeProbability: undefined, groupProbability: 12.5, materialProbability: 1, sourceProbability: undefined },
  ]);

  assert.deepEqual(coverage, { knownShare: 8, unrepresentedShare: null, hasUnavailableShare: true });
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

test("renders source-backed pools only for selected materials present at the location", () => {
  const rows = [
    { materialId: "copper", materialName: "Copper", sources: [{ materialKey: "copper", materialName: "Copper", groupName: "ship", relativeProbability: 60 }] },
    { materialId: "gold", materialName: "Gold", sources: [{ materialKey: "gold", materialName: "Gold", groupName: "ship", relativeProbability: 40 }] },
  ] as StaticLocationMaterialRow[];
  const pools = buildMiningLocationCompetitionPools({
    selectedMaterialKeys: ["copper", "gold", "beryl"],
    staticResourceRows: rows,
    staticIndexStatus: "loaded",
  });

  assert.equal(pools.length, 1);
  assert.deepEqual(pools[0].selectedMembers.map((member) => member.materialName), ["Copper", "Gold"]);
  assert.equal(pools[0].selectedMembers.some((member) => member.materialKey === "beryl"), false);
});

test("keeps unavailable source data out of competition rather than treating it as material absence", () => {
  const pools = buildMiningLocationCompetitionPools({
    selectedMaterialKeys: ["copper"],
    staticResourceRows: [],
    staticIndexStatus: "error",
  });

  assert.deepEqual(pools, []);
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
