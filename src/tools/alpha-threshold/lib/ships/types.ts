import type { Ship, ShipSizeGroup } from '../../types'

export type { Ship, ShipSizeGroup }

export type ShipSource =
  | 'manual'
  | 'erkul'
  | 'spviewer'
  | 'scunpacked'
  | 'merged'

export type ShipRecord = Ship & {
  id: string
  source?: ShipSource
  sourceId?: string
  patch?: string
}

export type ManualShipSeed = {
  manufacturer: string
  name: string
  sizeGroup: ShipSizeGroup
  health: number
  ballisticThreshold: number
  energyThreshold: number
  patch?: string
}
