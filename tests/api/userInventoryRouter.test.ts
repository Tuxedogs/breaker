import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test, { mock } from "node:test";
import type { IncomingMessage, ServerResponse } from "node:http";

import handler from "../../api/user/inventory-router.js";

type CapturedResponse = {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
};

function request(url: string, method: string, body = ""): IncomingMessage {
  const stream = Readable.from(body ? [body] : []) as IncomingMessage;
  stream.url = url;
  stream.method = method;
  stream.headers = {};
  return stream;
}

function response(): { outgoing: ServerResponse; captured: CapturedResponse } {
  const captured: CapturedResponse = { statusCode: 200, headers: {}, body: undefined };
  const outgoing = {
    get statusCode() {
      return captured.statusCode;
    },
    set statusCode(value: number) {
      captured.statusCode = value;
    },
    setHeader(name: string, value: string) {
      captured.headers[name.toLowerCase()] = value;
    },
    end(body?: string) {
      captured.body = body ? JSON.parse(body) : undefined;
    },
  } as ServerResponse;
  return { outgoing, captured };
}

async function invoke(url: string, method: string, body = "") {
  const { outgoing, captured } = response();
  await handler(request(url, method, body), outgoing);
  return captured;
}

test("all explicitly routed inventory paths reach the shared authenticated dispatcher", async () => {
  const routes = [
    ["/api/user/inventory/sync", "PUT", "{}"],
    ["/api/user/inventory/stacks", "POST", "{}"],
    ["/api/user/inventory/stacks/stack%201", "DELETE", ""],
    ["/api/user/inventory/locations/location%201", "DELETE", ""],
    ["/api/user/inventory/build-queues/queue%201", "DELETE", ""],
  ] as const;

  for (const [url, method, body] of routes) {
    const result = await invoke(url, method, body);
    assert.equal(result.statusCode, 401, url);
    assert.deepEqual(result.body, { error: "Authentication required." }, url);
    assert.equal(result.headers["content-type"], "application/json", url);
  }
});

test("rewrite query parameters are ignored", async () => {
  const result = await invoke("/api/user/inventory/sync?path=sync", "PUT", "{}");
  assert.equal(result.statusCode, 401);
  assert.deepEqual(result.body, { error: "Authentication required." });
});

test("unknown nested inventory routes remain unavailable", async () => {
  const result = await invoke("/api/user/inventory/unknown", "GET");
  assert.equal(result.statusCode, 404);
  assert.deepEqual(result.body, { error: "Not found." });
});

test("invalid JSON retains the existing 400 response", async () => {
  mock.method(console, "error", () => undefined);
  const result = await invoke("/api/user/inventory/sync", "PUT", "{");
  assert.equal(result.statusCode, 400);
  assert.deepEqual(result.body, { error: "Invalid request body." });
});

test("malformed encoded IDs retain route-specific 500 responses", async () => {
  mock.method(console, "error", () => undefined);
  const cases = [
    ["/api/user/inventory/stacks/%", "Inventory stack request failed."],
    ["/api/user/inventory/locations/%", "Inventory location request failed."],
    ["/api/user/inventory/build-queues/%", "Build queue request failed."],
  ] as const;

  for (const [url, message] of cases) {
    const result = await invoke(url, "DELETE");
    assert.equal(result.statusCode, 500, url);
    assert.deepEqual(result.body, { error: message }, url);
  }
});
