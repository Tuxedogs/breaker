import type { BuildQueueItem, InventoryEntry, MaterialTemplate } from "../../types/logistics";
import type { RecipeInputTemplate } from "../../data/logistics/seed";
import { getBuildQueueItemInputs } from "./inventory";
import { createMaterialResolver } from "./materialResolver";

export const RAW_TO_REFINED_YIELD_FACTOR = 0.40;

export interface QueueLedgerLine {
  materialKey: string;
  materialId: string;
  displayName: string;
  isRefinable: boolean;
  grossRequired: number;
  availableRefined: number;
  rawOreAvailable: number;
  refinedEquivalentFromOre: number;
  totalAvailableEquivalent: number;
  netMissingRefined: number;
  rawOreNeeded: number;
  unitType?: RecipeInputTemplate["unitType"];
}

export interface QueueLedgerSummary {
  refinedShortfall: number;
  reservableLines: number;
  noStockLines: number;
}

export interface QueueLedgerModel {
  lines: QueueLedgerLine[];
  refinedShortfallLines: QueueLedgerLine[];
  rawOreRequirementLines: QueueLedgerLine[];
  summary: QueueLedgerSummary;
}

function normalizeMaterialName(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\b(raw|refined|ore)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function resolveMaterialKey(input: {
  materialKey?: string | null;
  materialId?: string | null;
  displayName?: string | null;
  materialName?: string | null;
}, materials: MaterialTemplate[]): { materialKey: string; materialId: string; displayName: string; isRefinable: boolean } {
  const resolve = createMaterialResolver(materials);
  const resolved = resolve(input);
  if (resolved) {
    return {
      materialKey: resolved.materialKey,
      materialId: resolved.materialId,
      displayName: resolved.displayName,
      isRefinable: isRefinableMaterial(resolved.material),
    };
  }

  const materialId = input.materialKey ?? input.materialId ?? normalizeMaterialName(input.displayName ?? input.materialName);
  const material = materials.find((entry) => entry.id === materialId);
  return {
    materialKey: material?.id ?? materialId,
    materialId: material?.id ?? materialId,
    displayName: material?.name ?? input.displayName ?? input.materialName ?? materialId,
    isRefinable: isRefinableMaterial(material),
  };
}

function isRefinableMaterial(material: MaterialTemplate | undefined): boolean {
  const flagged = material as (MaterialTemplate & {
    isRefinable?: boolean;
    canComeFromRefinery?: boolean;
    sourceGroups?: string[];
  }) | undefined;
  return Boolean(
    flagged?.isRefinable === true ||
    flagged?.canComeFromRefinery === true ||
    flagged?.sourceGroups?.includes("ores"),
  );
}

function isRefinedInventory(entry: InventoryEntry): boolean {
  return (
    entry.materialType === "refined" ||
    entry.itemKind === "material" ||
    entry.source === "screenshot_parser" ||
    entry.sourceHistory?.includes("screenshot_parser") === true ||
    Boolean(entry.workOrderId) ||
    Boolean(entry.workOrderIds?.length)
  );
}

function isRawOreInventory(entry: InventoryEntry): boolean {
  if (isRefinedInventory(entry)) return false;
  return entry.itemKind === "ore" || entry.materialType === "ore";
}

function sortLedgerLines(left: QueueLedgerLine, right: QueueLedgerLine): number {
  return right.netMissingRefined - left.netMissingRefined || left.displayName.localeCompare(right.displayName);
}

export function getQueueLedgerModel(input: {
  buildQueue: BuildQueueItem[];
  inventoryEntries: InventoryEntry[];
  materials: MaterialTemplate[];
  recipeInputsByRecipeId: Record<string, RecipeInputTemplate[]>;
}): QueueLedgerModel {
  const demandByMaterial = new Map<string, QueueLedgerLine>();

  for (const item of input.buildQueue) {
    if (item.status === "complete") continue;
    for (const recipeInput of getBuildQueueItemInputs(item, input.recipeInputsByRecipeId)) {
      const identity = resolveMaterialKey(recipeInput, input.materials);
      const current = demandByMaterial.get(identity.materialKey) ?? {
        materialKey: identity.materialKey,
        materialId: identity.materialId,
        displayName: identity.displayName,
        isRefinable: identity.isRefinable,
        grossRequired: 0,
        availableRefined: 0,
        rawOreAvailable: 0,
        refinedEquivalentFromOre: 0,
        totalAvailableEquivalent: 0,
        netMissingRefined: 0,
        rawOreNeeded: 0,
        unitType: recipeInput.unitType,
      };

      demandByMaterial.set(identity.materialKey, {
        ...current,
        grossRequired: current.grossRequired + recipeInput.quantity * item.quantity,
        unitType: current.unitType ?? recipeInput.unitType,
      });
    }
  }

  for (const entry of input.inventoryEntries) {
    if (entry.quantity <= 0) continue;
    const identity = resolveMaterialKey({
      materialId: entry.materialId ?? entry.catalogItemId,
      displayName: entry.itemName,
      materialName: entry.materialName,
    }, input.materials);
    const line = demandByMaterial.get(identity.materialKey);
    if (!line) continue;
    if (line.isRefinable && isRawOreInventory(entry)) {
      line.rawOreAvailable += entry.quantity;
    } else {
      line.availableRefined += entry.quantity;
    }
  }

  const lines = [...demandByMaterial.values()].map((line) => {
    const refinedEquivalentFromOre = line.isRefinable ? line.rawOreAvailable * RAW_TO_REFINED_YIELD_FACTOR : 0;
    const totalAvailableEquivalent = line.availableRefined + refinedEquivalentFromOre;
    const netMissingRefined = Math.max(0, line.grossRequired - totalAvailableEquivalent);
    return {
      ...line,
      refinedEquivalentFromOre,
      totalAvailableEquivalent,
      netMissingRefined,
      rawOreNeeded: line.isRefinable && netMissingRefined > 0 ? netMissingRefined / RAW_TO_REFINED_YIELD_FACTOR : 0,
    };
  }).sort(sortLedgerLines);

  const refinedShortfallLines = lines.filter((line) => line.netMissingRefined > 0);
  const rawOreRequirementLines = refinedShortfallLines.filter((line) => line.rawOreNeeded > 0);

  return {
    lines,
    refinedShortfallLines,
    rawOreRequirementLines,
    summary: {
      refinedShortfall: refinedShortfallLines.reduce((sum, line) => sum + line.netMissingRefined, 0),
      reservableLines: refinedShortfallLines.filter((line) => line.totalAvailableEquivalent > 0).length,
      noStockLines: refinedShortfallLines.filter((line) => line.totalAvailableEquivalent <= 0).length,
    },
  };
}
