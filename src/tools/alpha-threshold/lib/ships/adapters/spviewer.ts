import { createShipId, normalizeShipManufacturer, normalizeShipName, normalizeShipSizeGroup } from '../normalize'
import type { ShipRecord, ShipSizeGroup } from '../types'

export function normalizeSpviewerShip(
  input: Record<string, unknown>
): ShipRecord {
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
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
=======
  const manufacturer = normalizeShipManufacturer(String(input.manufacturer ?? ''))
  const name = normalizeShipName(String(input.name ?? ''))

  return {
=======
  const manufacturer = normalizeShipManufacturer(String(input.manufacturer ?? ''))
  const name = normalizeShipName(String(input.name ?? ''))

  return {
>>>>>>> theirs
=======
  const manufacturer = normalizeShipManufacturer(String(input.manufacturer ?? ''))
  const name = normalizeShipName(String(input.name ?? ''))

  return {
>>>>>>> theirs
    id: createShipId({ manufacturer, name }),
    manufacturer,
    name,
    sizeGroup: normalizeShipSizeGroup(String(input.sizeGroup ?? 'medium') as ShipSizeGroup),
    health: Number(input.health ?? 0),
    ballisticThreshold: Number(input.ballisticThreshold ?? 0),
    energyThreshold: Number(input.energyThreshold ?? 0),
>>>>>>> theirs
    source: 'spviewer',
    sourceId: String(input.id ?? input.name ?? ''),
    patch: typeof input.patch === 'string' ? input.patch : undefined,
    pilotHardpointSize: typeof input.pilotHardpointSize === 'number' ? input.pilotHardpointSize : null,
    turretHardpointSize: typeof input.turretHardpointSize === 'number' ? input.turretHardpointSize : null,
  }
}
