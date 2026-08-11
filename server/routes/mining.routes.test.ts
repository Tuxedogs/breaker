import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { handleMiningRoute } from "./mining.routes";

const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "moonbreaker-mining-route-"));

const fixtures = new Map<string, unknown>([
  ["indexes/location-material.json", [{ materialId: "test", locationKey: "test-location" }]],
  ["indexes/material-encounter-rankings.json", [{ encounterRank: 1 }]],
  ["indexes/material-quality.json", [{ thresholdChances: { "800": 0.5 } }]],
  ["indexes/location-distribution.json", [{ distributionShare: 1 }]],
  ["indexes/location-hierarchy.json", { locationParents: {} }],
  ["locations/lagrange-groups.json", { groups: [] }],
  ["locations/lagrange-children.json", { points: [] }],
]);

for (const [relativePath, value] of fixtures) {
  const filePath = path.join(fixtureRoot, relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(value));
}

test.after(async () => {
  await rm(fixtureRoot, { recursive: true, force: true });
});

test("serves each Mining data contract from the server-only data root", async () => {
  const routes = new Map([
    ["/api/mining/location-materials", "indexes/location-material.json"],
    ["/api/mining/encounter-rankings", "indexes/material-encounter-rankings.json"],
    ["/api/mining/material-quality", "indexes/material-quality.json"],
    ["/api/mining/location-distribution", "indexes/location-distribution.json"],
    ["/api/mining/location-hierarchy", "indexes/location-hierarchy.json"],
    ["/api/mining/lagrange-groups", "locations/lagrange-groups.json"],
    ["/api/mining/lagrange-children", "locations/lagrange-children.json"],
  ]);

  for (const [route, relativePath] of routes) {
    const result = await handleMiningRoute("GET", `${route}?ignored=true`, undefined, fixtureRoot);
    assert.equal(result?.status, 200);
    assert.deepEqual(result?.body, fixtures.get(relativePath));
    assert.match(result?.headers?.["cache-control"] ?? "", /stale-while-revalidate/);
  }
});

test("allows HEAD but rejects mutation methods for Mining index routes", async () => {
  const head = await handleMiningRoute("HEAD", "/api/mining/location-materials", undefined, fixtureRoot);
  assert.equal(head?.status, 200);

  const post = await handleMiningRoute("POST", "/api/mining/location-materials", {}, fixtureRoot);
  assert.equal(post?.status, 405);
  assert.equal(post?.headers?.allow, "GET, HEAD");
});

test("returns null for routes outside the Mining API", async () => {
  assert.equal(await handleMiningRoute("GET", "/api/crafting/recipes/index", undefined, fixtureRoot), null);
});

test("serves recommendations through the deployable Mining POST route", async () => {
  const result = await handleMiningRoute("POST", "/api/mining/recommendations", {
    materialRequirements: [{
      materialName: "Raw Ice",
      displayName: "Raw Ice",
      requiredQuantity: 1,
      selectedQuality: 900,
    }],
  });
  assert.equal(result?.status, 200);
  const body = result?.body as { recommendations?: unknown[]; warnings?: unknown[] };
  assert.ok(Array.isArray(body.recommendations));
  assert.ok(body.recommendations.length > 0);
  assert.ok(Array.isArray(body.warnings));
});
