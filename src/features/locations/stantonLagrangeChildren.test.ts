import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  configureStantonLagrangeChildrenData,
  resolveRecommenderStantonLagrangeChildren,
} from "./stantonLagrangeChildren";

test("Lagrange parents retain their physical child badges", async () => {
  const groups = JSON.parse(
    await readFile("server-data/mining/locations/lagrange-groups.json", "utf8"),
  ) as Parameters<typeof configureStantonLagrangeChildrenData>[0];
  const children = JSON.parse(
    await readFile("server-data/mining/locations/lagrange-children.json", "utf8"),
  ) as Parameters<typeof configureStantonLagrangeChildrenData>[1];
  configureStantonLagrangeChildrenData(groups, children);

  const resolved = resolveRecommenderStantonLagrangeChildren("Lagrange E");
  assert.deepEqual(resolved.matchedLocationCodes, ["CRU-L3", "MIC-L1", "MIC-L2", "MIC-L5"]);
  assert.deepEqual(resolved.points.map((point) => point.code), ["CRU-L3", "MIC-L1", "MIC-L2", "MIC-L5"]);
  assert.ok(resolved.points.every((point) => point.groupLetter === "E"));
  assert.ok(resolved.points.every((point) => point.displayName === `Lagrange E ${point.code}`));
  assert.ok(resolved.points.every((point) => point.children.length > 0));
});
