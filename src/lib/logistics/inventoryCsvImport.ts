import type { InventoryUnitType, MaterialTemplate } from '../../types/logistics';
import { resolveInventoryUnitType } from './inventory';

export type ResolvedCsvUnit = {
  unitType?: InventoryUnitType;
  label?: string;
  multiplier: number;
  warning?: string;
};

export function resolveInventoryCsvUnit(value: string): ResolvedCsvUnit {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return { multiplier: 1 };
  if (normalized === 'scu') return { unitType: 'scu', label: 'SCU', multiplier: 1 };
  if (normalized === 'cscu') return { unitType: 'scu', label: 'SCU', multiplier: 0.01, warning: 'cSCU converted to SCU.' };
  if (normalized === 'unit' || normalized === 'units' || normalized === 'count' || normalized === 'counts') {
    return { unitType: 'unit', label: 'unit', multiplier: 1 };
  }
  return { multiplier: 1 };
}

export function expectedInventoryCsvUnit(material: MaterialTemplate): InventoryUnitType {
  return resolveInventoryUnitType(material);
}

export function inventoryCsvUnitMismatchMessage(material: MaterialTemplate, unitType: InventoryUnitType): string | null {
  const expected = expectedInventoryCsvUnit(material);
  if (expected === unitType) return null;
  if (expected === 'unit') return `${material.name} uses unit count, not SCU.`;
  return `${material.name} uses SCU, not unit count.`;
}

export function isRawIceInventoryInput(value: string): boolean {
  const key = value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  return key === 'rawice';
}
