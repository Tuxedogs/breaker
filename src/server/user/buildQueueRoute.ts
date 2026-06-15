import { AuthError, requireAuthenticatedUser } from "../auth/requireDiscordUserId.js";
import {
  addBuildQueueItem,
  clearBuildQueue,
  deleteBuildQueueItem,
  listBuildQueueItems,
  normalizeQuantity,
  normalizeRecipeId,
  normalizeVariantId,
  updateBuildQueueItem,
} from "./buildQueueService.js";

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

export async function handleUserBuildQueueRoute(
  method: string,
  headers: HeaderBag,
  body: unknown,
): Promise<RouteResult> {
  try {
    if (!["GET", "POST", "PATCH", "DELETE"].includes(method)) {
      return safeError(405, "Method not allowed.");
    }

    const { userId } = await requireAuthenticatedUser(headers);

    if (method === "GET") {
      return { status: 200, body: { items: await listBuildQueueItems(userId) } };
    }

    if (method === "POST") {
      if (!isRecord(body)) return safeError(400, "Invalid request body.");
      const recipeId = normalizeRecipeId(body.recipeId);
      if (!recipeId) return safeError(400, "recipeId is required.");

      const item = await addBuildQueueItem(userId, {
        recipeId,
        variantId: normalizeVariantId(body.variantId),
        quantity: normalizeQuantity(body.quantity, 1),
      });
      return { status: 200, body: item ? { item } : { ok: true } };
    }

    if (method === "PATCH") {
      if (!isRecord(body)) return safeError(400, "Invalid request body.");
      const recipeId = normalizeRecipeId(body.recipeId);
      if (!recipeId) return safeError(400, "recipeId is required.");

      const item = await updateBuildQueueItem(userId, {
        recipeId,
        variantId: normalizeVariantId(body.variantId),
        quantity: body.quantity as number,
      });
      return { status: 200, body: item ? { item } : { ok: true } };
    }

    if (method === "DELETE") {
      if (!isRecord(body)) return safeError(400, "Invalid request body.");
      if (body.clearAll === true) {
        await clearBuildQueue(userId);
        return { status: 200, body: { ok: true } };
      }

      const recipeId = normalizeRecipeId(body.recipeId);
      const id = normalizeRecipeId(body.id);
      if (!recipeId && !id) return safeError(400, "id or recipeId is required.");
      await deleteBuildQueueItem(userId, {
        id,
        recipeId,
        variantId: normalizeVariantId(body.variantId),
      });
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
    return safeError(500, "Database request failed.");
  }
}
