import {
  clearOnlineBuildQueue,
  deleteOnlineBuildQueueItem,
  getOnlinePersistenceAuth,
  upsertOnlineBuildQueueItem,
} from "./userOnlinePersistence";
import type { BuildQueueItem } from "../types/logistics";

export function hasBuildQueueAccessToken(): boolean {
  return Boolean(getOnlinePersistenceAuth().accessToken);
}

export function persistBuildQueueItem(item: BuildQueueItem) {
  const { accessToken } = getOnlinePersistenceAuth();
  return accessToken ? upsertOnlineBuildQueueItem(accessToken, item) : null;
}

export function persistBuildQueueDelete(item: Pick<BuildQueueItem, "id">) {
  const { accessToken } = getOnlinePersistenceAuth();
  return accessToken ? deleteOnlineBuildQueueItem(accessToken, item.id) : null;
}

export function persistBuildQueueClear(queueId?: string) {
  const { accessToken } = getOnlinePersistenceAuth();
  return accessToken && queueId ? clearOnlineBuildQueue(accessToken, queueId) : null;
}
