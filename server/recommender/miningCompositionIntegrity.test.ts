import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Guards the Scintel composition fix: Gold, Bexalite, Quantanium and Hephaestanite were once dropped from
// every rock composition, so each of their sources reported another material (Borase, Beryl, Quartz) as dominant.

type EnrichedSource = {
  primaryMaterial?: { materialName?: string; materialId?: string } | null;
  dominantCompositionMaterialName?: string;
  composition?: { summaryMaterialName?: string; qualityScale?: number };
  traceMaterials?: string[];
};
type EnrichedMaterial = { materialName: string; materialId?: string; sources: EnrichedSource[] };

const FOUR = ["Gold", "Bexalite", "Quantanium", "Hephaestanite"] as const;

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

test("each of Gold, Bexalite, Quantanium and Hephaestanite is the dominant composition of its own sources", async () => {
  const materials = await readJson<EnrichedMaterial[]>("server-data/mining/recommender/material-sources-quality-enriched.json");
  for (const name of FOUR) {
    const material = materials.find((entry) => entry.materialName === name);
    assert.ok(material && material.sources.length > 0, `${name} must have sources`);
    for (const source of material.sources) {
      assert.equal(source.dominantCompositionMaterialName, name, `${name} source dominant composition`);
      assert.equal(source.composition?.summaryMaterialName, name, `${name} source composition summary`);
      assert.equal(source.primaryMaterial?.materialName, name, `${name} source primary material`);
      assert.equal(source.composition?.qualityScale, 1, `${name} primary band qualityScale`);
    }
  }
});

test("the four materials appear as trace materials of other sources", async () => {
  const materials = await readJson<EnrichedMaterial[]>("server-data/mining/recommender/material-sources-quality-enriched.json");
  const traced = new Set<string>();
  for (const material of materials) {
    for (const source of material.sources) for (const trace of source.traceMaterials ?? []) traced.add(trace);
  }
  for (const name of ["Gold", "Bexalite", "Hephaestanite"]) assert.ok(traced.has(name), `${name} should be traced somewhere`);
});

test("quality quantization rows for the mineable commodities carry the MineableElement id", async () => {
  const rows = await readJson<Array<{ materialKey: string; materialId: string | null }>>("server-data/crafting/reference/material-quality-quantization.json");
  const byKey = new Map(rows.map((row) => [row.materialKey, row.materialId]));
  const expected: Record<string, string> = {
    gold: "f2f5bf2e-87f9-4f3d-bb59-b4e11eceeaad",
    bexalite: "f48b147f-713e-481f-adf2-ff9869ac61bd",
    hephaestanite: "220c2e18-9324-4528-b399-2f908488b204",
    quantainium: "fc62043c-3f29-4fff-b754-2301762723f7",
  };
  for (const [key, id] of Object.entries(expected)) assert.equal(byKey.get(key), id, `${key} materialId`);
});
