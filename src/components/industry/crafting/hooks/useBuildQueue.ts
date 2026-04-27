import { useState, useCallback } from "react";
import type { BuildQueueItem } from "../utils/craftingTypes";
import { loadBuildQueue, saveBuildQueue } from "../utils/craftingStorage";

export function useBuildQueue() {
  const [queue, setQueue] = useState<BuildQueueItem[]>(loadBuildQueue);

  const persist = useCallback((next: BuildQueueItem[]) => {
    setQueue(next);
    saveBuildQueue(next);
  }, []);

  const addItem = useCallback(
    (item: Omit<BuildQueueItem, "quantity">) => {
      setQueue((prev) => {
        const existing = prev.find((i) => i.blueprint_id === item.blueprint_id);
        const next = existing
          ? prev.map((i) =>
              i.blueprint_id === item.blueprint_id
                ? { ...i, quantity: i.quantity + 1 }
                : i
            )
          : [...prev, { ...item, quantity: 1 }];
        saveBuildQueue(next);
        return next;
      });
    },
    []
  );

  const setQuantity = useCallback(
    (blueprint_id: string, quantity: number) => {
      if (quantity < 1) return;
      setQueue((prev) => {
        const next = prev.map((i) =>
          i.blueprint_id === blueprint_id ? { ...i, quantity } : i
        );
        saveBuildQueue(next);
        return next;
      });
    },
    []
  );

  const removeItem = useCallback((blueprint_id: string) => {
    setQueue((prev) => {
      const next = prev.filter((i) => i.blueprint_id !== blueprint_id);
      saveBuildQueue(next);
      return next;
    });
  }, []);

  const clearQueue = useCallback(() => persist([]), [persist]);

  return { queue, addItem, setQuantity, removeItem, clearQueue };
}
