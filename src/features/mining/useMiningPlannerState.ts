import { useState, useCallback, useEffect } from "react";
import type {
  MiningPriorityItem,
  ManualMiningDemandItem,
  FavoriteMiningLocation,
  MiningPlannerFilters,
  MiningPlannerIntentPayload,
  BestRoute,
} from "./types";

const KEY_PRIORITY = "scintel:mining:priorityStack";
const KEY_DEMAND = "scintel:mining:manualDemand";
const KEY_FAVORITES = "scintel:mining:favoriteLocations";
const KEY_FILTERS = "scintel:mining:filters";

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getRouteFavoriteKey(route: Pick<BestRoute, "system" | "location" | "spawnType">): string {
  return `${route.system}|${route.location}|${route.spawnType}`;
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useMiningPlannerState() {
  const [priorityStack, setPriorityStackRaw] = useState<MiningPriorityItem[]>(() =>
    readJson(KEY_PRIORITY, [])
  );
  const [manualDemand, setManualDemandRaw] = useState<ManualMiningDemandItem[]>(() =>
    readJson(KEY_DEMAND, [])
  );
  const [favorites, setFavoritesRaw] = useState<FavoriteMiningLocation[]>(() =>
    readJson(KEY_FAVORITES, [])
  );
  const [filters, setFiltersRaw] = useState<MiningPlannerFilters>(() =>
    readJson(KEY_FILTERS, { showOnlyStarred: false })
  );

  // Persist on change
  useEffect(() => { writeJson(KEY_PRIORITY, priorityStack); }, [priorityStack]);
  useEffect(() => { writeJson(KEY_DEMAND, manualDemand); }, [manualDemand]);
  useEffect(() => { writeJson(KEY_FAVORITES, favorites); }, [favorites]);
  useEffect(() => { writeJson(KEY_FILTERS, filters); }, [filters]);

  // ── Priority stack ─────────────────────────────────────────────────────────

  const addToPriorityStack = useCallback((
    opts: Pick<MiningPriorityItem, "materialId" | "materialName" | "source">
  ) => {
    setPriorityStackRaw((prev) => {
      if (prev.some((p) => p.materialId === opts.materialId && opts.materialId !== null)) return prev;
      const newItem: MiningPriorityItem = {
        id: uid(),
        materialId: opts.materialId,
        materialName: opts.materialName,
        priorityRank: prev.length + 1,
        pinned: false,
        source: opts.source,
        createdAt: new Date().toISOString(),
      };
      return [...prev, newItem];
    });
  }, []);

  const removePriorityItem = useCallback((id: string) => {
    setPriorityStackRaw((prev) => {
      const next = prev.filter((p) => p.id !== id);
      return next.map((p, i) => ({ ...p, priorityRank: i + 1 }));
    });
  }, []);

  const movePriorityUp = useCallback((id: string) => {
    setPriorityStackRaw((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      if (idx <= 0) return prev;
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next.map((p, i) => ({ ...p, priorityRank: i + 1 }));
    });
  }, []);

  const movePriorityDown = useCallback((id: string) => {
    setPriorityStackRaw((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      if (idx < 0 || idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next.map((p, i) => ({ ...p, priorityRank: i + 1 }));
    });
  }, []);

  const togglePriorityPin = useCallback((id: string) => {
    setPriorityStackRaw((prev) =>
      prev.map((p) => (p.id === id ? { ...p, pinned: !p.pinned } : p))
    );
  }, []);

  const clearPriorityStack = useCallback(() => {
    setPriorityStackRaw([]);
  }, []);

  // ── Manual demand ──────────────────────────────────────────────────────────

  const addManualDemand = useCallback((
    opts: Omit<ManualMiningDemandItem, "id" | "createdAt">
  ) => {
    const newItem: ManualMiningDemandItem = {
      ...opts,
      id: uid(),
      createdAt: new Date().toISOString(),
    };
    setManualDemandRaw((prev) => [...prev, newItem]);
    if (opts.addToPriority) {
      addToPriorityStack({ materialId: null, materialName: opts.materialName, source: "manual" });
    }
  }, [addToPriorityStack]);

  const removeManualDemand = useCallback((id: string) => {
    setManualDemandRaw((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const clearManualDemand = useCallback(() => {
    setManualDemandRaw([]);
  }, []);

  // ── Favorites ──────────────────────────────────────────────────────────────

  const toggleFavorite = useCallback((route: Pick<BestRoute, "system" | "location" | "spawnType">) => {
    const key = getRouteFavoriteKey(route);
    setFavoritesRaw((prev) => {
      if (prev.some((f) => f.key === key)) {
        return prev.filter((f) => f.key !== key);
      }
      return [...prev, {
        key,
        system: route.system,
        location: route.location,
        spawnType: route.spawnType,
        starredAt: new Date().toISOString(),
      }];
    });
  }, []);

  const isFavorite = useCallback((route: Pick<BestRoute, "system" | "location" | "spawnType">) => {
    const key = getRouteFavoriteKey(route);
    return favorites.some((f) => f.key === key);
  }, [favorites]);

  // ── Filters ────────────────────────────────────────────────────────────────

  const toggleShowOnlyStarred = useCallback(() => {
    setFiltersRaw((prev) => ({ ...prev, showOnlyStarred: !prev.showOnlyStarred }));
  }, []);

  // ── Intent payload (for preview panel) ────────────────────────────────────

  const intentPayload: MiningPlannerIntentPayload = {
    priorityStack,
    manualDemand,
    favoriteLocationIds: favorites.map((f) => f.key),
    filters,
  };

  return {
    priorityStack,
    manualDemand,
    favorites,
    filters,
    intentPayload,
    // priority
    addToPriorityStack,
    removePriorityItem,
    movePriorityUp,
    movePriorityDown,
    togglePriorityPin,
    clearPriorityStack,
    // demand
    addManualDemand,
    removeManualDemand,
    clearManualDemand,
    // favorites
    toggleFavorite,
    isFavorite,
    // filters
    toggleShowOnlyStarred,
  };
}
