import type {
  ComponentMaterial,
  ComponentRecipe,
  QualityModifier,
} from "../components/industry/crafting/utils/craftingTypes";
import { apiUrl } from "./apiUrl";
import { parseJsonResponse } from "./safeJson";

const BLUEPRINTS_URL = "/api/crafting/blueprints.json";
const FPS_BLUEPRINTS_URL = "/api/crafting/fps/fps_blueprints.json";
const CRAFTED_PROPERTIES_URL = "/api/crafting/crafted_properties.json";
const QUALITY_QUANTIZATION_URL = "/api/crafting/quality_quantization.json";

interface ApiMaterialRecord {
  slot?: string | null;
  costType?: string | null;
  materialName?: string | null;
  costId?: string | null;
  quantity?: string | number | null;
}

interface ApiQualityModifierRecord {
  slot?: string | null;
  gameplayProperty?: string | null;
  gameplayPropertyId?: string | null;
  startQuality?: string | number | null;
  endQuality?: string | number | null;
  modifierStart?: string | number | null;
  modifierEnd?: string | number | null;
  modifierStartPercent?: string | number | null;
  modifierEndPercent?: string | number | null;
  modifierMode?: string | null;
}

interface ApiQualityModifierValueRange {
  startQuality?: string | number | null;
  endQuality?: string | number | null;
  modifierAtStart?: string | number | null;
  modifierAtEnd?: string | number | null;
  additiveModifierAtStart?: string | number | null;
  additiveModifierAtEnd?: string | number | null;
  type?: string | null;
}

interface FpsMaterialModifierRecord {
  gameplayProperty?: string | null;
  gameplayPropertyId?: string | null;
  displayName?: string | null;
  valueRanges?: ApiQualityModifierValueRange[] | null;
}

export interface BlueprintRecord {
  displayName?: string | null;
  nameSource?: string | null;
  componentType?: string | null;
  category?: string | null;
  size?: string | number | null;
  blueprintGuid?: string | null;
  blueprintName?: string | null;
  blueprintPath?: string | null;
  entityClass?: string | null;
  craftTimeSeconds?: string | number | null;
  baseStats?: Record<string, unknown> | null;
  materials?: ApiMaterialRecord[] | null;
  qualityModifiers?: ApiQualityModifierRecord[] | null;
  overallQualityModifiers?: ApiQualityModifierRecord[] | null;
  rewardPools?: unknown[] | null;

  internalName?: string | null;
  fallbackName?: string | null;
  name?: string | null;
  grade?: string | null;
  class?: string | null;
  manufacturer?: string | null;
  wikiResolved?: boolean | null;
  wikiUrl?: string | null;
  sourceFile?: string | null;
}

export interface FpsBlueprintMaterialRecord {
  slot?: string | null;
  slotDisplayName?: string | null;
  costType?: string | null;
  materialName?: string | null;
  costId?: string | null;
  quantity?: string | number | null;
  unitType?: string | null;
  modifiers?: FpsMaterialModifierRecord[] | null;
  qualityModifiers?: ApiQualityModifierRecord[] | null;
}

export interface FpsBlueprintRecord {
  id?: string | null;
  displayName?: string | null;
  entityClass?: string | null;
  blueprintGuid?: string | null;
  blueprintName?: string | null;
  blueprintPath?: string | null;
  recordPath?: string | null;
  craftTimeSeconds?: string | number | null;
  materials?: FpsBlueprintMaterialRecord[] | null;
  materialRequirements?: FpsBlueprintMaterialRecord[] | null;
  qualityModifiers?: ApiQualityModifierRecord[] | null;
  overallQualityModifiers?: ApiQualityModifierRecord[] | null;
  fpsCategory?: string | null;
  sourceBranch?: string | null;
  sourceRelativePath?: string | null;
  familyDisplayName?: string | null;
  familyKey?: string | null;
  baseName?: string | null;
  variantName?: string | null;
  weaponClass?: string | null;
  armorSlot?: string | null;
  armorWeight?: string | null;
  armorFamily?: string | null;
  ammoClass?: string | null;
}

