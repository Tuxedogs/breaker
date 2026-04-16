import type { ComponentType } from 'react'

export type ViewId = string
export type ShipClass = 'capital' | 'medium' | 'small'
export type ComponentPriority = 1 | 2 | 3 | 4 | 5 | 6

export type ZoneType =
  | 'power-plant'
  | 'shield'
  | 'qt-drive'
  | 'radar'
  | 'weapon'
  | 'airlock'

export type ComponentSize = 's1' | 's2' | 's3' | 's4' | 's5'

export type ZoneCategory =
  | 'power'
  | 'shield'
  | 'qt-drive'
  | 'radar'
  | 'main-weapon'
  | 'pdc'
  | 'mav-thruster'
  | 'entry-point'

export type ZoneCategoryGroup = 'components' | 'externals' | 'entry-points'

export type ZonePosition = {
  // Normalized to the specific source image for that view, in the 0-1 range.
  x: number
  y: number
  w: number
  h: number
  wPx?: number
  hPx?: number
}

export type ShipViewTab = {
  id: ViewId
  label: string
}

export type ShipZone = {
  id: string
  type: ZoneType
  category: ZoneCategory
  label: string
  resultName: string
  shortLabel?: string
  groupId?: string
  priority: ComponentPriority
  effect: string
  positions: Partial<Record<ViewId, ZonePosition>>
}

export type ShipDefinition = {
  id: string
  label: string
  class: ShipClass
  componentSize: ComponentSize
  componentSizeOverrides?: Partial<Record<ZoneType, ComponentSize>>
  views: {
    tabs: ShipViewTab[]
    assets: Partial<Record<ViewId, string>>
  }
  zones: ShipZone[]
}

export type ZoneIconComponent = ComponentType<{ className?: string }>

export type ZoneComponentMeta = {
  label: string
  color: string
  Icon: ZoneIconComponent
}

export type ZoneCategoryMeta = {
  label: string
  color: string
  group: ZoneCategoryGroup
}

export type ZoneCategoryGroupMeta = {
  label: string
  collapsible: boolean
  defaultExpanded: boolean
  defaultChecked: boolean
}

export type NormalizedShipZone = ShipZone & {
  color: string
  Icon: ZoneIconComponent
  priorityLabel: string
  viewIds: ViewId[]
}

export type NormalizedShipDefinition = Omit<ShipDefinition, 'views' | 'zones'> & {
  viewTabs: ShipViewTab[]
  viewAssets: Record<ViewId, string>
  zones: NormalizedShipZone[]
  zonesByView: Record<ViewId, NormalizedShipZone[]>
}

export type ShipValidationIssueCode =
  | 'duplicate-ship-id'
  | 'duplicate-view-id'
  | 'duplicate-zone-id'
  | 'invalid-priority'
  | 'missing-view-asset'
  | 'zone-without-positions'
  | 'position-for-undefined-view'
  | 'position-out-of-range'

export type ShipValidationIssue = {
  code: ShipValidationIssueCode
  message: string
  shipId?: string
  zoneId?: string
  viewId?: ViewId
}
