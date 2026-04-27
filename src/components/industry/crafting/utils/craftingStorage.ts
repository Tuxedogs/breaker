import type { BuildQueueItem, MaterialInventory } from "./craftingTypes";

const QUEUE_KEY = "craft_build_queue";
const INVENTORY_KEY = "craft_material_inventory";

// ── Build Queue ────────────────────────────────────────────────────

export function loadBuildQueue(): BuildQueueItem[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as BuildQueueItem[]) : [];
  } catch {
    return [];
  }
}

export function saveBuildQueue(queue: BuildQueueItem[]): void {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

// ── Material Inventory ─────────────────────────────────────────────

export function loadMaterialInventory(): MaterialInventory {
  try {
    const raw = localStorage.getItem(INVENTORY_KEY);
    return raw ? (JSON.parse(raw) as MaterialInventory) : {};
  } catch {
    return {};
  }
}

export function saveMaterialInventory(inv: MaterialInventory): void {
  localStorage.setItem(INVENTORY_KEY, JSON.stringify(inv));
}
