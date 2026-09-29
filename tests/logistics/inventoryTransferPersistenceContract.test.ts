import assert from "node:assert/strict";
import test, { before, mock } from "node:test";
import { build } from "esbuild";

type StoreModule = Pick<typeof import("../../src/stores/logisticsStore"), "useLogisticsStore" | "createInventoryEntryDraft">
  & Pick<typeof import("../../src/lib/userOnlinePersistence"), "setOnlinePersistenceAccessToken">;

let storeModule: StoreModule;

before(async () => {
  const bundle = await build({
    stdin: {
      contents: [
        "export { useLogisticsStore, createInventoryEntryDraft } from './src/stores/logisticsStore';",
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

const sourceLocation = { id: "source-location", name: "Everus Harbor", type: "station" };
const targetLocation = { id: "target-location", name: "Port Tressler", type: "station" };
const timestamp = "2026-09-29T12:00:00.000Z";
const legendaryRarity = { tier: "legendary", label: "Legendary", colorRgb: [255, 199, 0], colorHex: "#ffc700", colorToken: "legendary" };

function physicalBox() {
  return storeModule.createInventoryEntryDraft({
    id: "00000000-0000-4000-8000-000000000001",
    recordKind: "box",
    materialId: "stileron",
    materialName: "Stileron",
    itemName: "Stileron",
    itemKind: "refined",
    unitType: "scu",
    quantity: 3.25,
    quality: 937,
    locationId: sourceLocation.id,
    rarity: legendaryRarity,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

function aggregateStock() {
  return storeModule.createInventoryEntryDraft({
    id: "legacy-aggregate-stileron",
    recordKind: "aggregate",
    materialId: "stileron",
    materialName: "Stileron",
    itemName: "Stileron",
    itemKind: "refined",
    unitType: "scu",
    quantity: 21,
    quality: 812,
    locationId: sourceLocation.id,
    rarity: legendaryRarity,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

function reservedQueueItem(inventoryEntryId: string) {
  return {
    id: "queue-entry-a",
    entryKind: "instance",
    queueId: "queue-a",
    recipeId: "same-recipe",
    quantity: 1,
    priority: 1,
    status: "active",
    reservedAllocations: [{
      id: "allocation-a",
      inventoryEntryId,
      materialId: "stileron",
      quantityReserved: 1.5,
      quality: 937,
      unitType: "scu",
      rarity: legendaryRarity,
    }],
  };
}

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

test("transfer persists the exact physical box before changing its local location, preserving reservation identity", async () => {
  const useLogisticsStore = storeModule.useLogisticsStore;
  const original = useLogisticsStore.getState();
  let resolveRequest: ((response: Response) => void) | undefined;
  let signalRequestStarted: (() => void) | undefined;
  const requestStarted = new Promise<void>((resolve) => {
    signalRequestStarted = resolve;
  });
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  mock.method(globalThis, "fetch", (input: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(input), init });
    signalRequestStarted?.();
    return new Promise<Response>((resolve) => {
      resolveRequest = resolve;
    });
  });
  storeModule.setOnlinePersistenceAccessToken("access-token", "user-id");

  try {
    const box = physicalBox();
    const queueItem = reservedQueueItem(box.id);
    useLogisticsStore.setState({
      locations: [sourceLocation, targetLocation],
      inventoryEntries: [box],
      inventorySync: syncedInventoryState(),
      buildQueue: [queueItem],
    });

    const transfer = useLogisticsStore.getState().transferInventoryStacksAsync({
      entryIds: [box.id],
      sourceLocationId: sourceLocation.id,
      targetLocationId: targetLocation.id,
    });

    assert.equal(useLogisticsStore.getState().inventoryEntries[0]?.locationId, sourceLocation.id);
    await requestStarted;
    assert.equal(requests.length, 1);
    assert.equal(requests[0]?.url, "/api/user/inventory/sync");
    assert.equal(requests[0]?.init?.method, "PUT");
    assert.equal(requests[0]?.init?.headers && new Headers(requests[0].init.headers).get("authorization"), "Bearer access-token");

    const payload = JSON.parse(String(requests[0]?.init?.body));
    assert.deepEqual(payload.locations, [targetLocation]);
    assert.equal(payload.inventoryEntries[0]?.id, box.id);
    assert.equal(payload.inventoryEntries[0]?.locationId, targetLocation.id);
    assert.equal(payload.inventoryEntries[0]?.quantity, box.quantity);
    assert.equal(payload.inventoryEntries[0]?.quality, box.quality);

    resolveRequest?.(Response.json({ locations: [], inventoryEntries: [], buildQueues: [], buildQueue: [] }));
    const result = await transfer;
    const moved = useLogisticsStore.getState().inventoryEntries[0];
    assert.equal(result.moves[0]?.snapshot.id, box.id);
    assert.equal(moved?.id, box.id);
    assert.equal(moved?.locationId, targetLocation.id);
    assert.equal(moved?.quantity, box.quantity);
    assert.equal(moved?.quality, box.quality);
    assert.deepEqual(useLogisticsStore.getState().buildQueue[0]?.reservedAllocations, queueItem.reservedAllocations);
  } finally {
    storeModule.setOnlinePersistenceAccessToken(null, null);
    mock.restoreAll();
    useLogisticsStore.setState(original, true);
  }
});

test("failed transfer persistence leaves the local physical box unchanged", async () => {
  const useLogisticsStore = storeModule.useLogisticsStore;
  const original = useLogisticsStore.getState();
  mock.method(globalThis, "fetch", async () => Response.json({ error: "Transfer unavailable" }, { status: 503 }));
  storeModule.setOnlinePersistenceAccessToken("access-token", "user-id");

  try {
    const box = physicalBox();
    useLogisticsStore.setState({
      locations: [sourceLocation, targetLocation],
      inventoryEntries: [box],
      inventorySync: syncedInventoryState(),
    });

    const transfer = useLogisticsStore.getState().transferInventoryStacksAsync({
        entryIds: [box.id],
        sourceLocationId: sourceLocation.id,
        targetLocationId: targetLocation.id,
      });
    assert.equal(useLogisticsStore.getState().inventoryEntries[0]?.locationId, sourceLocation.id);
    await assert.rejects(transfer);

    assert.deepEqual(useLogisticsStore.getState().inventoryEntries, [box]);
  } finally {
    storeModule.setOnlinePersistenceAccessToken(null, null);
    mock.restoreAll();
    useLogisticsStore.setState(original, true);
  }
});

test("aggregate transfer moves the supported whole record without manufacturing box identity", async () => {
  const useLogisticsStore = storeModule.useLogisticsStore;
  const original = useLogisticsStore.getState();
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(input), init });
    return Response.json({ locations: [], inventoryEntries: [], buildQueues: [], buildQueue: [] });
  });
  storeModule.setOnlinePersistenceAccessToken("access-token", "user-id");

  try {
    const aggregate = aggregateStock();
    useLogisticsStore.setState({
      locations: [sourceLocation, targetLocation],
      inventoryEntries: [aggregate],
      inventorySync: syncedInventoryState(),
    });

    const result = await useLogisticsStore.getState().transferInventoryStacksAsync({
      entryIds: [aggregate.id],
      sourceLocationId: sourceLocation.id,
      targetLocationId: targetLocation.id,
    });

    assert.equal(requests.length, 1);
    const payload = JSON.parse(String(requests[0]?.init?.body));
    assert.equal(payload.inventoryEntries.length, 1);
    assert.equal(payload.inventoryEntries[0]?.id, aggregate.id);
    assert.equal(payload.inventoryEntries[0]?.recordKind, "aggregate");
    assert.equal(payload.inventoryEntries[0]?.quantity, aggregate.quantity);
    assert.equal(payload.inventoryEntries[0]?.locationId, targetLocation.id);
    assert.equal(payload.inventoryEntries[0]?.container, undefined);
    assert.equal(payload.inventoryEntries[0]?.boxSize, undefined);

    const moved = useLogisticsStore.getState().inventoryEntries[0];
    assert.equal(result.moves[0]?.snapshot.id, aggregate.id);
    assert.equal(moved?.id, aggregate.id);
    assert.equal(moved?.recordKind, "aggregate");
    assert.equal(moved?.quantity, aggregate.quantity);
    assert.equal(moved?.locationId, targetLocation.id);
  } finally {
    storeModule.setOnlinePersistenceAccessToken(null, null);
    mock.restoreAll();
    useLogisticsStore.setState(original, true);
  }
});
