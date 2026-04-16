import { PRIORITY_LABELS, ZONE_COMPONENT_META } from './componentMeta'
import type {
  NormalizedShipDefinition,
  NormalizedShipZone,
  ShipDefinition,
  ShipValidationIssue,
  ViewId,
} from './types'
import { validateShipDefinitions } from './validateShips'

function formatValidationIssues(issues: ShipValidationIssue[]): string {
  return issues.map((issue) => `- ${issue.message}`).join('\n')
}

export function normalizeShipDefinitions(
  ships: ShipDefinition[],
  issues = validateShipDefinitions(ships)
): NormalizedShipDefinition[] {
  if (issues.length > 0) {
    throw new Error(`Invalid sub-target ship definitions:\n${formatValidationIssues(issues)}`)
  }

  return ships.map((ship) => {
    const viewTabs = ship.views.tabs.map((tab) => ({ ...tab }))
    const viewAssets = Object.fromEntries(
      viewTabs.map((tab) => [tab.id, ship.views.assets[tab.id] as string])
    ) as Record<ViewId, string>

    const zones: NormalizedShipZone[] = ship.zones.map((zone) => {
      const meta = ZONE_COMPONENT_META[zone.type]
      return {
        ...zone,
        color: meta.color,
        Icon: meta.Icon,
        priorityLabel: PRIORITY_LABELS[zone.priority],
        viewIds: Object.keys(zone.positions),
      }
    })

    const zonesByView = Object.fromEntries(
      viewTabs.map((tab) => [tab.id, zones.filter((zone) => zone.positions[tab.id])])
    ) as Record<ViewId, NormalizedShipZone[]>

    return {
      id: ship.id,
      label: ship.label,
      class: ship.class,
      componentSize: ship.componentSize,
      ...(ship.componentSizeOverrides ? { componentSizeOverrides: ship.componentSizeOverrides } : {}),
      viewTabs,
      viewAssets,
      zones,
      zonesByView,
    }
  })
}
