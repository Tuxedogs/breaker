import {
  buildSessionExpiredInventorySyncPatch,
  buildSignedOutInventorySyncPatch,
  logInventorySyncDev,
  SESSION_EXPIRED_SYNC_MESSAGE,
} from "../logistics/inventorySyncLifecycle";
import { setBuildQueueAccessToken } from "../userBuildQueuePersistence";
import { setOnlinePersistenceAccessToken } from "../userOnlinePersistence";
import { useLogisticsStore } from "../../stores/logisticsStore";
import { getSupabaseAuthStorageKey, getSupabaseClient, hasSupabaseConfig } from "../supabaseClient";
import {
  isAuthRecoveryFailed,
  isInvalidRefreshTokenError,
  markAuthRecoveryFailed,
  resetAuthRecoveryFailed,
} from "./authRecoveryState";

export { isAuthRecoveryFailed, isInvalidRefreshTokenError, resetAuthRecoveryFailed };
export const SESSION_EXPIRED_MESSAGE = SESSION_EXPIRED_SYNC_MESSAGE;

let clearingInvalidSession = false;

export async function clearInvalidSupabaseSession(): Promise<void> {
  if (!hasSupabaseConfig() || clearingInvalidSession) return;

  clearingInvalidSession = true;
  try {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut({ scope: "local" });
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("[auth] clear invalid session failed", error instanceof Error ? error.message : String(error));
    }
    const storageKey = getSupabaseAuthStorageKey();
    if (storageKey) {
      window.localStorage.removeItem(storageKey);
    }
  } finally {
    clearingInvalidSession = false;
  }
}

export function applyAuthenticatedAuthClearedState(reason: "signed-out" | "session-expired"): void {
  setBuildQueueAccessToken(null);
  setOnlinePersistenceAccessToken(null, null);

  const { inventorySync, clearAuthenticatedLogisticsData, setInventorySync } = useLogisticsStore.getState();
  clearAuthenticatedLogisticsData();
  setInventorySync(
    reason === "session-expired"
      ? buildSessionExpiredInventorySyncPatch(inventorySync.hasHydratedPersist)
      : buildSignedOutInventorySyncPatch(inventorySync.hasHydratedPersist),
  );

  logInventorySyncDev("auth cleared", {
    reason,
    clearedVisibleData: true,
    syncError: reason === "session-expired" ? SESSION_EXPIRED_MESSAGE : undefined,
  });
}

export async function handleInvalidRefreshToken(source: string): Promise<boolean> {
  if (isAuthRecoveryFailed()) return false;

  markAuthRecoveryFailed();
  if (import.meta.env.DEV) {
    console.warn("[auth] invalid refresh token", { source });
  }

  await clearInvalidSupabaseSession();
  applyAuthenticatedAuthClearedState("session-expired");
  return true;
}
