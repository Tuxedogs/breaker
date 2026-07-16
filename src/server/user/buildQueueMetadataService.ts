import { and, eq } from "drizzle-orm";

import { getDb } from "../../db/client.js";
import { buildQueueItems, buildQueues } from "../../db/schema.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function localIdOf(metadata: unknown): string | null {
  if (!isRecord(metadata)) return null;
  return typeof metadata.localId === "string" && metadata.localId.trim() ? metadata.localId.trim() : null;
}

export async function deleteBuildQueue(userId: string, queueId: string): Promise<void> {
  const queues = await getDb().select().from(buildQueues).where(eq(buildQueues.userId, userId));
  if (queues.length <= 1) throw new TypeError("At least one build queue is required.");
  const match = queues.find((queue) => queue.id === queueId || localIdOf(queue.metadata) === queueId);
  if (!match) return;
  await getDb().transaction(async (tx) => {
    await tx.delete(buildQueueItems).where(and(eq(buildQueueItems.userId, userId), eq(buildQueueItems.queueId, match.id)));
    await tx.delete(buildQueues).where(and(eq(buildQueues.userId, userId), eq(buildQueues.id, match.id)));
  });
}
