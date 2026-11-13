import { randomUUID } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";
import { stagingManifest as manifest } from "../../src/server/staging/manifest";

test("authenticated physical inventory, reservations, reload, account isolation and cleanup", async ({ browser, request }) => {
  // Require checked-in provider audit approval before opening accounts or issuing any mutation.
  expect(manifest.verified, "Provider audit approval is required").toBe(true);
  const origin = manifest.origin;
  expect(process.env.STAGING_BASE_URL, "Exact approved staging origin is required").toBe(origin);
  expect(new URL(origin).protocol).toBe("https:");
  expect(["scintel.app", "www.scintel.app"]).not.toContain(new URL(origin).hostname);
  const probe = await request.get(`${origin}/api/staging/isolation`, { maxRedirects: 0 });
  expect(probe.status(), "Isolation endpoint must verify services before login or writes").toBe(200);
  expect(await probe.json()).toEqual({ ready: true, environment: "staging", candidate: manifest.candidate });
  const stateA = process.env.STAGING_ACCOUNT_A_STATE;
  const stateB = process.env.STAGING_ACCOUNT_B_STATE;
  expect(Boolean(stateA && stateB), "Two manually authorized staging-only login states are required").toBe(true);
  const contextA = await browser.newContext({ storageState: stateA, serviceWorkers: "block" });
  const contextB = await browser.newContext({ storageState: stateB, serviceWorkers: "block" });
  const allowed = new Set([origin, `https://${manifest.supabaseRef}.supabase.co`]);
  for (const context of [contextA, contextB]) {
    await context.route("**/*", route => allowed.has(new URL(route.request().url()).origin) ? route.continue() : route.abort());
  }
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  const sessionKey = `sb-${manifest.supabaseRef}-auth-token`;
  async function loginIdentity(page: Page) {
    const result = await page.evaluate(async ({ sessionKey, authOrigin }) => {
      const session = JSON.parse(localStorage.getItem(sessionKey) ?? "null");
      if (!session?.access_token) return { ok: false, id: null };
      const key = sessionStorage.getItem("breaker-staging-anon-key");
      if (!key) return { ok: false, id: null };
      const response = await fetch(`${authOrigin}/auth/v1/user`, {
        headers: { apikey: key, Authorization: `Bearer ${session.access_token}` }, redirect: "error",
      });
      const user = await response.json();
      return { ok: response.ok && user.identities?.some((identity: { provider: string }) => identity.provider === "discord"), id: user.id };
    }, { sessionKey, authOrigin: `https://${manifest.supabaseRef}.supabase.co` });
    expect(result.ok, "Valid staging Discord session required; never log session data").toBe(true);
    return result.id;
  }
  async function api(page: Page, path: string, method = "GET", body?: unknown) {
    return page.evaluate(async ({ path, method, body, sessionKey }) => {
      const session = JSON.parse(localStorage.getItem(sessionKey) ?? "null");
      if (!session?.access_token) throw new Error("Missing staging login.");
      const response = await fetch(path, { method, redirect: "error", cache: "no-store",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: response.status, data: await response.json() };
    }, { path, method, body, sessionKey });
  }
  const runId = randomUUID();
  console.info(`Synthetic staging verification run: ${runId}`);
  const lotId = randomUUID();
  const itemId = randomUUID();
  const locationLocalId = `staging-location-${runId}`;
  const queueLocalId = `staging-queue-${runId}`;
  let locationId: string | undefined;
  let queueId: string | undefined;
  let attemptedWrite = false;
  const inventory = "/api/user/inventory";
  try {
    await Promise.all([pageA.goto(`${origin}/inventory`), pageB.goto(`${origin}/inventory`)]);
    const anonKey = process.env.STAGING_SUPABASE_ANON_KEY;
    expect(Boolean(anonKey), "Staging public anon key required for live login verification").toBe(true);
    for (const page of [pageA, pageB]) await page.evaluate(key => sessionStorage.setItem("breaker-staging-anon-key", key!), anonKey);
    const idA = await loginIdentity(pageA);
    const idB = await loginIdentity(pageB);
    expect(idA === idB, "Accounts A and B must be different synthetic testers").toBe(false);
    const unauthenticated = await request.get(`${origin}${inventory}`, { maxRedirects: 0 });
    expect(unauthenticated.status()).toBe(401);
    const baseline = await api(pageA, inventory);
    expect(baseline.status).toBe(200);
    expect(baseline.data.buildQueues.length, "Account A must have a baseline queue; server retains at least one queue").toBeGreaterThan(0);
    const baselineB = await api(pageB, inventory);
    expect(baselineB.status).toBe(200);
    expect(baselineB.data.buildQueues.length, "Account B must have a baseline queue before cross-account probes").toBeGreaterThan(0);
    attemptedWrite = true;
    const result = await api(pageA, `${inventory}/sync`, "PUT", {
      locations: [{ id: locationLocalId, name: `Staging ${runId}`, type: "station" }],
      inventoryEntries: [{ id: lotId, recordKind: "box", materialId: "stileron", materialName: "Stileron",
        itemName: "Stileron", itemKind: "refined", unitType: "scu", quantity: 3.25, quality: 937,
        locationId: locationLocalId, notes: `synthetic-staging-${runId}` }],
      buildQueues: [{ id: queueLocalId, name: `Staging ${runId}`, sourceType: "custom" }],
      buildQueue: [{ id: itemId, entryKind: "instance", queueId: queueLocalId, recipeId: `synthetic-${runId}`,
        quantity: 1, status: "active", priority: 1,
        reservedAllocations: [{ id: randomUUID(), inventoryEntryId: lotId, materialId: "stileron", quantityReserved: 1.5, quality: 937, unitType: "scu" }] }],
    });
    expect(result.status).toBe(200);
    await pageA.reload();
    const loaded = await api(pageA, inventory);
    expect(loaded.status).toBe(200);
    const lot = loaded.data.inventoryEntries.find((entry: { id: string }) => entry.id === lotId);
    expect(Boolean(lot), "Physical lot survives browser reload").toBe(true);
    expect(lot.recordKind).toBe("box");
    expect(lot.quantity).toBe(3.25);
    expect(lot.quality).toBe(937);
    locationId = lot.locationId;
    const item = loaded.data.buildQueue.find((entry: { id: string }) => entry.id === itemId);
    expect(Boolean(item), "Reservation owner survives browser reload").toBe(true);
    queueId = item.queueId;
    expect(item.reservedAllocations[0].inventoryEntryId).toBe(lotId);
    expect(item.reservedAllocations[0].quantityReserved).toBe(1.5);
    const other = await api(pageB, inventory);
    expect(other.status).toBe(200);
    expect(other.data.inventoryEntries.some((entry: { id: string }) => entry.id === lotId)).toBe(false);
    expect(other.data.buildQueue.some((entry: { id: string }) => entry.id === itemId)).toBe(false);
    // The unified sync owner must also prevent foreign-ID upserts from changing A's records.
    await api(pageB, `${inventory}/sync`, "PUT", { inventoryEntries: [{ ...lot, quantity: 99 }] });
    await api(pageB, `${inventory}/sync`, "PUT", { buildQueue: [{ ...item, quantity: 99 }] });
    // Account B must be unable to delete account A's exact physical lot or reservation owner.
    await api(pageB, `${inventory}/stacks/${lotId}`, "DELETE");
    await api(pageB, `${inventory}/build-queue-items/${itemId}`, "DELETE");
    const afterAttack = await api(pageA, inventory);
    expect(afterAttack.status).toBe(200);
    expect(afterAttack.data.inventoryEntries.some((entry: { id: string }) => entry.id === lotId)).toBe(true);
    expect(afterAttack.data.buildQueue.some((entry: { id: string }) => entry.id === itemId)).toBe(true);
    expect(afterAttack.data.inventoryEntries.find((entry: { id: string }) => entry.id === lotId)?.quantity).toBe(3.25);
    expect(afterAttack.data.buildQueue.find((entry: { id: string }) => entry.id === itemId)?.quantity).toBe(1);
  } finally {
    try {
      if (attemptedWrite) {
        // Resolve remapped IDs even when the create request timed out after a partial write.
        const state = await api(pageA, inventory);
        expect(state.status, "Cleanup must retrieve the run's IDs").toBe(200);
        locationId ??= state.data.locations.find((entry: { name: string }) => entry.name === `Staging ${runId}`)?.id;
        queueId ??= state.data.buildQueues.find((entry: { name: string }) => entry.name === `Staging ${runId}`)?.id;
        const paths = [`${inventory}/build-queue-items/${itemId}`, ...(queueId ? [`${inventory}/build-queues/${queueId}`] : []),
          `${inventory}/stacks/${lotId}`, ...(locationId ? [`${inventory}/locations/${locationId}`] : [])];
        const cleanupFailures: string[] = [];
        for (const path of paths) {
          try {
            if ((await api(pageA, path, "DELETE")).status !== 200) cleanupFailures.push(path);
          } catch { cleanupFailures.push(path); }
        }
        const cleaned = await api(pageA, inventory);
        expect(cleaned.status).toBe(200);
        expect(cleaned.data.inventoryEntries.some((entry: { id: string }) => entry.id === lotId)).toBe(false);
        expect(cleaned.data.buildQueue.some((entry: { id: string }) => entry.id === itemId)).toBe(false);
        expect(cleaned.data.locations.some((entry: { id: string }) => entry.id === locationId)).toBe(false);
        expect(cleaned.data.buildQueues.some((entry: { id: string }) => entry.id === queueId)).toBe(false);
        expect(cleanupFailures.length, `Run-scoped cleanup had failures; recover using run ${runId}`).toBe(0);
      }
    } finally {
      await Promise.all([contextA.close(), contextB.close()]);
    }
  }
});
