import fr66Card from "../../../../server-data/crafting/component-cards/by-id/db3f4c97-8d40-4b36-b397-452dea1594fc.json";
import ad5bCard from "../../../../server-data/crafting/component-cards/by-id/ba842720-ad32-4d53-8f56-992bacb1fc45.json";
import fpsWeaponCard from "../../../../server-data/crafting/component-cards/by-id/bd636d35-43fd-4782-a223-40ce0a727f39.json";
import fpsArmorCard from "../../../../server-data/crafting/component-cards/by-id/005d95db-96ca-45b7-9647-7e7537b8fac8.json";
import hazardZoneWeaponCard from "../../../../server-data/crafting/component-cards/by-id/ad3568b3-9a28-441e-b8cd-af572cd52e3f.json";
import secondWindArmorCard from "../../../../server-data/crafting/component-cards/by-id/5fa322e9-ddb3-4696-94fb-45725aca6aef.json";
import secondWindWeaponCard from "../../../../server-data/crafting/component-cards/by-id/b488199e-f0fc-4e8b-89bd-d3a435d6dce1.json";
import m5aCard from "../../../../server-data/crafting/component-cards/by-id/9fe902be-8b39-4d71-9017-e2fed7b0604c.json";
import fr66Recipe from "../../../../server-data/crafting/recipes/by-blueprint/db3f4c97-8d40-4b36-b397-452dea1594fc.json";
import ad5bRecipe from "../../../../server-data/crafting/recipes/by-blueprint/ba842720-ad32-4d53-8f56-992bacb1fc45.json";
import fpsWeaponRecipe from "../../../../server-data/crafting/recipes/by-blueprint/bd636d35-43fd-4782-a223-40ce0a727f39.json";
import fpsArmorRecipe from "../../../../server-data/crafting/recipes/by-blueprint/005d95db-96ca-45b7-9647-7e7537b8fac8.json";
import hazardZoneWeaponRecipe from "../../../../server-data/crafting/recipes/by-blueprint/ad3568b3-9a28-441e-b8cd-af572cd52e3f.json";
import secondWindArmorRecipe from "../../../../server-data/crafting/recipes/by-blueprint/5fa322e9-ddb3-4696-94fb-45725aca6aef.json";
import secondWindWeaponRecipe from "../../../../server-data/crafting/recipes/by-blueprint/b488199e-f0fc-4e8b-89bd-d3a435d6dce1.json";
import m5aRecipe from "../../../../server-data/crafting/recipes/by-blueprint/9fe902be-8b39-4d71-9017-e2fed7b0604c.json";
import materialQualityQuantization from "../../../../server-data/crafting/reference/material-quality-quantization.json";
import materialIdentityIndex from "../../../../server-data/crafting/reference/material-identity-index.json";
import componentCardFacetsSource from "../../../../server-data/crafting/component-cards/facets.json";

export const fixtureMetadata = {
  channel: "LIVE",
  buildId: "4.9.0-live.12232306",
  fixtureDate: "2026-07-16",
  sourceEndpoints: ["/api/crafting/component-cards/:id", "/api/crafting/recipes/:id", "/api/v1/fitting/components/:entityClass"],
};

export const blueprintSourceMissions = new Map<string, unknown[]>([
  ["db3f4c97-8d40-4b36-b397-452dea1594fc", [{
    conceptKey: "xenothreat-2-85-01",
    contractId: "f7e79f35-9b92-4b44-8f76-4fc9154f16cd",
    contractTitle: "Xenothreat 2 85 01",
  }]],
]);

export const componentCards = new Map([
  fr66Card,
  ad5bCard,
  fpsWeaponCard,
  fpsArmorCard,
  hazardZoneWeaponCard,
  secondWindArmorCard,
  secondWindWeaponCard,
  m5aCard,
].map((record) => [record.id, record]));
export const componentCardRecords = [
  fr66Card,
  ad5bCard,
  fpsWeaponCard,
  fpsArmorCard,
  hazardZoneWeaponCard,
  secondWindArmorCard,
  secondWindWeaponCard,
  m5aCard,
];
export const componentCardRecordFiles = Object.fromEntries(
  componentCardRecords.map((record) => [record.id, `by-id/${record.id}.json`]),
);

const componentCardGeneratedAt = "2026-07-16T00:00:00.000Z";
const componentCardSourceGeneratedAt = componentCardGeneratedAt;

export const componentCardIndexResponse = {
  schemaVersion: 1,
  generatedAt: componentCardGeneratedAt,
  sourceGeneratedAt: componentCardSourceGeneratedAt,
  sourceRecordCount: { vehicle: 4, fps: 4, total: 8 },
  shapedRecordCount: 8,
  missingIdCount: 0,
  duplicateIdCount: 0,
  skippedCount: 0,
  warnings: [],
  recordIds: Object.keys(componentCardRecordFiles),
};

