import assert from "node:assert/strict";
import test from "node:test";

import { handleCraftingRecipesRoute } from "./craftingRecipes.routes.ts";

type RecipeIndexBody = {
  blueprintGuids?: string[];
  vehicleBlueprintGuids?: string[];
  fpsBlueprintGuids?: string[];
  vehicleCount?: number;
  fpsCount?: number;
};

test("recipe index partitions all shard ids by source kind", async () => {
  const result = await handleCraftingRecipesRoute("GET", "/api/crafting/recipes/index", undefined);
  assert.equal(result?.status, 200);

  const body = result?.body as RecipeIndexBody;
  const vehicleIds = body.vehicleBlueprintGuids ?? [];
  const fpsIds = body.fpsBlueprintGuids ?? [];
  const allIds = body.blueprintGuids ?? [];

  assert.equal(vehicleIds.length, body.vehicleCount);
  assert.equal(fpsIds.length, body.fpsCount);
  assert.equal(allIds.length, vehicleIds.length + fpsIds.length);
  assert.equal(new Set(allIds).size, allIds.length);
  assert.deepEqual(new Set(allIds), new Set([...vehicleIds, ...fpsIds]));
});

test("recipe batch resolves indexed vehicle and FPS shards", async () => {
  const indexResult = await handleCraftingRecipesRoute("GET", "/api/crafting/recipes/index", undefined);
  const index = indexResult?.body as RecipeIndexBody;
  const vehicleId = index.vehicleBlueprintGuids?.[0];
  const fpsId = index.fpsBlueprintGuids?.[0];
  assert.ok(vehicleId);
  assert.ok(fpsId);

  const result = await handleCraftingRecipesRoute(
    "POST",
    "/api/crafting/recipes/batch",
    { blueprintGuids: [vehicleId, fpsId] },
  );
  assert.equal(result?.status, 200);
  const body = result?.body as { records?: Array<{ kind?: string }>; missing?: string[] };
  assert.deepEqual(body.missing, []);
  assert.deepEqual(body.records?.map((record) => record.kind), ["vehicle", "fps"]);
});

test("legacy recipe catalog routes are not served", async () => {
  assert.equal(
    await handleCraftingRecipesRoute("GET", "/api/crafting/recipes/catalog/vehicle", undefined),
    null,
  );
  assert.equal(
    await handleCraftingRecipesRoute("GET", "/api/crafting/recipes/catalog/fps", undefined),
    null,
  );
});
