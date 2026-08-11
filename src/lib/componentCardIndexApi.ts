import { apiUrl } from "@/lib/apiUrl";
import { parseJsonResponse } from "@/lib/safeJson";
import type { ComponentCardIndex, ComponentCardIndexRecord } from "@/lib/componentCardIndex";
import { validateComponentCatalogGeneration } from "@/lib/componentCatalogGeneration";

const COMPONENT_CARDS_INDEX_URL = "/api/crafting/component-cards/index";
const COMPONENT_CARDS_FACETS_URL = "/api/crafting/component-cards/facets";
const COMPONENT_CARDS_BROWSE_URL = "/api/crafting/component-cards/browse";
const COMPONENT_CARD_BY_ID_URL = "/api/crafting/component-cards";

type ComponentCardsIndexResponse = {
  schemaVersion?: number;
  generatedAt?: string;
  sourceGeneratedAt?: string;
  sourceRecordCount?: ComponentCardIndex["sourceRecordCount"];
  shapedRecordCount?: number;
  recordIds?: string[];
};

type ComponentCardsFacetsResponse = {
  schemaVersion?: number;
  generatedAt?: string | null;
  facets?: ComponentCardIndex["facets"];
};

type ComponentCardsBrowseResponse = {
  schemaVersion?: number;
  generatedAt?: string | null;
  recordCount?: number;
  records?: ComponentCardIndexRecord[];
};

let componentCardIndexPromise: Promise<ComponentCardIndex> | null = null;

async function fetchJson<T>(url: string, label: string): Promise<T> {
  const response = await fetch(apiUrl(url));
  const data = await parseJsonResponse<T>(response, { label, url: response.url });
  if (!response.ok) {
    throw new Error(`${label} unavailable: ${response.status}`);
  }
  return data;
}

export async function getComponentCardIndexFromApi(): Promise<ComponentCardIndex> {
  componentCardIndexPromise ??= (async () => {
    try {
      const [index, facetsPayload, browsePayload] = await Promise.all([
        fetchJson<ComponentCardsIndexResponse>(COMPONENT_CARDS_INDEX_URL, "component card index"),
        fetchJson<ComponentCardsFacetsResponse>(COMPONENT_CARDS_FACETS_URL, "component card facets"),
        fetchJson<ComponentCardsBrowseResponse>(COMPONENT_CARDS_BROWSE_URL, "component card browse"),
      ]);

      const records = Array.isArray(browsePayload.records) ? browsePayload.records : [];
      const facets = facetsPayload.facets;
      if (!facets || records.length === 0) {
        throw new Error("Component card API payload is invalid");
      }

      validateComponentCatalogGeneration(
        index.sourceGeneratedAt ?? index.generatedAt,
        facetsPayload,
        browsePayload,
      );

      if (
        typeof index.shapedRecordCount === "number"
        && index.shapedRecordCount > 0
        && records.length !== index.shapedRecordCount
      ) {
        throw new Error(
          `Component card browse count mismatch: expected ${index.shapedRecordCount}, got ${records.length}`,
        );
      }

      return {
        schemaVersion: index.schemaVersion ?? 1,
        generatedAt: index.sourceGeneratedAt ?? index.generatedAt ?? new Date().toISOString(),
        sourceRecordCount: index.sourceRecordCount ?? {
          vehicle: 0,
          fps: 0,
          total: records.length,
        },
        records,
        facets,
      };
    } catch (error) {
      componentCardIndexPromise = null;
      throw error;
    }
  })();

  return componentCardIndexPromise;
}

export async function fetchComponentCardById(id: string): Promise<ComponentCardIndexRecord> {
  const normalizedId = id.trim().toLowerCase();
  if (!normalizedId) {
    throw new Error("Component card id is required.");
  }

  const response = await fetch(apiUrl(`${COMPONENT_CARD_BY_ID_URL}/${encodeURIComponent(normalizedId)}`));
  const data = await parseJsonResponse<ComponentCardIndexRecord>(response, {
    label: "component card by id",
    url: response.url,
  });
  if (!response.ok) {
    const message = typeof data === "object" && data !== null && "error" in data && typeof data.error === "string"
      ? data.error
      : `Component card not found: ${response.status}`;
    throw new Error(message);
  }
  return data;
}

export async function resolveComponentCardById(
  id: string,
  browseFallback?: ComponentCardIndexRecord | null,
): Promise<ComponentCardIndexRecord> {
  const normalizedId = id.trim().toLowerCase();
  if (!normalizedId) {
    if (browseFallback) return browseFallback;
    throw new Error("Component card id is required.");
  }

  try {
    return await fetchComponentCardById(normalizedId);
  } catch (error) {
    if (browseFallback && browseFallback.id.trim().toLowerCase() === normalizedId) {
      if (import.meta.env.DEV) {
        console.warn("[component-card-index] by-id fetch failed; using browse record.", error);
      }
      return browseFallback;
    }
    throw error;
  }
}

export async function getComponentCardIndex(): Promise<ComponentCardIndex> {
  return getComponentCardIndexFromApi();
}

export function clearComponentCardIndexCache(): void {
  componentCardIndexPromise = null;
}
