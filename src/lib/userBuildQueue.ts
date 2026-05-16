import { apiUrl } from "./apiUrl";

const BUILD_QUEUE_URL = "/api/user/build-queue";

export type UserBuildQueueItem = {
  id: string;
  recipeId: string;
  variantId: string | null;
  quantity: number;
  createdAt: string | Date | null;
  updatedAt: string | Date | null;
};

export type BuildQueueItemRequest = {
  recipeId: string;
  variantId?: string | null;
  quantity?: number;
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

export async function fetchUserBuildQueue(accessToken: string): Promise<UserBuildQueueItem[]> {
  const response = await fetch(apiUrl(BUILD_QUEUE_URL), {
    headers: authHeaders(accessToken),
  });
  const data = await parseJsonResponse<{ items?: UserBuildQueueItem[] }>(response);
  return Array.isArray(data.items) ? data.items : [];
}

export async function addUserBuildQueueItem(
  accessToken: string,
  payload: BuildQueueItemRequest,
): Promise<UserBuildQueueItem | null> {
  const response = await fetch(apiUrl(BUILD_QUEUE_URL), {
    method: "POST",
    headers: {
      ...authHeaders(accessToken),
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await parseJsonResponse<{ item?: UserBuildQueueItem; ok?: true }>(response);
  return data.item ?? null;
}

export async function updateUserBuildQueueItem(
  accessToken: string,
  payload: Required<Pick<BuildQueueItemRequest, "recipeId" | "quantity">> & Pick<BuildQueueItemRequest, "variantId">,
): Promise<UserBuildQueueItem | null> {
  const response = await fetch(apiUrl(BUILD_QUEUE_URL), {
    method: "PATCH",
    headers: {
      ...authHeaders(accessToken),
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await parseJsonResponse<{ item?: UserBuildQueueItem; ok?: true }>(response);
  return data.item ?? null;
}

export async function deleteUserBuildQueueItem(
  accessToken: string,
  payload: Pick<BuildQueueItemRequest, "recipeId" | "variantId">,
): Promise<void> {
  const response = await fetch(apiUrl(BUILD_QUEUE_URL), {
    method: "DELETE",
    headers: {
      ...authHeaders(accessToken),
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  await parseJsonResponse<{ ok: true }>(response);
}

export async function clearUserBuildQueue(accessToken: string): Promise<void> {
  const response = await fetch(apiUrl(BUILD_QUEUE_URL), {
    method: "DELETE",
    headers: {
      ...authHeaders(accessToken),
      "content-type": "application/json",
    },
    body: JSON.stringify({ clearAll: true }),
  });
  await parseJsonResponse<{ ok: true }>(response);
}
