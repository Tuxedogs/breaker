import type { ComponentMaterial, ComponentRecipe, QualityModifier } from "../components/industry/crafting/utils/craftingTypes";

const VEHICLE_COMPONENTS_URL = "/api/vehicle_components.cleaned.json";
const FPS_GEAR_URL = "/api/full_gear.json";

interface GeneratedVehicleMaterial {
  slot?: string | null;
  costType?: string | null;
  materialName?: string | null;
  costId?: string | null;
  quantity?: string | number | null;
  qualityModifiers?: GeneratedQualityModifier[] | null;
}

interface GeneratedQualityModifier {
  slot?: string | null;
  gameplayProperty?: string | null;
  gameplayPropertyId?: string | null;
  startQuality?: string | number | null;
  endQuality?: string | number | null;
  modifierStart?: string | number | null;
  modifierEnd?: string | number | null;
  modifierStartPercent?: string | number | null;
  modifierEndPercent?: string | number | null;
}

export interface VehicleComponentRecord {
  id?: string | null;
  internalName?: string | null;
  displayName?: string | null;
  fallbackName?: string | null;
  name?: string | null;
  nameSource?: string | null;
  componentType?: string | null;
  category?: string | null;
  size?: string | number | null;
  grade?: string | null;
  class?: string | null;
  manufacturer?: string | null;
  wikiResolved?: boolean | null;
  wikiUrl?: string | null;
  blueprintGuid?: string | null;
  blueprintName?: string | null;
  blueprintPath?: string | null;
  entityClass?: string | null;
  sourceFile?: string | null;
  craftTimeSeconds?: string | number | null;
  materials?: GeneratedVehicleMaterial[] | null;
  qualityModifiers?: GeneratedQualityModifier[] | null;
  overallQualityModifiers?: GeneratedQualityModifier[] | null;
  rewardPools?: unknown[] | null;
}

interface GeneratedFPSMaterial {
  slot?: string | null;
  material?: string | null;
  materialId?: string | null;
  quantity?: string | number | null;
}

export interface FPSGearRecord {
  name?: string | null;
  rawName?: string | null;
  nameSource?: string | null;
  category?: string | null;
  blueprintGuid?: string | null;
  entityClass?: string | null;
  craftTimeSeconds?: string | number | null;
  materials?: GeneratedFPSMaterial[] | null;
  wikiUuid?: string | null;
  wikiClassName?: string | null;
  wikiType?: string | null;
  wikiUrl?: string | null;
  wikiVersion?: string | null;
}

let vehicleComponentsPromise: Promise<VehicleComponentRecord[]> | null = null;
let fpsGearPromise: Promise<FPSGearRecord[]> | null = null;
let craftingItemsPromise: Promise<ComponentRecipe[]> | null = null;

