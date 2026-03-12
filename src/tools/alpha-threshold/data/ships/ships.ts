import { normalizeManualShipRecord } from '../../lib/ships/adapters/manual'
import type { Ship } from '../../types'
import { manualShipSeeds } from './manualSeeds'

export const shipRecords = manualShipSeeds.map((seed) =>
  normalizeManualShipRecord(seed)
)

export const shipThresholds: Ship[] = shipRecords.map((record) => ({
  manufacturer: record.manufacturer,
  name: record.name,
  sizeGroup: record.sizeGroup,
  health: record.health,
  ballisticThreshold: record.ballisticThreshold,
  energyThreshold: record.energyThreshold,
}))
