import { and, eq, sql } from "drizzle-orm";

import { getDb } from "../../db/client.js";
import { buildQueueItems, inventoryLocations, inventoryStacks, userSettings } from "../../db/schema.js";

const seedInventoryEntryIds = new Set([
  "inv-1",
  "inv-2",
  "inv-3",
  "inv-4",
  "inv-5",
  "inv-6",
  "inv-7",
  "inv-8",
  "inv-9",
  "inv-10",
  "inv-11",
  "inv-12",
]);

const seedBuildQueueIds = new Set([
  "bq-1",
  "bq-2",
  "bq-3",
  "bq-4",
  "bq-5",
  "bq-6",
]);

type UnknownRecord = Record<string, unknown>;

export type OnlinePersistencePayload = {
  locations?: unknown[];
  inventoryEntries?: unknown[];
  buildQueue?: unknown[];
};

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asJsonObject(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {};
}

function asJsonArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function isUuid(value: string | null | undefined): value is string {
  return Boolean(value?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i));
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function toDateString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value.trim()) return value;
  return new Date().toISOString();
}

function getSnapshotLocalId(value: unknown): string | null {
  const snapshot = asJsonObject(value);
  return asString(snapshot.localId);
}

function isSeedInventoryPayload(input: UnknownRecord) {
  const id = asString(input.id);
  return Boolean(id && seedInventoryEntryIds.has(id));
}

function isSeedInventoryRow(row: typeof inventoryStacks.$inferSelect) {
  return Boolean(getSnapshotLocalId(row.snapshot) && seedInventoryEntryIds.has(getSnapshotLocalId(row.snapshot) as string));
}

function isSeedBuildQueuePayload(input: UnknownRecord) {
  const id = asString(input.id);
  return Boolean(id && seedBuildQueueIds.has(id));
}

function isSeedBuildQueueRow(row: typeof buildQueueItems.$inferSelect) {
  return Boolean(getSnapshotLocalId(row.snapshot) && seedBuildQueueIds.has(getSnapshotLocalId(row.snapshot) as string));
}

function getLocationMetadata(input: UnknownRecord) {
  const id = asString(input.id);
  return {
    localId: id,
    category: asString(input.category),
    original: input,
  };
}

function getLocationType(input: UnknownRecord) {
  return asString(input.type) ?? asString(input.category);
}

function locationMergeKey(input: UnknownRecord) {
  return [
    asString(input.name)?.toLowerCase() ?? "",
    asString(input.system)?.toLowerCase() ?? "",
    getLocationType(input)?.toLowerCase() ?? "",
  ].join("|");
}

function rowLocationMergeKey(row: { name: string; system: string | null; locationType: string | null }) {
  return [row.name.toLowerCase(), row.system?.toLowerCase() ?? "", row.locationType?.toLowerCase() ?? ""].join("|");
}

function stackMergeKey(input: UnknownRecord, locationId: string | null) {
  return [
    asString(input.materialId) ?? "",
    asString(input.catalogItemId) ?? "",
    asString(input.itemName) ?? asString(input.materialName) ?? "",
    asString(input.itemKind) ?? "",
    asString(input.unitType) ?? "",
    locationId ?? "",
    asString(input.container) ?? "",
    asNumber(input.quality)?.toString() ?? "",
    asNumber(input.boxSize)?.toString() ?? "",
    asString(input.importSourceType) ?? "",
    asString(input.importBatchId) ?? "",
    asNumber(input.importRowNumber)?.toString() ?? "",
    asNumber(input.importLotIndex)?.toString() ?? "",
  ].join("|").toLowerCase();
}

