import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { checkPublishedDatasetConsistency, gameBuildKey } from "./dataset-consistency.mts";

const GEN = "aaaaaaaaaaaaaaaaaaaaaaaa";
const OTHER_GEN = "bbbbbbbbbbbbbbbbbbbbbbbb";
const SNAPSHOT = "2026-11-13T01:00:15.772928+00:00";
const BUILD = "4.10.200.58746-live.13165946";
const CONTRACT = "11111111-1111-1111-1111-111111111111";
const BLUEPRINT = "22222222-2222-2222-2222-222222222222";
const OFFER = "provider:offer";

type Overrides = {
  bsGeneration?: string;
  bsSnapshot?: string;
  recordGeneration?: string;
  refBuild?: string;
  bsContract?: string;
  bsOffer?: string;
  fittingBuild?: string;
  pointerGeneration?: string;
};

async function writeJson(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(value), "utf8");
}

async function fixture(o: Overrides = {}): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "dataset-consistency-"));
  const sd = path.join(root, "server-data");
  const generation = { generationId: GEN, missionSchemaVersion: 3, sourceContractVersion: 4, offerSchemaVersion: 1, offerJoinStatus: "joined_exact_variant" };
  const pointerGeneration = o.pointerGeneration ?? GEN;
  await writeJson(path.join(sd, "missions", "current.json"), {
    schemaVersion: 1, missionSchemaVersion: 3, sourceContractVersion: 4, offerSchemaVersion: 1,
    generationId: pointerGeneration, generationPath: `generations/${pointerGeneration}`,
  });
  const genRoot = path.join(sd, "missions", "generations", GEN);
  await writeJson(path.join(genRoot, "mission_browser_index.json"), {
    generationId: GEN, schemaVersion: 3, sourceContractVersion: 4, offerSchemaVersion: 1,
    sourceLatestModifiedAt: SNAPSHOT,
    sourceInputs: { refIndex: { status: "explicit", buildId: o.refBuild ?? BUILD } },
    variantDetailFiles: { [CONTRACT]: "variants/x.json" },
    variantOfferKeys: { [CONTRACT]: OFFER },
  });
  await writeJson(path.join(genRoot, "mission_shard_manifest.json"), {
    generationId: GEN, schemaVersion: 3, sourceContractVersion: 4, offerSchemaVersion: 1,
    offerDetailFiles: { [OFFER]: "offers/x.json" },
  });
  await writeJson(path.join(sd, "missions", "source", "mission_contracts.json"), {
    sourceLatestModifiedAt: SNAPSHOT,
    source: { channel: "LIVE", sourceBuildId: BUILD },
    records: [{ contractId: CONTRACT, blueprintRewards: [{ blueprintPoolGuid: "p" }] }, { contractId: "33333333-3333-3333-3333-333333333333", blueprintRewards: [] }],
  });
  const bsRoot = path.join(sd, "crafting", "blueprint-sources");
  const bsGeneration = { ...generation, generationId: o.bsGeneration ?? GEN };
  await writeJson(path.join(bsRoot, "index.json"), {
    schemaVersion: 1, sourceLatestModifiedAt: o.bsSnapshot ?? SNAPSHOT, missionGeneration: bsGeneration,
    blueprintFiles: { [BLUEPRINT]: `by-blueprint/${BLUEPRINT}.json` },
    missionFiles: { [CONTRACT]: `missions/by-contract/${CONTRACT}.json` },
  });
  const link = { contractId: o.bsContract ?? CONTRACT, offerKey: o.bsOffer ?? OFFER };
  await writeJson(path.join(bsRoot, "by-blueprint", `${BLUEPRINT}.json`), {
    missionGeneration: { ...bsGeneration, generationId: o.recordGeneration ?? bsGeneration.generationId },
    blueprintGuid: BLUEPRINT, missions: [link],
  });
  await writeJson(path.join(bsRoot, "missions", "by-contract", `${CONTRACT}.json`), { missionGeneration: bsGeneration, ...link });
  await writeJson(path.join(sd, "crafting", "recipes", "index.json"), { sourceGeneratedAt: SNAPSHOT, vehicleBlueprintGuids: [BLUEPRINT], fpsBlueprintGuids: [] });
  const fittingBuild = o.fittingBuild ?? `${BUILD}-scintel.1`;
  await writeJson(path.join(sd, "fitting", "current.json"), { schemaVersion: 1, channels: { LIVE: { currentBuildId: fittingBuild } } });
  await mkdir(path.join(sd, "fitting", "LIVE", `${BUILD}-scintel.1`), { recursive: true });
  return root;
}

async function check(o: Overrides = {}) {
  const root = await fixture(o);
  try {
    return checkPublishedDatasetConsistency({ serverDataRoot: path.join(root, "server-data") });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

const codes = (r: { errors: Array<{ code: string }> }) => r.errors.map((e) => e.code).sort();

test("consistent published generations pass and report provenance", async () => {
  const report = await check();
  assert.deepEqual(report.errors, []);
  assert.equal(report.ok, true);
  assert.equal(report.datasets.missions.sourceBuildId, BUILD);
  assert.equal(report.datasets.missions.catalogContractCount, 2);
  assert.equal(report.datasets.missions.catalogBlueprintContractCount, 1);
  assert.equal(report.datasets.craftingRecipes.buildIdentity, "unrecorded");
  assert.equal(report.links.unresolvedContractIds, 0);
  assert.equal(report.links.unresolvedOfferKeys, 0);
});

test("blueprint sources shaped from another mission generation are rejected", async () => {
  assert.deepEqual(codes(await check({ bsGeneration: OTHER_GEN })), ["blueprint_sources_generation"]);
});

test("a partially reshaped blueprint-source projection is rejected", async () => {
  assert.deepEqual(codes(await check({ recordGeneration: OTHER_GEN })), ["blueprint_sources_partial_reshape"]);
});

test("a blueprint-source snapshot from another mission source is rejected", async () => {
  assert.deepEqual(codes(await check({ bsSnapshot: "2026-08-28T08:37:16.792995+00:00" })), ["blueprint_sources_snapshot"]);
});

test("a cross-build reference index join is rejected", async () => {
  assert.deepEqual(codes(await check({ refBuild: "4.10.191.2241-12519617" })), ["mission_cross_build_ref_index"]);
});

test("broken mission reverse links are rejected", async () => {
  assert.deepEqual(
    codes(await check({ bsContract: "99999999-9999-9999-9999-999999999999", bsOffer: "missing:offer" })),
    ["blueprint_sources_unresolved_contract", "blueprint_sources_unresolved_offer"],
  );
});

test("a pointer to a missing mission generation is rejected", async () => {
  const report = await check({ pointerGeneration: OTHER_GEN });
  assert.ok(codes(report).includes("mission_generation_missing"));
  assert.equal(report.ok, false);
});

test("a fitting pointer to a missing build is rejected", async () => {
  assert.deepEqual(codes(await check({ fittingBuild: "4.10.200.58746-live.13165946-scintel.9" })), ["fitting_build_missing"]);
});

test("game build keys ignore publication suffixes but not changelists", () => {
  assert.equal(gameBuildKey("4.10.191.2241-12519617-scintel.12"), gameBuildKey("4.10.191.2241-12519617"));
  assert.equal(gameBuildKey("4.10.200.58746-live.13165946"), "4.10.200.58746:13165946");
  assert.notEqual(gameBuildKey("4.10.191.2241-12519617"), gameBuildKey("4.10.200.58746-live.13165946"));
});
