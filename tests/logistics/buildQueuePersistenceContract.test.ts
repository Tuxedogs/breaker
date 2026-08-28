import assert from "node:assert/strict";
import test, { mock } from "node:test";

import {
  persistBuildQueueClear,
  persistBuildQueueDelete,
} from "../../src/lib/userBuildQueuePersistence";
import { setOnlinePersistenceAccessToken } from "../../src/lib/userOnlinePersistence";

const emptyOnlineState = {
  locations: [],
  inventoryEntries: [],
  buildQueues: [],
  buildQueue: [],
  activeBuildQueueId: null,
};

test("delete persists one exact build queue instance through the unified inventory contract", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(input), init });
    return Response.json(emptyOnlineState);
  });
  setOnlinePersistenceAccessToken("access-token", "user-id");

  try {
    await persistBuildQueueDelete({ id: "00000000-0000-4000-8000-000000000001" });

    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, "/api/user/inventory/build-queue-items/00000000-0000-4000-8000-000000000001");
    assert.equal(requests[0].init?.method, "DELETE");
    assert.equal(requests[0].init?.body, undefined);
  } finally {
    setOnlinePersistenceAccessToken(null, null);
    mock.restoreAll();
  }
});

test("clear persists only the selected queue through the unified inventory contract", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(input), init });
    return Response.json(emptyOnlineState);
  });
  setOnlinePersistenceAccessToken("access-token", "user-id");

  try {
    await persistBuildQueueClear("00000000-0000-4000-8000-000000000010");

    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, "/api/user/inventory/build-queues/00000000-0000-4000-8000-000000000010/items");
    assert.equal(requests[0].init?.method, "DELETE");
    assert.equal(requests[0].init?.body, undefined);
  } finally {
    setOnlinePersistenceAccessToken(null, null);
    mock.restoreAll();
  }
});