function rowStackMergeKey(row: typeof inventoryStacks.$inferSelect) {
  const original = asJsonObject(asJsonObject(row.snapshot).original);
  return [
    row.materialId ?? "",
    row.catalogItemId ?? "",
    row.itemName,
    row.itemKind ?? "",
    row.unitType ?? "",
    row.locationId ?? "",
    row.container ?? "",
    row.quality === null ? "" : Number(row.quality).toString(),
    asNumber(original.boxSize)?.toString() ?? "",
    asString(original.importSourceType) ?? "",
    asString(original.importBatchId) ?? "",
    asNumber(original.importRowNumber)?.toString() ?? "",
    asNumber(original.importLotIndex)?.toString() ?? "",
  ].join("|").toLowerCase();
}

function buildQueueMergeKey(input: UnknownRecord) {
  return [
    asString(input.recipeId) ?? "",
    asString(input.blueprint_id) ?? "",
    asString(input.itemId) ?? "",
  ].join("|").toLowerCase();
}

function rowBuildQueueMergeKey(row: { recipeId: string; blueprintId: string | null; itemId: string | null }) {
  return [row.recipeId, row.blueprintId ?? "", row.itemId ?? ""].join("|").toLowerCase();
}

function remapAllocationIds(allocations: unknown[], inventoryIdMap: Record<string, string>) {
  return allocations.map((allocation) => {
    if (!isRecord(allocation)) return allocation;
    const localInventoryId = asString(allocation.inventoryEntryId);
    return {
      ...allocation,
      inventoryEntryId: localInventoryId ? inventoryIdMap[localInventoryId] ?? localInventoryId : allocation.inventoryEntryId,
    };
  });
}

function mapLocationRow(row: typeof inventoryLocations.$inferSelect) {
  const metadata = asJsonObject(row.metadata);
  return {
    id: row.id,
    name: row.name,
    category: asString(metadata.category) ?? row.locationType ?? undefined,
    system: row.system ?? undefined,
    type: row.locationType ?? undefined,
  };
}

function mapStackRow(row: typeof inventoryStacks.$inferSelect) {
  const snapshot = asJsonObject(row.snapshot);
  return {
    ...(isRecord(snapshot.original) ? snapshot.original : {}),
    id: row.id,
    materialId: row.materialId ?? undefined,
    materialName: row.materialName ?? undefined,
    itemName: row.itemName,
    itemKind: row.itemKind ?? undefined,
    catalogItemId: row.catalogItemId ?? undefined,
    catalogSource: row.catalogSource ?? undefined,
    unitType: row.unitType ?? undefined,
    quality: row.quality === null ? undefined : Number(row.quality),
    qualityBand: row.qualityBand ?? undefined,
    quantity: Number(row.quantity),
    locationId: row.locationId ?? undefined,
    container: row.container ?? undefined,
    notes: row.notes ?? undefined,
    source: row.source ?? undefined,
    sourceHistory: normalizeStringArray(row.sourceHistory),
    valueAUEC: row.valueAuec === null ? undefined : Number(row.valueAuec),
    valueUnit: row.valueUnit ?? undefined,
    valueSource: row.valueSource ?? undefined,
    createdAt: toDateString(row.createdAt),
    updatedAt: toDateString(row.updatedAt),
  };
}

function mapBuildQueueRow(row: typeof buildQueueItems.$inferSelect) {
  const snapshot = asJsonObject(row.snapshot);
  return {
    ...(isRecord(snapshot.original) ? snapshot.original : {}),
    id: row.id,
    recipeId: row.recipeId,
    blueprint_id: row.blueprintId ?? undefined,
    itemId: row.itemId ?? undefined,
    itemName: row.itemName ?? undefined,
    finalProductQualityBand: row.finalProductQualityBand === null ? undefined : Number(row.finalProductQualityBand),
    finalProductQualityAverage: row.finalProductQualityAverage === null ? undefined : Number(row.finalProductQualityAverage),
    finalProductRarity: row.finalProductRarity ?? undefined,
    quantity: row.quantity,
    allowLowerQuality: row.allowLowerQuality,
    priority: row.priority,
    priorityActive: row.priorityActive,
    status: row.status,
    reservedAllocations: asJsonArray(row.reservedAllocations),
    materialRequirements: asJsonArray(row.materialRequirements),
    blueprintSources: asJsonArray(row.blueprintSources),
  };
}

