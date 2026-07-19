import {
  clearUserBuildQueue,
  deleteUserBuildQueueItem,
} from "./userBuildQueue";
import { runOnlinePersistenceMutation, upsertOnlineBuildQueueItem } from "./userOnlinePersistence";
import type { BuildQueueItem } from "../types/logistics";

let currentAccessToken: string | null = null;

export function setBuildQueueAccessToken(accessToken: string | null) {
  currentAccessToken = accessToken;
}

export function hasBuildQueueAccessToken(): boolean {
  return Boolean(currentAccessToken);
}

export function persistBuildQueueItem(item: BuildQueueItem) {
  if (!currentAccessToken) return null;
  return upsertOnlineBuildQueueItem(currentAccessToken, item);
}

export function persistBuildQueueDelete(item: Pick<BuildQueueItem, "id" | "recipeId" | "blueprint_id">) {
  if (!currentAccessToken) return null;
  return runOnlinePersistenceMutation(() => deleteUserBuildQueueItem(currentAccessToken as string, {
    id: item.id,
    recipeId: item.recipeId,
    variantId: item.blueprint_id,
  }));
}

export function persistBuildQueueClear(queueId?: string) {
  if (!currentAccessToken) return null;
  return runOnlinePersistenceMutation(() => clearUserBuildQueue(currentAccessToken as string, queueId));
}
