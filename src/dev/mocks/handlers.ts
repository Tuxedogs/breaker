import { http, HttpResponse, passthrough } from "msw";
import {
  componentCardBrowseResponse,
  componentCardFacetsResponse,
  componentCardIndexResponse,
  componentCardMonolithResponse,
  componentCards,
  blueprintSourceMissions,
  fittingDetails,
  fittingMeta,
  fpsRecipeCatalog,
  materialIdentityIndex,
  materialQualityQuantization,
  recipeShards,
  vehicleRecipeCatalog,
} from "../fixtures/buildQueue";

const localStaticMiningPaths = [
  "/api/lagrange-children.generated.json",
  "/api/lagrange-groups.generated.json",
  "/api/recommendations/location_distribution_index.json",
  "/api/recommendations/location_hierarchy_index.json",
  "/api/recommendations/location_material_index.json",
  "/api/recommendations/material_encounter_rankings.json",
  "/api/recommendations/material_quality_index.json",
] as const;

export const handlers = [
  ...localStaticMiningPaths.map((path) => http.get(`*${path}`, () => passthrough())),
  http.get("*/api/crafting/component-cards/index", () => HttpResponse.json(componentCardIndexResponse)),
  http.get("*/api/crafting/component-cards/facets", () => HttpResponse.json(componentCardFacetsResponse)),
  http.get("*/api/crafting/component-cards/browse", () => HttpResponse.json(componentCardBrowseResponse)),
  http.get("*/api/crafting/component_card_index.json", () => HttpResponse.json(componentCardMonolithResponse)),
  http.get("*/api/crafting/recipes/catalog/vehicle", () => HttpResponse.json(vehicleRecipeCatalog)),
  http.get("*/api/crafting/recipes/catalog/fps", () => HttpResponse.json(fpsRecipeCatalog)),
  http.get("*/api/crafting/reference/material-quality-quantization", () => HttpResponse.json(materialQualityQuantization)),
  http.get("*/api/crafting/reference/material-identity", () => HttpResponse.json(materialIdentityIndex)),
  http.get("*/api/crafting/material_identity_index.json", () => HttpResponse.json(materialIdentityIndex)),
  http.get("*/api/crafting/blueprint-rewards/release-state", () => HttpResponse.json({ states: {} })),
  http.get("*/api/crafting/blueprint-rewards/missions", () => HttpResponse.json({ missions: [] })),
  http.get("*/api/missions/mission_blueprint_rewards.json", () => HttpResponse.json([])),
  http.get("*/api/crafting/blueprint-sources", ({ request }) => {
    const blueprintGuid = new URL(request.url).searchParams.get("blueprintGuid")?.trim().toLowerCase() ?? "";
    return HttpResponse.json({ blueprintGuid, missions: blueprintSourceMissions.get(blueprintGuid) ?? [] });
  }),
  http.get("*/api/v1/fitting/meta", () => HttpResponse.json({ meta: fittingMeta, data: {} })),
  http.get("*/api/crafting/component-cards/:id", ({ params }) => {
    const record = componentCards.get(String(params.id).toLowerCase());
    return record ? HttpResponse.json(record) : HttpResponse.json({ error: "Unknown fixture component card" }, { status: 404 });
  }),
  http.get("*/api/crafting/recipes/:id", ({ params }) => {
    const shard = recipeShards.get(String(params.id).toLowerCase());
    return shard ? HttpResponse.json(shard) : HttpResponse.json({ error: "Unknown fixture recipe" }, { status: 404 });
  }),
  http.post("*/api/crafting/recipes/batch", async ({ request }) => {
    const payload = await request.json() as { blueprintGuids?: unknown };
    const blueprintGuids = Array.isArray(payload.blueprintGuids)
      ? payload.blueprintGuids.filter((value): value is string => typeof value === "string")
      : [];
    const records: unknown[] = [];
    const missing: string[] = [];
    for (const id of blueprintGuids) {
      const normalizedId = id.trim().toLowerCase();
      const shard = recipeShards.get(normalizedId);
      if (shard) records.push(shard);
      else missing.push(normalizedId);
    }
    return HttpResponse.json({ records, missing });
  }),
  http.get("*/api/v1/fitting/components/:id", ({ params }) => {
    const payload = fittingDetails.get(String(params.id).toLowerCase());
    return payload ? HttpResponse.json(payload) : HttpResponse.json({ detail: "Fixture fitting component not found" }, { status: 404 });
  }),
];
