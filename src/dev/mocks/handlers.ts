import { http, HttpResponse } from "msw";
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

export const handlers = [
  http.get("*/api/crafting/component-cards/index", () => HttpResponse.json(componentCardIndexResponse)),
  http.get("*/api/crafting/component-cards/facets", () => HttpResponse.json(componentCardFacetsResponse)),
  http.get("*/api/crafting/component-cards/browse", () => HttpResponse.json(componentCardBrowseResponse)),
  http.get("*/api/crafting/component_card_index.json", () => HttpResponse.json(componentCardMonolithResponse)),
  http.get("*/api/crafting/recipes/catalog/vehicle", () => HttpResponse.json(vehicleRecipeCatalog)),
  http.get("*/api/crafting/recipes/catalog/fps", () => HttpResponse.json(fpsRecipeCatalog)),
  http.get("*/api/crafting/reference/material-quality-quantization", () => HttpResponse.json(materialQualityQuantization)),
  http.get("*/api/crafting/reference/material-identity", () => HttpResponse.json(materialIdentityIndex)),
  http.get("*/api/crafting/material_identity_index.json", () => HttpResponse.json(materialIdentityIndex)),
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
  http.get("*/api/v1/fitting/components/:id", ({ params }) => {
    const payload = fittingDetails.get(String(params.id).toLowerCase());
    return payload ? HttpResponse.json(payload) : HttpResponse.json({ detail: "Fixture fitting component not found" }, { status: 404 });
  }),
];
