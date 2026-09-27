import { http, HttpResponse, passthrough } from "msw";
import type { ComponentCardIndexRecord } from "@/lib/componentCardIndex";
import {
  getComponentCardVariantGroupKey,
  pickComponentCardGroupRepresentative,
} from "@/components/industry/crafting/utils/componentCardVariants";
import {
  compareRecipeBrowserRecords,
  compareRecipeBrowserSearchRecords,
  filterRecipeBrowserRecords,
  getRecipeBrowserSearchParam,
} from "@/components/industry/crafting/utils/recipeBrowserFilters";
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

function getFixtureComponentCardBrowserPage(requestUrl: string) {
  const url = new URL(requestUrl);
  const searchParams = url.searchParams;
  const savedBlueprintIds = new Set(
    (searchParams.get("saved") ?? "").split(",").map((value) => value.trim()).filter(Boolean),
  );
  const records = (componentCardBrowseResponse.records as ComponentCardIndexRecord[])
    .filter((record) => componentCards.has(record.id));
  const filteredRecords = filterRecipeBrowserRecords(records, searchParams, {
    savedOnly: searchParams.get("bk") === "1",
    savedBlueprintIds,
  });
  const groupedRecords = new Map<string, ComponentCardIndexRecord[]>();
  const ungroupedRecords: ComponentCardIndexRecord[] = [];
  for (const record of filteredRecords) {
    const key = getComponentCardVariantGroupKey(record);
    if (!key) ungroupedRecords.push(record);
    else groupedRecords.set(key, [...(groupedRecords.get(key) ?? []), record]);
  }
  const search = getRecipeBrowserSearchParam(searchParams);
  const browserRecords = [
    ...ungroupedRecords,
    ...[...groupedRecords.values()].map(pickComponentCardGroupRepresentative),
  ].sort(search
    ? (a, b) => compareRecipeBrowserSearchRecords(a, b, search)
    : compareRecipeBrowserRecords);
  const limit = Math.max(1, Math.min(40, Number(searchParams.get("limit") ?? "40") || 40));
  const requestedPage = Math.max(1, Number(searchParams.get("pg") ?? "1") || 1);
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(browserRecords.length / limit)));
  const pageRecords = browserRecords.slice((page - 1) * limit, page * limit);

  return {
    schemaVersion: 1,
    generatedAt: componentCardBrowseResponse.generatedAt,
    facets: componentCardFacetsResponse.facets,
    totalRecords: browserRecords.length,
    page,
    limit,
    records: pageRecords,
    supportingRecords: [],
    familyRecipeIdsById: Object.fromEntries(pageRecords.map((record) => [
      record.id,
      record.familyKey
        ? records.filter((candidate) => (
          candidate.kind === record.kind
          && candidate.type === record.type
          && candidate.familyKey === record.familyKey
        )).map((candidate) => candidate.id)
        : [record.id],
    ])),
  };
}

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
  http.get("*/api/crafting/blueprint-sources/index", () => HttpResponse.json({
    // Fixture cards are the curated source-backed Crafting browse set. The
    // individual mission fixture remains intentionally sparse for detail tests.
    blueprintGuids: [...componentCards.keys()],
  })),
  http.get("*/api/crafting/blueprint-sources", ({ request }) => {
    const blueprintGuid = new URL(request.url).searchParams.get("blueprintGuid")?.trim().toLowerCase() ?? "";
    return HttpResponse.json({ blueprintGuid, missions: blueprintSourceMissions.get(blueprintGuid) ?? [] });
  }),
  http.get("*/api/v1/fitting/meta", ({ request }) => {
    const channel = new URL(request.url).searchParams.get("channel")?.toUpperCase();
    return channel === "PTU"
      ? HttpResponse.json({ error: "Fixture PTU dataset unavailable" }, { status: 404 })
      : HttpResponse.json({ meta: fittingMeta, data: {} });
  }),
  http.get("*/api/crafting/component-cards/browser", ({ request }) => (
    HttpResponse.json(getFixtureComponentCardBrowserPage(request.url))
  )),
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
