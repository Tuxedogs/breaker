import assert from "node:assert/strict";
import test, { mock } from "node:test";
import type { IncomingMessage, ServerResponse } from "node:http";
import handler from "../../../api/staging/isolation.js";
import { verifyStagingIsolation } from "./isolation.js";
import { getDb } from "../../db/client.js";

test("unverified staging refuses DB access and service verification before network access", async () => {
  const fetchMock = mock.method(globalThis, "fetch", async () => { throw new Error("Unexpected network access"); });
  try {
    assert.throws(() => getDb(), /Staging isolation is unverified/);
    await assert.rejects(verifyStagingIsolation(), /Staging isolation is unverified/);
    assert.equal(fetchMock.mock.callCount(), 0);
  } finally { fetchMock.mock.restore(); }
});

test("readiness returns no-store 503 while isolation is unverified", async () => {
  const headers: Record<string, string> = {};
  let payload = "";
  const response = {
    statusCode: 200,
    setHeader: (key: string, value: string) => { headers[key] = value; },
    end: (body: string) => { payload = body; },
  };
  await handler({ method: "GET" } as IncomingMessage, response as unknown as ServerResponse);
  assert.equal(response.statusCode, 503);
  assert.equal(headers["cache-control"], "no-store");
  assert.deepEqual(JSON.parse(payload), { ready: false, error: "Staging isolation is unverified." });
});
