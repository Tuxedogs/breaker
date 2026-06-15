import { and, eq, sql } from "drizzle-orm";

import { getDb } from "../../db/client";
import { buildQueueItems } from "../../db/schema";

export type BuildQueuePayload = {
  recipeId: string;
  variantId?: string | null;
  quantity?: number;
};

export type DeleteBuildQueuePayload = {
  id?: string | null;
  recipeId?: string | null;
  variantId?: string | null;
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
  const existingRows = await getDb()
    .update(buildQueueItems)
    .set({
      quantity: sql`${buildQueueItems.quantity} + ${quantity}`,
      updatedAt: sql`now()`,
    })
    .where(
      and(
        eq(buildQueueItems.userId, userId),
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
  const quantity = Math.trunc(payload.quantity);
  const rows = await getDb()
    .update(buildQueueItems)
    .set({ quantity, updatedAt: sql`now()` })
    .where(
      and(
        eq(buildQueueItems.userId, userId),
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

  await getDb()
    .delete(buildQueueItems)
    .where(
      and(
        eq(buildQueueItems.userId, userId),
        eq(buildQueueItems.recipeId, recipeId),
        eq(buildQueueItems.blueprintId, toDbVariantId(payload.variantId)),
      ),
    );
}

export async function clearBuildQueue(userId: string) {
  await getDb()
    .delete(buildQueueItems)
    .where(eq(buildQueueItems.userId, userId));
}
