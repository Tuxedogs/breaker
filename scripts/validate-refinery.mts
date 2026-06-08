import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  calculateMaterialAtRefinery,
  findBestSingleRefinery,
  getFinalYieldMultiplier,
  getRawRequired,
  optimizePerMaterial,
  optimizeSelectedRoute,
} from "../src/lib/refineryCalculations";
import type { RefineryDataset, RefineryRecord } from "../src/types/refinery";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertApprox(actual: number, expected: number, message: string): void {
  assert(Math.abs(actual - expected) < 1e-9, `${message}: expected ${expected}, received ${actual}`);
}

function assertThrows(run: () => unknown, message: string): void {
  let threw = false;
  try {
    run();
  } catch {
    threw = true;
  }
  assert(threw, message);
}

function refinery(id: string, name: string, agricium: number, aluminum: number): RefineryRecord {
  const bonus = {
    agricium: 0,
    aluminum: 0,
    beryl: 0,
    bexalite: 0,
    borase: 0,
    copper: 0,
    corundum: 0,
    gold: 0,
    hephaestanite: 0,
    iron: 0,
    laranite: 0,
    lindinium: 0,
    quantanium: 0,
    quartz: 0,
    savrilium: 0,
    taranite: 0,
    titanium: 0,
    torite: 0,
    tungsten: 0,
  };
  return { id, name, systemCode: "TS", materialBonuses: { ...bonus, agricium, aluminum } };
}

const targets = [
  { materialId: "agricium" as const, desiredRefinedAmount: 100 },
  { materialId: "aluminum" as const, desiredRefinedAmount: 200 },
];
const alpha = refinery("alpha", "Alpha", 20, 0);
const beta = refinery("beta", "Beta", 0, 20);
const alphaLaterId = refinery("alpha-z", "Alpha", 20, 0);

assertApprox(getFinalYieldMultiplier(20), 0.48, "20% multiplier");
assertApprox(getRawRequired(100, 0), 250, "0% raw requirement");
assertApprox(getRawRequired(100, 20), 208.33333333333334, "20% raw requirement");
assert(getRawRequired(0, 20) === 0, "Zero desired refined amount must return zero.");
assertThrows(() => getRawRequired(-1, 0), "Negative desired refined amount must throw.");
assertThrows(() => getRawRequired(Number.NaN, 0), "Non-finite desired refined amount must throw.");
assertThrows(() => getRawRequired(1, Number.POSITIVE_INFINITY), "Non-finite bonus must throw.");
assertThrows(() => getRawRequired(0, Number.NaN), "Zero desired amount must still reject a non-finite bonus.");
assertThrows(() => getFinalYieldMultiplier(-100), "Non-positive final multiplier must throw.");

const optimized = optimizePerMaterial([alpha, beta], targets);
assert(optimized?.calculations[0]?.refineryId === "alpha", "Agricium should select Alpha.");
assert(optimized?.calculations[1]?.refineryId === "beta", "Aluminum should select Beta.");
assert(findBestSingleRefinery([alpha, beta], targets)?.refineryId === "beta", "Best single refinery must minimize total raw.");
assert(optimizeSelectedRoute([alpha, beta], ["alpha"], targets)?.calculations.every((row) => row.refineryId === "alpha"), "Selected route must exclude unselected refineries.");
assert(findBestSingleRefinery([alphaLaterId, alpha], [targets[0]])?.refineryId === "alpha", "Ties must resolve by refinery name then ID.");
assert(calculateMaterialAtRefinery(alpha, targets[0]).bonusPercent === 20, "Calculation must use the requested material bonus.");
assert(optimizePerMaterial([], targets) === null, "Empty refinery candidates must return null.");
assert(findBestSingleRefinery([], targets) === null, "Empty single-refinery candidates must return null.");
assert(optimizeSelectedRoute([alpha], ["missing"], targets) === null, "Unknown selected refinery IDs must return null.");

const datasetPath = path.resolve("public/api/refinery/refinery_yields.json");
const dataset = JSON.parse(await readFile(datasetPath, "utf8")) as RefineryDataset;
assert(dataset.schemaVersion === 1, "Generated dataset schema version must be 1.");
assert(dataset.baseRefineryYield === 0.4, "Generated dataset base yield must be 0.4.");
assert(dataset.materials.length === 19, "Generated dataset must contain 19 materials.");
assert(dataset.refineries.length === 20, "Generated dataset must contain 20 refineries.");
assert(dataset.refineries.every((record) => Object.keys(record.materialBonuses).length === 19), "Every refinery must contain 19 material bonuses.");

console.log("Refinery calculation and dataset validation passed.");
