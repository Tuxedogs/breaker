import { and, eq, isNull, or, sql } from "drizzle-orm";

import { getDb } from "../../db/client";
import { userBuildQueueItems } from "../../db/schema";

export type BuildQueuePayload = {
  recipeId: string;
  variantId?: string | null;
  quantity?: number;
};

export type DeleteBuildQueuePayload = {
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

function variantWhere(variantId: string) {
  return variantId
    ? eq(userBuildQueueItems.variantId, variantId)
    : or(eq(userBuildQueueItems.variantId, ""), isNull(userBuildQueueItems.variantId));
}

function selectBuildQueueFields() {
  return {
    id: userBuildQueueItems.id,
    recipeId: userBuildQueueItems.recipeId,
    variantId: userBuildQueueItems.variantId,
    quantity: userBuildQueueItems.quantity,
    createdAt: userBuildQueueItems.createdAt,
    updatedAt: userBuildQueueItems.updatedAt,
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
    .from(userBuildQueueItems)
    .where(eq(userBuildQueueItems.userId, userId))
    .orderBy(userBuildQueueItems.createdAt);

  return rows.map(mapBuildQueueItem);
}

export async function addBuildQueueItem(userId: string, payload: BuildQueuePayload) {
  const recipeId = normalizeRecipeId(payload.recipeId);
  if (!recipeId) throw new TypeError("recipeId is required.");

  const quantity = normalizeQuantity(payload.quantity, 1);
  const variantId = toDbVariantId(payload.variantId);
  const existingRows = await getDb()
    .update(userBuildQueueItems)
    .set({
      quantity: sql`${userBuildQueueItems.quantity} + ${quantity}`,
      updatedAt: sql`now()`,
    })
    .where(
      and(
        eq(userBuildQueueItems.userId, userId),
        eq(userBuildQueueItems.recipeId, recipeId),
        variantWhere(variantId),
      ),
    )
    .returning(selectBuildQueueFields());

  if (existingRows[0]) return mapBuildQueueItem(existingRows[0]);

  const rows = await getDb()
    .insert(userBuildQueueItems)
    .values({
      userId,
      recipeId,
      variantId,
      quantity,
      updatedAt: sql`now()`,
    })
    .onConflictDoUpdate({
      target: [
        userBuildQueueItems.userId,
        userBuildQueueItems.recipeId,
        userBuildQueueItems.variantId,
      ],
      set: {
        quantity: sql`${userBuildQueueItems.quantity} + ${quantity}`,
        updatedAt: sql`now()`,
      },
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
    .update(userBuildQueueItems)
    .set({ quantity, updatedAt: sql`now()` })
    .where(
      and(
        eq(userBuildQueueItems.userId, userId),
        eq(userBuildQueueItems.recipeId, recipeId),
        variantWhere(variantId),
      ),
    )
    .returning(selectBuildQueueFields());

  return rows[0] ? mapBuildQueueItem(rows[0]) : null;
}

export async function deleteBuildQueueItem(userId: string, payload: DeleteBuildQueuePayload) {
  const recipeId = normalizeRecipeId(payload.recipeId);
  if (!recipeId) throw new TypeError("recipeId is required.");

  await getDb()
    .delete(userBuildQueueItems)
    .where(
      and(
        eq(userBuildQueueItems.userId, userId),
        eq(userBuildQueueItems.recipeId, recipeId),
        variantWhere(toDbVariantId(payload.variantId)),
      ),
    );
}

export async function clearBuildQueue(userId: string) {
  await getDb()
    .delete(userBuildQueueItems)
    .where(eq(userBuildQueueItems.userId, userId));
}
