import { normalizeErkulShip } from '../../lib/ships/adapters/erkul'
import { normalizeManualShipRecord } from '../../lib/ships/adapters/manual'
import { normalizeSpviewerShip } from '../../lib/ships/adapters/spviewer'
import { mergeShipRecords } from '../../lib/ships/merge'
import type { ShipRecord } from '../../lib/ships/types'
import type { AttackerHardpointProfile, Ship } from '../../types'
import { erkulShipSeeds } from './erkulSeeds'
import { manualShipSeeds } from './manualSeeds'
import { spviewerShipSeeds } from './spviewerSeeds'

const sourceRecords = [
  ...spviewerShipSeeds.map((seed) => normalizeSpviewerShip({ ...seed })),
  ...erkulShipSeeds.map((seed) => normalizeErkulShip({ ...seed })),
]

const manualRecords = manualShipSeeds.map((seed) => normalizeManualShipRecord(seed))

export const shipRecords = mergeShipRecords([
  ...manualRecords,
  ...sourceRecords,
])

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

const FALLBACK_PROFILE: Omit<AttackerHardpointProfile, 'shipName'> = {
  pilotHardpointSize: null,
  turretHardpointSize: null,
}

function toAttackerHardpointProfile(record: ShipRecord): AttackerHardpointProfile {
  return {
    shipName: record.name,
    pilotHardpointSize: record.pilotHardpointSize ?? null,
    turretHardpointSize: record.turretHardpointSize ?? null,
  }
}

const attackerHardpointProfileMap = new Map(
  shipRecords.map((record) => [record.name, toAttackerHardpointProfile(record)])
)

export function getAttackerHardpointProfile(shipName: string): AttackerHardpointProfile {
  return attackerHardpointProfileMap.get(shipName) ?? {
    shipName,
    ...FALLBACK_PROFILE,
  }
}
