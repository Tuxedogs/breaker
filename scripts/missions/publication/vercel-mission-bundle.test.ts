import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { checkVercelMissionBundle, missionFunctionBundle, MISSIONS_FUNCTION, syncVercelMissionBundle } from "./vercel-mission-bundle.mts";

const GEN = "c694366121fb3bcedf50739f";

async function repo(generationPath: string, vercel: unknown): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "vercel-bundle-"));
  await mkdir(path.join(root, "server-data", "missions"), { recursive: true });
  await writeFile(path.join(root, "server-data", "missions", "current.json"), JSON.stringify({ generationPath }));
  await writeFile(path.join(root, "vercel.json"), `${JSON.stringify(vercel, null, 2)}\n`);
  return root;
}

test("bundles only the pointer and the active generation, without shaping-only files", () => {
  const bundle = missionFunctionBundle(`generations/${GEN}`);
  assert.equal(bundle.includeFiles, `server-data/missions/{current.json,generations/${GEN}/**}`);
  assert.match(bundle.excludeFiles, new RegExp(`generations/${GEN}/mission_\\{rewards,`));
  assert.match(bundle.excludeFiles, /category\*_report,concept\*_report,browser\*_report,offer\*_report/);
  assert.ok(bundle.excludeFiles.length <= 256, "Vercel excludeFiles must be at most 256 characters");
  assert.doesNotMatch(bundle.excludeFiles, /graph|solver_reference|browser_index|shard_manifest/);
  assert.throws(() => missionFunctionBundle("../elsewhere"));
});

test("detects a stale bundle and syncs only the missions entry", async () => {
  const root = await repo(`generations/${GEN}`, {
    buildCommand: "npm run build:staging",
    functions: {
      [MISSIONS_FUNCTION]: { includeFiles: "server-data/missions/{mission_browser_index.json}" },
      "api/crafting/[...path].ts": { includeFiles: "server-data/crafting/**" },
    },
  });
  try {
    assert.match(checkVercelMissionBundle(root) ?? "", /does not bundle the active mission generation/);
    assert.equal(syncVercelMissionBundle(root), true);
    assert.equal(checkVercelMissionBundle(root), null);
    assert.equal(syncVercelMissionBundle(root), false);
    const written = JSON.parse(await readFile(path.join(root, "vercel.json"), "utf8"));
    assert.equal(written.buildCommand, "npm run build:staging");
    assert.deepEqual(written.functions["api/crafting/[...path].ts"], { includeFiles: "server-data/crafting/**" });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
