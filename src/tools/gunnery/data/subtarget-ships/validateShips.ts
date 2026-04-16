import type {
  ComponentPriority,
  ShipDefinition,
  ShipValidationIssue,
  ViewId,
} from './types'

const VALID_PRIORITIES = new Set<ComponentPriority>([1, 2, 3, 4, 5, 6])

export function validateShipDefinitions(ships: ShipDefinition[]): ShipValidationIssue[] {
  const issues: ShipValidationIssue[] = []
  const shipIds = new Set<string>()

  for (const ship of ships) {
    if (shipIds.has(ship.id)) {
      issues.push({
        code: 'duplicate-ship-id',
        shipId: ship.id,
        message: `Duplicate ship id "${ship.id}".`,
      })
    }
    shipIds.add(ship.id)

    const tabIds = new Set<ViewId>()
    for (const tab of ship.views.tabs) {
      if (tabIds.has(tab.id)) {
        issues.push({
          code: 'duplicate-view-id',
          shipId: ship.id,
          viewId: tab.id,
          message: `Ship "${ship.id}" defines duplicate view tab "${tab.id}".`,
        })
      }
      tabIds.add(tab.id)

      if (!ship.views.assets[tab.id]) {
        issues.push({
          code: 'missing-view-asset',
          shipId: ship.id,
          viewId: tab.id,
          message: `Ship "${ship.id}" is missing an asset for view tab "${tab.id}".`,
        })
      }
    }

    const zoneIds = new Set<string>()
    for (const zone of ship.zones) {
      if (zoneIds.has(zone.id)) {
        issues.push({
          code: 'duplicate-zone-id',
          shipId: ship.id,
          zoneId: zone.id,
          message: `Ship "${ship.id}" defines duplicate zone id "${zone.id}".`,
        })
      }
      zoneIds.add(zone.id)

      if (!VALID_PRIORITIES.has(zone.priority)) {
        issues.push({
          code: 'invalid-priority',
          shipId: ship.id,
          zoneId: zone.id,
          message: `Ship "${ship.id}" zone "${zone.id}" has invalid priority "${zone.priority}".`,
        })
      }

      const positionEntries = Object.entries(zone.positions)
      if (positionEntries.length === 0) {
        issues.push({
          code: 'zone-without-positions',
          shipId: ship.id,
          zoneId: zone.id,
          message: `Ship "${ship.id}" zone "${zone.id}" has no view positions.`,
        })
      }

      for (const [viewId] of positionEntries) {
        if (!tabIds.has(viewId)) {
          issues.push({
            code: 'position-for-undefined-view',
            shipId: ship.id,
            zoneId: zone.id,
            viewId,
            message: `Ship "${ship.id}" zone "${zone.id}" defines a position for undefined view "${viewId}".`,
          })
        }

        const position = zone.positions[viewId]
        if (!position) continue

        for (const key of ['x', 'y', 'w', 'h'] as const) {
          const value = position[key]
          if (value < 0 || value > 1) {
            issues.push({
              code: 'position-out-of-range',
              shipId: ship.id,
              zoneId: zone.id,
              viewId,
              message: `Ship "${ship.id}" zone "${zone.id}" has ${key}=${value} for view "${viewId}", but normalized coordinates must stay in the 0-1 range.`,
            })
          }
        }
      }
    }
  }

  return issues
}
