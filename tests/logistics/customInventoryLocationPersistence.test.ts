import assert from "node:assert/strict";
import test, { before, mock } from "node:test";
import { build } from "esbuild";

type StoreModule = Pick<typeof import("../../src/stores/logisticsStore"), "useLogisticsStore">
  & Pick<typeof import("../../src/lib/userOnlinePersistence"), "setOnlinePersistenceAccessToken">;

let storeModule: StoreModule;

before(async () => {
  const bundle = await build({
    stdin: {
      contents: [
        "export { useLogisticsStore } from './src/stores/logisticsStore';",
        "export { setOnlinePersistenceAccessToken } from './src/lib/userOnlinePersistence';",
      ].join("\n"),
      resolveDir: process.cwd(),
      loader: "ts",
    },
    bundle: true,
    format: "esm",
    platform: "node",
    packages: "bundle",
    write: false,
    define: { "import.meta.env.DEV": "false" },
  });
  storeModule = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0]!.text).toString("base64")}`) as StoreModule;
});

function syncedInventoryState() {
  return {
    status: "synced" as const,
    isFetching: false,
    isSyncing: false,
    loadedForUserId: "user-id",
    lastSuccessfulSyncAt: Date.now(),
    activeRequestId: 1,
    hasUnsyncedChanges: false,
    pendingMutationCount: 0,
    hasHydratedPersist: true,
    hasFetchedServerInventory: true,
  };
}

test("custom location creation is per-user, persistence-first, and adopts the stable server UUID", async () => {
  const useLogisticsStore = storeModule.useLogisticsStore;
  const original = useLogisticsStore.getState();
  const savedId = "4a8600c6-acde-4a24-9ca6-9c3dd942bb99";
  let resolveRequest: ((response: Response) => void) | undefined;
  let requestStartedResolve: (() => void) | undefined;
  const requestStarted = new Promise<void>((resolve) => { requestStartedResolve = resolve; });
  let requestBody: Record<string, unknown> | undefined;

  mock.method(globalThis, "fetch", async (_input: string | URL | Request, init?: RequestInit) => {
    requestBody = JSON.parse(String(init?.body));
    requestStartedResolve?.();
    return new Promise<Response>((resolve) => { resolveRequest = resolve; });
  });
  storeModule.setOnlinePersistenceAccessToken("access-token", "user-id");

  try {
    useLogisticsStore.setState({ locations: [], inventorySync: syncedInventoryState() });
    const create = useLogisticsStore.getState().createCustomInventoryLocationAsync("  Org   Hangar 7  ");
    await requestStarted;

    assert.deepEqual(useLogisticsStore.getState().locations, []);
    const sentLocation = (requestBody?.locations as Array<Record<string, unknown>>)[0];
    assert.equal(sentLocation?.name, "Org Hangar 7");
    assert.equal(sentLocation?.source, "custom");
    assert.equal(sentLocation?.category, "custom");

    const localId = String(sentLocation?.id);
    const savedLocation = { id: savedId, name: "Org Hangar 7", source: "custom", category: "custom" };
    resolveRequest?.(Response.json({
      locations: [savedLocation],
      inventoryEntries: [],
      buildQueues: [],
      buildQueue: [],
      idMap: { locations: { [localId]: savedId } },
    }));

    const created = await create;
    assert.deepEqual(created, savedLocation);
    assert.deepEqual(useLogisticsStore.getState().locations, [savedLocation]);
  } finally {
    storeModule.setOnlinePersistenceAccessToken(null, null);
    mock.restoreAll();
    useLogisticsStore.setState(original, true);
  }
});

test("failed custom location persistence does not add a local destination", async () => {
  const useLogisticsStore = storeModule.useLogisticsStore;
  const original = useLogisticsStore.getState();
  mock.method(globalThis, "fetch", async () => Response.json({ error: "Location unavailable" }, { status: 503 }));
  storeModule.setOnlinePersistenceAccessToken("access-token", "user-id");

  try {
    useLogisticsStore.setState({ locations: [], inventorySync: syncedInventoryState() });
    await assert.rejects(
      useLogisticsStore.getState().createCustomInventoryLocationAsync("Org Hangar 7"),
      /Location unavailable/,
    );
    assert.deepEqual(useLogisticsStore.getState().locations, []);
  } finally {
    storeModule.setOnlinePersistenceAccessToken(null, null);
    mock.restoreAll();
    useLogisticsStore.setState(original, true);
  }
});
