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
  armor: record.armor,
  armorHp: record.armorHp,
  vitalHp: record.vitalHp,
  ballisticThreshold: record.ballisticThreshold,
  energyThreshold: record.energyThreshold,
  patch: record.patch,
  history: record.history ?? [],
  hardpointGroups: record.hardpointGroups,
}))
