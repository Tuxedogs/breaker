import type {
  RefineryCanonicalMaterial,
  RefineryDataset,
  RefineryMaterialId,
  RefineryRecord,
} from "../types/refinery";
import { apiUrl } from "./apiUrl";
import { parseJsonResponse } from "./safeJson";

const REFINERY_YIELDS_URL = "/api/crafting/reference/refinery-yields";
const MATERIAL_IDENTITY_URL = "/api/crafting/reference/material-identity";
let refineryDatasetPromise: Promise<RefineryDataset> | null = null;
let refineryMaterialOptionsPromise: Promise<RefineryCanonicalMaterial[]> | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isRefineryRecord(value: unknown, materialIds: Set<string>): value is RefineryRecord {
  if (!isRecord(value) || !isRecord(value.materialBonuses)) return false;
  const materialBonuses = value.materialBonuses;
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.systemCode === "string" &&
    materialIds.size > 0 &&
    [...materialIds].every((materialId) => Number.isFinite(materialBonuses[materialId]))
  );
}

function validateDataset(value: unknown): RefineryDataset {
  if (!isRecord(value) || !Array.isArray(value.materials) || !Array.isArray(value.refineries)) {
    throw new Error("Refinery yield data has an invalid root shape.");
  }
  const materialIds = new Set(
    value.materials
      .filter((material): material is { id: RefineryMaterialId; code: string; displayName: string } =>
        isRecord(material) &&
        typeof material.id === "string" &&
        typeof material.code === "string" &&
        typeof material.displayName === "string"
      )
      .map((material) => material.id),
  );
  if (
    value.schemaVersion !== 1 ||
    value.baseRefineryYield !== 0.4 ||
    typeof value.generatedAt !== "string" ||
    typeof value.sourceName !== "string" ||
    materialIds.size !== value.materials.length ||
    !value.refineries.every((refinery) => isRefineryRecord(refinery, materialIds))
  ) {
    throw new Error("Refinery yield data failed contract validation.");
  }
  return value as unknown as RefineryDataset;
}

function isMaterialIdentity(value: unknown): value is {
  materialKey: string;
  displayName: string;
  materialForm: string;
  unitType: string;
  isRefinable?: boolean;
  refinesToMaterialKey?: string | null;
} {
  if (!isRecord(value)) return false;
  return (
    typeof value.materialKey === "string" &&
    typeof value.displayName === "string" &&
    typeof value.materialForm === "string" &&
    typeof value.unitType === "string"
  );
}

function validateMaterialIdentities(value: unknown): RefineryCanonicalMaterial[] {
  if (!isRecord(value) || !Array.isArray(value.materials)) {
    throw new Error("Material identity data has an invalid root shape.");
  }
  const identities = value.materials.filter(isMaterialIdentity);
  const identityByKey = new Map(identities.map((identity) => [identity.materialKey, identity]));
  const sourceKeysByOutput = new Map<string, string[]>();

  for (const identity of identities) {
    if (!identity.isRefinable || !identity.refinesToMaterialKey) continue;
    const current = sourceKeysByOutput.get(identity.refinesToMaterialKey) ?? [];
    current.push(identity.materialKey);
    sourceKeysByOutput.set(identity.refinesToMaterialKey, current);
  }

  return [...sourceKeysByOutput.entries()]
    .flatMap(([materialKey, sourceMaterialKeys]) => {
      const identity = identityByKey.get(materialKey);
      if (!identity) return [];
      return [{
        id: identity.materialKey,
        displayName: identity.displayName,
        materialForm: identity.materialForm,
        unitType: identity.unitType,
        sourceMaterialKeys: sourceMaterialKeys.sort((left, right) => left.localeCompare(right)),
      }];
    })
    .sort((left, right) => left.displayName.localeCompare(right.displayName) || left.id.localeCompare(right.id));
}

export function loadRefineryDataset(): Promise<RefineryDataset> {
  if (!refineryDatasetPromise) {
    refineryDatasetPromise = (async () => {
      const requestUrl = apiUrl(REFINERY_YIELDS_URL);
      const response = await fetch(requestUrl);
      const data = await parseJsonResponse<unknown>(response, {
        label: "refinery yield data",
        url: requestUrl,
      });
      if (!response.ok) {
        throw new Error(`Failed to load refinery yield data: ${response.status}`);
      }
      return validateDataset(data);
    })();
  }
  return refineryDatasetPromise;
}

export function loadRefineryMaterialOptions(): Promise<RefineryCanonicalMaterial[]> {
  if (!refineryMaterialOptionsPromise) {
    refineryMaterialOptionsPromise = (async () => {
      const requestUrl = apiUrl(MATERIAL_IDENTITY_URL);
      const response = await fetch(requestUrl);
      const data = await parseJsonResponse<unknown>(response, {
        label: "material identity data",
        url: requestUrl,
      });
      if (!response.ok) {
        throw new Error(`Failed to load material identity data: ${response.status}`);
      }
      return validateMaterialIdentities(data);
    })();
  }
  return refineryMaterialOptionsPromise;
}
