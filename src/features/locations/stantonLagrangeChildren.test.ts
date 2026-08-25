import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  configureStantonLagrangeGroupData,
  resolveRecommenderStantonLagrangeChildren,
} from "./stantonLagrangeChildren";

test("Lagrange parents retain their physical child badges", async () => {
  const groups = JSON.parse(
    await readFile("server-data/mining/locations/lagrange-groups.json", "utf8"),
  ) as Parameters<typeof configureStantonLagrangeGroupData>[0];
  configureStantonLagrangeGroupData(groups);

  const resolved = resolveRecommenderStantonLagrangeChildren("Lagrange E");
  assert.deepEqual(resolved.matchedLocationCodes, ["CRU-L3", "MIC-L1", "MIC-L2", "MIC-L5"]);
  assert.deepEqual(resolved.children.map((child) => child.code), ["CRU-L3", "MIC-L1", "MIC-L2", "MIC-L5"]);
  assert.ok(resolved.children.every((child) => child.groupLetter === "E"));
});

test("matched physical locations render without lower-level starmap child records", () => {
  const resolved = resolveRecommenderStantonLagrangeChildren("Lagrange Z", ["HUR-L1", "MIC-L5"]);
  assert.deepEqual(resolved.children.map((child) => child.code), ["HUR-L1", "MIC-L5"]);
});
