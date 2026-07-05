import { useEffect } from "react";

import { canonicalInventoryLocations } from "../../data/logistics/inventoryLocationCatalog";
import { initialBuildQueue, initialInventoryEntries } from "../../data/logistics/seed";
import { useAuthSession } from "../../lib/auth/useAuthSession";
import { getOnlineSyncStatus, getUserRemoteMigratedAtKey, setOnlineSyncStatus } from "../../lib/onlineSyncStatus";
import {
  buildInventorySyncBeginPatch,
  buildPendingUserSwitchInventorySyncPatch,
  buildSignedOutInventorySyncPatch,
  createInventorySyncRequestId,
  hasMeaningfulLocalInventoryPayload,
  logInventorySyncDev,
  shouldAllowLocalToServerMigrationUpload,
  shouldClearAuthenticatedLogisticsForUser,
} from "../../lib/logistics/inventorySyncLifecycle";
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

async function waitForPersistHydration(timeoutMs = 5_000): Promise<boolean> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (useLogisticsStore.getState().inventorySync.hasHydratedPersist) {
      return true;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 25));
  }
  return useLogisticsStore.getState().inventorySync.hasHydratedPersist;
}

export default function OnlinePersistenceCoordinator() {
  const { session, loading } = useAuthSession();
  const accessToken = session?.access_token ?? null;

  useEffect(() => {
    if (loading) return;
    setBuildQueueAccessToken(accessToken);
    setOnlinePersistenceAccessToken(accessToken);
    if (!accessToken) {
      const { inventorySync, clearAuthenticatedLogisticsData, setInventorySync } = useLogisticsStore.getState();
      clearAuthenticatedLogisticsData();
      setInventorySync(buildSignedOutInventorySyncPatch(inventorySync.hasHydratedPersist));
      logInventorySyncDev("auth cleared", { reason: "signed-out", clearedVisibleData: true });
      return;
    }
    const token = accessToken;
    const userId = session?.user.id;
    if (!userId) return;
    const authenticatedUserId = userId;

    const store = useLogisticsStore.getState();
    const previousUserId = store.inventorySync.loadedForUserId;
    if (shouldClearAuthenticatedLogisticsForUser(previousUserId, authenticatedUserId)) {
      store.clearAuthenticatedLogisticsData();
      store.setInventorySync({
        ...buildPendingUserSwitchInventorySyncPatch(),
        hasHydratedPersist: store.inventorySync.hasHydratedPersist,
      });
      logInventorySyncDev("auth user switched", {
        previousUserId,
        nextUserId: authenticatedUserId,
        clearedVisibleData: true,
      });
    }

    let cancelled = false;
    let hydrated = false;
    let refreshTimer: number | null = null;
    let refreshInFlight = false;
    let refreshAgain = false;

    function applyHydratedState(
      remoteState: {
        locations: InventoryLocation[];
        inventoryEntries: InventoryEntry[];
        buildQueue: BuildQueueItem[];
      },
      requestId: number,
    ) {
      useLogisticsStore.getState().replaceOnlineState(remoteState, {
        userId: authenticatedUserId,
        requestId,
      });
    }

    async function refreshRemoteState() {
      if (!hydrated || cancelled) return;
      if (isOnlinePersistenceMutationInFlight() || refreshInFlight) {
        refreshAgain = true;
        scheduleRefresh();
        return;
      }

      refreshInFlight = true;
      const requestId = createInventorySyncRequestId();
      useLogisticsStore.getState().setInventorySync(
        buildInventorySyncBeginPatch(requestId, authenticatedUserId),
      );
      logInventorySyncDev("coordinator refresh requested", { requestId, userId: authenticatedUserId });

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
        }, requestId);
        markSynced(remote.sync?.migratedAt);
        logInventorySyncDev("coordinator refresh success", {
          requestId,
          inventoryEntryCount: remote.inventoryEntries.length,
        });
      } catch (error) {
        useLogisticsStore.getState().applyInventorySyncFailure(requestId, authenticatedUserId, error);
        setOnlineSyncStatus({
          lastError: error instanceof Error ? error.message : String(error),
        });
        logInventorySyncDev("coordinator refresh failure", {
          requestId,
          message: error instanceof Error ? error.message : String(error),
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
      const persistHydrated = await waitForPersistHydration();
      if (cancelled) return;
      if (!persistHydrated) {
        logInventorySyncDev("coordinator hydrate skipped", { reason: "persist-not-hydrated" });
        return;
      }

      const requestId = createInventorySyncRequestId();
      useLogisticsStore.getState().setInventorySync(
        buildInventorySyncBeginPatch(requestId, authenticatedUserId),
      );
      logInventorySyncDev("coordinator hydrate requested", { requestId, userId: authenticatedUserId });

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
        const localPayload = getUserPlanningPayload();
        const remotePayload = {
          locations: remote.locations,
          inventoryEntries: remote.inventoryEntries,
          buildQueue: remote.buildQueue,
        };
        const shouldUploadLocal = !window.localStorage.getItem(userMigratedAtKey)
          && shouldAllowLocalToServerMigrationUpload(remotePayload, localPayload);

        if (shouldUploadLocal) {
          logInventorySyncDev("coordinator migration upload", {
            requestId,
            inventoryEntryCount: localPayload.inventoryEntries.length,
            buildQueueCount: localPayload.buildQueue.length,
          });
          const synced = await runOnlinePersistenceMutation(() => syncOnlinePersistenceState(token, localPayload));
          if (cancelled) return;
          applyHydratedState({
            locations: synced.locations,
            inventoryEntries: synced.inventoryEntries,
            buildQueue: synced.buildQueue,
          }, requestId);
          window.localStorage.setItem(userMigratedAtKey, synced.sync?.migratedAt ?? new Date().toISOString());
          markSynced(synced.sync?.migratedAt, synced.sync?.lastSyncedAt);
        } else {
          if (
            !hasRemotePlanningState(remote)
            && hasMeaningfulLocalInventoryPayload(localPayload)
            && window.localStorage.getItem(userMigratedAtKey)
          ) {
            logInventorySyncDev("coordinator skipped empty overwrite", {
              requestId,
              reason: "remote-empty-local-present",
            });
          }
          applyHydratedState(remotePayload, requestId);
          if (hasRemotePlanningState(remote)) {
            window.localStorage.setItem(userMigratedAtKey, remote.sync?.migratedAt ?? new Date().toISOString());
          }
          markSynced(remote.sync?.migratedAt);
        }
      } catch (error) {
        useLogisticsStore.getState().applyInventorySyncFailure(requestId, authenticatedUserId, error);
        if (import.meta.env.DEV) {
          console.warn("[online-sync] hydrate failed", error);
        }
        setOnlineSyncStatus({
          lastError: error instanceof Error ? error.message : String(error),
        });
        logInventorySyncDev("coordinator hydrate failure", {
          requestId,
          message: error instanceof Error ? error.message : String(error),
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
