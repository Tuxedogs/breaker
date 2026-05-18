import { apiUrl } from "./apiUrl";
import { parseJsonResponse, type JsonParseOptions } from "./safeJson";

const BLUEPRINT_TRACKER_URL = "/api/user/blueprint-tracker";

export type UserBlueprintTrackerState = {
  completedMissionIds: string[];
  acquiredBlueprintIds: string[];
  pinnedMissionIds: string[];
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

export async function fetchUserBlueprintTrackerState(accessToken: string): Promise<UserBlueprintTrackerState | null> {
  const url = apiUrl(BLUEPRINT_TRACKER_URL);
  const response = await fetch(url, {
    headers: authHeaders(accessToken),
  });
  if (response.status === 401) return null;
  const data = await parseUserJsonResponse<{ state?: UserBlueprintTrackerState }>(response, {
    label: "blueprint tracker state",
    url,
  });
  return data.state ?? null;
}

export async function saveUserBlueprintTrackerState(
  accessToken: string,
  state: UserBlueprintTrackerState,
): Promise<void> {
  const url = apiUrl(BLUEPRINT_TRACKER_URL);
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      ...authHeaders(accessToken),
      "content-type": "application/json",
    },
    body: JSON.stringify(state),
  });
  await parseUserJsonResponse<{ state?: UserBlueprintTrackerState }>(response, {
    label: "save blueprint tracker state",
    url,
  });
}
