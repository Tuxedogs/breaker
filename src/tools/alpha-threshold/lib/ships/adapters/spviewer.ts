import type { ShipRecord } from '../types'

export function normalizeSpviewerShip(
  input: Record<string, unknown>
): ShipRecord {
  const health = Number(input.health ?? 0)
  const ballisticThreshold = Number(input.ballisticThreshold ?? 0)
  const energyThreshold = Number(input.energyThreshold ?? 0)

  return {
    id: String(input.id ?? ''),
    manufacturer: String(input.manufacturer ?? ''),
    name: String(input.name ?? ''),
    sizeGroup: 'medium',
    health,
    armor: Math.max(1, Math.round((ballisticThreshold + energyThreshold) / 2)),
    armorHp: health,
    vitalHp: health,
    ballisticThreshold,
    energyThreshold,
    history: [],
    source: 'spviewer',
    sourceId: String(input.id ?? input.name ?? ''),
    patch: typeof input.patch === 'string' ? input.patch : undefined,
  }
}
