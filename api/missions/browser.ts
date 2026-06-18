import type { IncomingMessage, ServerResponse } from "node:http";

import { runMissionsApiHandler } from "../../server/routes/missionsApi.js";

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  await runMissionsApiHandler(request, response);
}