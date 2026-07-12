import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { buildCraftStatViewModel } from "./craftStatViewModel.ts";
import { buildFittingDetailFromFpsComponentCard } from "./fpsComponentCardDetail.ts";
import type { ComponentCardIndexRecord } from "../componentCardIndex.ts";
import type { FittingComponentDetail } from "../fitting/fittingApi.ts";

function loadCard(blueprintId: string): ComponentCardIndexRecord {
  const filePath = path.join(
    process.cwd(),
    "server-data",
    "crafting",
    "component-cards",
    "by-id",
    `${blueprintId}.json`,
  );
  return JSON.parse(readFileSync(filePath, "utf8")) as ComponentCardIndexRecord;
}

test("buildCraftStatViewModel marks projected values primary and keeps base deltas", () => {
  const detail: FittingComponentDetail = {
    id: "weapon-mod",
    name: "TEST_WPN",
    displayName: "Test Weapon",
    manufacturer: null,
    type: "ship_weapon",
    subtype: null,
    size: 3,
    grade: "A",
    class: null,
    confidence: "high",
    stats: {
      alphaDamage: 100,
      damagePhysical: 100,
      fireRateRpm: 600,
      health: 200,
      mass: 40,
    },
    mitigation: null,
  };

  const model = buildCraftStatViewModel({
    detail,
    totalModifiers: [{
      property: "GPP_Weapon_Damage",
      totalValue: 10,
      modifierMode: "multiplier",
      contributions: [{ materialName: "Iron", value: 10 }],
    }],
  });

  assert.equal(model.status, "ready");
  assert.ok(model.identity.some((badge) => badge.label === "Size" && badge.value === "S3"));
  assert.ok(model.identity.some((badge) => badge.label === "Grade" && badge.value === "A"));

  const damageRow = model.groups
    .flatMap((group) => {
      if (group.kind === "nested") return group.subclusters.flatMap((sub) => sub.stats);
      if (group.kind === "flat") return group.stats;
      return [];
    })
    .find((stat) => stat.label === "Alpha Damage");

  assert.ok(damageRow);
  assert.equal(damageRow.projectedValue, "110");
  assert.equal(damageRow.baseValue, "100");
  assert.ok(damageRow.delta);
});

test("buildCraftStatViewModel groups FPS armor resistance as a matrix", () => {
  const detail = buildFittingDetailFromFpsComponentCard(loadCard("005d95db-96ca-45b7-9647-7e7537b8fac8"));
  assert.ok(detail);
  const model = buildCraftStatViewModel({ detail });
  assert.equal(model.status, "ready");
  assert.ok(model.groups.some((group) => group.kind === "matrix"));
});
