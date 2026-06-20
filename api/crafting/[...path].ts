import type { IncomingMessage, ServerResponse } from "node:http";

import { runCraftingBlueprintSourcesApiHandler } from "../../server/routes/craftingBlueprintSourcesApi.js";

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  await runCraftingBlueprintSourcesApiHandler(request, response);
}