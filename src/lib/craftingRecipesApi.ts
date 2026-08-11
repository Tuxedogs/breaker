import { apiUrl } from "@/lib/apiUrl";
import { parseJsonResponse } from "@/lib/safeJson";
import type { BlueprintRecord, FpsBlueprintRecord } from "@/lib/craftingData";

const RECIPES_INDEX_URL = "/api/crafting/recipes/index";
const RECIPE_BY_ID_URL = "/api/crafting/recipes";
const RECIPES_BATCH_URL = "/api/crafting/recipes/batch";
const RECIPES_BATCH_LIMIT = 100;

export type RecipeShard = {
  schemaVersion?: number;
  kind?: "vehicle" | "fps";
  record?: BlueprintRecord | FpsBlueprintRecord;
};

type CraftingRecipesIndex = {
  blueprintGuids: string[];
  vehicleBlueprintGuids: string[];
  fpsBlueprintGuids: string[];
  vehicleCount: number;
  fpsCount: number;
};

let recipesIndexPromise: Promise<CraftingRecipesIndex> | null = null;

async function fetchJson<T>(url: string, label: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(url), init);
  const data = await parseJsonResponse<T>(response, { label, url: response.url });
  if (!response.ok) {
    throw new Error(`${label} unavailable: ${response.status}`);
  }
  return data;
}

export async function getBlueprintRecordsFromApi(): Promise<BlueprintRecord[]> {
  const index = await getCraftingRecipesIndexFromApi();
  const payload = await getCraftingRecipeShardsBatchFromApi(index.vehicleBlueprintGuids);
  if (payload.missing.length > 0) {
    throw new Error(`Vehicle recipe API is missing ${payload.missing.length} indexed records.`);
  }
  const records = payload.records.flatMap((shard) => (
    shard.kind === "vehicle" && shard.record ? [shard.record as BlueprintRecord] : []
  ));
  if (records.length !== index.vehicleBlueprintGuids.length) {
    throw new Error("Vehicle recipe API returned a mismatched shard set.");
  }
  return records;
}

export async function getFPSBlueprintRecordsFromApi(): Promise<FpsBlueprintRecord[]> {
  const index = await getCraftingRecipesIndexFromApi();
  const payload = await getCraftingRecipeShardsBatchFromApi(index.fpsBlueprintGuids);
  if (payload.missing.length > 0) {
    throw new Error(`FPS recipe API is missing ${payload.missing.length} indexed records.`);
  }
  const records = payload.records.flatMap((shard) => (
    shard.kind === "fps" && shard.record ? [shard.record as FpsBlueprintRecord] : []
  ));
  if (records.length !== index.fpsBlueprintGuids.length) {
    throw new Error("FPS recipe API returned a mismatched shard set.");
  }
  return records;
}

export async function getCraftingRecipeShardFromApi(
  blueprintGuid: string,
): Promise<RecipeShard> {
  const normalizedId = blueprintGuid.trim().toLowerCase();
  return fetchJson<RecipeShard>(
    `${RECIPE_BY_ID_URL}/${encodeURIComponent(normalizedId)}`,
    "crafting recipe by id",
  );
}

export async function getCraftingRecipeShardsBatchFromApi(
  blueprintGuids: string[],
): Promise<{ records: RecipeShard[]; missing: string[] }> {
  const normalizedGuids = [...new Set(
    blueprintGuids.map((guid) => guid.trim().toLowerCase()).filter(Boolean),
  )];
  const chunks: string[][] = [];
  for (let index = 0; index < normalizedGuids.length; index += RECIPES_BATCH_LIMIT) {
    chunks.push(normalizedGuids.slice(index, index + RECIPES_BATCH_LIMIT));
  }
  const payloads = await Promise.all(chunks.map((chunk) => fetchJson<{
    records?: RecipeShard[];
    missing?: string[];
  }>(RECIPES_BATCH_URL, "crafting recipe batch", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ blueprintGuids: chunk }),
  })));
  return {
    records: payloads.flatMap((payload) => Array.isArray(payload.records) ? payload.records : []),
    missing: payloads.flatMap((payload) => Array.isArray(payload.missing) ? payload.missing : []),
  };
}

export function getCraftingRecipesIndexFromApi(): Promise<CraftingRecipesIndex> {
  recipesIndexPromise ??= fetchJson<{
    blueprintGuids?: string[];
    vehicleBlueprintGuids?: string[];
    fpsBlueprintGuids?: string[];
    vehicleCount?: number;
    fpsCount?: number;
  }>(RECIPES_INDEX_URL, "crafting recipe index").then((index) => {
    const parsed = {
      blueprintGuids: Array.isArray(index.blueprintGuids) ? index.blueprintGuids : [],
      vehicleBlueprintGuids: Array.isArray(index.vehicleBlueprintGuids) ? index.vehicleBlueprintGuids : [],
      fpsBlueprintGuids: Array.isArray(index.fpsBlueprintGuids) ? index.fpsBlueprintGuids : [],
      vehicleCount: index.vehicleCount ?? 0,
      fpsCount: index.fpsCount ?? 0,
    };
    if (
      parsed.vehicleBlueprintGuids.length !== parsed.vehicleCount
      || parsed.fpsBlueprintGuids.length !== parsed.fpsCount
      || parsed.blueprintGuids.length !== parsed.vehicleCount + parsed.fpsCount
    ) {
      throw new Error("Crafting recipe index kind counts are inconsistent.");
    }
    return parsed;
  }).catch((error) => {
    recipesIndexPromise = null;
    throw error;
  });
  return recipesIndexPromise;
}
