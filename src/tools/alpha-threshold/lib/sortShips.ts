import { getActiveThreshold } from './calculations'
import type { Ship, ShipSortKey, ThresholdMode } from '../types'

export function sortShips(
  ships: Ship[],
  sortKey: ShipSortKey,
  mode: ThresholdMode
): Ship[] {
  const next = [...ships]

  switch (sortKey) {
    case 'health-desc':
      return next.sort((a, b) => b.health - a.health)

    case 'manufacturer-asc':
      return next.sort((a, b) => {
        const makeCompare = a.manufacturer.localeCompare(b.manufacturer)
        if (makeCompare !== 0) return makeCompare

        return a.name.localeCompare(b.name)
      })

    case 'threshold-desc':
    default:
      return next.sort(
        (a, b) => getActiveThreshold(b, mode) - getActiveThreshold(a, mode)
      )
  }
}
