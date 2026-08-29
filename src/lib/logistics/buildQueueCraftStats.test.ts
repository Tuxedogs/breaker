import assert from "node:assert/strict";
import test from "node:test";
import type { ComponentRecipe } from "@/components/industry/crafting/utils/craftingTypes";
import type { BuildQueueItem } from "@/types/logistics";
import type { RecipeInputTemplate } from "@/data/logistics/seed";
import {
  buildBuildQueueProductQualitySummary,
  buildAllocatedMaterialQualities,
  buildTargetMaterialQualities,
  hasConfiguredTargetQualities,
  hasMaterialAllocations,
} from "./buildQueueCraftStats.ts";
import { getBuildQueueItemAllocationProgress } from "./buildQueueProgress.ts";

const recipe: ComponentRecipe = {
  blueprint_id: "test-blueprint",
  component_type: "shield",
  component_name: "TEST_SHIELD",
  size: "1",
  craft_time_seconds: 10,
  output_entityClass: "test.xml",
  materials: [
    {
      slot: "shell",
      cost_type: "material",
      material_name: "Stileron",
      cost_id: "stileron",
      quantity: 1,
      qualityModifiers: [{
        component_type: "shield",
        component_name: "TEST_SHIELD",
        size: "1",
        slot: "shell",
        gameplay_property: "GPP_Shield_MaxHealth",
        start_quality: 500,
        end_quality: 900,
        modifier_start: 0,
        modifier_end: 10,
        modifier_start_percent: 0,
        modifier_end_percent: 10,
        gameplay_property_id: "id",
        blueprint_id: "test-blueprint",
      }],
    },
    {
      slot: "liner",
      cost_type: "material",
      material_name: "Iron",
      cost_id: "iron",
      quantity: 1,
      qualityModifiers: [],
    },
  ],
};

const item: BuildQueueItem = {
  id: "bq-test",
  recipeId: "recipe-test",
  blueprint_id: "test-blueprint",
  itemId: "test",
  itemName: "Test Shield",
  quantity: 1,
  status: "active",
  priority: 1,
  reservedAllocations: [{
    id: "alloc-1",
    materialId: "stileron",
    inventoryEntryId: "inv-1",
    quantityReserved: 1,
    requirementId: "req-shell",
    quality: 860,
    unitType: "scu",
    locationId: "loc-1",
  }],
};

const inputs: RecipeInputTemplate[] = [
  {
    requirementId: "req-shell",
    materialId: "stileron",
    materialKey: "stileron",
    materialName: "Stileron",
    quantity: 1,
    unitType: "scu",
    selectedQuality: 800,
  },
  {
    requirementId: "req-liner",
    materialId: "iron",
    materialKey: "iron",
    materialName: "Iron",
    quantity: 1,
    unitType: "scu",
  },
];

test("buildTargetMaterialQualities maps selectedQuality for modifiable materials", () => {
  const qualities = buildTargetMaterialQualities(item, recipe, inputs);
  assert.equal(Object.keys(qualities).length, 1);
  assert.equal(Object.values(qualities)[0], 800);
});

test("buildAllocatedMaterialQualities uses weighted allocation quality", () => {
  const qualities = buildAllocatedMaterialQualities(item, recipe, inputs);
  assert.equal(Object.keys(qualities).length, 1);
  assert.equal(Object.values(qualities)[0], 860);
});

test("hasConfiguredTargetQualities is false when no modifiable target is set", () => {
  const noTargetInputs = inputs.map((input) => ({ ...input, selectedQuality: undefined }));
  assert.equal(hasConfiguredTargetQualities(recipe, noTargetInputs), false);
  assert.equal(hasConfiguredTargetQualities(recipe, inputs), true);
});

test("hasMaterialAllocations is false without reserved amounts", () => {
  const emptyItem = { ...item, reservedAllocations: [] };
  assert.equal(hasMaterialAllocations(emptyItem, recipe, inputs), false);
  assert.equal(hasMaterialAllocations(item, recipe, inputs), true);
});

test("getBuildQueueItemAllocationProgress reports valid reserved coverage rather than owned inventory", () => {
  assert.equal(getBuildQueueItemAllocationProgress(item, { "recipe-test": inputs }, [{
    id: "inv-1",
    materialId: "stileron",
    itemName: "Stileron",
    quantity: 1,
    quality: 860,
    rarity: { tier: "common", label: "Common", colorHex: "#fff" },
    createdAt: "2026-08-28T00:00:00.000Z",
    updatedAt: "2026-08-28T00:00:00.000Z",
  }]), 50);
});

test("buildBuildQueueProductQualitySummary keeps incomplete allocation distinct from a prediction", () => {
  const summary = buildBuildQueueProductQualitySummary(item, recipe, inputs);
  assert.equal(summary.target?.averageBand, 3);
  assert.equal(summary.predicted, null);
});

test("buildBuildQueueProductQualitySummary uses the shared final-quality calculation and preserves valid zero quality", () => {
  const completedItem: BuildQueueItem = {
    ...item,
    reservedAllocations: [
      ...(item.reservedAllocations ?? []),
      {
        id: "alloc-2",
        materialId: "iron",
        inventoryEntryId: "inv-2",
        quantityReserved: 1,
        requirementId: "req-liner",
        quality: 0,
        unitType: "scu",
        locationId: "loc-1",
      },
    ],
  };
  const summary = buildBuildQueueProductQualitySummary(completedItem, recipe, inputs);
  assert.equal(summary.predicted?.averageBand, 3);
});
