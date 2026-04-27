import type { CraftingRecipe, InventoryEntry, Location, Material } from '../../data/models';

export type SourceStrategy = 'nearest' | 'highest-quality' | 'minimize-splits';

export interface InventoryStack extends InventoryEntry {
  material: Material | undefined;
  location: Location | undefined;
}

export interface StackAllocation {
  stack: InventoryStack;
  quantity: number;
}

export function formatQuantity(quantity: number, material: Material | undefined): string {
  const unit = material?.unitType ?? 'units';
  if (unit === 'count') return `${quantity}x`;
  return `${quantity.toFixed(2)} ${unit}`;
}

export function getInventoryStacks(
  inventory: InventoryEntry[],
  materials: Material[],
  locations: Location[],
): InventoryStack[] {
  return inventory.map((entry) => ({
    ...entry,
    material: materials.find((material) => material.id === entry.materialId),
    location: locations.find((location) => location.id === entry.locationId),
  }));
}

export function summarizeLocation(
  location: Location,
  inventory: InventoryEntry[],
  materials: Material[],
) {
  const entries = inventory.filter((entry) => entry.locationId === location.id);
  const materialIds = new Set(entries.map((entry) => entry.materialId));
  const totalQuantity = entries.reduce((sum, entry) => sum + entry.quantity, 0);
  const highestStack = entries.reduce<InventoryEntry | null>(
    (best, entry) => (!best || entry.quality > best.quality ? entry : best),
    null,
  );
  const materialTotals = Array.from(materialIds).map((materialId) => {
    const material = materials.find((item) => item.id === materialId);
    const quantity = entries
      .filter((entry) => entry.materialId === materialId)
      .reduce((sum, entry) => sum + entry.quantity, 0);
    return { materialId, material, quantity };
  });

  return { entries, uniqueMaterials: materialIds.size, totalQuantity, highestStack, materialTotals };
}

export function getGlobalTopQualityMaterials(inventory: InventoryEntry[], materials: Material[]) {
  const bestByMaterial = new Map<string, InventoryEntry>();
  for (const entry of inventory) {
    const current = bestByMaterial.get(entry.materialId);
    if (!current || entry.quality > current.quality) bestByMaterial.set(entry.materialId, entry);
  }
  return Array.from(bestByMaterial.values())
    .map((entry) => ({ entry, material: materials.find((material) => material.id === entry.materialId) }))
    .sort((a, b) => b.entry.quality - a.entry.quality);
}

export function getMaterialBreakdown(
  inventory: InventoryEntry[],
  materials: Material[],
  locations: Location[],
) {
  return getInventoryStacks(inventory, materials, locations).sort((a, b) => {
    const materialCompare = (a.material?.name ?? a.materialId).localeCompare(b.material?.name ?? b.materialId);
    if (materialCompare !== 0) return materialCompare;
    return b.quality - a.quality;
  });
}

export function getPremiumStacks(
  inventory: InventoryEntry[],
  materials: Material[],
  locations: Location[],
  threshold = 900,
) {
  return getInventoryStacks(inventory, materials, locations)
    .filter((stack) => stack.quality >= threshold)
    .sort((a, b) => b.quality - a.quality);
}

export function getRecipeForQueueItem(itemName: string, recipes: CraftingRecipe[]) {
  return recipes.find((recipe) => recipe.itemName === itemName);
}

export function allocateMaterialFromStacks(
  materialId: string,
  requiredQuantity: number,
  inventory: InventoryEntry[],
  materials: Material[],
  locations: Location[],
  strategy: SourceStrategy,
): StackAllocation[] {
  const stacks = getInventoryStacks(
    inventory.filter((entry) => entry.materialId === materialId && entry.quantity > 0),
    materials,
    locations,
  );

  const sorted = stacks.sort((a, b) => {
    if (strategy === 'highest-quality') return b.quality - a.quality || b.quantity - a.quantity;
    if (strategy === 'minimize-splits') return b.quantity - a.quantity || b.quality - a.quality;
    return (a.location?.name ?? a.locationId).localeCompare(b.location?.name ?? b.locationId) || b.quantity - a.quantity;
  });

  const allocations: StackAllocation[] = [];
  let remaining = requiredQuantity;
  for (const stack of sorted) {
    if (remaining <= 0) break;
    const quantity = Math.min(stack.quantity, remaining);
    allocations.push({ stack, quantity });
    remaining -= quantity;
  }
  return allocations;
}
