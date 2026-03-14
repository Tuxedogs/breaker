import { createShipId, normalizeShipManufacturer, normalizeShipName, normalizeShipSizeGroup } from '../normalize'
import type { ShipRecord, ShipSizeGroup } from '../types'

export function normalizeErkulShip(
  input: Record<string, unknown>
): ShipRecord {
  const manufacturer = normalizeShipManufacturer(String(input.manufacturer ?? ''))
  const name = normalizeShipName(String(input.name ?? ''))

  return {
    id: createShipId({ manufacturer, name }),
    manufacturer,
    name,
    sizeGroup: normalizeShipSizeGroup(String(input.sizeGroup ?? 'medium') as ShipSizeGroup),
    health: Number(input.health ?? 0),
    ballisticThreshold: Number(input.ballisticThreshold ?? 0),
    energyThreshold: Number(input.energyThreshold ?? 0),
    source: 'erkul',
    sourceId: String(input.id ?? input.name ?? ''),
    patch: typeof input.patch === 'string' ? input.patch : undefined,
    pilotHardpointSize: typeof input.pilotHardpointSize === 'number' ? input.pilotHardpointSize : null,
    turretHardpointSize: typeof input.turretHardpointSize === 'number' ? input.turretHardpointSize : null,
  }
}
