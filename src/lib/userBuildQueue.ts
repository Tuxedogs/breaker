import { apiUrl } from "./apiUrl";
import { parseJsonResponse, type JsonParseOptions } from "./safeJson";

const BUILD_QUEUE_URL = "/api/user/build-queue";

export type UserBuildQueueItem = {
  id: string;
  queueId?: string;
  recipeId: string;
  variantId: string | null;
  quantity: number;
  createdAt: string | Date | null;
  updatedAt: string | Date | null;
};

export type BuildQueueItemRequest = {
  id?: string;
  queueId?: string;
  recipeId: string;
  variantId?: string | null;
  quantity?: number;
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

export async function fetchUserBuildQueue(accessToken: string): Promise<UserBuildQueueItem[]> {
  const url = apiUrl(BUILD_QUEUE_URL);
  const response = await fetch(url, {
    headers: authHeaders(accessToken),
  });
  if (response.status === 401) return [];
  const data = await parseUserJsonResponse<{ items?: UserBuildQueueItem[] }>(response, {
    label: "build queue",
    url,
  });
  return Array.isArray(data.items) ? data.items : [];
}

export async function addUserBuildQueueItem(
  accessToken: string,
  payload: BuildQueueItemRequest,
): Promise<UserBuildQueueItem | null> {
  const url = apiUrl(BUILD_QUEUE_URL);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...authHeaders(accessToken),
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await parseUserJsonResponse<{ item?: UserBuildQueueItem; ok?: true }>(response, {
    label: "add build queue item",
    url,
  });
  return data.item ?? null;
}

export async function updateUserBuildQueueItem(
  accessToken: string,
  payload: Required<Pick<BuildQueueItemRequest, "recipeId" | "quantity">> & Pick<BuildQueueItemRequest, "id" | "queueId" | "variantId">,
): Promise<UserBuildQueueItem | null> {
  const url = apiUrl(BUILD_QUEUE_URL);
  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      ...authHeaders(accessToken),
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await parseUserJsonResponse<{ item?: UserBuildQueueItem; ok?: true }>(response, {
    label: "update build queue item",
    url,
  });
  return data.item ?? null;
}

export async function deleteUserBuildQueueItem(
  accessToken: string,
  payload: Pick<BuildQueueItemRequest, "id" | "recipeId" | "variantId">,
): Promise<void> {
  const url = apiUrl(BUILD_QUEUE_URL);
  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      ...authHeaders(accessToken),
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  await parseUserJsonResponse<{ ok: true }>(response, { label: "delete build queue item", url });
}

export async function clearUserBuildQueue(accessToken: string, queueId?: string): Promise<void> {
  const url = apiUrl(BUILD_QUEUE_URL);
  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      ...authHeaders(accessToken),
      "content-type": "application/json",
    },
    body: JSON.stringify({ clearAll: true, queueId }),
  });
  await parseUserJsonResponse<{ ok: true }>(response, { label: "clear build queue", url });
}
