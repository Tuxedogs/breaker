import { apiUrl } from "./apiUrl";

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

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data?.error === "string" ? data.error : `Request failed: ${response.status}`;
    throw new Error(message);
  }
  return data as T;
}

export async function fetchSavedBlueprints(accessToken: string): Promise<SavedBlueprint[]> {
  const response = await fetch(apiUrl(SAVED_BLUEPRINTS_URL), {
    headers: authHeaders(accessToken),
  });
  const data = await parseJsonResponse<{ savedBlueprints?: SavedBlueprint[] }>(response);
  return Array.isArray(data.savedBlueprints) ? data.savedBlueprints : [];
}

export async function saveUserBlueprint(accessToken: string, payload: SaveBlueprintRequest): Promise<void> {
  const response = await fetch(apiUrl(SAVED_BLUEPRINTS_URL), {
    method: "POST",
    headers: {
      ...authHeaders(accessToken),
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  await parseJsonResponse<{ ok: true }>(response);
}

export async function deleteUserBlueprint(accessToken: string, blueprintId: string): Promise<void> {
  const response = await fetch(apiUrl(SAVED_BLUEPRINTS_URL), {
    method: "DELETE",
    headers: {
      ...authHeaders(accessToken),
      "content-type": "application/json",
    },
    body: JSON.stringify({ blueprintId }),
  });
  await parseJsonResponse<{ ok: true }>(response);
}
