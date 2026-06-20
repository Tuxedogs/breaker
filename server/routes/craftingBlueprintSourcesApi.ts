import type { IncomingMessage, ServerResponse } from "node:http";

import { handleComponentCardsRoute } from "./componentCards.routes.js";
import { handleCraftingBlueprintSourcesRoute } from "./craftingBlueprintSources.routes.js";

function sendJson(
  response: ServerResponse,
  status: number,
  body: unknown,
  extraHeaders?: Record<string, string>,
) {
  response.statusCode = status;
  response.setHeader("content-type", "application/json");
  for (const [key, value] of Object.entries(extraHeaders ?? {})) {
    response.setHeader(key, value);
  }
  response.end(JSON.stringify(body));
}

async function readRequestBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

export async function runCraftingBlueprintSourcesApiHandler(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const method = request.method ?? "GET";
  const rawUrl = request.url ?? "";

  try {
    let body: unknown = {};
    if (method === "POST") {
      try {
        body = await readRequestBody(request);
      } catch {
        sendJson(response, 400, { error: "Invalid request body." });
        return;
      }
    }

    const componentCardsResult = await handleComponentCardsRoute(method, rawUrl);
    if (componentCardsResult) {
      sendJson(
        response,
        componentCardsResult.status,
        componentCardsResult.body,
        componentCardsResult.status === 405 ? { allow: "GET" } : undefined,
      );
      return;
    }

    const result = await handleCraftingBlueprintSourcesRoute(method, rawUrl, body);
    if (!result) {
      sendJson(response, 404, { error: "Crafting route not found." });
      return;
    }
    sendJson(
      response,
      result.status,
      result.body,
      result.status === 405 ? { allow: "GET, POST" } : undefined,
    );
  } catch (error) {
    console.error("[api/crafting] Unhandled route error.", error);
    sendJson(response, 500, { error: "Crafting blueprint source request failed." });
  }
}