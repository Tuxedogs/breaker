import { eq, sql } from "drizzle-orm";

import { getDb } from "../../db/client.js";
import { userSettings } from "../../db/schema.js";

export type BlueprintTrackerState = {
  completedMissionIds: string[];
  acquiredBlueprintIds: string[];
  pinnedMissionIds: string[];
};

const EMPTY_STATE: BlueprintTrackerState = {
  completedMissionIds: [],
  acquiredBlueprintIds: [],
  pinnedMissionIds: [],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const strings = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
  return Array.from(new Set(strings));
}

export function normalizeBlueprintTrackerState(value: unknown): BlueprintTrackerState {
  const record = isRecord(value) ? value : {};
  return {
    completedMissionIds: normalizeStringList(record.completedMissionIds),
    acquiredBlueprintIds: normalizeStringList(record.acquiredBlueprintIds),
    pinnedMissionIds: normalizeStringList(record.pinnedMissionIds),
  };
}

function getBlueprintTrackerSettings(settings: unknown): BlueprintTrackerState {
  const record = isRecord(settings) ? settings : {};
  return normalizeBlueprintTrackerState(record.blueprintTracker);
}

export async function getBlueprintTrackerState(userId: string): Promise<BlueprintTrackerState> {
  const rows = await getDb()
    .select({ settings: userSettings.settings })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  return rows[0] ? getBlueprintTrackerSettings(rows[0].settings) : EMPTY_STATE;
}

export async function saveBlueprintTrackerState(
  userId: string,
  payload: unknown,
): Promise<BlueprintTrackerState> {
  const nextState = normalizeBlueprintTrackerState(payload);
  const existingRows = await getDb()
    .select({ settings: userSettings.settings })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  const existing = isRecord(existingRows[0]?.settings) ? existingRows[0].settings : {};
  const nextSettings = {
    ...existing,
    blueprintTracker: nextState,
  };

  await getDb()
    .insert(userSettings)
    .values({
      userId,
      settings: nextSettings,
      updatedAt: sql`now()`,
    })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: {
        settings: nextSettings,
        updatedAt: sql`now()`,
      },
    });

  return nextState;
}
