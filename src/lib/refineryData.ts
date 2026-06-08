import type { RefineryDataset, RefineryMaterialId, RefineryRecord } from "../types/refinery";
import { apiUrl } from "./apiUrl";
import { parseJsonResponse } from "./safeJson";

const REFINERY_YIELDS_URL = "/api/refinery/refinery_yields.json";
let refineryDatasetPromise: Promise<RefineryDataset> | null = null;

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
