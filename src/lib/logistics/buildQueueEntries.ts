import type { BuildQueueCompletionSnapshot, BuildQueueItem } from "../../types/logistics";

function fallbackUuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function createBuildQueueEntryId(): string {
  return globalThis.crypto?.randomUUID?.() ?? fallbackUuid();
}

export function getActiveBuildQueueEntries(items: BuildQueueItem[]): BuildQueueItem[] {
  return items.filter((item) => item.status !== "complete");
}

export function createBuildQueueCompletionSnapshot(item: BuildQueueItem, completedAt = new Date().toISOString()): BuildQueueCompletionSnapshot {
  return {
    completedAt,
    quantity: item.quantity,
    allowLowerQuality: item.allowLowerQuality,
    finalProductQuality: item.finalProductQuality ? { ...item.finalProductQuality } : undefined,
    finalProductQualityBand: item.finalProductQualityBand,
    finalProductQualityAverage: item.finalProductQualityAverage,
    finalProductRarity: item.finalProductRarity,
    materialRequirements: item.materialRequirements?.map((requirement) => ({ ...requirement })),
    reservedAllocations: item.reservedAllocations?.map((allocation) => ({
      ...allocation,
      rarity: { ...allocation.rarity },
    })),
  };
}

export function getCompletedPresentationItem(item: BuildQueueItem): BuildQueueItem {
  const snapshot = item.completionSnapshot;
  if (item.status !== "complete" || !snapshot) return item;
  return {
    ...item,
    quantity: snapshot.quantity,
    allowLowerQuality: snapshot.allowLowerQuality,
    finalProductQuality: snapshot.finalProductQuality,
    finalProductQualityBand: snapshot.finalProductQualityBand,
    finalProductQualityAverage: snapshot.finalProductQualityAverage,
    finalProductRarity: snapshot.finalProductRarity,
    materialRequirements: snapshot.materialRequirements,
    reservedAllocations: snapshot.reservedAllocations,
  };
}

export function reorderActiveQueueEntries(
  items: BuildQueueItem[],
  queueId: string,
  orderedEntryIds: string[],
): BuildQueueItem[] {
  const activeIds = new Set(
    items.filter((item) => item.queueId === queueId && item.status !== "complete").map((item) => item.id),
  );
  const normalizedIds = [
    ...orderedEntryIds.filter((id, index) => activeIds.has(id) && orderedEntryIds.indexOf(id) === index),
    ...items
      .filter((item) => activeIds.has(item.id) && !orderedEntryIds.includes(item.id))
      .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
      .map((item) => item.id),
  ];
  const priorityById = new Map(normalizedIds.map((id, index) => [id, index + 1]));
  return items.map((item) => priorityById.has(item.id)
    ? { ...item, priority: priorityById.get(item.id), priorityActive: false }
    : item);
}

export function moveActiveQueueEntry(
  items: BuildQueueItem[],
  entryId: string,
  destinationQueueId: string,
  destinationIndex?: number,
): BuildQueueItem[] {
  const moving = items.find((item) => item.id === entryId);
  if (!moving) return items;
  const sourceQueueId = moving.queueId;
  let next = items.map((item) => item.id === entryId
    ? { ...item, queueId: destinationQueueId, status: "queued" as const, priorityActive: false }
    : item);
  if (sourceQueueId) {
    const sourceIds = next
      .filter((item) => item.queueId === sourceQueueId && item.status !== "complete" && item.id !== entryId)
      .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
      .map((item) => item.id);
    next = reorderActiveQueueEntries(next, sourceQueueId, sourceIds);
  }
  const destinationIds = next
    .filter((item) => item.queueId === destinationQueueId && item.status !== "complete" && item.id !== entryId)
    .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
    .map((item) => item.id);
  destinationIds.splice(Math.max(0, Math.min(destinationIndex ?? destinationIds.length, destinationIds.length)), 0, entryId);
  return reorderActiveQueueEntries(next, destinationQueueId, destinationIds);
}
