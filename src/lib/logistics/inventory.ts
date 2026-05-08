import type {
  BuildQueueItem,
  InventoryEntry,
  InventoryItemKind,
  InventoryLocation,
  InventoryUnitType,
  MaterialTemplate,
  RarityInfo,
  RecipeTemplate,
} from '../../types/logistics';
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

export function getLegacyMaterialItemKind(material: MaterialTemplate | undefined): InventoryItemKind {
  if (!material) return 'unknown';
  if (material.id === 'rawice') return 'ice';
  if (material.materialType === 'ore' || material.materialType === 'refined') return 'ore';
  if (material.materialType === 'raw') return 'raw_mineable';
  if (material.materialType === 'special') return 'raw_mineable';
  return 'material';
}

export function resolveInventoryItemName(entry: InventoryEntry, material?: MaterialTemplate): string {
  return entry.itemName ?? entry.materialName ?? material?.name ?? entry.materialId ?? entry.catalogItemId ?? 'Custom Item';
}

export function resolveInventoryItemKind(entry: InventoryEntry, material?: MaterialTemplate): InventoryItemKind {
  return entry.itemKind ?? getLegacyMaterialItemKind(material ?? undefined);
}

export function resolveInventoryUnitType(
  entryOrTemplate: InventoryEntry | MaterialTemplate | undefined,
  material?: MaterialTemplate,
): InventoryUnitType {
  if (!entryOrTemplate) return 'unit';
  if ('unitType' in entryOrTemplate && entryOrTemplate.unitType) return entryOrTemplate.unitType;
  const template = material ?? ('materialType' in entryOrTemplate && 'id' in entryOrTemplate ? entryOrTemplate : undefined);
  if (template && 'sourceGroups' in template) {
    const groups = (template as { sourceGroups: string[] }).sourceGroups;
    if (groups.includes('vehicleMining') || groups.includes('fpsMining')) return 'unit';
  }
  const materialType = template?.materialType ?? ('materialType' in entryOrTemplate ? entryOrTemplate.materialType : undefined);
  if (materialType === 'special' || materialType === 'raw') return 'unit';
  if (materialType === 'ore' || materialType === 'refined') return 'scu';
  return 'unit';
}

export function getInventoryUnitLabel(entryOrTemplate: InventoryEntry | MaterialTemplate | undefined): 'unit' | 'SCU' {
  if (!entryOrTemplate) return 'unit';
  if ('unitType' in entryOrTemplate && entryOrTemplate.unitType) return entryOrTemplate.unitType === 'scu' ? 'SCU' : 'unit';
  if ('sourceGroups' in entryOrTemplate) {
    const groups = (entryOrTemplate as { sourceGroups: string[] }).sourceGroups;
    if (groups.includes('vehicleMining') || groups.includes('fpsMining')) return 'unit';
  }
  // FPS mineables stored as InventoryEntry carry materialType 'special'; vehicle mineables carry 'raw'.
  if (entryOrTemplate.materialType === 'special' || entryOrTemplate.materialType === 'raw') return 'unit';
  return 'SCU';
}

export function formatQuantity(quantity: number, material: MaterialTemplate | undefined): string {
  return formatInventoryQuantity(quantity, material ? resolveInventoryUnitType(material) : 'unit');
}

export function formatInventoryQuantity(quantity: number, unitType: InventoryUnitType | undefined): string {
  const sign = quantity < 0 ? '-' : '';
  const absoluteQuantity = Math.abs(quantity);
  const roundedQuantity = unitType === 'scu'
    ? Math.round(absoluteQuantity * 100) / 100
    : absoluteQuantity;
  const displayQuantity = Number.isInteger(roundedQuantity)
    ? String(roundedQuantity)
    : roundedQuantity.toFixed(2).replace(/\.?0+$/, '');

  if (unitType === 'scu') return `${sign}${displayQuantity} SCU`;
  return `${sign}x${displayQuantity}`;
}

export function formatEntryQuantity(entry: InventoryEntry, material?: MaterialTemplate): string {
  return formatInventoryQuantity(entry.quantity, resolveInventoryUnitType(entry, material));
}

export function formatRequirementQuantity(
  quantity: number,
  unitType: 'unit' | 'SCU' | 'scu' | 'cscu' | undefined,
  material: MaterialTemplate | undefined,
): string {
  const resolved = unitType === 'SCU' || unitType === 'scu' || unitType === 'cscu' ? 'scu' : unitType ?? resolveInventoryUnitType(material);
  return formatInventoryQuantity(quantity, resolved);
}

export function materialTypeClass(material: MaterialTemplate | undefined, fallback?: MaterialTemplate['materialType']): string {
  return `logi-material-type--${material?.materialType ?? fallback ?? 'special'}`;
}

export function rarityClass(rarity: RarityInfo | undefined): string {
  return `logi-rarity--${rarity?.tier ?? 'common'}`;
}

export function getInventoryStacks(
  inventory: InventoryEntry[],
  materials: MaterialTemplate[],
  locations: InventoryLocation[],
): InventoryStack[] {
  return inventory.map((entry) => ({
    ...entry,
    material: entry.materialId ? materials.find((material) => material.id === entry.materialId) : undefined,
    location: locations.find((location) => location.id === entry.locationId),
  }));
}

export function summarizeLocation(
  location: InventoryLocation,
  inventory: InventoryEntry[],
  materials: MaterialTemplate[],
) {
  const entries = inventory.filter((entry) => entry.locationId === location.id);
  const materialIds = new Set(entries.map((entry) => entry.materialId ?? entry.catalogItemId ?? entry.itemName ?? entry.id));
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
    const key = entry.materialId ?? entry.catalogItemId ?? entry.itemName ?? entry.id;
    const current = bestByMaterial.get(key);
    if (!current || (entry.quality ?? -1) > (current.quality ?? -1)) bestByMaterial.set(key, entry);
  }
  return Array.from(bestByMaterial.values())
    .map((entry) => ({ entry, material: entry.materialId ? materials.find((material) => material.id === entry.materialId) : undefined }))
    .sort((a, b) => (b.entry.quality ?? -1) - (a.entry.quality ?? -1));
}

export function getMaterialBreakdown(
  inventory: InventoryEntry[],
  materials: MaterialTemplate[],
  locations: InventoryLocation[],
) {
  return getInventoryStacks(inventory, materials, locations).sort((a, b) => {
    const materialCompare = resolveInventoryItemName(a, a.material).localeCompare(resolveInventoryItemName(b, b.material));
    if (materialCompare !== 0) return materialCompare;
    return (b.quality ?? -1) - (a.quality ?? -1);
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

export function getBuildQueueItemInputs(
  item: BuildQueueItem,
  inputsByRecipeId: Record<string, RecipeInputTemplate[]>,
) {
  return item.materialRequirements ?? getRecipeInputs(item.recipeId, inputsByRecipeId);
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
