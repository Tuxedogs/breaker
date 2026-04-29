import type { InventoryEntry, InventoryLocation, MaterialTemplate, RecipeTemplate } from '../../types/logistics';
import type { RecipeInputTemplate } from '../../data/logistics/seed';

export type SourceStrategy = 'nearest' | 'highest-quality' | 'minimize-splits';

export interface InventoryStack extends InventoryEntry {
  material: MaterialTemplate | undefined;
  location: InventoryLocation | undefined;
}

export interface StackAllocation {
  stack: InventoryStack;
  quantity: number;
}

export function getInventoryUnitLabel(entryOrTemplate: InventoryEntry | MaterialTemplate | undefined): string {
  // TODO: move inventory unit labels into template/catalog data when the global catalog exists.
  return entryOrTemplate?.materialType === 'special' ? 'count' : 'SCU';
}

export function formatQuantity(quantity: number, material: MaterialTemplate | undefined): string {
  const unit = getInventoryUnitLabel(material);
  if (unit === 'count') return `${quantity}x`;
  return `${quantity.toFixed(2)} ${unit}`;
}

export function getInventoryStacks(
  inventory: InventoryEntry[],
  materials: MaterialTemplate[],
  locations: InventoryLocation[],
): InventoryStack[] {
  return inventory.map((entry) => ({
    ...entry,
    material: materials.find((material) => material.id === entry.materialId),
    location: locations.find((location) => location.id === entry.locationId),
  }));
}

export function summarizeLocation(
  location: InventoryLocation,
  inventory: InventoryEntry[],
  materials: MaterialTemplate[],
) {
  const entries = inventory.filter((entry) => entry.locationId === location.id);
  const materialIds = new Set(entries.map((entry) => entry.materialId));
  const totalQuantity = entries.reduce((sum, entry) => sum + entry.quantity, 0);
  const highestStack = entries.reduce<InventoryEntry | null>(
    (best, entry) => (!best || (entry.quality ?? 0) > (best.quality ?? 0) ? entry : best),
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

export function getGlobalTopQualityMaterials(inventory: InventoryEntry[], materials: MaterialTemplate[]) {
  const bestByMaterial = new Map<string, InventoryEntry>();
  for (const entry of inventory) {
    const current = bestByMaterial.get(entry.materialId);
    if (!current || (entry.quality ?? 0) > (current.quality ?? 0)) bestByMaterial.set(entry.materialId, entry);
  }
  return Array.from(bestByMaterial.values())
    .map((entry) => ({ entry, material: materials.find((material) => material.id === entry.materialId) }))
    .sort((a, b) => (b.entry.quality ?? 0) - (a.entry.quality ?? 0));
}

export function getMaterialBreakdown(
  inventory: InventoryEntry[],
  materials: MaterialTemplate[],
  locations: InventoryLocation[],
) {
  return getInventoryStacks(inventory, materials, locations).sort((a, b) => {
    const materialCompare = (a.material?.name ?? a.materialId).localeCompare(b.material?.name ?? b.materialId);
    if (materialCompare !== 0) return materialCompare;
    return (b.quality ?? 0) - (a.quality ?? 0);
  });
}

export function getPremiumStacks(
  inventory: InventoryEntry[],
  materials: MaterialTemplate[],
  locations: InventoryLocation[],
  threshold = 900,
) {
  return getInventoryStacks(inventory, materials, locations)
    .filter((stack) => (stack.quality ?? 0) >= threshold)
    .sort((a, b) => (b.quality ?? 0) - (a.quality ?? 0));
}

export function getRecipeInputs(recipeId: string, inputsByRecipeId: Record<string, RecipeInputTemplate[]>) {
  return inputsByRecipeId[recipeId] ?? [];
}

export function getRecipeForQueueItem(recipeId: string, recipes: RecipeTemplate[]) {
  return recipes.find((recipe) => recipe.id === recipeId);
}

export function allocateMaterialFromStacks(
  materialId: string,
  requiredQuantity: number,
  inventory: InventoryEntry[],
  materials: MaterialTemplate[],
  locations: InventoryLocation[],
  strategy: SourceStrategy,
): StackAllocation[] {
  const stacks = getInventoryStacks(
    inventory.filter((entry) => entry.materialId === materialId && entry.quantity > 0),
    materials,
    locations,
  );

  const sorted = stacks.sort((a, b) => {
    if (strategy === 'highest-quality') return (b.quality ?? 0) - (a.quality ?? 0) || b.quantity - a.quantity;
    if (strategy === 'minimize-splits') return b.quantity - a.quantity || (b.quality ?? 0) - (a.quality ?? 0);
    return (a.location?.name ?? a.locationId ?? '').localeCompare(b.location?.name ?? b.locationId ?? '') || b.quantity - a.quantity;
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
