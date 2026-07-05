import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AuthApiError } from "@supabase/supabase-js";

import {
  isInvalidRefreshTokenError,
  resetAuthRecoveryFailed,
} from "../../src/lib/auth/authRecoveryState";
import {
  buildSessionExpiredInventorySyncPatch,
  buildSignedOutInventorySyncPatch,
  SESSION_EXPIRED_SYNC_MESSAGE,
} from "../../src/lib/logistics/inventorySyncLifecycle";
import {
  getInventoryMutationBlockReason,
} from "../../src/lib/logistics/inventoryFreshness";

describe("auth session recovery", () => {
  it("detects invalid refresh token AuthApiError messages", () => {
    const error = new AuthApiError("Invalid Refresh Token: Refresh Token Not Found", 400);
    assert.equal(isInvalidRefreshTokenError(error), true);
  });

  it("detects revoked and expired refresh token messages", () => {
    assert.equal(isInvalidRefreshTokenError(new Error("Refresh token revoked")), true);
    assert.equal(isInvalidRefreshTokenError(new Error("refresh token expired")), true);
  });

  it("ignores unrelated auth errors", () => {
    assert.equal(isInvalidRefreshTokenError(new Error("Invalid login credentials")), false);
    assert.equal(isInvalidRefreshTokenError(null), false);
  });

  it("builds session-expired inventory sync patch", () => {
    const patch = buildSessionExpiredInventorySyncPatch(true);
    assert.equal(patch.status, "idle");
    assert.equal(patch.loadedForUserId, null);
    assert.equal(patch.lastSuccessfulSyncAt, null);
    assert.equal(patch.hasFetchedServerInventory, false);
    assert.equal(patch.syncError, SESSION_EXPIRED_SYNC_MESSAGE);
    assert.equal(patch.hasHydratedPersist, true);
  });

  it("signed-out patch clears sync authority without session-expired message", () => {
    const patch = buildSignedOutInventorySyncPatch(true);
    assert.equal(patch.syncError, undefined);
    assert.equal(patch.loadedForUserId, null);
    assert.equal(patch.hasFetchedServerInventory, false);
  });

  it("blocks inventory mutation when session expired sync state is active", () => {
    const sync = {
      ...buildSessionExpiredInventorySyncPatch(true),
      hasHydratedPersist: true,
    };
    assert.ok(getInventoryMutationBlockReason(sync, null, { hasAccessToken: false, hasHydratedPersist: true }));
  });
});

describe("auth recovery guard reset", () => {
  it("resetAuthRecoveryFailed is callable after failure flag", () => {
    resetAuthRecoveryFailed();
    assert.doesNotThrow(() => resetAuthRecoveryFailed());
  });
});
