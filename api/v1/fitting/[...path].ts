import type { IncomingMessage, ServerResponse } from "node:http";

import { runFittingApiHandler } from "../../../server/routes/fittingApi.js";

function removeVercelCatchAllPathQuery(request: IncomingMessage): void {
  if (!request.url) return;
  const url = new URL(request.url, "http://localhost");
  if (!url.searchParams.has("path")) return;
  url.searchParams.delete("path");
  request.url = `${url.pathname}${url.search}${url.hash}`;
}

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  removeVercelCatchAllPathQuery(request);
  await runFittingApiHandler(request, response);
}
