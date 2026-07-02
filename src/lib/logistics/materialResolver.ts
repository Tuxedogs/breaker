import type { MaterialTemplate } from "../../types/logistics";
import type { RecipeInputTemplate } from "../../data/logistics/seed";
import { getInventoryUnitLabel } from "./inventory";
import type { MaterialIdentity } from "./materialIdentityIndex";

export interface MaterialIdentityInput {
  materialKey?: string | null;
  materialId?: string | null;
  materialGuid?: string | null;
  displayName?: string | null;
  materialName?: string | null;
  rawName?: string | null;
  sourceName?: string | null;
  sourceType?: string | null;
  entityClass?: string | null;
  recordName?: string | null;
  internalName?: string | null;
  costId?: string | null;
}

export interface ResolvedMaterialIdentity {
  materialKey: string;
  materialId: string;
  costId?: string;
  guid?: string;
  displayName: string;
  rawName?: string;
  sourceName?: string;
  sourceType?: string;
  aliasesMatched: string[];
  unitType: "unit" | "SCU";
  category?: MaterialTemplate["materialType"];
  material: MaterialTemplate;
}

const API_MATERIAL_GUID_ALIASES: Record<string, string> = {
  "75b37a54-45c9-4f27-ac09-9830f092dd86": "torite",
  "f9f3251a-8e48-408a-b957-f1e3d5d3e213": "rawice",
  "f386a33c-ac9a-400a-a7b8-fe1fc7c8d270": "iron",
  "1b4c4042-5fdc-4b52-bec4-07085cb3520a": "tin",
  "33bff393-42f1-4f70-85a1-71e695ed2a5a": "borase",
  "60f116f4-c02a-45b2-9ded-333747795124": "tungsten",
  "dc6fbcbb-5990-4ed5-82ee-93152dab7845": "agricium",
  "8cd317a3-df9b-4315-8ac3-0f1fca42dfd4": "stileron",
  "392b4dca-449a-4d4d-8fef-beab024d9ee7": "lindinium",
  "07570c9f-fdf6-4bca-a56b-c42809ec0e01": "titanium",
  "86d00bd8-08f7-4231-b375-a609803fc46d": "riccite",
  "4a47cad8-0271-4048-b19b-d9b52521fc20": "savrilium",
  "51b456cd-e73e-42a8-b36e-0bf6fbe29ce6": "sadaryx",
  "a789f57a-e12b-4bcd-8132-e0c03d84fc89": "copper",
  "7f4599b0-a2b2-4178-8c7e-13292054ab20": "laranite",
  "06cafea0-49fe-4dce-b0f0-dc583316c66d": "taranite",
  "7bbd3197-a6e1-49b3-a495-0b7ef4f8ce40": "silicon",
  "93c8b7df-d6ac-4b4f-a115-b0e3afc238b8": "beryl",
  "989f9b73-f636-4f35-a81d-579dcbe3f0ab": "ouratite",
  "999e3149-fd10-49ac-914f-8911e61c6122": "bexalite",
  "4236c16b-c47f-4083-9e26-4313733f2326": "corundum",
  "61189578-ed7a-4491-9774-37ae2f82b8b0": "hephaestanite",
  "21825507-7923-4683-9bf3-9cfe316940e3": "gold",
  "35121003-f1af-481a-b16f-7f48d8af0efb": "quartz",
  "38d7d7e9-819b-4351-a40e-7b764cb304e6": "beradom",
  "ae6d8d74-04fa-4d21-9991-4232f8eb2cfe": "glacosite",
  "d7a21cac-3c2b-4695-95b7-2042d8f5755e": "feynmaline",
  "20094ded-ad04-46a3-b734-9e37aa3154b3": "dolivine",
  "125dd723-95ad-488d-830f-62c954445ca1": "hadanite",
  "bde5a2c8-2ef4-46ac-9403-2fcb79e4016c": "quantanium",
};

const TEXT_ALIASES: Record<string, string> = {
  aluminum: "aluminum",
  aluminium: "aluminum",
  ice: "rawice",
  rawice: "rawice",
  pressurizedice: "rawice",
  carinitepure: "carinite-pure",
};

function normalizeToken(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/^entityclassdefinition\./, "").replace(/[^a-z0-9]/g, "");
}

function addAlias(index: Map<string, MaterialTemplate>, alias: string | null | undefined, material: MaterialTemplate) {
  const key = normalizeToken(alias);
  if (key && !index.has(key)) index.set(key, material);
}

function addIdentityAliasValues(index: Map<string, MaterialTemplate>, aliases: MaterialIdentity["aliases"], material: MaterialTemplate) {
  if (!aliases) return;
  if (Array.isArray(aliases)) {
    for (const alias of aliases) addAlias(index, alias, material);
    return;
  }
  for (const values of Object.values(aliases)) {
    for (const alias of values) addAlias(index, alias, material);
  }
}

