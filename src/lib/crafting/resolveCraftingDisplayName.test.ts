import assert from "node:assert/strict";
import test from "node:test";
import {
  formatCraftingDisplayTitle,
  isGenericBlueprintLabel,
  resolveCraftingCardTitle,
  resolveCraftingDisplayName,
  resolveCraftingVariantLabel,
  variantLabelFromBlueprintFields,
} from "./resolveCraftingDisplayName.ts";

test("isGenericBlueprintLabel detects size and role placeholders", () => {
  assert.equal(isGenericBlueprintLabel("S1"), true);
  assert.equal(isGenericBlueprintLabel("Small"), true);
  assert.equal(isGenericBlueprintLabel("Military 1"), true);
  assert.equal(isGenericBlueprintLabel("Lancet MH1 Mining Laser"), false);
});

test("resolveCraftingDisplayName prefers fitting detail over generic blueprint labels", () => {
  const name = resolveCraftingDisplayName({
    fittingDetail: { displayName: "Helix I Mining Laser", name: "Mining_Laser_Thermyte_2_S1" },
    recipe: { component_name: "S1", item_kind: "vehicle" },
    card: { name: "S1" },
  });
  assert.equal(name, "Helix I Mining Laser");
});

test("resolveCraftingVariantLabel preserves salvation and size variants for salvage modifiers", () => {
  assert.equal(
    variantLabelFromBlueprintFields({
      blueprintName: "BP_CRAFT_Salvage_Modifier_Scraper_Salvation_Medium",
      entityClassPath: "libs/foundry/records/entities/scitem/ships/utility/salvage/salvagemodifiers/salvage_modifier_scraper_salvation_medium.xml",
      displayName: "Medium",
    }),
    "Salvation Medium",
  );

  const small = resolveCraftingVariantLabel({
    fittingDetail: { displayName: "Cinch Scraper Module", name: "Salvage_Modifier_Scraper_Small" },
    recipe: { component_name: "Small", item_kind: "vehicle" },
    card: { name: "Cinch Scraper Module", variantLabel: "Small" },
  });
  assert.equal(small, "Small");
});

test("resolveCraftingCardTitle combines primary fitting name with source-backed variant", () => {
  const title = resolveCraftingCardTitle({
    fittingDetail: { displayName: "Cinch Scraper Module", name: "Salvage_Modifier_Scraper_Salvation_Small" },
    recipe: { component_name: "Small", item_kind: "vehicle" },
    card: { name: "Cinch Scraper Module", variantLabel: "Salvation Small" },
  });
  assert.equal(title, "Cinch Scraper Module · Salvation Small");
});

test("formatCraftingDisplayTitle avoids duplicate variant suffix", () => {
  assert.equal(formatCraftingDisplayTitle("Abrade Scraper Module", "Medium"), "Abrade Scraper Module · Medium");
});