async function getUserSettings(userId: string) {
  const rows = await getDb()
    .select({ settings: userSettings.settings })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);
  return asJsonObject(rows[0]?.settings);
}

async function setUserSettings(userId: string, settings: UnknownRecord) {
  await getDb()
    .insert(userSettings)
    .values({ userId, settings, updatedAt: sql`now()` })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: { settings, updatedAt: sql`now()` },
    });
}

export async function listOnlinePersistenceState(userId: string) {
  const [locations, stacks, queue, settings] = await Promise.all([
    getDb().select().from(inventoryLocations).where(eq(inventoryLocations.userId, userId)).orderBy(inventoryLocations.createdAt),
    getDb().select().from(inventoryStacks).where(eq(inventoryStacks.userId, userId)).orderBy(inventoryStacks.createdAt),
    getDb().select().from(buildQueueItems).where(eq(buildQueueItems.userId, userId)).orderBy(buildQueueItems.priority, buildQueueItems.createdAt),
    getUserSettings(userId),
  ]);

  return {
    locations: locations.map(mapLocationRow),
    inventoryEntries: stacks.filter((row) => !isSeedInventoryRow(row)).map(mapStackRow),
    buildQueue: queue.filter((row) => !isSeedBuildQueueRow(row)).map(mapBuildQueueRow),
    sync: {
      migratedAt: asString(settings.remoteMigratedAt),
      lastSyncedAt: asString(settings.lastSyncedAt),
    },
  };
}

