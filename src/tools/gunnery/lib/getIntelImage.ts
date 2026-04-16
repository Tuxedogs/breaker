import type { NormalizedShipDefinition, NormalizedShipZone, ZoneType } from '../data/subtarget-ships/types'

const ZONE_TYPE_TO_FILE: Partial<Record<ZoneType, string>> = {
  'power-plant': 'power',
  'shield': 'shield',
  'qt-drive': 'qt',
  'radar': 'radar',
}

export function getIntelImage(
  ship: NormalizedShipDefinition,
  zone: NormalizedShipZone,
): string | null {
  const family = ZONE_TYPE_TO_FILE[zone.type]
  if (!family) return null

  const size = ship.componentSizeOverrides?.[zone.type] ?? ship.componentSize

  return `/ships/components/${size}/${family}.jpg`
}
