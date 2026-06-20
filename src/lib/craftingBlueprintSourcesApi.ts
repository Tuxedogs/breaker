import { apiUrl } from "@/lib/apiUrl";
import { parseJsonResponse } from "@/lib/safeJson";

const BLUEPRINT_SOURCES_API_URL = "/api/crafting/blueprint-sources";
const BLUEPRINT_SOURCES_INDEX_API_URL = "/api/crafting/blueprint-sources/index";
const BLUEPRINT_SOURCES_BATCH_API_URL = "/api/crafting/blueprint-sources/batch";
const BLUEPRINT_REWARDS_RELEASE_STATE_API_URL = "/api/crafting/blueprint-rewards/release-state";
const BLUEPRINT_REWARDS_MISSIONS_API_URL = "/api/crafting/blueprint-rewards/missions";

export const FALLBACK_BLUEPRINT_SOURCES_URL = "/api/missions/blueprint_reward_sources.json";
export const FALLBACK_MISSION_REWARDS_URL = "/api/missions/mission_blueprint_rewards.json";

const BATCH_GUID_LIMIT = 100;

type BlueprintSourceSlice = {
  blueprintGuid?: string;
  missions?: unknown[];
};

type BlueprintSourcesBatchResponse = {
  byBlueprintGuid?: Record<string, BlueprintSourceSlice>;
};

type BlueprintSourcesIndexResponse = {
  blueprintGuids?: string[];
};

type ReleaseStateResponse = {
  states?: Record<string, boolean>;
};

type MissionCatalogResponse = {
  missions?: unknown[];
};

let releaseStateMapCache: Promise<Map<string, boolean>> | null = null;
let missionRewardsCatalogCache: Promise<unknown[]> | null = null;
let missionDetailMapCache: Promise<Map<string, unknown[]>> | null = null;
let fallbackBlueprintSourcesCache: Promise<Map<string, unknown[]>> | null = null;

function normalizeBlueprintGuid(value: string): string {
  return value.trim().toLowerCase();
}

async function fetchJson<T>(url: string, label: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(url), init);
  const data = await parseJsonResponse<T>(response, { label, url: response.url });
  if (!response.ok) {
    throw new Error(`${label} unavailable: ${response.status}`);
  }
  return data;
}

function chunkValues<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

export async function loadFallbackBlueprintSourceMap(): Promise<Map<string, unknown[]>> {
  if (!fallbackBlueprintSourcesCache) {
    fallbackBlueprintSourcesCache = fetchJson<unknown[]>(
      FALLBACK_BLUEPRINT_SOURCES_URL,
      "fallback blueprint reward sources",
    )
      .then((data) => {
        const map = new Map<string, unknown[]>();
        if (!Array.isArray(data)) return map;
        for (const item of data) {
          if (typeof item !== "object" || item === null) continue;
          const record = item as Record<string, unknown>;
          const blueprintGuid = typeof record.blueprintGuid === "string"
            ? normalizeBlueprintGuid(record.blueprintGuid)
            : "";
          const missions = Array.isArray(record.missions) ? record.missions : [];
          if (blueprintGuid) map.set(blueprintGuid, missions);
        }
        return map;
      })
      .catch(() => new Map());
  }
  return fallbackBlueprintSourcesCache;
}

export async function loadFallbackMissionRewardsCatalog(): Promise<unknown[]> {
  return fetchJson<unknown[]>(FALLBACK_MISSION_REWARDS_URL, "fallback mission blueprint rewards")
    .catch(() => []);
}

export async function loadBlueprintReleaseStateMap(): Promise<Map<string, boolean>> {
  if (!releaseStateMapCache) {
    releaseStateMapCache = fetchJson<ReleaseStateResponse>(
      BLUEPRINT_REWARDS_RELEASE_STATE_API_URL,
      "blueprint reward release state",
    )
      .then((data) => new Map(Object.entries(data.states ?? {})))
      .catch(async () => {
        const raw = await loadFallbackMissionRewardsCatalog();
        const map = new Map<string, boolean>();
        if (!Array.isArray(raw)) return map;
        for (const item of raw) {
          if (typeof item !== "object" || item === null) continue;
          const record = item as Record<string, unknown>;
          const contractId = typeof record.contractId === "string" ? record.contractId : undefined;
          if (!contractId) continue;
          const debugName = typeof record.debugName === "string" ? record.debugName : undefined;
          const title = typeof record.title === "string" ? record.title : undefined;
          const disabled = record.notForRelease === true
            || record.notForRelease === 1
            || record.notForRelease === "1"
            || record.notForRelease === "true"
            || /\bdisabled\b/i.test([debugName, title].filter(Boolean).join(" "));
          map.set(contractId, disabled);
        }
        return map;
      });
  }
  return releaseStateMapCache;
}

export async function loadBlueprintSourceMissions(blueprintGuid: string): Promise<unknown[]> {
  const normalizedGuid = normalizeBlueprintGuid(blueprintGuid);
  if (!normalizedGuid) return [];

  try {
    const data = await fetchJson<BlueprintSourceSlice>(
      `${BLUEPRINT_SOURCES_API_URL}?blueprintGuid=${encodeURIComponent(normalizedGuid)}`,
      "blueprint reward sources",
    );
    return Array.isArray(data.missions) ? data.missions : [];
  } catch {
    const fallbackMap = await loadFallbackBlueprintSourceMap();
    return fallbackMap.get(normalizedGuid) ?? [];
  }
}

export async function loadBlueprintSourceMissionMap(): Promise<Map<string, unknown[]>> {
  if (!missionDetailMapCache) {
    missionDetailMapCache = (async () => {
      try {
        const index = await fetchJson<BlueprintSourcesIndexResponse>(
          BLUEPRINT_SOURCES_INDEX_API_URL,
          "blueprint source index",
        );
        const blueprintGuids = (index.blueprintGuids ?? []).map(normalizeBlueprintGuid).filter(Boolean);
        const map = new Map<string, unknown[]>();

        for (const chunk of chunkValues(blueprintGuids, BATCH_GUID_LIMIT)) {
          const batch = await fetchJson<BlueprintSourcesBatchResponse>(
            BLUEPRINT_SOURCES_BATCH_API_URL,
            "blueprint reward sources batch",
            {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ blueprintGuids: chunk }),
            },
          );
          for (const [guid, slice] of Object.entries(batch.byBlueprintGuid ?? {})) {
            map.set(normalizeBlueprintGuid(guid), Array.isArray(slice.missions) ? slice.missions : []);
          }
        }

        return map;
      } catch {
        return loadFallbackBlueprintSourceMap();
      }
    })();
  }
  return missionDetailMapCache;
}

function isNormalizedMissionCatalogEntry(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.missionId === "string" && Array.isArray(record.rewards);
}

export async function loadBlueprintRewardMissionsCatalog(): Promise<{
  missions: unknown[];
  normalized: boolean;
}> {
  if (!missionRewardsCatalogCache) {
    missionRewardsCatalogCache = fetchJson<MissionCatalogResponse>(
      BLUEPRINT_REWARDS_MISSIONS_API_URL,
      "blueprint reward missions",
    )
      .then((data) => (Array.isArray(data.missions) ? data.missions : []))
      .catch(() => loadFallbackMissionRewardsCatalog());
  }

  const missions = await missionRewardsCatalogCache;
  return {
    missions,
    normalized: missions.length > 0 && missions.every(isNormalizedMissionCatalogEntry),
  };
}