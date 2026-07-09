import { apiUrl } from "@/lib/apiUrl";
import { parseJsonResponse } from "@/lib/safeJson";
import type {
  CraftedPropertyRecord,
  QualityQuantizationRecord,
} from "@/lib/craftingData";

const CRAFTED_PROPERTIES_URL = "/api/crafting/reference/crafted-properties";
const QUALITY_QUANTIZATION_URL = "/api/crafting/reference/quality-quantization";
const MATERIAL_QUALITY_QUANTIZATION_URL = "/api/crafting/reference/material-quality-quantization";
const MATERIAL_IDENTITY_URL = "/api/crafting/reference/material-identity";

const LEGACY_CRAFTED_PROPERTIES_URL = "/api/crafting/crafted_properties.json";
const LEGACY_QUALITY_QUANTIZATION_URL = "/api/crafting/quality_quantization.json";
const LEGACY_MATERIAL_QUALITY_QUANTIZATION_URL = "/api/crafting/material_quality_quantization.json";
const LEGACY_MATERIAL_IDENTITY_URL = "/api/crafting/material_identity_index.json";

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

async function withApiFallback<T>(apiUrlPath: string, legacyUrl: string, label: string): Promise<T> {
  try {
    return await fetchJsonObject<T>(apiUrlPath, label);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn(`[crafting-reference] ${label} API failed; falling back to static JSON.`, error);
    }
    return fetchJsonObject<T>(legacyUrl, `${label} (legacy)`);
  }
}

async function withApiArrayFallback<T>(apiUrlPath: string, legacyUrl: string, label: string): Promise<T[]> {
  try {
    return await fetchJsonArray<T>(apiUrlPath, label);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn(`[crafting-reference] ${label} API failed; falling back to static JSON.`, error);
    }
    return fetchJsonArray<T>(legacyUrl, `${label} (legacy)`);
  }
}

export function getCraftedPropertiesFromApi(): Promise<CraftedPropertyRecord[]> {
  return withApiArrayFallback<CraftedPropertyRecord>(
    CRAFTED_PROPERTIES_URL,
    LEGACY_CRAFTED_PROPERTIES_URL,
    "crafted properties",
  );
}

export function getQualityQuantizationFromApi(): Promise<QualityQuantizationRecord[]> {
  return withApiArrayFallback<QualityQuantizationRecord>(
    QUALITY_QUANTIZATION_URL,
    LEGACY_QUALITY_QUANTIZATION_URL,
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
  return withApiArrayFallback<MaterialQualityQuantizationRecord>(
    MATERIAL_QUALITY_QUANTIZATION_URL,
    LEGACY_MATERIAL_QUALITY_QUANTIZATION_URL,
    "material quality quantization",
  );
}

export type MaterialIdentityIndex = {
  materials?: Array<{ materialKey?: string; sources?: unknown }>;
};

export function getMaterialIdentityIndexFromApi(): Promise<MaterialIdentityIndex> {
  return withApiFallback<MaterialIdentityIndex>(
    MATERIAL_IDENTITY_URL,
    LEGACY_MATERIAL_IDENTITY_URL,
    "material identity index",
  );
}

export const CRAFTING_REFERENCE_API_URLS = {
  materialQualityQuantization: MATERIAL_QUALITY_QUANTIZATION_URL,
  qualityQuantization: QUALITY_QUANTIZATION_URL,
} as const;
