import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  assertMissionPublicationGate,
  verifyMissionPublicationGate,
  type MissionPublicationGateReceiptV1,
} from "./publication-gates.mts";
import { publishImmutableMissionGeneration } from "./write-artifacts.mts";

const offerContract = {
  missionSchemaVersion: 3,
  sourceContractVersion: 4,
  offerSchemaVersion: 1,
};

function receipt(overrides: Partial<MissionPublicationGateReceiptV1> = {}): MissionPublicationGateReceiptV1 {
  const buildId = "4.9.0-live.test";
  const refIndexPath = path.resolve("fixture", buildId, "datasets", "ref_index.json");
  return {
    schemaVersion: 1,
    sourceBuildId: buildId,
    refIndex: {
      status: "explicit",
      path: refIndexPath,
      sha256: "hash",
      buildId,
      recordCount: 1,
      auditedBuildId: buildId,
      auditedPath: refIndexPath,
    },
    semantics: {
      variantCount: 2_501,
      reputationScopeResolvedCount: 1_735,
      unresolvedLocationCount: 0,
    },
    ...overrides,
  };
}

test("offer publication rejects missing ref-index evidence and semantic collapse", () => {
  assert.throws(
    () => assertMissionPublicationGate(offerContract),
    /missing its publication gate receipt/,
  );
  assert.throws(
    () => assertMissionPublicationGate(offerContract, {
      ...receipt(),
      refIndex: { ...receipt().refIndex, status: "not_configured" },
    }),
    /requires a configured, non-empty MISSION_REF_INDEX/,
  );
  assert.throws(
    () => assertMissionPublicationGate(offerContract, {
      ...receipt(),
      semantics: { ...receipt().semantics, reputationScopeResolvedCount: 0 },
    }),
    /zero resolved reputation scopes/,
  );
  assert.throws(
    () => assertMissionPublicationGate(offerContract, {
      ...receipt(),
      semantics: { ...receipt().semantics, unresolvedLocationCount: 252 },
    }),
    /rejected 252 unresolved locations/,
  );
});

test("offer publication rejects cross-build ref indexes", () => {
  assert.throws(
    () => assertMissionPublicationGate(offerContract, {
      ...receipt(),
      refIndex: { ...receipt().refIndex, buildId: "other-build" },
    }),
    /does not match the accepted mission source build/,
  );
  assert.throws(
    () => assertMissionPublicationGate(offerContract, {
      ...receipt(),
      refIndex: { ...receipt().refIndex, auditedPath: path.resolve("other", "ref_index.json") },
    }),
    /does not match the accepted mission source build/,
  );
});

test("offer verifier rejects not-configured and collapsed semantic receipts", async () => {
  await assert.rejects(
    verifyMissionPublicationGate(offerContract, {
      ...receipt(),
      refIndex: { ...receipt().refIndex, status: "not_configured" },
    }),
    /requires a configured, non-empty MISSION_REF_INDEX/,
  );
  await assert.rejects(
    verifyMissionPublicationGate(offerContract, {
      ...receipt(),
      semantics: { ...receipt().semantics, reputationScopeResolvedCount: 0 },
    }),
    /zero resolved reputation scopes/,
  );
  await assert.rejects(
    verifyMissionPublicationGate(offerContract, {
      ...receipt(),
      semantics: { ...receipt().semantics, unresolvedLocationCount: 252 },
    }),
    /rejected 252 unresolved locations/,
  );
});

test("immutable offer publication re-reads the audited ref index before moving the pointer", async () => {
  const testRoot = await mkdtemp(path.join(os.tmpdir(), "mission-publication-gate-"));
  const missionRoot = path.join(testRoot, "missions");
  const stagingRoot = path.join(missionRoot, ".staging-generation");
  const buildId = "4.9.0-live.test";
  const refIndexPath = path.join(testRoot, buildId, "datasets", "ref_index.json");
  const refIndexContent = `${JSON.stringify([{ guid: "guid" }])}\n`;
  try {
    await mkdir(stagingRoot, { recursive: true });
    await writeFile(path.join(stagingRoot, "mission_browser_index.json"), "{}", "utf8");
    await mkdir(path.dirname(refIndexPath), { recursive: true });
    await writeFile(refIndexPath, refIndexContent, "utf8");
    const validReceipt: MissionPublicationGateReceiptV1 = {
      ...receipt(),
      sourceBuildId: buildId,
      refIndex: {
        status: "explicit",
        path: refIndexPath,
        sha256: createHash("sha256").update(refIndexContent).digest("hex"),
        buildId,
        recordCount: 1,
        auditedBuildId: buildId,
        auditedPath: refIndexPath,
      },
    };

    await verifyMissionPublicationGate(offerContract, validReceipt);
    await publishImmutableMissionGeneration({
      missionRoot,
      stagingRoot,
      generationId: "generation",
      shaperVersion: "offer-shaper",
      generationContract: offerContract,
      publicationGate: validReceipt,
      legacyRootFiles: [],
      legacyShardDirectories: [],
    });
    const pointer = JSON.parse(await readFile(path.join(missionRoot, "current.json"), "utf8"));
    assert.equal(pointer.generationId, "generation");
  } finally {
    await rm(testRoot, { recursive: true, force: true });
  }
});

test("immutable offer publication fails before writing when the ref index is unreadable", async () => {
  const testRoot = await mkdtemp(path.join(os.tmpdir(), "mission-publication-gate-unreadable-"));
  const missionRoot = path.join(testRoot, "missions");
  const stagingRoot = path.join(missionRoot, ".staging-generation");
  try {
    await mkdir(stagingRoot, { recursive: true });
    await assert.rejects(
      publishImmutableMissionGeneration({
        missionRoot,
        stagingRoot,
        generationId: "generation",
        shaperVersion: "offer-shaper",
        generationContract: offerContract,
        publicationGate: receipt(),
        legacyRootFiles: [],
        legacyShardDirectories: [],
      }),
      /Configured MISSION_REF_INDEX is not readable/,
    );
    await assert.rejects(readFile(path.join(missionRoot, "current.json"), "utf8"));
  } finally {
    await rm(testRoot, { recursive: true, force: true });
  }
});
