import { apiUrl } from "./apiUrl";
import { parseJsonResponse } from "./safeJson";
import type {
  CraftedPropertyRecord,
  QualityQuantizationRecord,
} from "./craftingData";
import type { MaterialIdentityRecord } from "./materialIdentity";

const CRAFTED_PROPERTIES_URL = "/api/crafting/reference/crafted-properties";
const QUALITY_QUANTIZATION_URL = "/api/crafting/reference/quality-quantization";
const MATERIAL_QUALITY_QUANTIZATION_URL = "/api/crafting/reference/material-quality-quantization";
const MATERIAL_IDENTITY_URL = "/api/crafting/reference/material-identity";

async function fetchJsonArray<T>(url: string, label: string): Promise<T[]> {
  const response = await fetch(apiUrl(url));
  const data = await parseJsonResponse<unknown>(response, { label, url: response.url });
  if (!response.ok) {
    throw new Error(`${label} unavailable: ${response.status}`);
  }
  if (!Array.isArray(data)) {
    throw new Error(`${label} payload is invalid`);
  }
  return data as T[];
}

async function fetchJsonObject<T>(url: string, label: string): Promise<T> {
  const response = await fetch(apiUrl(url));
  const data = await parseJsonResponse<T>(response, { label, url: response.url });
  if (!response.ok) {
    throw new Error(`${label} unavailable: ${response.status}`);
  }
  return data;
}

export function getCraftedPropertiesFromApi(): Promise<CraftedPropertyRecord[]> {
  return fetchJsonArray<CraftedPropertyRecord>(
    CRAFTED_PROPERTIES_URL,
    "crafted properties",
  );
}

export function getQualityQuantizationFromApi(): Promise<QualityQuantizationRecord[]> {
  return fetchJsonArray<QualityQuantizationRecord>(
    QUALITY_QUANTIZATION_URL,
    "quality quantization",
  );
}

export type MaterialQualityQuantizationRecord = {
  materialKey?: string;
  materialName?: string;
  materialId?: string;
  qualityOptions?: number[];
  bands?: Array<{ start: number; end: number; mappedValue: number }>;
};

export function getMaterialQualityQuantizationFromApi(): Promise<MaterialQualityQuantizationRecord[]> {
  return fetchJsonArray<MaterialQualityQuantizationRecord>(
    MATERIAL_QUALITY_QUANTIZATION_URL,
    "material quality quantization",
  );
}

export type MaterialIdentityIndex = {
  materials?: MaterialIdentityRecord[];
  guidLookup?: Record<string, unknown>;
  conflicts?: unknown[];
};

export function getMaterialIdentityIndexFromApi(): Promise<MaterialIdentityIndex> {
  return fetchJsonObject<MaterialIdentityIndex>(
    MATERIAL_IDENTITY_URL,
    "material identity index",
  );
}

export const CRAFTING_REFERENCE_API_URLS = {
  materialQualityQuantization: MATERIAL_QUALITY_QUANTIZATION_URL,
  qualityQuantization: QUALITY_QUANTIZATION_URL,
} as const;
