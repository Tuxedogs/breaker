import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { verifyAcceptedMiningSource } from "./miningPublicationProvenance.mts";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");

async function createAcceptedDataset() {
  const root = await mkdtemp(path.join(os.tmpdir(), "moonbreaker-mining-provenance-"));
  const datasetRoot = path.join(root, "datasets");
  const receiptPath = path.join(root, "reports", "mining", "mining_generation_receipt.json");
  const enriched = "[{\"materialName\":\"Aluminum\"}]\n";
  const locationIndex = "[{\"locationKey\":\"Aaronhalo\"}]\n";
  await mkdir(path.join(datasetRoot, "mining"), { recursive: true });
  await mkdir(path.join(datasetRoot, "recommendations"), { recursive: true });
  await mkdir(path.dirname(receiptPath), { recursive: true });
  await writeFile(path.join(datasetRoot, "mining", "material_sources_quality_enriched.json"), enriched);
  await writeFile(path.join(datasetRoot, "recommendations", "location_material_index.json"), locationIndex);
  await writeFile(receiptPath, JSON.stringify({
    buildId: "accepted-build.1",
    datasetRoot,
    validatedAt: "2026-10-15T00:00:00Z",
    receiptedAt: "2026-10-15T00:00:01Z",
    validatedArtifacts: {
      "mining/material_sources_quality_enriched.json": { sha256: hash(enriched) },
      "recommendations/location_material_index.json": { sha256: hash(locationIndex) },
    },
  }));
  return { datasetRoot, locationIndexPath: path.join(datasetRoot, "recommendations", "location_material_index.json") };
}

test("accepts only a receipted Mining dataset with matching immutable artifacts", async () => {
  const fixture = await createAcceptedDataset();
  const provenance = await verifyAcceptedMiningSource(fixture.datasetRoot, "accepted-build.1");
  assert.equal(provenance.buildId, "accepted-build.1");
  assert.equal(provenance.validatedArtifactHashes["recommendations/location_material_index.json"], hash("[{\"locationKey\":\"Aaronhalo\"}]\n"));
});

test("rejects a source tree whose index no longer matches its acceptance receipt", async () => {
  const fixture = await createAcceptedDataset();
  await writeFile(fixture.locationIndexPath, "[]\n");
  await assert.rejects(
    verifyAcceptedMiningSource(fixture.datasetRoot, "accepted-build.1"),
    /source hash mismatch/i,
  );
});
