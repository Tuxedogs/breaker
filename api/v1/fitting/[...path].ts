import type { IncomingMessage, ServerResponse } from "node:http";
import { runFittingApiHandler } from "../../../server/routes/fittingApi.js";

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  await runFittingApiHandler(request, response);
}