async function fetchJsonArray<T>(url: string): Promise<T[]> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.status}`);
  }
  const data = (await response.json()) as unknown;
  return Array.isArray(data) ? (data as T[]) : [];
}

function toStringOrFallback(value: unknown, fallback = "Unknown"): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function toOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function toNumber(value: unknown, fallback = 0): number {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(number) ? number : fallback;
}

function normalizeQualityModifier(
  modifier: GeneratedQualityModifier,
  item: VehicleComponentRecord
): QualityModifier {
  const displayName = item.displayName ?? item.fallbackName ?? item.name ?? item.internalName;
  return {
    component_type: toStringOrFallback(item.category ?? item.componentType),
    component_name: toStringOrFallback(displayName),
    size: toStringOrFallback(item.size, ""),
    slot: toStringOrFallback(modifier.slot, ""),
    gameplay_property: toStringOrFallback(modifier.gameplayProperty, ""),
    start_quality: toNumber(modifier.startQuality),
    end_quality: toNumber(modifier.endQuality),
    modifier_start: toNumber(modifier.modifierStart),
    modifier_end: toNumber(modifier.modifierEnd),
    modifier_start_percent: toNumber(modifier.modifierStartPercent),
    modifier_end_percent: toNumber(modifier.modifierEndPercent),
    gameplay_property_id: toStringOrFallback(modifier.gameplayPropertyId, ""),
    blueprint_id: toStringOrFallback(item.blueprintGuid),
  };
}

function normalizeVehicleMaterial(
  material: GeneratedVehicleMaterial,
  item: VehicleComponentRecord
): ComponentMaterial {
  return {
    slot: toStringOrFallback(material.slot),
    cost_type: toStringOrFallback(material.costType),
    material_name: toStringOrFallback(material.materialName),
    cost_id: toStringOrFallback(material.costId, ""),
    quantity: toNumber(material.quantity),
    qualityModifiers: (material.qualityModifiers ?? []).map((modifier) =>
      normalizeQualityModifier(modifier, item)
    ),
  };
}

function normalizeFPSMaterial(material: GeneratedFPSMaterial): ComponentMaterial {
  return {
    slot: toStringOrFallback(material.slot),
    cost_type: "resource",
    material_name: toStringOrFallback(material.material),
    cost_id: toStringOrFallback(material.materialId, ""),
    quantity: toNumber(material.quantity),
  };
}

function normalizeVehicleComponent(item: VehicleComponentRecord): ComponentRecipe {
  const displayName = item.displayName ?? item.fallbackName ?? item.name ?? item.internalName;
  return {
    blueprint_id: toStringOrFallback(item.blueprintGuid),
    component_type: toStringOrFallback(item.category ?? item.componentType),
    component_name: toStringOrFallback(displayName),
    size: toStringOrFallback(item.size, ""),
    craft_time_seconds: toNumber(item.craftTimeSeconds),
    output_entityClass: toStringOrFallback(item.entityClass, ""),
    materials: (item.materials ?? []).map((material) => normalizeVehicleMaterial(material, item)),
    item_kind: "vehicle",
    internal_name: toOptionalString(item.internalName),
    fallback_name: toOptionalString(item.fallbackName),
    wiki_resolved: Boolean(item.wikiResolved),
    wiki_url: toOptionalString(item.wikiUrl),
    category: toOptionalString(item.category),
    grade: toOptionalString(item.grade),
    class: toOptionalString(item.class),
    manufacturer: toOptionalString(item.manufacturer),
    source_file: toOptionalString(item.sourceFile),
    name_source: toOptionalString(item.nameSource),
    qualityModifiers: item.qualityModifiers?.map((modifier) => normalizeQualityModifier(modifier, item)) ?? [],
    overallQualityModifiers: item.overallQualityModifiers?.map((modifier) =>
      normalizeQualityModifier(modifier, item)
    ) ?? [],
    rewardPools: item.rewardPools ?? [],
  };
}

function normalizeFPSGear(item: FPSGearRecord): ComponentRecipe {
  return {
    blueprint_id: toStringOrFallback(item.blueprintGuid),
    component_type: toStringOrFallback(item.category),
    component_name: toStringOrFallback(item.name),
    size: "",
    craft_time_seconds: toNumber(item.craftTimeSeconds),
    output_entityClass: toStringOrFallback(item.entityClass, ""),
    materials: (item.materials ?? []).map(normalizeFPSMaterial),
    item_kind: "fps",
    raw_name: toOptionalString(item.rawName),
    name_source: toOptionalString(item.nameSource),
    wiki_uuid: toOptionalString(item.wikiUuid),
    wiki_class_name: toOptionalString(item.wikiClassName),
    wiki_type: toOptionalString(item.wikiType),
    wiki_url: toOptionalString(item.wikiUrl),
    wiki_version: toOptionalString(item.wikiVersion),
  };
}

export function getVehicleComponents(): Promise<VehicleComponentRecord[]> {
  vehicleComponentsPromise ??= fetchJsonArray<VehicleComponentRecord>(VEHICLE_COMPONENTS_URL);
  return vehicleComponentsPromise;
}

export function getFPSGear(): Promise<FPSGearRecord[]> {
  fpsGearPromise ??= fetchJsonArray<FPSGearRecord>(FPS_GEAR_URL);
  return fpsGearPromise;
}

export async function getCraftingItems(): Promise<ComponentRecipe[]> {
  craftingItemsPromise ??= Promise.all([getVehicleComponents(), getFPSGear()]).then(([vehicle, fps]) => [
    ...vehicle.map(normalizeVehicleComponent),
    ...fps.map(normalizeFPSGear),
  ]);
  return craftingItemsPromise;
}

export async function getCraftingItemByBlueprintGuid(guid: string): Promise<ComponentRecipe | null> {
  const items = await getCraftingItems();
  return items.find((item) => item.blueprint_id === guid) ?? null;
}

export async function getCraftingItemsByMaterial(materialName: string): Promise<ComponentRecipe[]> {
  const needle = materialName.trim().toLowerCase();
  const items = await getCraftingItems();
  return items.filter((item) => item.materials.some((material) => material.material_name.toLowerCase() === needle));
}

export async function getCraftingItemsByCategory(category: string): Promise<ComponentRecipe[]> {
  const needle = category.trim().toLowerCase();
  const items = await getCraftingItems();
  return items.filter((item) => item.component_type.toLowerCase() === needle);
}

export async function getCraftingItemsByType(type: string): Promise<ComponentRecipe[]> {
  return getCraftingItemsByCategory(type);
}
