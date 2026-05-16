import { and, eq, sql } from "drizzle-orm";

import { getDb } from "../../db/client";
import { userSavedBlueprints } from "../../db/schema";

export type SaveBlueprintPayload = {
  blueprintId: string;
  faction?: string | null;
  itemName?: string | null;
  sourceType?: string | null;
};

export function normalizeBlueprintId(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function listSavedBlueprints(userId: string) {
  return getDb()
    .select({
      id: userSavedBlueprints.id,
      blueprintId: userSavedBlueprints.blueprintId,
      faction: userSavedBlueprints.faction,
      itemName: userSavedBlueprints.itemName,
      sourceType: userSavedBlueprints.sourceType,
      createdAt: userSavedBlueprints.createdAt,
      updatedAt: userSavedBlueprints.updatedAt,
    })
    .from(userSavedBlueprints)
    .where(eq(userSavedBlueprints.userId, userId))
    .orderBy(userSavedBlueprints.createdAt);
}

export async function saveBlueprint(userId: string, payload: SaveBlueprintPayload) {
  const blueprintId = normalizeBlueprintId(payload.blueprintId);
  if (!blueprintId) {
    throw new TypeError("blueprintId is required.");
  }

  await getDb()
    .insert(userSavedBlueprints)
    .values({
      userId,
      blueprintId,
      faction: normalizeOptionalString(payload.faction),
      itemName: normalizeOptionalString(payload.itemName),
      sourceType: normalizeOptionalString(payload.sourceType) ?? "blueprint",
      updatedAt: sql`now()`,
    })
    .onConflictDoUpdate({
      target: [userSavedBlueprints.userId, userSavedBlueprints.blueprintId],
      set: {
        faction: normalizeOptionalString(payload.faction),
        itemName: normalizeOptionalString(payload.itemName),
        sourceType: normalizeOptionalString(payload.sourceType) ?? "blueprint",
        updatedAt: sql`now()`,
      },
    });
}

export async function deleteSavedBlueprint(userId: string, blueprintId: string) {
  const normalizedBlueprintId = normalizeBlueprintId(blueprintId);
  if (!normalizedBlueprintId) {
    throw new TypeError("blueprintId is required.");
  }

  await getDb()
    .delete(userSavedBlueprints)
    .where(
      and(
        eq(userSavedBlueprints.userId, userId),
        eq(userSavedBlueprints.blueprintId, normalizedBlueprintId),
      ),
    );
}
