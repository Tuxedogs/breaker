import { apiUrl } from "@/lib/apiUrl";
import { parseJsonResponse } from "@/lib/safeJson";
import type { BlueprintRecord, FpsBlueprintRecord } from "@/lib/craftingData";

const RECIPES_INDEX_URL = "/api/crafting/recipes/index";
const RECIPES_VEHICLE_CATALOG_URL = "/api/crafting/recipes/catalog/vehicle";
const RECIPES_FPS_CATALOG_URL = "/api/crafting/recipes/catalog/fps";
const RECIPE_BY_ID_URL = "/api/crafting/recipes";

type RecipeShard = {
  schemaVersion?: number;
  kind?: "vehicle" | "fps";
  record?: BlueprintRecord | FpsBlueprintRecord;
};

async function fetchJson<T>(url: string, label: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(url), init);
  const data = await parseJsonResponse<T>(response, { label, url: response.url });
  if (!response.ok) {
    throw new Error(`${label} unavailable: ${response.status}`);
  }
  return data;
}

export async function getBlueprintRecordsFromApi(): Promise<BlueprintRecord[]> {
  const data = await fetchJson<unknown>(RECIPES_VEHICLE_CATALOG_URL, "vehicle recipe catalog");
  if (!Array.isArray(data)) {
    throw new Error("Vehicle recipe catalog payload is invalid");
  }
  return data as BlueprintRecord[];
}

export async function getFPSBlueprintRecordsFromApi(): Promise<FpsBlueprintRecord[]> {
  const data = await fetchJson<unknown>(RECIPES_FPS_CATALOG_URL, "fps recipe catalog");
  if (!Array.isArray(data)) {
    throw new Error("FPS recipe catalog payload is invalid");
  }
  return data as FpsBlueprintRecord[];
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

export async function getCraftingRecipesIndexFromApi(): Promise<{
  blueprintGuids: string[];
  vehicleCount: number;
  fpsCount: number;
}> {
  const index = await fetchJson<{
    blueprintGuids?: string[];
    vehicleCount?: number;
    fpsCount?: number;
  }>(RECIPES_INDEX_URL, "crafting recipe index");
  return {
    blueprintGuids: Array.isArray(index.blueprintGuids) ? index.blueprintGuids : [],
    vehicleCount: index.vehicleCount ?? 0,
    fpsCount: index.fpsCount ?? 0,
  };
}
