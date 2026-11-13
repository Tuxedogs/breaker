import type { IncomingMessage, ServerResponse } from "node:http";
import { verifyStagingIsolation } from "../../src/server/staging/isolation.js";

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  response.setHeader("content-type", "application/json");
  response.setHeader("cache-control", "no-store");
  if (request.method !== "GET") {
    response.statusCode = 405;
    response.setHeader("allow", "GET");
    response.end(JSON.stringify({ ready: false }));
    return;
  }
  try {
    response.end(JSON.stringify(await verifyStagingIsolation()));
  } catch {
    response.statusCode = 503;
    response.end(JSON.stringify({ ready: false, error: "Staging isolation is unverified." }));
  }
}