export async function syncOnlinePersistenceState(userId: string, payload: OnlinePersistencePayload) {
  const locationIdMap: Record<string, string> = {};
  const inventoryIdMap: Record<string, string> = {};
  const buildQueueIdMap: Record<string, string> = {};

  const existingLocations = await getDb()
    .select()
    .from(inventoryLocations)
    .where(eq(inventoryLocations.userId, userId));
  const locationsById = new Map(existingLocations.map((row) => [row.id, row]));
  const locationsByLocalId = new Map(existingLocations.flatMap((row) => {
    const localId = getSnapshotLocalId(row.metadata);
    return localId ? [[localId, row] as const] : [];
  }));
  const locationsByMergeKey = new Map(existingLocations.map((row) => [rowLocationMergeKey(row), row]));

  for (const raw of asArray(payload.locations)) {
    if (!isRecord(raw)) continue;
    const localId = asString(raw.id);
    const name = asString(raw.name);
    if (!name) continue;

    const match = (isUuid(localId) ? locationsById.get(localId) : undefined)
      ?? (localId ? locationsByLocalId.get(localId) : undefined)
      ?? locationsByMergeKey.get(locationMergeKey(raw));
    const values = {
      userId,
      name,
      system: asString(raw.system),
      locationType: getLocationType(raw),
      metadata: getLocationMetadata(raw),
      updatedAt: sql`now()`,
    };

    const rows = match
      ? await getDb()
          .update(inventoryLocations)
          .set(values)
          .where(and(eq(inventoryLocations.userId, userId), eq(inventoryLocations.id, match.id)))
          .returning()
      : await getDb().insert(inventoryLocations).values(values).returning();

    const saved = rows[0];
    if (saved && localId) locationIdMap[localId] = saved.id;
  }

  const refreshedLocations = await getDb()
    .select()
    .from(inventoryLocations)
    .where(eq(inventoryLocations.userId, userId));
  const validLocationIds = new Set(refreshedLocations.map((row) => row.id));
  for (const row of refreshedLocations) {
    const localId = getSnapshotLocalId(row.metadata);
    if (localId) locationIdMap[localId] = row.id;
  }

  const existingStacks = await getDb()
    .select()
    .from(inventoryStacks)
    .where(eq(inventoryStacks.userId, userId));
  const stacksById = new Map(existingStacks.map((row) => [row.id, row]));
  const stacksByLocalId = new Map(existingStacks.flatMap((row) => {
    const localId = getSnapshotLocalId(row.snapshot);
    return localId ? [[localId, row] as const] : [];
  }));
  const stacksByMergeKey = new Map(existingStacks.map((row) => [rowStackMergeKey(row), row]));

  for (const raw of asArray(payload.inventoryEntries)) {
    if (!isRecord(raw)) continue;
    if (isSeedInventoryPayload(raw)) continue;
    const localId = asString(raw.id);
    const itemName = asString(raw.itemName) ?? asString(raw.materialName);
    const quantity = asNumber(raw.quantity);
    if (!itemName || quantity === null) continue;

    const rawLocationId = asString(raw.locationId);
    const mappedLocationId = rawLocationId ? locationIdMap[rawLocationId] ?? rawLocationId : null;
    const locationId = mappedLocationId && isUuid(mappedLocationId) && validLocationIds.has(mappedLocationId)
      ? mappedLocationId
      : null;
    const match = (isUuid(localId) ? stacksById.get(localId) : undefined)
      ?? (localId ? stacksByLocalId.get(localId) : undefined)
      ?? stacksByMergeKey.get(stackMergeKey(raw, locationId));
    const matchedStack = match;
    const addingToMatchedLocal = Boolean(matchedStack && localId && getSnapshotLocalId(matchedStack.snapshot) !== localId && !isUuid(localId));
    const nextQuantity = addingToMatchedLocal && matchedStack ? Number(matchedStack.quantity) + quantity : quantity;

    const values = {
      userId,
      locationId,
      materialId: asString(raw.materialId),
      materialName: asString(raw.materialName),
      itemName,
      itemKind: asString(raw.itemKind),
      catalogItemId: asString(raw.catalogItemId) ?? asString(raw.materialId),
      catalogSource: asString(raw.catalogSource),
      unitType: asString(raw.unitType),
      quantity: String(nextQuantity),
      quality: asNumber(raw.quality) === null ? null : String(asNumber(raw.quality)),
      qualityBand: asNumber(raw.qualityBand),
      rarity: asString(asJsonObject(raw.rarity).tier) ?? asString(raw.finalProductRarity),
      container: asString(raw.container),
      notes: asString(raw.notes),
      source: asString(raw.source),
      sourceHistory: normalizeStringArray(raw.sourceHistory),
      valueAuec: asNumber(raw.valueAUEC) === null ? null : String(asNumber(raw.valueAUEC)),
      valueUnit: asString(raw.valueUnit),
      valueSource: asString(raw.valueSource),
      snapshot: { localId, original: raw },
      updatedAt: sql`now()`,
    };

    const rows = match
      ? await getDb()
          .update(inventoryStacks)
          .set(values)
          .where(and(eq(inventoryStacks.userId, userId), eq(inventoryStacks.id, match.id)))
          .returning()
      : await getDb().insert(inventoryStacks).values(values).returning();

    const saved = rows[0];
    if (saved && localId) inventoryIdMap[localId] = saved.id;
  }

  const existingQueue = await getDb()
    .select()
    .from(buildQueueItems)
    .where(eq(buildQueueItems.userId, userId));
  const queueById = new Map(existingQueue.map((row) => [row.id, row]));
  const queueByLocalId = new Map(existingQueue.flatMap((row) => {
    const localId = getSnapshotLocalId(row.snapshot);
    return localId ? [[localId, row] as const] : [];
  }));
  const queueByMergeKey = new Map(existingQueue.map((row) => [rowBuildQueueMergeKey(row), row]));

  for (const raw of asArray(payload.buildQueue)) {
    if (!isRecord(raw)) continue;
    if (isSeedBuildQueuePayload(raw)) continue;
    const localId = asString(raw.id);
    const recipeId = asString(raw.recipeId);
    const quantity = asNumber(raw.quantity);
    if (!recipeId || quantity === null) continue;

    const match = (isUuid(localId) ? queueById.get(localId) : undefined)
      ?? (localId ? queueByLocalId.get(localId) : undefined)
      ?? queueByMergeKey.get(buildQueueMergeKey(raw));
    const reservedAllocations = remapAllocationIds(asJsonArray(raw.reservedAllocations), inventoryIdMap);
    const values = {
      userId,
      recipeId,
      blueprintId: asString(raw.blueprint_id),
      itemId: asString(raw.itemId),
      itemName: asString(raw.itemName),
      quantity: Math.max(1, Math.trunc(quantity)),
      status: asString(raw.status) ?? "queued",
      priority: Math.max(0, Math.trunc(asNumber(raw.priority) ?? 0)),
      priorityActive: asBoolean(raw.priorityActive),
      allowLowerQuality: asBoolean(raw.allowLowerQuality),
      finalProductQualityBand: asNumber(raw.finalProductQualityBand) === null ? null : String(asNumber(raw.finalProductQualityBand)),
      finalProductQualityAverage: asNumber(raw.finalProductQualityAverage) === null ? null : String(asNumber(raw.finalProductQualityAverage)),
      finalProductRarity: asString(raw.finalProductRarity),
      materialRequirements: asJsonArray(raw.materialRequirements),
      reservedAllocations,
      blueprintSources: asJsonArray(raw.blueprintSources),
      snapshot: { localId, original: { ...raw, reservedAllocations } },
      updatedAt: sql`now()`,
    };

    const rows = match
      ? await getDb()
          .update(buildQueueItems)
          .set(values)
          .where(and(eq(buildQueueItems.userId, userId), eq(buildQueueItems.id, match.id)))
          .returning()
      : await getDb().insert(buildQueueItems).values(values).returning();

    const saved = rows[0];
    if (saved && localId) buildQueueIdMap[localId] = saved.id;
  }

  const settings = {
    ...(await getUserSettings(userId)),
    remoteMigratedAt: new Date().toISOString(),
    lastSyncedAt: new Date().toISOString(),
  };
  await setUserSettings(userId, settings);

  return {
    ...(await listOnlinePersistenceState(userId)),
    idMap: {
      locations: locationIdMap,
      inventoryEntries: inventoryIdMap,
      buildQueue: buildQueueIdMap,
    },
  };
}

