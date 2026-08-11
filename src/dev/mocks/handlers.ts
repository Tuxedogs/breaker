import { http, HttpResponse, passthrough } from "msw";
import {
  componentCardBrowseResponse,
  componentCardFacetsResponse,
  componentCardIndexResponse,
  componentCards,
  blueprintSourceMissions,
  fittingDetails,
  fittingMeta,
  materialIdentityIndex,
  materialQualityQuantization,
  recipeIndexResponse,
  recipeShards,
} from "../fixtures/buildQueue";

const localMiningApiPaths = [
  "/api/mining/location-materials",
  "/api/mining/encounter-rankings",
  "/api/mining/material-quality",
  "/api/mining/location-distribution",
  "/api/mining/location-hierarchy",
  "/api/mining/lagrange-groups",
  "/api/mining/lagrange-children",
] as const;

export const handlers = [
  ...localMiningApiPaths.map((path) => http.get(`*${path}`, () => passthrough())),
  http.post("*/api/mining/recommendations", () => passthrough()),
  http.get("*/api/crafting/component-cards/index", () => HttpResponse.json(componentCardIndexResponse)),
  http.get("*/api/crafting/component-cards/facets", () => HttpResponse.json(componentCardFacetsResponse)),
  http.get("*/api/crafting/component-cards/browse", () => HttpResponse.json(componentCardBrowseResponse)),
  http.get("*/api/crafting/recipes/index", () => HttpResponse.json(recipeIndexResponse)),
  http.get("*/api/crafting/reference/material-quality-quantization", () => HttpResponse.json(materialQualityQuantization)),
  http.get("*/api/crafting/reference/material-identity", () => HttpResponse.json(materialIdentityIndex)),
  http.get("*/api/crafting/blueprint-rewards/release-state", () => HttpResponse.json({ states: {} })),
  http.get("*/api/crafting/blueprint-rewards/missions", () => HttpResponse.json({ missions: [] })),
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