function identityMaterial(identity: MaterialIdentity, materialById: Map<string, MaterialTemplate>, sourceKeyByOutput: Map<string, string>) {
  return materialById.get(identity.materialKey) ??
    materialById.get(sourceKeyByOutput.get(identity.materialKey) ?? "") ??
    undefined;
}

export function createMaterialResolver(materials: MaterialTemplate[], materialIdentities: MaterialIdentity[] = []) {
  const index = new Map<string, MaterialTemplate>();
  const materialById = new Map(materials.map((material) => [material.id, material]));
  for (const material of materials) {
    addAlias(index, material.id, material);
    addAlias(index, material.name, material);
  }
  const sourceKeyByOutput = new Map<string, string>();
  for (const identity of materialIdentities) {
    if (identity.isRefinable && identity.refinesToMaterialKey && materialById.has(identity.materialKey)) {
      sourceKeyByOutput.set(identity.refinesToMaterialKey, identity.materialKey);
    }
  }
  for (const identity of materialIdentities) {
    const material = identityMaterial(identity, materialById, sourceKeyByOutput);
    if (!material) continue;
    addAlias(index, identity.materialKey, material);
    addAlias(index, identity.canonicalName, material);
    addAlias(index, identity.displayName, material);
    addAlias(index, identity.rawName, material);
    addAlias(index, identity.refinedName, material);
    addAlias(index, identity.commodityName, material);
    addIdentityAliasValues(index, identity.aliases, material);
  }
  for (const [alias, materialId] of Object.entries(TEXT_ALIASES)) {
    const material = materials.find((entry) => entry.id === materialId);
    if (material) addAlias(index, alias, material);
  }
  for (const [guid, materialId] of Object.entries(API_MATERIAL_GUID_ALIASES)) {
    const material = materials.find((entry) => entry.id === materialId);
    if (material) addAlias(index, guid, material);
  }

  return (input: MaterialIdentityInput): ResolvedMaterialIdentity | null => {
    const strongCandidates = [input.materialKey, input.materialId, input.materialGuid, input.costId];
    const aliasCandidates = [input.entityClass, input.recordName, input.internalName, input.sourceName, input.rawName];
    const fallbackCandidates = [input.displayName, input.materialName];
    const orderedCandidates = [...strongCandidates, ...aliasCandidates, ...fallbackCandidates];
    const matches = orderedCandidates
      .map((candidate) => ({ candidate, material: index.get(normalizeToken(candidate)) }))
      .filter((match): match is { candidate: string; material: MaterialTemplate } => Boolean(match.candidate && match.material));
    const material = matches[0]?.material;
    if (!material) return null;
    const guid = [input.materialGuid, input.costId, input.materialId].find((value) =>
      typeof value === "string" && API_MATERIAL_GUID_ALIASES[value.toLowerCase()] === material.id
    ) ?? undefined;
    return {
      materialKey: material.id,
      materialId: material.id,
      costId: guid,
      guid,
      displayName: material.name,
      rawName: input.rawName ?? input.materialName ?? input.displayName ?? input.sourceName ?? undefined,
      sourceName: input.sourceName ?? input.materialName ?? input.rawName ?? undefined,
      sourceType: input.sourceType ?? undefined,
      aliasesMatched: matches.filter((match) => match.material.id === material.id).map((match) => match.candidate),
      unitType: getInventoryUnitLabel(material),
      category: material.materialType,
      material,
    };
  };
}

export function normalizeRecipeInputTemplate(
  input: RecipeInputTemplate,
  materials: MaterialTemplate[],
): RecipeInputTemplate {
  const resolve = createMaterialResolver(materials);
  const resolved = resolve(input);
  if (!resolved) {
    return {
      ...input,
      materialKey: input.materialKey ?? input.materialId,
      displayName: input.displayName ?? input.materialName,
      rawName: input.rawName ?? input.materialName,
    };
  }
  return {
    ...input,
    requirementId: input.requirementId,
    materialKey: resolved.materialKey,
    materialId: resolved.materialId,
    costId: input.costId ?? resolved.costId,
    materialGuid: input.materialGuid ?? resolved.guid,
    displayName: input.displayName ?? input.materialName ?? resolved.displayName,
    materialName: input.materialName ?? input.displayName ?? resolved.displayName,
    rawName: input.rawName ?? resolved.rawName,
    sourceName: input.sourceName ?? resolved.sourceName,
    sourceType: input.sourceType ?? resolved.sourceType,
    unitType: input.unitType ?? resolved.unitType,
  };
}
