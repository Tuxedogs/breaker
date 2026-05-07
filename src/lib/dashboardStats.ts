import type { InventoryEntry } from "../types/logistics";
import type { LogisticsMaterialTemplate } from "../data/logistics/seed";

export interface VolumeTop3 {
  name: string;
  quantity: number;
  unit: "SCU" | "x";
}

export interface QualityTop3 {
  name: string;
  quality: number;
}

export interface UserDashStats {
  totalVolume: number;
  totalVolumeUnit: "SCU" | "x";
  top3Volume: VolumeTop3[];
  highestQuality: number | null;
  highestQualityMaterial: string | null;
  top3Highest: QualityTop3[];
  lowestQuality: number | null;
  lowestQualityMaterial: string | null;
  bottom3Lowest: QualityTop3[];
}

function isFpsMineable(entry: InventoryEntry, templates: LogisticsMaterialTemplate[]): boolean {
  const tpl = templates.find((t) => t.id === entry.materialId);
  return tpl?.sourceGroups?.includes("fpsMining") ?? false;
}

/** Derive user stats from inventory entries. */
export function deriveUserDashStats(
  entries: InventoryEntry[],
  templates: LogisticsMaterialTemplate[],
): UserDashStats {
  // Group by material, aggregate volumes
  const volumeByMaterial = new Map<string, { name: string; qty: number; isFps: boolean }>();
  for (const e of entries) {
    const fps = isFpsMineable(e, templates);
    const key = e.materialId ?? e.catalogItemId ?? e.itemName ?? e.id;
    const name = e.itemName ?? e.materialName ?? templates.find((t) => t.id === e.materialId)?.name ?? key;
    const existing = volumeByMaterial.get(key);
    if (existing) {
      existing.qty += e.quantity;
    } else {
      volumeByMaterial.set(key, { name, qty: e.quantity, isFps: fps });
    }
  }

  // Sort by volume descending
  const sorted = [...volumeByMaterial.values()].sort((a, b) => b.qty - a.qty);
  const top3Volume: VolumeTop3[] = sorted.slice(0, 3).map((m) => ({
    name: m.name,
    quantity: m.qty,
    unit: m.isFps ? "x" : "SCU",
  }));

  // Total — sum all non-fps as SCU; fps entries are units and excluded from main SCU total
  const totalScu = sorted.filter((m) => !m.isFps).reduce((s, m) => s + m.qty, 0);
  const totalX = sorted.filter((m) => m.isFps).reduce((s, m) => s + m.qty, 0);
  const totalVolume = totalScu > 0 ? parseFloat(totalScu.toFixed(2)) : totalX;
  const totalVolumeUnit: "SCU" | "x" = totalScu > 0 ? "SCU" : "x";

  // Quality-tracked entries
  const withQuality = entries
    .filter((e) => e.quality != null)
    .map((e) => ({
      name: e.itemName ?? e.materialName ?? templates.find((t) => t.id === e.materialId)?.name ?? e.materialId ?? e.catalogItemId ?? e.id,
      quality: e.quality as number,
    }))
    .sort((a, b) => b.quality - a.quality);

  const top3Highest: QualityTop3[] = withQuality.slice(0, 3);
  const bottom3Lowest: QualityTop3[] = [...withQuality].reverse().slice(0, 3);

  return {
    totalVolume,
    totalVolumeUnit,
    top3Volume,
    highestQuality: withQuality[0]?.quality ?? null,
    highestQualityMaterial: withQuality[0]?.name ?? null,
    top3Highest,
    lowestQuality: withQuality[withQuality.length - 1]?.quality ?? null,
    lowestQualityMaterial: withQuality[withQuality.length - 1]?.name ?? null,
    bottom3Lowest,
  };
}
