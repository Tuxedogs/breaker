import fr66Card from "../../../../server-data/crafting/component-cards/by-id/db3f4c97-8d40-4b36-b397-452dea1594fc.json";
import ad5bCard from "../../../../server-data/crafting/component-cards/by-id/ba842720-ad32-4d53-8f56-992bacb1fc45.json";
import fpsWeaponCard from "../../../../server-data/crafting/component-cards/by-id/bd636d35-43fd-4782-a223-40ce0a727f39.json";
import fpsArmorCard from "../../../../server-data/crafting/component-cards/by-id/005d95db-96ca-45b7-9647-7e7537b8fac8.json";
import fr66Recipe from "../../../../server-data/crafting/recipes/by-blueprint/db3f4c97-8d40-4b36-b397-452dea1594fc.json";
import ad5bRecipe from "../../../../server-data/crafting/recipes/by-blueprint/ba842720-ad32-4d53-8f56-992bacb1fc45.json";
import fpsWeaponRecipe from "../../../../server-data/crafting/recipes/by-blueprint/bd636d35-43fd-4782-a223-40ce0a727f39.json";
import fpsArmorRecipe from "../../../../server-data/crafting/recipes/by-blueprint/005d95db-96ca-45b7-9647-7e7537b8fac8.json";
import materialQualityQuantization from "../../../../server-data/crafting/reference/material-quality-quantization.json";
import componentCardFacetsSource from "../../../../server-data/crafting/component-cards/facets.json";

export const fixtureMetadata = {
  channel: "LIVE",
  buildId: "4.8.184.64329-12122953",
  fixtureDate: "2026-07-12",
  sourceEndpoints: ["/api/crafting/component-cards/:id", "/api/crafting/recipes/:id", "/api/v1/fitting/components/:entityClass"],
};

export const componentCards = new Map([fr66Card, ad5bCard, fpsWeaponCard, fpsArmorCard].map((record) => [record.id, record]));
export const componentCardRecords = [fr66Card, ad5bCard, fpsWeaponCard, fpsArmorCard];
export const componentCardRecordFiles = Object.fromEntries(
  componentCardRecords.map((record) => [record.id, `by-id/${record.id}.json`]),
);

const componentCardGeneratedAt = "2026-07-12T00:00:00.000Z";
const componentCardSourceGeneratedAt = "2026-06-23T06:01:05.031Z";

export const componentCardIndexResponse = {
  schemaVersion: 1,
  generatedAt: componentCardGeneratedAt,
  sourceGeneratedAt: componentCardSourceGeneratedAt,
  sourceRecordCount: { vehicle: 2, fps: 2, total: 4 },
  shapedRecordCount: 4,
  missingIdCount: 0,
  duplicateIdCount: 0,
  skippedCount: 0,
  warnings: [],
  recordIds: Object.keys(componentCardRecordFiles),
};

export const componentCardFacetsResponse = {
  ...componentCardFacetsSource,
  generatedAt: componentCardGeneratedAt,
};

export const componentCardBrowseResponse = {
  schemaVersion: 1,
  generatedAt: componentCardGeneratedAt,
  recordCount: componentCardRecords.length,
  records: componentCardRecords,
};

export const componentCardMonolithResponse = {
  schemaVersion: 1,
  generatedAt: componentCardSourceGeneratedAt,
  sourceRecordCount: { vehicle: 2, fps: 2, total: 4 },
  records: componentCardRecords,
  facets: componentCardFacetsSource.facets,
};
export const recipeShards = new Map<string, unknown>([
  ["db3f4c97-8d40-4b36-b397-452dea1594fc", fr66Recipe],
  ["ba842720-ad32-4d53-8f56-992bacb1fc45", ad5bRecipe],
  ["bd636d35-43fd-4782-a223-40ce0a727f39", fpsWeaponRecipe],
  ["005d95db-96ca-45b7-9647-7e7537b8fac8", fpsArmorRecipe],
]);
export const vehicleRecipeCatalog = [fr66Recipe.record, ad5bRecipe.record];
export const fpsRecipeCatalog = [fpsWeaponRecipe.record, fpsArmorRecipe.record];
export { materialQualityQuantization };

const meta = { apiVersion: "1", artifactSchemaVersion: 1, channel: "LIVE", buildId: fixtureMetadata.buildId, generatedAt: "2026-07-12T00:00:00.000Z" } as const;

export const fittingDetails = new Map<string, unknown>([
  ["0baaf20a-460e-4668-84f2-d09f9d31b492", { meta, data: { id: "0baaf20a-460e-4668-84f2-d09f9d31b492", name: "SHLD_GODI_S01_FR66_SCItem", displayName: "FR-66", manufacturer: null, type: "shield", subtype: null, size: 1, grade: "A", class: "Military", confidence: "high", stats: { mass: 120, health: 270, powerDraw: 3, coolingDraw: 0, heatGenerated: 0.45, electromagneticEmission: 1240, infraredEmission: 0, shieldHp: 3168, regenRate: 697, distortionResistance: 4100 }, mitigation: null } }],
  ["f52975b5-d621-4c08-9dcc-3c4bd8170383", { meta, data: { id: "f52975b5-d621-4c08-9dcc-3c4bd8170383", name: "BEHR_BallisticGatling_S5", displayName: "AD5B Ballistic Gatling", manufacturer: null, type: "ship_weapon", subtype: "Gun", size: 5, grade: null, class: null, confidence: "high", stats: { mass: 938, health: 1650, powerDraw: 0.1, alphaDamage: 126.5, dps: 1897.5, projectileSpeed: 1251, projectileLifetime: 3.2, calculatedRange: 4003.2, ammoCapacity: 5004, damagePhysical: 126.5, fireRateRpm: 900, heatPerShot: 0.5727273 }, mitigation: null } }],
]);
