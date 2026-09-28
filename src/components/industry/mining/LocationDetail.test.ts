import assert from "node:assert/strict";
import test from "node:test";

import {
  formatMiningCompetitionDecimalProbability,
  formatMiningCompetitionPercentagePoints,
  miningCompetitionEmptyMessage,
  miningCompetitionProbabilitySummary,
  miningCompetitionSourceLabel,
} from "./miningCompetitionPresentation";

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
  assert.equal(miningCompetitionEmptyMessage(false), "Select exactly one material available at this location to inspect its source-group competition.");
  assert.equal(miningCompetitionEmptyMessage(true), "Source-group competition is unavailable for the selected material at this location.");
});

test("presents delivered competition source groups as user-facing mining pools", () => {
  assert.equal(miningCompetitionSourceLabel("spaceship_surface"), "Surface-ship spawn pool");
  assert.equal(miningCompetitionSourceLabel("ground_vehicle"), "Vehicle-mining spawn pool");
  assert.equal(miningCompetitionSourceLabel("fps_hand"), "Hand-mining spawn pool");
  assert.equal(miningCompetitionSourceLabel("unknown_source"), "unknown source");
});
