import { useEffect } from "react";

import {
  initialBuildQueue,
  initialInventoryEntries,
  inventoryLocations,
} from "../../data/logistics/seed";
import { useAuthSession } from "../../lib/auth/useAuthSession";
import { getOnlineSyncStatus, remoteMigratedAtKey, setOnlineSyncStatus } from "../../lib/onlineSyncStatus";
import { fetchOnlinePersistenceState, syncOnlinePersistenceState } from "../../lib/userOnlinePersistence";
import { setBuildQueueAccessToken } from "../../lib/userBuildQueuePersistence";
import { useLogisticsStore } from "../../stores/logisticsStore";
import type { BuildQueueItem, InventoryEntry, InventoryLocation } from "../../types/logistics";

const seedLocationIds = new Set(inventoryLocations.map((location) => location.id));
const seedInventoryEntryIds = new Set(initialInventoryEntries.map((entry) => entry.id));
const seedBuildQueueIds = new Set(initialBuildQueue.map((item) => item.id));

function isSeedLocation(location: InventoryLocation) {
  return seedLocationIds.has(location.id);
}

function isSeedInventoryEntry(entry: InventoryEntry) {
  return seedInventoryEntryIds.has(entry.id);
}

function isSeedBuildQueueItem(item: BuildQueueItem) {
  return seedBuildQueueIds.has(item.id);
}

function getUserPlanningPayload() {
  const state = useLogisticsStore.getState();
  const inventoryEntries = state.inventoryEntries.filter((entry) => !isSeedInventoryEntry(entry));
  const buildQueue = state.buildQueue.filter((item) => !isSeedBuildQueueItem(item));
  const referencedLocationIds = new Set(
    inventoryEntries
      .map((entry) => entry.locationId)
      .filter((locationId): locationId is string => Boolean(locationId)),
  );
  return {
    locations: state.locations.filter((location) => !isSeedLocation(location) || referencedLocationIds.has(location.id)),
    inventoryEntries,
    buildQueue,
  };
}

function hasLocalPlanningState() {
  const payload = getUserPlanningPayload();
  return payload.locations.length > 0 || payload.inventoryEntries.length > 0 || payload.buildQueue.length > 0;
}

function getLocalPlanningPayload() {
  return getUserPlanningPayload();
}

function markSynced(migratedAt?: string | null, lastSyncedAt?: string | null) {
  const now = new Date().toISOString();
  setOnlineSyncStatus({
    migratedAt: migratedAt ?? getOnlineSyncStatus().migratedAt ?? now,
    lastSyncedAt: lastSyncedAt ?? now,
    lastError: null,
  });
}

export default function OnlinePersistenceCoordinator() {
  const { session } = useAuthSession();
  const accessToken = session?.access_token ?? null;

  useEffect(() => {
    setBuildQueueAccessToken(null);
    if (!accessToken) return;
    const token = accessToken;

    let cancelled = false;
    let hydrated = false;
    let syncTimer: number | null = null;
    let syncInFlight = false;
    let syncAgain = false;

    async function pushSnapshot() {
      if (!hydrated || cancelled) return;
      if (syncInFlight) {
        syncAgain = true;
        return;
      }

      syncInFlight = true;
      try {
        const result = await syncOnlinePersistenceState(token, getLocalPlanningPayload());
        if (cancelled) return;
        markSynced(result.sync?.migratedAt, result.sync?.lastSyncedAt);
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn("[online-sync] snapshot sync failed", error);
        }
        setOnlineSyncStatus({
          lastError: error instanceof Error ? error.message : String(error),
        });
      } finally {
        syncInFlight = false;
        if (syncAgain && !cancelled) {
          syncAgain = false;
          scheduleSync();
        }
      }
    }

    function scheduleSync() {
      if (syncTimer !== null) {
        window.clearTimeout(syncTimer);
      }
      syncTimer = window.setTimeout(() => {
        syncTimer = null;
        void pushSnapshot();
      }, 900);
    }

    const unsubscribe = useLogisticsStore.subscribe(() => {
      if (!hydrated) return;
      scheduleSync();
    });

    async function hydrate() {
      try {
        const remote = await fetchOnlinePersistenceState(token);
        if (cancelled || !remote) return;

        const migratedAt = window.localStorage.getItem(remoteMigratedAtKey);
        if (!migratedAt && hasLocalPlanningState()) {
          const synced = await syncOnlinePersistenceState(token, getLocalPlanningPayload());
          if (cancelled) return;
          useLogisticsStore.getState().replaceOnlineState({
            locations: synced.locations,
            inventoryEntries: synced.inventoryEntries,
            buildQueue: synced.buildQueue,
          });
          markSynced(synced.sync?.migratedAt, synced.sync?.lastSyncedAt);
        } else {
          useLogisticsStore.getState().replaceOnlineState({
            locations: remote.locations,
            inventoryEntries: remote.inventoryEntries,
            buildQueue: remote.buildQueue,
          });
          markSynced(remote.sync?.migratedAt, remote.sync?.lastSyncedAt);
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn("[online-sync] hydrate failed", error);
        }
        setOnlineSyncStatus({
          lastError: error instanceof Error ? error.message : String(error),
        });
      } finally {
        hydrated = true;
      }
    }

    void hydrate();

    return () => {
      cancelled = true;
      hydrated = false;
      unsubscribe();
      if (syncTimer !== null) window.clearTimeout(syncTimer);
    };
  }, [accessToken]);

  return null;
}
