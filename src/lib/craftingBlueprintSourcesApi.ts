import { apiUrl } from "@/lib/apiUrl";
import { parseJsonResponse } from "@/lib/safeJson";
import { normalizeBlueprintGuid } from "@/lib/crafting/blueprintEligibility";

const BLUEPRINT_SOURCES_API_URL = "/api/crafting/blueprint-sources";
const BLUEPRINT_SOURCES_INDEX_API_URL = "/api/crafting/blueprint-sources/index";
const BLUEPRINT_SOURCES_BATCH_API_URL = "/api/crafting/blueprint-sources/batch";
const BLUEPRINT_REWARDS_RELEASE_STATE_API_URL = "/api/crafting/blueprint-rewards/release-state";
const BLUEPRINT_REWARDS_MISSIONS_API_URL = "/api/crafting/blueprint-rewards/missions";

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
let blueprintSourceGuidSetCache: Promise<Set<string>> | null = null;
let eligibleMissionOfferKeysCache: Promise<Set<string>> | null = null;

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

export async function loadBlueprintReleaseStateMap(): Promise<Map<string, boolean>> {
  if (!releaseStateMapCache) {
    releaseStateMapCache = fetchJson<ReleaseStateResponse>(
      BLUEPRINT_REWARDS_RELEASE_STATE_API_URL,
      "blueprint reward release state",
    )
      .then((data) => new Map(Object.entries(data.states ?? {})));
  }
  return releaseStateMapCache;
}

export async function loadBlueprintSourceMissions(blueprintGuid: string): Promise<unknown[]> {
  const normalizedGuid = normalizeBlueprintGuid(blueprintGuid);
  if (!normalizedGuid) return [];

  const data = await fetchJson<BlueprintSourceSlice>(
    `${BLUEPRINT_SOURCES_API_URL}?blueprintGuid=${encodeURIComponent(normalizedGuid)}`,
    "blueprint reward sources",
  );
  return Array.isArray(data.missions) ? data.missions : [];
}

/** Canonical set of blueprints which have a source-backed acquisition path. */
export async function loadBlueprintSourceGuidSet(): Promise<Set<string>> {
  if (!blueprintSourceGuidSetCache) {
    blueprintSourceGuidSetCache = fetchJson<BlueprintSourcesIndexResponse>(
      BLUEPRINT_SOURCES_INDEX_API_URL,
      "blueprint source index",
    ).then((index) => new Set((index.blueprintGuids ?? []).map(normalizeBlueprintGuid).filter(Boolean)));
  }
  return blueprintSourceGuidSetCache;
}

export async function loadBlueprintSourceMissionMap(): Promise<Map<string, unknown[]>> {
  if (!missionDetailMapCache) {
    missionDetailMapCache = (async () => {
      const blueprintGuids = Array.from(await loadBlueprintSourceGuidSet());
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
    })();
  }
  return missionDetailMapCache;
}

/** Exact mission-offer keys which reward an eligible Crafting blueprint. */
export async function loadEligibleBlueprintMissionOfferKeys(): Promise<Set<string>> {
  if (!eligibleMissionOfferKeysCache) {
    eligibleMissionOfferKeysCache = loadBlueprintRewardMissionsCatalog().then(({ missions }) => {
      const offerKeys = new Set<string>();
      for (const mission of missions) {
        if (typeof mission !== "object" || mission === null) continue;
        const offerKey = (mission as { offerKey?: unknown }).offerKey;
        if (typeof offerKey === "string" && offerKey.trim()) offerKeys.add(offerKey);
      }
      return offerKeys;
    });
  }
  return eligibleMissionOfferKeysCache;
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
      .then((data) => (Array.isArray(data.missions) ? data.missions : []));
  }

  const missions = await missionRewardsCatalogCache;
  return {
    missions,
    normalized: missions.length > 0 && missions.every(isNormalizedMissionCatalogEntry),
  };
}
