import assert from "node:assert/strict";
import test from "node:test";
import type { ComponentRecipe } from "../../components/industry/crafting/utils/craftingTypes";
import { getMaterialQualityKey } from "../../components/industry/crafting/utils/materialQuality";
import {
  computeTotalModifiersFromQualities,
  deriveFinalProductQuality,
} from "../../components/industry/crafting/utils/recipeQuality";
import {
  FALLBACK_QUALITY_BANDS,
  findNearestBandForQuality,
} from "../../components/industry/crafting/utils/qualityBands";
import {
  projectCraftingDetailMaterialRows,
} from "./craftingDetailRequirements";

const recipe: ComponentRecipe = {
  blueprint_id: "quality-test",
  component_type: "weapons",
  component_name: "Quality Test",
  size: "1",
  craft_time_seconds: 1,
  output_entityClass: "quality-test",
  materials: [
    {
      slot: "BARREL",
      cost_type: "material",
      material_name: "Test Material",
      cost_id: "test-material",
      quantity: 1,
      qualityModifiers: [
        {
          component_type: "weapons",
          component_name: "Quality Test",
          size: "1",
          slot: "BARREL",
          gameplay_property: "GPP_Weapon_Damage",
          start_quality: 0,
          end_quality: 1000,
          modifier_start: 0,
          modifier_end: 0,
          modifier_start_percent: 0,
          modifier_end_percent: 100,
          gameplay_property_id: "damage",
          blueprint_id: "quality-test",
        },
      ],
    },
  ],
};

const materialKey = getMaterialQualityKey(recipe, recipe.materials[0], 0);

test("crafting detail modifiers use the freely selected raw quality", () => {
  const rows = computeTotalModifiersFromQualities(recipe, { [materialKey]: 725 });
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.totalValue, 72.5);
});

test("zero remains a valid raw modifier result rather than missing data", () => {
  const rows = computeTotalModifiersFromQualities(recipe, { [materialKey]: 0 });
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.totalValue, 0);
});

test("final product semantics use the nearest extracted band, not raw quality as a band", () => {
  const selectedQuality = 725;
  const nearestBandIndex = findNearestBandForQuality(
    FALLBACK_QUALITY_BANDS,
    selectedQuality,
  );
  const finalProduct = deriveFinalProductQuality(
    recipe,
    () => nearestBandIndex,
  );

  assert.equal(nearestBandIndex, 3);
  assert.equal(finalProduct.band, 4);
});

test("crafting detail projects Insulative Liner's Aslarite requirement as an editable material row", () => {
  const recipeWithAslarite: ComponentRecipe = {
    ...recipe,
    materials: [
      recipe.materials[0],
      {
        slot: "INSULATIVE LINER",
        cost_type: "resource",
        input_kind: "material",
        material_name: "Aslarite",
        cost_id: "fde0cd65-8827-4b23-804d-cc8845dfa7ac",
        quantity: 0.02,
      },
    ],
  };

  const requirements = projectCraftingDetailMaterialRows(recipeWithAslarite);
  assert.deepEqual(
    requirements.map(({ inputIndex, renderKind, editableQuality, requirement }) => ({
      inputIndex,
      renderKind,
      editableQuality,
      slot: requirement.slot,
      displayName: requirement.material_name,
      quantity: requirement.quantity,
    })),
    [
      {
        inputIndex: 0,
        renderKind: "material-quality",
        editableQuality: true,
        slot: "BARREL",
        displayName: "Test Material",
        quantity: 1,
      },
      {
        inputIndex: 1,
        renderKind: "material-quality",
        editableQuality: true,
        slot: "INSULATIVE LINER",
        displayName: "Aslarite",
        quantity: 0.02,
      },
    ],
  );
});
