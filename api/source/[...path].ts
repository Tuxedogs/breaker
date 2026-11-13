import type { IncomingMessage, ServerResponse } from "node:http";
import { runSourceApiHandler } from "../../server/routes/sourceApi.js";

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  await runSourceApiHandler(request, response);
}
