import type { BuildQueue, BuildQueueItem, BuildQueueSourceType } from "../../types/logistics";

export const DEFAULT_BUILD_QUEUE_ID = "build-queue-default";
export const DEFAULT_BUILD_QUEUE_NAME = "Default Queue";

export function createDefaultBuildQueue(): BuildQueue {
  return {
    id: DEFAULT_BUILD_QUEUE_ID,
    name: DEFAULT_BUILD_QUEUE_NAME,
    sourceType: "custom",
  };
}

export function normalizeBuildQueueName(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, 80);
}

export function normalizeBuildQueueSourceType(value: unknown): BuildQueueSourceType {
  return value === "fitting" ? "fitting" : "custom";
}

export function normalizeBuildQueueState(input: {
  queues?: BuildQueue[];
  items?: BuildQueueItem[];
  activeQueueId?: string | null;
}): {
  queues: BuildQueue[];
  items: BuildQueueItem[];
  activeQueueId: string;
} {
  const queues = (input.queues ?? []).flatMap((queue) => {
    const id = queue.id?.trim();
    const name = normalizeBuildQueueName(queue.name ?? "");
    if (!id || !name) return [];
    return [{
      ...queue,
      id,
      name,
      sourceType: normalizeBuildQueueSourceType(queue.sourceType),
      sourceReference: queue.sourceReference?.trim() || undefined,
    }];
  });
  const resolvedQueues = queues.length > 0 ? queues : [createDefaultBuildQueue()];
  const queueIds = new Set(resolvedQueues.map((queue) => queue.id));
  const fallbackQueueId = resolvedQueues[0].id;
  const items = (input.items ?? []).map((item) => ({
    ...item,
    queueId: item.queueId && queueIds.has(item.queueId) ? item.queueId : fallbackQueueId,
  }));
  const activeQueueId = input.activeQueueId && queueIds.has(input.activeQueueId)
    ? input.activeQueueId
    : fallbackQueueId;

  return { queues: resolvedQueues, items, activeQueueId };
}

export function createLocalBuildQueueId(): string {
  return `build-queue-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
