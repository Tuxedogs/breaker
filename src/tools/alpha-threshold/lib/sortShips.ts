import type { Ship, ShipSortKey } from '../types'

export function sortShips(ships: Ship[], sortKey: ShipSortKey): Ship[] {
  const next = [...ships]

  switch (sortKey) {
    case 'ballistic-desc':
      return next.sort(
        (a, b) => b.ballisticThreshold - a.ballisticThreshold
      )

    case 'energy-desc':
      return next.sort((a, b) => b.energyThreshold - a.energyThreshold)

    case 'manufacturer-asc':
      return next.sort((a, b) => {
        const makeCompare = a.manufacturer.localeCompare(b.manufacturer)
        if (makeCompare !== 0) return makeCompare

        return a.name.localeCompare(b.name)
      })

    case 'health-desc':
    default:
      return next.sort((a, b) => b.health - a.health)
  }
}
