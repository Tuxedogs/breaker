import { AuthError, requireAuthenticatedUser } from "../auth/requireDiscordUserId.js";
import {
  deleteSavedBlueprint,
  listSavedBlueprints,
  normalizeBlueprintId,
  saveBlueprint,
} from "./savedBlueprintsService.js";

type HeaderValue = string | string[] | undefined;
type HeaderBag = Record<string, HeaderValue> | Headers;

type RouteResult = {
  status: number;
  body: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function safeError(status: number, message: string): RouteResult {
  return { status, body: { error: message } };
}

export async function handleSavedBlueprintsRoute(
  method: string,
  headers: HeaderBag,
  body: unknown,
): Promise<RouteResult> {
  try {
    if (!["GET", "POST", "DELETE"].includes(method)) {
      return safeError(405, "Method not allowed.");
    }

    const { userId } = await requireAuthenticatedUser(headers);

    if (method === "GET") {
      return { status: 200, body: { savedBlueprints: await listSavedBlueprints(userId) } };
    }

    if (method === "POST") {
      if (!isRecord(body)) return safeError(400, "Invalid request body.");
      const blueprintId = normalizeBlueprintId(body.blueprintId);
      if (!blueprintId) return safeError(400, "blueprintId is required.");

      await saveBlueprint(userId, {
        blueprintId,
        faction: typeof body.faction === "string" ? body.faction : null,
        itemName: typeof body.itemName === "string" ? body.itemName : null,
        sourceType: typeof body.sourceType === "string" ? body.sourceType : null,
      });
      return { status: 200, body: { ok: true } };
    }

    if (method === "DELETE") {
      if (!isRecord(body)) return safeError(400, "Invalid request body.");
      const blueprintId = normalizeBlueprintId(body.blueprintId);
      if (!blueprintId) return safeError(400, "blueprintId is required.");

      await deleteSavedBlueprint(userId, blueprintId);
      return { status: 200, body: { ok: true } };
    }

    return safeError(405, "Method not allowed.");
  } catch (error) {
    if (error instanceof AuthError) {
      return safeError(error.status, error.message);
    }
    if (error instanceof TypeError) {
      return safeError(400, error.message);
    }
    console.error("[api/user/saved-blueprints] Database request failed.", error);
    return safeError(500, "Database request failed.");
  }
}
