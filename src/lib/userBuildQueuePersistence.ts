import {
  addUserBuildQueueItem,
  clearUserBuildQueue,
  deleteUserBuildQueueItem,
  updateUserBuildQueueItem,
} from "./userBuildQueue";

let currentAccessToken: string | null = null;

export function setBuildQueueAccessToken(accessToken: string | null) {
  currentAccessToken = accessToken;
}

export function hasBuildQueueAccessToken(): boolean {
  return Boolean(currentAccessToken);
}

export function persistBuildQueueAdd(recipeId: string, quantity: number, variantId?: string | null) {
  if (!currentAccessToken) return null;
  return addUserBuildQueueItem(currentAccessToken, { recipeId, variantId, quantity });
}

export function persistBuildQueueQuantity(recipeId: string, quantity: number, variantId?: string | null) {
  if (!currentAccessToken) return null;
  return updateUserBuildQueueItem(currentAccessToken, { recipeId, variantId, quantity });
}

export function persistBuildQueueDelete(recipeId: string, variantId?: string | null) {
  if (!currentAccessToken) return null;
  return deleteUserBuildQueueItem(currentAccessToken, { recipeId, variantId });
}

export function persistBuildQueueClear() {
  if (!currentAccessToken) return null;
  return clearUserBuildQueue(currentAccessToken);
}
