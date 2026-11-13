import type { BuildQueueItem, InventoryEntry, InventoryLocation } from "../../types/logistics";
import type { Shortage } from "./shortages";
import {
  clampMaterialQuality,
  getLotAvailableAmountAfterReservations,
  isInventoryEntrySupportedForBuildQueuePhysicalAvailability,
} from "./buildQueueReservations";

export interface PotentialSourceMaterial {
  materialId: string;
  available: number;
  unitType: string;
  lotCount: number;
  qualityMin?: number;
  qualityMax?: number;
}
export interface PotentialSourceLocation {
  id: string;
  name: string;
  available: number;
  materials: PotentialSourceMaterial[];
  lotCount: number;
}

/** Source cards contain only stored, eligible, currently unreserved physical lots.
 * This is not a mining-spawn recommender and never synthesizes game locations.
 */
export function getQueuePotentialSources(
  coverage: Shortage[],
  inventory: InventoryEntry[],
  locations: InventoryLocation[],
  entireQueue: BuildQueueItem[],
): PotentialSourceLocation[] {
  const byId = new Map(locations.map((location) => [location.id, location.name]));
  const byLocation = new Map<string, {
    id: string; name: string; available: number; lots: Set<string>;
    materials: Map<string, PotentialSourceMaterial>;
  }>();
  for (const entry of inventory) {
    if (entry.recordKind !== "box" || entry.inventoryStatus === "replaced") continue;
    if (!entry.materialId || entry.quantity <= 0) continue;
    if (!isInventoryEntrySupportedForBuildQueuePhysicalAvailability(entry)) continue;
    const eligible = coverage.some((line) => {
      if (line.materialId !== entry.materialId || line.needed <= 0) return false;
      if (line.unitType && entry.unitType && line.unitType !== entry.unitType) return false;
      if (line.allowLowerQuality || line.selectedQuality === undefined) return true;
      const quality = clampMaterialQuality(entry.quality);
      return quality !== undefined && quality >= line.selectedQuality;
    });
    if (!eligible) continue;
    const available = getLotAvailableAmountAfterReservations(entry, entireQueue);
    if (available <= 0) continue;
    const id = entry.locationId || "unassigned";
    let location = byLocation.get(id);
    if (!location) {
      location = {
        id,
        name: byId.get(id) ?? (id === "unassigned" ? "Unassigned stock" : "Location not named"),
        available: 0,
        lots: new Set(),
        materials: new Map(),
      };
      byLocation.set(id, location);
    }
    location.available += available;
    location.lots.add(entry.id);
    const key = entry.materialId + ":" + (entry.unitType ?? "unit");
    let material = location.materials.get(key);
    if (!material) {
      material = { materialId: entry.materialId, available: 0, unitType: entry.unitType ?? "unit", lotCount: 0 };
      location.materials.set(key, material);
    }
    material.available += available;
    material.lotCount++;
    const quality = clampMaterialQuality(entry.quality);
    if (quality !== undefined) {
      material.qualityMin = Math.min(material.qualityMin ?? quality, quality);
      material.qualityMax = Math.max(material.qualityMax ?? quality, quality);
    }
  }
  return [...byLocation.values()]
    .map((location) => ({
      id: location.id,
      name: location.name,
      available: location.available,
      materials: [...location.materials.values()].sort((a, b) => b.available - a.available),
      lotCount: location.lots.size,
    }))
    .sort((a, b) => b.available - a.available || a.name.localeCompare(b.name));
}
