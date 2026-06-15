export const onlineSyncStatusEvent = "scintel:online-sync-status";
export const remoteMigratedAtKey = "scintel_remote_migrated_at";
const lastSyncedAtKey = "scintel_remote_last_synced_at";
const lastSyncErrorKey = "scintel_remote_last_sync_error";

export type OnlineSyncStatus = {
  remoteConnected: boolean;
  migratedAt: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
};

function storageGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // ignore storage failures
  }
}

export function getOnlineSyncStatus(): OnlineSyncStatus {
  return {
    remoteConnected: Boolean(storageGet(lastSyncedAtKey)),
    migratedAt: storageGet(remoteMigratedAtKey),
    lastSyncedAt: storageGet(lastSyncedAtKey),
    lastError: storageGet(lastSyncErrorKey),
  };
}

export function setOnlineSyncStatus(input: Partial<OnlineSyncStatus>) {
  if ("migratedAt" in input) storageSet(remoteMigratedAtKey, input.migratedAt ?? null);
  if ("lastSyncedAt" in input) storageSet(lastSyncedAtKey, input.lastSyncedAt ?? null);
  if ("lastError" in input) storageSet(lastSyncErrorKey, input.lastError ?? null);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(onlineSyncStatusEvent));
  }
}

export function getUserRemoteMigratedAtKey(userId: string) {
  return `${remoteMigratedAtKey}:${userId}`;
}
