import assert from "node:assert/strict";
import test from "node:test";
import { buildBuildQueueFittingStatGroups } from "../../components/logistics/buildQueueStatsGroups.ts";
import type { FittingComponentDetail } from "../../lib/fitting/fittingApi.ts";

test("buildBuildQueueFittingStatGroups groups cooler fitting stats", () => {
  const detail: FittingComponentDetail = {
    id: "7db13b34-c8b1-4e1a-9aba-3dcd7087e995",
    name: "COOL_TEST",
    displayName: "Test Cooler",
    manufacturer: "Behring",
    type: "cooler",
    subtype: null,
    size: 2,
    grade: "B",
    class: "civilian",
    confidence: "high",
    stats: {
      coolingGenerated: 16,
      health: 53,
      mass: 43,
      powerDraw: 1,
      electromagneticEmission: 375,
    },
    mitigation: null,
  };

  const groups = buildBuildQueueFittingStatGroups(detail);
  const labels = groups.map((group) => group.label);

  assert.ok(labels.includes("Identity"));
  assert.ok(labels.includes("Performance"));
  assert.ok(labels.includes("Power & Cooling"));
  assert.ok(labels.includes("Signatures"));
  assert.ok(labels.includes("Durability"));

  const performance = groups.find((group) => group.id === "performance");
  assert.ok(performance?.rows.some((row) => row.label === "Coolant Generation"));
});

test("buildBuildQueueFittingStatGroups returns empty for missing detail", () => {
  assert.deepEqual(buildBuildQueueFittingStatGroups(null), []);
});
