import { and, eq, sql } from "drizzle-orm";

import { getDb } from "../../db/client.js";
import { buildQueueItems, buildQueues } from "../../db/schema.js";

export type BuildQueuePayload = {
  queueId?: string | null;
  recipeId: string;
  variantId?: string | null;
  quantity?: number;
};

export type DeleteBuildQueuePayload = {
  id?: string | null;
  recipeId?: string | null;
  variantId?: string | null;
  queueId?: string | null;
  clearAll?: boolean;
};

export function normalizeRecipeId(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function normalizeVariantId(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function normalizeQuantity(value: unknown, fallback = 1): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.trunc(value));
}

function toDbVariantId(value: unknown): string {
  return normalizeVariantId(value) ?? "";
}

function selectBuildQueueFields() {
  return {
    id: buildQueueItems.id,
    queueId: buildQueueItems.queueId,
    recipeId: buildQueueItems.recipeId,
    variantId: buildQueueItems.blueprintId,
    quantity: buildQueueItems.quantity,
    createdAt: buildQueueItems.createdAt,
    updatedAt: buildQueueItems.updatedAt,
  };
}

function mapBuildQueueItem<T extends { variantId: string | null }>(item: T): T {
  return {
    ...item,
    variantId: item.variantId || null,
  };
}

async function getOrCreateDefaultQueueId(userId: string): Promise<string> {
  const existing = await getDb().select({ id: buildQueues.id }).from(buildQueues)
    .where(eq(buildQueues.userId, userId)).orderBy(buildQueues.createdAt).limit(1);
  if (existing[0]) return existing[0].id;
  const rows = await getDb().insert(buildQueues).values({
    userId,
    name: "Default Queue",
    sourceType: "custom",
  }).returning({ id: buildQueues.id });
  if (!rows[0]) throw new Error("Failed to create default build queue.");
  return rows[0].id;
}

function metadataLocalId(metadata: unknown): string | null {
  if (typeof metadata !== "object" || metadata === null || Array.isArray(metadata)) return null;
  const localId = (metadata as Record<string, unknown>).localId;
  return typeof localId === "string" && localId.trim() ? localId.trim() : null;
}

async function resolveUserQueueId(userId: string, queueId?: string | null): Promise<string> {
  if (!queueId) return getOrCreateDefaultQueueId(userId);
  const queues = await getDb().select().from(buildQueues).where(eq(buildQueues.userId, userId));
  const match = queues.find((queue) => queue.id === queueId || metadataLocalId(queue.metadata) === queueId);
  if (!match) throw new TypeError("Build queue not found.");
  return match.id;
}

export async function listBuildQueueItems(userId: string) {
  const rows = await getDb()
    .select(selectBuildQueueFields())
    .from(buildQueueItems)
    .where(eq(buildQueueItems.userId, userId))
    .orderBy(buildQueueItems.createdAt);

  return rows.map(mapBuildQueueItem);
}

export async function addBuildQueueItem(userId: string, payload: BuildQueuePayload) {
  const recipeId = normalizeRecipeId(payload.recipeId);
  if (!recipeId) throw new TypeError("recipeId is required.");

  const quantity = normalizeQuantity(payload.quantity, 1);
  const variantId = toDbVariantId(payload.variantId);
  const queueId = await resolveUserQueueId(userId, payload.queueId);
  const existingRows = await getDb()
    .update(buildQueueItems)
    .set({
      quantity: sql`${buildQueueItems.quantity} + ${quantity}`,
      updatedAt: sql`now()`,
    })
    .where(
      and(
        eq(buildQueueItems.userId, userId),
        eq(buildQueueItems.queueId, queueId),
        eq(buildQueueItems.recipeId, recipeId),
        eq(buildQueueItems.blueprintId, variantId),
      ),
    )
    .returning(selectBuildQueueFields());

  if (existingRows[0]) return mapBuildQueueItem(existingRows[0]);

  const rows = await getDb()
    .insert(buildQueueItems)
    .values({
      userId,
      queueId,
      recipeId,
      blueprintId: variantId,
      quantity,
      updatedAt: sql`now()`,
    })
    .returning(selectBuildQueueFields());

  return rows[0] ? mapBuildQueueItem(rows[0]) : null;
}

export async function updateBuildQueueItem(userId: string, payload: BuildQueuePayload) {
  const recipeId = normalizeRecipeId(payload.recipeId);
  if (!recipeId) throw new TypeError("recipeId is required.");
  if (typeof payload.quantity !== "number" || !Number.isFinite(payload.quantity) || payload.quantity <= 0) {
    throw new TypeError("quantity must be positive.");
  }

  const variantId = toDbVariantId(payload.variantId);
  const queueId = await resolveUserQueueId(userId, payload.queueId);
  const quantity = Math.trunc(payload.quantity);
  const rows = await getDb()
    .update(buildQueueItems)
    .set({ quantity, updatedAt: sql`now()` })
    .where(
      and(
        eq(buildQueueItems.userId, userId),
        eq(buildQueueItems.queueId, queueId),
        eq(buildQueueItems.recipeId, recipeId),
        eq(buildQueueItems.blueprintId, variantId),
      ),
    )
    .returning(selectBuildQueueFields());

  return rows[0] ? mapBuildQueueItem(rows[0]) : null;
}

export async function deleteBuildQueueItem(userId: string, payload: DeleteBuildQueuePayload) {
  const id = normalizeRecipeId(payload.id);
  if (id) {
    const existingRows = await getDb()
      .select()
      .from(buildQueueItems)
      .where(eq(buildQueueItems.userId, userId));
    const match = existingRows.find((row) => row.id === id || (
      typeof row.snapshot === "object"
      && row.snapshot !== null
      && "localId" in row.snapshot
      && row.snapshot.localId === id
    ));
    if (match) {
      await getDb()
        .delete(buildQueueItems)
        .where(and(eq(buildQueueItems.userId, userId), eq(buildQueueItems.id, match.id)));
      return;
    }
  }

  const recipeId = normalizeRecipeId(payload.recipeId);
  if (!recipeId) throw new TypeError("recipeId is required.");

  const queueId = await resolveUserQueueId(userId, payload.queueId);
  await getDb()
    .delete(buildQueueItems)
    .where(
      and(
        eq(buildQueueItems.userId, userId),
        eq(buildQueueItems.queueId, queueId),
        eq(buildQueueItems.recipeId, recipeId),
        eq(buildQueueItems.blueprintId, toDbVariantId(payload.variantId)),
      ),
    );
}

export async function clearBuildQueue(userId: string, queueId?: string | null) {
  const resolvedQueueId = queueId ? await resolveUserQueueId(userId, queueId) : null;
  const query = getDb()
    .delete(buildQueueItems)
    .where(resolvedQueueId
      ? and(eq(buildQueueItems.userId, userId), eq(buildQueueItems.queueId, resolvedQueueId))
      : eq(buildQueueItems.userId, userId));
  await query;
}
