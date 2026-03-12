import type { ShipRecord, ShipSizeGroup } from './types'

export function normalizeShipName(name: string): string {
  return name.trim().replace(/\s+/g, '_')
}

export function normalizeShipManufacturer(manufacturer: string): string {
  return manufacturer.trim().toUpperCase()
}

export function normalizeShipSizeGroup(sizeGroup: ShipSizeGroup): ShipSizeGroup {
  return sizeGroup
}

export function createShipId({
  manufacturer,
  name,
}: Pick<ShipRecord, 'manufacturer' | 'name'>): string {
  return `${normalizeShipManufacturer(manufacturer)}:${normalizeShipName(name)}`
}
