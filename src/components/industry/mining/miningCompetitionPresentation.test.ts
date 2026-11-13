import assert from "node:assert/strict";
import test from "node:test";
import type { MiningSpawnCompetitionMember } from "../../../features/mining/miningPresentationModels";
import type { StaticLocationMaterialRow } from "../../../features/mining/staticMiningIndex";
import {
  buildMiningLocationOccurrenceRatings,
  miningOccurrenceRatingForRow,
  rateMiningPoolShare,
} from "./miningCompetitionPresentation";

const member = (materialKey: string, relativeProbability: number | null): MiningSpawnCompetitionMember => ({
  materialKey, materialName: materialKey, relativeProbability,
  groupProbability: 100, materialProbability: 1, sourceProbability: 1,
});
const pool = (...shares: Array<[string, number | null]>) => shares.map(([key, share]) => member(key, share));

test("fair share compares a material with an even split of its pool", () => {
  // Bloom hand pool: 3 members.
  const hand = pool(["aphorite", 61.1], ["dolivine", 36.9], ["janalite", 2]);
  assert.equal(rateMiningPoolShare(61.1, hand).label, "High");
  assert.equal(rateMiningPoolShare(36.9, hand).label, "Average");
  assert.equal(rateMiningPoolShare(2, hand).label, "Very low");
  // Bloom ship pool: 5 members.
  const ship = pool(["iron", 35], ["quartz", 35], ["borase", 18], ["riccite", 10], ["stileron", 2]);
  assert.equal(rateMiningPoolShare(18, ship).label, "Average");
  assert.equal(rateMiningPoolShare(35, ship).label, "High");
  assert.equal(rateMiningPoolShare(10, ship).label, "Low");
});

test("band edges are lower-bound inclusive", () => {
  const four = pool(["a", 25], ["b", 25], ["c", 25], ["d", 25]);
  // fair share 25%: ratio 2 / 1.2 / 0.8 / 0.35 sit on the edges.
  assert.equal(rateMiningPoolShare(50, four).band, "very-high");
  assert.equal(rateMiningPoolShare(30, four).band, "high");
  assert.equal(rateMiningPoolShare(20, four).band, "average");
  assert.equal(rateMiningPoolShare(8.75, four).band, "low");
  assert.equal(rateMiningPoolShare(8.7, four).band, "very-low");
});

test("partial, unavailable, zero and sole-member pools stay distinct", () => {
  assert.deepEqual(
    [rateMiningPoolShare(12.5, pool(["beradom", 12.5])).label, rateMiningPoolShare(12.5, pool(["beradom", 12.5])).reason],
    ["Not rated", "partial-pool"],
  );
  assert.equal(rateMiningPoolShare(50, pool(["a", 50], ["b", null])).label, "Unknown");
  assert.equal(rateMiningPoolShare(undefined, pool(["a", 100])).label, "Unknown");
  assert.equal(rateMiningPoolShare(0, pool(["a", 100], ["b", 0])).label, "None");
  const sole = rateMiningPoolShare(100, pool(["a", 100]));
  assert.deepEqual([sole.band, sole.reason], ["very-high", "sole-member"]);
});

test("location ratings resolve each material row through its source pool", () => {
  const row = (materialName: string, groupName: string, relativeProbability: number) => ({
    materialId: materialName.toLowerCase(), materialName,
    sources: [{ groupName, materialKey: materialName.toLowerCase(), materialName, relativeProbability, groupProbability: 100, materialProbability: 1, sourceProbability: 1 }],
  }) as unknown as StaticLocationMaterialRow;
  const rows = [row("Aphorite", "fps", 61.1), row("Dolivine", "fps", 36.9), row("Janalite", "fps", 2), row("Beradom", "groundvehicle", 12.5)];
  const ratings = buildMiningLocationOccurrenceRatings(rows);
  assert.equal(miningOccurrenceRatingForRow(rows[0], ratings)?.label, "High");
  assert.equal(miningOccurrenceRatingForRow(rows[3], ratings)?.label, "Not rated");
  assert.equal(miningOccurrenceRatingForRow(undefined, ratings), undefined);
});