export interface CraftedPropertyRecord {
  gameplayPropertyId: string;
  gameplayProperty: string;
  propertyName: string;
  path: string;
}

export interface QualityQuantizationBand {
  start: number;
  end: number;
  mappedValue: number;
}

export interface QualityQuantizationRecord {
  guid: string;
  recordName: string;
  recordType: string;
  path: string;
  bands: QualityQuantizationBand[];
}

let blueprintsPromise: Promise<BlueprintRecord[]> | null = null;
let fpsBlueprintsPromise: Promise<FpsBlueprintRecord[]> | null = null;
let craftedPropertiesPromise: Promise<CraftedPropertyRecord[]> | null = null;
let qualityQuantizationPromise: Promise<QualityQuantizationRecord[]> | null = null;
let craftingItemsPromise: Promise<ComponentRecipe[]> | null = null;

async function fetchJsonArray<T>(url: string): Promise<T[]> {
  const requestUrl = apiUrl(url);
  const response = await fetch(requestUrl);
  const data = await parseJsonResponse<unknown>(response, {
    label: `crafting static JSON ${url}`,
    url: requestUrl,
  });

  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.status}`);
  }

  if (!Array.isArray(data)) {
    throw new Error(`Expected ${url} to contain a JSON array`);
  }
  return data as T[];
}

function toStringOrFallback(value: unknown, fallback = "Unknown"): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function toOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toNumber(value: unknown, fallback = 0): number {
  const number =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  return Number.isFinite(number) ? number : fallback;
}

type QualityModifierOwner = Pick<
  BlueprintRecord,
  | "displayName"
  | "fallbackName"
  | "name"
  | "internalName"
  | "blueprintName"
  | "componentType"
  | "category"
  | "size"
  | "blueprintGuid"
>;

function normalizeQualityModifier(
  modifier: ApiQualityModifierRecord,
  item: QualityModifierOwner
): QualityModifier {
  const displayName =
    item.displayName ??
    item.fallbackName ??
    item.name ??
    item.internalName ??
    item.blueprintName;

  return {
    component_type: toStringOrFallback(item.componentType ?? item.category),
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
    modifier_mode: toOptionalString(modifier.modifierMode) ?? undefined,
    gameplay_property_id: toStringOrFallback(modifier.gameplayPropertyId, ""),
    blueprint_id: toStringOrFallback(item.blueprintGuid),
  };
}

function modifierPercent(value: unknown): number {
  return (toNumber(value, 1) - 1) * 100;
}

function fpsMaterialModifiersToQualityModifiers(
  material: FpsBlueprintMaterialRecord
): ApiQualityModifierRecord[] {
  if (material.qualityModifiers) return material.qualityModifiers;

  const slot = material.slot ?? material.slotDisplayName ?? null;

  return (material.modifiers ?? []).flatMap((modifier) =>
    (modifier.valueRanges ?? []).map((range) => {
      const rangeType = String(range.type ?? "");
      const isIntegerAdditive =
        rangeType.includes("IntegerAdditive") ||
        range.additiveModifierAtStart !== undefined ||
        range.additiveModifierAtEnd !== undefined;
      const modifierStart = isIntegerAdditive
        ? range.additiveModifierAtStart
        : range.modifierAtStart;
      const modifierEnd = isIntegerAdditive
        ? range.additiveModifierAtEnd
        : range.modifierAtEnd;

      return {
        slot,
        gameplayProperty: modifier.gameplayProperty,
        gameplayPropertyId: modifier.gameplayPropertyId,
        startQuality: range.startQuality,
        endQuality: range.endQuality,
        modifierStart,
        modifierEnd,
        modifierStartPercent: isIntegerAdditive
          ? null
          : modifierPercent(modifierStart),
        modifierEndPercent: isIntegerAdditive ? null : modifierPercent(modifierEnd),
        modifierMode: isIntegerAdditive ? "integerAdditive" : "multiplier",
      };
    })
  );
}

function normalizeMaterial(
  material: ApiMaterialRecord,
  item: BlueprintRecord
): ComponentMaterial {
  const slot = toStringOrFallback(material.slot, "");

  return {
    slot,
    cost_type: toStringOrFallback(material.costType, "resource"),
    material_name: toStringOrFallback(material.materialName),
    cost_id: toStringOrFallback(material.costId, ""),
    quantity: toNumber(material.quantity),
    qualityModifiers: (item.qualityModifiers ?? []).filter((modifier) => {
      return toStringOrFallback(modifier.slot, "") === slot;
    }).map((modifier) => normalizeQualityModifier(modifier, item)),
  };
}

function normalizeBlueprint(item: BlueprintRecord): ComponentRecipe {
  const displayName =
    item.displayName ??
    item.fallbackName ??
    item.name ??
    item.internalName ??
    item.blueprintName;

  const componentType = item.componentType ?? item.category;

  return {
    blueprint_id: toStringOrFallback(item.blueprintGuid),
    component_type: toStringOrFallback(componentType),
    component_name: toStringOrFallback(displayName),
    size: toStringOrFallback(item.size, ""),
    craft_time_seconds: toNumber(item.craftTimeSeconds),
    output_entityClass: toStringOrFallback(item.entityClass, ""),
    baseStats: item.baseStats ?? undefined,
    materials: (item.materials ?? []).map((material) => normalizeMaterial(material, item)),
    item_kind: "vehicle",

    internal_name: toOptionalString(item.internalName ?? item.blueprintName),
    fallback_name: toOptionalString(item.fallbackName),
    wiki_resolved: Boolean(item.wikiResolved),
    wiki_url: toOptionalString(item.wikiUrl),
    category: toOptionalString(componentType),
    grade: toOptionalString(item.grade),
    class: toOptionalString(item.class),
    manufacturer: toOptionalString(item.manufacturer),
    source_file: toOptionalString(item.sourceFile ?? item.blueprintPath),
    name_source: toOptionalString(item.nameSource),

    qualityModifiers: (item.qualityModifiers ?? []).map((modifier) =>
      normalizeQualityModifier(modifier, item)
    ),
    overallQualityModifiers: (item.overallQualityModifiers ?? []).map((modifier) =>
      normalizeQualityModifier(modifier, item)
    ),
    rewardPools: item.rewardPools ?? [],
  };
}

export function getBlueprintRecords(): Promise<BlueprintRecord[]> {
  blueprintsPromise ??= fetchJsonArray<BlueprintRecord>(BLUEPRINTS_URL);
  return blueprintsPromise;
}

export function getFPSBlueprintRecords(): Promise<FpsBlueprintRecord[]> {
  fpsBlueprintsPromise ??= fetchJsonArray<FpsBlueprintRecord>(FPS_BLUEPRINTS_URL);
  return fpsBlueprintsPromise;
}

function normalizeFpsMaterial(
  material: FpsBlueprintMaterialRecord,
  item: FpsBlueprintRecord,
  recipeModifiers: ApiQualityModifierRecord[]
): ComponentMaterial {
  const slot = toStringOrFallback(material.slot ?? material.slotDisplayName, "");
  const materialModifiers = fpsMaterialModifiersToQualityModifiers(material);
  const modifiers = materialModifiers.length > 0
    ? materialModifiers
    : recipeModifiers.filter((modifier) => toStringOrFallback(modifier.slot, "") === slot);

  return {
    slot,
    cost_type: toStringOrFallback(material.costType, "resource"),
    material_name: toStringOrFallback(material.materialName),
    cost_id: toStringOrFallback(material.costId, ""),
    quantity: toNumber(material.quantity),
    qualityModifiers: modifiers.map((modifier) => normalizeQualityModifier(modifier, item)),
  };
}

function normalizeFpsBlueprint(item: FpsBlueprintRecord): ComponentRecipe {
  const displayName =
    item.displayName ??
    item.familyDisplayName ??
    item.baseName ??
    item.blueprintName;
  const category = item.fpsCategory ?? item.sourceBranch ?? "fps gear";
  const materials = item.materialRequirements ?? item.materials ?? [];
  const recipeModifiers = item.qualityModifiers ?? [];

  return {
    blueprint_id: toStringOrFallback(item.blueprintGuid ?? item.id),
    component_type: toStringOrFallback(category),
    component_name: toStringOrFallback(displayName),
    size: "",
    craft_time_seconds: toNumber(item.craftTimeSeconds),
    output_entityClass: toStringOrFallback(item.entityClass, ""),
    materials: materials.map((material) =>
      normalizeFpsMaterial(material, item, recipeModifiers)
    ),
    item_kind: "fps",

    internal_name: toOptionalString(item.blueprintName),
    fallback_name: toOptionalString(item.variantName ?? item.baseName),
    wiki_resolved: false,
    wiki_url: null,
    category: toOptionalString(category),
    grade: null,
    class: null,
    manufacturer: null,
    source_file: toOptionalString(item.sourceRelativePath ?? item.blueprintPath ?? item.recordPath),
    raw_name: toOptionalString(item.blueprintName),
    name_source: null,
    wiki_type: toOptionalString(item.ammoClass ?? category),
    wiki_version: null,
    weaponClass: toOptionalString(item.weaponClass),
    familyKey: toOptionalString(item.familyKey),
    familyDisplayName: toOptionalString(item.familyDisplayName),
    baseName: toOptionalString(item.baseName),
    variantName: toOptionalString(item.variantName),
    armorSlot: toOptionalString(item.armorSlot),
    armorWeight: toOptionalString(item.armorWeight),
    armorFamily: toOptionalString(item.armorFamily),

    qualityModifiers: recipeModifiers.map((modifier) =>
      normalizeQualityModifier(modifier, item)
    ),
    overallQualityModifiers: (item.overallQualityModifiers ?? []).map((modifier) =>
      normalizeQualityModifier(modifier, item)
    ),
    rewardPools: [],
  };
}

export function getVehicleComponents(): Promise<BlueprintRecord[]> {
  return getBlueprintRecords();
}

export function getCraftedProperties(): Promise<CraftedPropertyRecord[]> {
  craftedPropertiesPromise ??= fetchJsonArray<CraftedPropertyRecord>(CRAFTED_PROPERTIES_URL);
  return craftedPropertiesPromise;
}

export function getQualityQuantization(): Promise<QualityQuantizationRecord[]> {
  qualityQuantizationPromise ??= fetchJsonArray<QualityQuantizationRecord>(
    QUALITY_QUANTIZATION_URL
  );
  return qualityQuantizationPromise;
}

export async function getFPSGear(): Promise<ComponentRecipe[]> {
  const blueprints = await getFPSBlueprintRecords();
  return blueprints.map(normalizeFpsBlueprint);
}

export async function getCraftingItems(): Promise<ComponentRecipe[]> {
  craftingItemsPromise ??= Promise.all([
    getBlueprintRecords(),
    getFPSBlueprintRecords(),
  ]).then(([blueprints, fpsBlueprints]) =>
    [
      ...blueprints.map(normalizeBlueprint),
      ...fpsBlueprints.map(normalizeFpsBlueprint),
    ]
  );

  return craftingItemsPromise;
}

export async function getCraftingItemByBlueprintGuid(
  guid: string
): Promise<ComponentRecipe | null> {
  const items = await getCraftingItems();
  return items.find((item) => item.blueprint_id === guid) ?? null;
}

export async function getCraftingItemsByMaterial(
  materialName: string
): Promise<ComponentRecipe[]> {
  const needle = materialName.trim().toLowerCase();
  const items = await getCraftingItems();

  return items.filter((item) =>
    item.materials.some((material) => material.material_name.toLowerCase() === needle)
  );
}

export async function getCraftingItemsByCategory(
  category: string
): Promise<ComponentRecipe[]> {
  const needle = category.trim().toLowerCase();
  const items = await getCraftingItems();

  return items.filter((item) => item.component_type.toLowerCase() === needle);
}

export async function getCraftingItemsByType(type: string): Promise<ComponentRecipe[]> {
  return getCraftingItemsByCategory(type);
}

export function clearCraftingDataCache(): void {
  blueprintsPromise = null;
  fpsBlueprintsPromise = null;
  craftedPropertiesPromise = null;
  qualityQuantizationPromise = null;
  craftingItemsPromise = null;
}