export const componentCardFacetsResponse = {
  ...componentCardFacetsSource,
  generatedAt: componentCardSourceGeneratedAt,
};

export const componentCardBrowseResponse = {
  schemaVersion: 1,
  generatedAt: componentCardSourceGeneratedAt,
  recordCount: componentCardRecords.length,
  records: componentCardRecords,
};

export const componentCardMonolithResponse = {
  schemaVersion: 1,
  generatedAt: componentCardSourceGeneratedAt,
  sourceRecordCount: { vehicle: 4, fps: 4, total: 8 },
  records: componentCardRecords,
  facets: componentCardFacetsSource.facets,
};
export const recipeShards = new Map<string, unknown>([
  ["db3f4c97-8d40-4b36-b397-452dea1594fc", fr66Recipe],
  ["ba842720-ad32-4d53-8f56-992bacb1fc45", ad5bRecipe],
  ["bd636d35-43fd-4782-a223-40ce0a727f39", fpsWeaponRecipe],
  ["005d95db-96ca-45b7-9647-7e7537b8fac8", fpsArmorRecipe],
  ["ad3568b3-9a28-441e-b8cd-af572cd52e3f", hazardZoneWeaponRecipe],
  ["5fa322e9-ddb3-4696-94fb-45725aca6aef", secondWindArmorRecipe],
  ["b488199e-f0fc-4e8b-89bd-d3a435d6dce1", secondWindWeaponRecipe],
  ["9fe902be-8b39-4d71-9017-e2fed7b0604c", m5aRecipe],
]);
export const vehicleRecipeCatalog = [fr66Recipe.record, ad5bRecipe.record, hazardZoneWeaponRecipe.record, m5aRecipe.record];
export const fpsRecipeCatalog = [
  fpsWeaponRecipe.record,
  fpsArmorRecipe.record,
  secondWindArmorRecipe.record,
  secondWindWeaponRecipe.record,
];
export { materialIdentityIndex, materialQualityQuantization };

export const fittingMeta = { apiVersion: "1", artifactSchemaVersion: 1, channel: "LIVE", buildId: fixtureMetadata.buildId, generatedAt: "2026-07-12T00:00:00.000Z" } as const;

export const fittingDetails = new Map<string, unknown>([
  ["0baaf20a-460e-4668-84f2-d09f9d31b492", { meta: fittingMeta, data: { id: "0baaf20a-460e-4668-84f2-d09f9d31b492", name: "SHLD_GODI_S01_FR66_SCItem", displayName: "FR-66", manufacturer: null, type: "shield", subtype: null, size: 1, grade: "A", class: "Military", confidence: "high", stats: { mass: 120, health: 270, powerDraw: 3, coolingDraw: 0, heatGenerated: 0.45, electromagneticEmission: 1240, infraredEmission: 0, shieldHp: 3168, regenRate: 697, distortionResistance: 4100 }, mitigation: null } }],
  ["f52975b5-d621-4c08-9dcc-3c4bd8170383", { meta: fittingMeta, data: { id: "f52975b5-d621-4c08-9dcc-3c4bd8170383", name: "BEHR_BallisticGatling_S5", displayName: "AD5B Ballistic Gatling", manufacturer: null, type: "ship_weapon", subtype: "Gun", size: 5, grade: null, class: null, confidence: "high", stats: { mass: 938, health: 1650, powerDraw: 0.1, alphaDamage: 126.5, dps: 1897.5, projectileSpeed: 1251, projectileLifetime: 3.2, calculatedRange: 4003.2, ammoCapacity: 5004, damagePhysical: 126.5, fireRateRpm: 900, heatPerShot: 0.5727273 }, mitigation: null } }],
  ["f72ca643-b48c-4f6e-abb7-d5bc8eb261aa", { meta: fittingMeta, data: { id: "f72ca643-b48c-4f6e-abb7-d5bc8eb261aa", name: "BEHR_LaserCannon_S3", displayName: "M5A Cannon", manufacturer: null, type: "ship_weapon", subtype: "Gun", size: 3, grade: "A", class: null, confidence: "high", stats: { mass: 900, health: 1024, powerDraw: 1.3, alphaDamage: 410.184, dps: 683.64, projectileSpeed: 1184, projectileLifetime: 2.03, calculatedRange: 2403.52, ammoCapacity: 0, damageEnergy: 410.184, fireRateRpm: 100, heatPerShot: 0 }, mitigation: { kind: "weapon_projectile", damage: { physical: 0, energy: 410.184, distortion: 0, thermal: 0, biochemical: 0, stun: 0 }, ammoPenetration: 0.5, basePenetrationDistance: 2.25, maxPenetrationThickness: null, penetrationParams: null } } }],
]);
