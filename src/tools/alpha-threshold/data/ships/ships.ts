import { normalizeErkulShip } from '../../lib/ships/adapters/erkul'
import { normalizeManualShipRecord } from '../../lib/ships/adapters/manual'
import { normalizeShipName } from '../../lib/ships/normalize'
import { normalizeSpviewerShip } from '../../lib/ships/adapters/spviewer'
import { mergeShipRecords } from '../../lib/ships/merge'
import type { ShipRecord } from '../../lib/ships/types'
import type { AttackerHardpointProfile, Ship, ShipDefenseProfile, ThresholdDataSourceKey } from '../../types'
import { erkulLiveShipSeeds } from './erkulLiveSeeds'
import { erkulPtuShipSeeds } from './erkulPtuSeeds'
import { manualShipSeeds } from './manualSeeds'
import { spviewerShipSeeds } from './spviewerSeeds'
import { shipCardStats } from './cardStats'
import { erkulLiveShipDefenseProfiles } from '../shields/erkulLiveShipDefenseProfiles'
import { erkulPtuShipDefenseProfiles } from '../shields/erkulPtuShipDefenseProfiles'
import { observedBreakpoints } from './observedBreakpoints'
import { shipWikiImages } from './wikiImages'

function getDefenseProfileKey(name: string) {
  return normalizeShipName(name).toLowerCase()
}

const liveDefenseProfileMap = new Map<string, ShipDefenseProfile>(
  erkulLiveShipDefenseProfiles.map((profile) => [getDefenseProfileKey(profile.name), profile as ShipDefenseProfile])
)
const ptuDefenseProfileMap = new Map<string, ShipDefenseProfile>(
  erkulPtuShipDefenseProfiles.map((profile) => [getDefenseProfileKey(profile.name), profile as ShipDefenseProfile])
)

function getDefenseProfile(record: ShipRecord, source: ThresholdDataSourceKey) {
  const key = getDefenseProfileKey(record.name)

  if (source === 'erkul-live') return liveDefenseProfileMap.get(key)
  if (source === 'erkul-ptu') return ptuDefenseProfileMap.get(key)

  if (source === 'merged') {
    return liveDefenseProfileMap.get(key) ?? ptuDefenseProfileMap.get(key)
  }

  return undefined
}

function getObservedBreakpoints(record: ShipRecord, defenseProfile?: ShipDefenseProfile) {
  const byRecordId = observedBreakpoints[record.id as keyof typeof observedBreakpoints]
  if (byRecordId) return byRecordId

  if (defenseProfile?.id) {
    return observedBreakpoints[defenseProfile.id as keyof typeof observedBreakpoints]
  }

  return undefined
}

function toShip(record: ShipRecord, source: ThresholdDataSourceKey): Ship {
  const imageKey = `${record.manufacturer}::${record.name}`.toLowerCase() as keyof typeof shipWikiImages
  const wikiImage = shipWikiImages[imageKey]
  const cardStatsKey = `${record.manufacturer}::${record.name}`.toLowerCase() as keyof typeof shipCardStats
  const cardStats = shipCardStats[cardStatsKey]
  const defenseProfile = getDefenseProfile(record, source)
  const observed = getObservedBreakpoints(record, defenseProfile)

  return {
    id: record.id,
    manufacturer: record.manufacturer,
    name: record.name,
    role: record.role ?? null,
    career: record.career ?? null,
    isGroundVehicle: record.isGroundVehicle ?? false,
    source,
    imageSrc: wikiImage?.imageSrc,
    imageAlt: wikiImage?.imageAlt,
    scmSpeed: cardStats?.scmSpeed ?? null,
    navSpeed: cardStats?.navSpeed ?? null,
    noiseCount: cardStats?.noiseCount ?? null,
    decoyCount: cardStats?.decoyCount ?? null,
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
    defenseProfile: defenseProfile
      ? {
          ...defenseProfile,
          ...(observed ? { observedBreakpoints: observed } : {}),
        }
      : undefined,
  }
}

const manualRecords = manualShipSeeds.map((seed) => normalizeManualShipRecord(seed))
const erkulLiveRecords = erkulLiveShipSeeds.map((seed) => normalizeErkulShip(seed as Record<string, unknown>))
const erkulPtuRecords = erkulPtuShipSeeds.map((seed) => normalizeErkulShip(seed as Record<string, unknown>))
const spviewerRecords = spviewerShipSeeds.map((seed) => normalizeSpviewerShip(seed as Record<string, unknown>))

const shipRecordDatasets: Record<ThresholdDataSourceKey, ShipRecord[]> = {
  manual: manualRecords,
  'erkul-live': erkulLiveRecords,
  'erkul-ptu': erkulPtuRecords,
  spviewer: spviewerRecords,
  merged: mergeShipRecords([
    ...manualRecords,
    ...spviewerRecords,
    ...erkulLiveRecords,
    ...erkulPtuRecords,
  ]),
}

const shipDatasets: Record<ThresholdDataSourceKey, Ship[]> = Object.fromEntries(
  Object.entries(shipRecordDatasets).map(([key, records]) => [
    key,
    records.map((record) => toShip(record, key as ThresholdDataSourceKey)),
  ])
) as Record<ThresholdDataSourceKey, Ship[]>

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

const attackerHardpointProfileMaps: Record<ThresholdDataSourceKey, Map<string, AttackerHardpointProfile>> =
  Object.fromEntries(
    Object.entries(shipRecordDatasets).map(([key, records]) => [
      key,
      new Map(records.map((record) => [record.name, toAttackerHardpointProfile(record)])),
    ])
  ) as Record<ThresholdDataSourceKey, Map<string, AttackerHardpointProfile>>

export const shipThresholds = shipDatasets.merged
export const shipRecords = shipRecordDatasets.merged

export function getShipRecordsForSource(source: ThresholdDataSourceKey): ShipRecord[] {
  return shipRecordDatasets[source]
}

export function getShipThresholdsForSource(source: ThresholdDataSourceKey): Ship[] {
  return shipDatasets[source]
}

export function getAttackerHardpointProfile(
  shipName: string,
  source: ThresholdDataSourceKey = 'merged'
): AttackerHardpointProfile {
  return attackerHardpointProfileMaps[source].get(shipName) ?? {
    shipName,
    ...FALLBACK_PROFILE,
  }
}
