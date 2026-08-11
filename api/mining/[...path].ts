import type { IncomingMessage, ServerResponse } from "node:http";

import { runMiningApiHandler } from "../../server/routes/miningApi.js";

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  await runMiningApiHandler(request, response);
}