export async function deleteInventoryStack(userId: string, stackId: string) {
  const existingStacks = await getDb()
    .select()
    .from(inventoryStacks)
    .where(eq(inventoryStacks.userId, userId));
  const match = existingStacks.find((row) => row.id === stackId || getSnapshotLocalId(row.snapshot) === stackId);
  if (!match) return listOnlinePersistenceState(userId);
  await getDb()
    .delete(inventoryStacks)
    .where(and(eq(inventoryStacks.userId, userId), eq(inventoryStacks.id, match.id)));
  return listOnlinePersistenceState(userId);
}

export async function deleteInventoryLocation(userId: string, locationId: string) {
  const existingLocations = await getDb()
    .select()
    .from(inventoryLocations)
    .where(eq(inventoryLocations.userId, userId));
  const match = existingLocations.find((row) => row.id === locationId || getSnapshotLocalId(row.metadata) === locationId);
  if (!match) return listOnlinePersistenceState(userId);

  const referencedStacks = await getDb()
    .select({ id: inventoryStacks.id })
    .from(inventoryStacks)
    .where(and(eq(inventoryStacks.userId, userId), eq(inventoryStacks.locationId, match.id)))
    .limit(1);
  if (referencedStacks.length > 0) {
    throw new TypeError("Location cannot be deleted while inventory stacks reference it.");
  }

  await getDb()
    .delete(inventoryLocations)
    .where(and(eq(inventoryLocations.userId, userId), eq(inventoryLocations.id, match.id)));
  return listOnlinePersistenceState(userId);
}
