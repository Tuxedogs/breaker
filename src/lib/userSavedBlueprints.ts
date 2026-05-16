import { apiUrl } from "./apiUrl";
import { parseJsonResponse, type JsonParseOptions } from "./safeJson";

const SAVED_BLUEPRINTS_URL = "/api/user/saved-blueprints";

export type SavedBlueprint = {
  id: string;
  blueprintId: string;
  faction: string | null;
  itemName: string | null;
  sourceType: string | null;
  createdAt: string | Date | null;
  updatedAt: string | Date | null;
};

export type SaveBlueprintRequest = {
  blueprintId: string;
  faction?: string | null;
  itemName?: string | null;
  sourceType?: string | null;
};

function authHeaders(accessToken: string) {
  return {
    authorization: `Bearer ${accessToken}`,
  };
}

async function parseUserJsonResponse<T>(response: Response, options: JsonParseOptions): Promise<T> {
  const data = await parseJsonResponse<Record<string, unknown>>(response, options);
  if (!response.ok) {
    const message = typeof data?.error === "string" ? data.error : `Request failed: ${response.status}`;
    throw new Error(message);
  }
  return data as T;
}

export async function fetchSavedBlueprints(accessToken: string): Promise<SavedBlueprint[]> {
  const url = apiUrl(SAVED_BLUEPRINTS_URL);
  const response = await fetch(url, {
    headers: authHeaders(accessToken),
  });
  if (response.status === 401) return [];
  const data = await parseUserJsonResponse<{ savedBlueprints?: SavedBlueprint[] }>(response, {
    label: "saved blueprints",
    url,
  });
  return Array.isArray(data.savedBlueprints) ? data.savedBlueprints : [];
}

export async function saveUserBlueprint(accessToken: string, payload: SaveBlueprintRequest): Promise<void> {
  const url = apiUrl(SAVED_BLUEPRINTS_URL);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...authHeaders(accessToken),
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  await parseUserJsonResponse<{ ok: true }>(response, { label: "save blueprint", url });
}

export async function deleteUserBlueprint(accessToken: string, blueprintId: string): Promise<void> {
  const url = apiUrl(SAVED_BLUEPRINTS_URL);
  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      ...authHeaders(accessToken),
      "content-type": "application/json",
    },
    body: JSON.stringify({ blueprintId }),
  });
  await parseUserJsonResponse<{ ok: true }>(response, { label: "delete blueprint", url });
}
