import type { ShipRecord } from '../types'

export function normalizeErkulShip(
  input: Record<string, unknown>
): ShipRecord {
  return {
    id: String(input.id ?? ''),
    manufacturer: String(input.manufacturer ?? ''),
    name: String(input.name ?? ''),
    sizeGroup: 'medium',
    health: Number(input.health ?? 0),
    ballisticThreshold: Number(input.ballisticThreshold ?? 0),
    energyThreshold: Number(input.energyThreshold ?? 0),
    source: 'erkul',
    sourceId: String(input.id ?? input.name ?? ''),
    patch: typeof input.patch === 'string' ? input.patch : undefined,
  }
}
