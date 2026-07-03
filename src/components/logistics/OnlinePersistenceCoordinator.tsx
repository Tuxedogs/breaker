import { useEffect } from "react";

import { canonicalInventoryLocations } from "../../data/logistics/inventoryLocationCatalog";
import { initialBuildQueue, initialInventoryEntries } from "../../data/logistics/seed";
import { useAuthSession } from "../../lib/auth/useAuthSession";
import { getOnlineSyncStatus, getUserRemoteMigratedAtKey, setOnlineSyncStatus } from "../../lib/onlineSyncStatus";
import {
  fetchOnlinePersistenceState,
  isOnlinePersistenceMutationInFlight,
  runOnlinePersistenceMutation,
  setOnlinePersistenceAccessToken,
  syncOnlinePersistenceState,
  type OnlinePersistenceState,
} from "../../lib/userOnlinePersistence";
import { setBuildQueueAccessToken } from "../../lib/userBuildQueuePersistence";
import { useLogisticsStore } from "../../stores/logisticsStore";
import type { BuildQueueItem, InventoryEntry, InventoryLocation } from "../../types/logistics";

const seedLocationIds = new Set(canonicalInventoryLocations.map((location) => location.id));
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

function hasRemotePlanningState(remote: OnlinePersistenceState | null) {
  return Boolean(
    remote && (
      remote.locations.length > 0
      || remote.inventoryEntries.length > 0
      || remote.buildQueue.length > 0
      || remote.sync?.migratedAt
    )
  );
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
  const { session, loading } = useAuthSession();
  const accessToken = session?.access_token ?? null;

  useEffect(() => {
    if (loading) return;
    setBuildQueueAccessToken(accessToken);
    setOnlinePersistenceAccessToken(accessToken);
    if (!accessToken) return;
    const token = accessToken;
    const userId = session?.user.id;
    if (!userId) return;
    const authenticatedUserId = userId;

    let cancelled = false;
    let hydrated = false;
    let refreshTimer: number | null = null;
    let refreshInFlight = false;
    let refreshAgain = false;

    function applyHydratedState(remoteState: {
      locations: InventoryLocation[];
      inventoryEntries: InventoryEntry[];
      buildQueue: BuildQueueItem[];
    }) {
      useLogisticsStore.getState().replaceOnlineState(remoteState);
    }

    async function refreshRemoteState() {
      if (!hydrated || cancelled) return;
      if (isOnlinePersistenceMutationInFlight() || refreshInFlight) {
        refreshAgain = true;
        scheduleRefresh();
        return;
      }

      refreshInFlight = true;
      try {
        const remote = await fetchOnlinePersistenceState(token);
        if (cancelled) return;
        if (isOnlinePersistenceMutationInFlight()) {
          refreshAgain = true;
          scheduleRefresh();
          return;
        }
        applyHydratedState({
          locations: remote.locations,
          inventoryEntries: remote.inventoryEntries,
          buildQueue: remote.buildQueue,
        });
        markSynced(remote.sync?.migratedAt);
      } catch (error) {
        setOnlineSyncStatus({
          lastError: error instanceof Error ? error.message : String(error),
        });
      } finally {
        refreshInFlight = false;
        if (refreshAgain && !cancelled) {
          refreshAgain = false;
          scheduleRefresh();
        }
      }
    }

    function scheduleRefresh() {
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null;
        void refreshRemoteState();
      }, 350);
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") scheduleRefresh();
    }

    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) scheduleRefresh();
    }

    async function waitForPendingMutations() {
      while (!cancelled && isOnlinePersistenceMutationInFlight()) {
        await new Promise((resolve) => window.setTimeout(resolve, 50));
      }
    }

    async function hydrate() {
      try {
        let remote = await fetchOnlinePersistenceState(token);
        if (cancelled) return;
        if (isOnlinePersistenceMutationInFlight()) {
          await waitForPendingMutations();
          if (cancelled) return;
          remote = await fetchOnlinePersistenceState(token);
          if (cancelled) return;
        }

        const userMigratedAtKey = getUserRemoteMigratedAtKey(authenticatedUserId);
        if (!hasRemotePlanningState(remote) && !window.localStorage.getItem(userMigratedAtKey) && hasLocalPlanningState()) {
          const localPayload = getUserPlanningPayload();
          const synced = await runOnlinePersistenceMutation(() => syncOnlinePersistenceState(token, localPayload));
          if (cancelled) return;
          applyHydratedState({
            locations: synced.locations,
            inventoryEntries: synced.inventoryEntries,
            buildQueue: synced.buildQueue,
          });
          window.localStorage.setItem(userMigratedAtKey, synced.sync?.migratedAt ?? new Date().toISOString());
          markSynced(synced.sync?.migratedAt, synced.sync?.lastSyncedAt);
        } else {
          applyHydratedState({
            locations: remote.locations,
            inventoryEntries: remote.inventoryEntries,
            buildQueue: remote.buildQueue,
          });
          window.localStorage.setItem(userMigratedAtKey, remote.sync?.migratedAt ?? new Date().toISOString());
          markSynced(remote.sync?.migratedAt);
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
    window.addEventListener("focus", scheduleRefresh);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      cancelled = true;
      hydrated = false;
      setBuildQueueAccessToken(null);
      setOnlinePersistenceAccessToken(null);
      window.removeEventListener("focus", scheduleRefresh);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pageshow", handlePageShow);
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
    };
  }, [accessToken, loading, session?.user.id]);

  return null;
}
