import { normalizeErkulShip } from '../../lib/ships/adapters/erkul'
import { normalizeManualShipRecord } from '../../lib/ships/adapters/manual'
import { normalizeSpviewerShip } from '../../lib/ships/adapters/spviewer'
import { mergeShipRecords } from '../../lib/ships/merge'
import type { ShipRecord } from '../../lib/ships/types'
import type { AttackerHardpointProfile, Ship, ThresholdDataSourceKey } from '../../types'
import { erkulLiveShipSeeds } from './erkulLiveSeeds'
import { erkulPtuShipSeeds } from './erkulPtuSeeds'
import { manualShipSeeds } from './manualSeeds'
import { spviewerShipSeeds } from './spviewerSeeds'
import { shipCardStats } from './cardStats'
import { shipWikiImages } from './wikiImages'

function toShip(record: ShipRecord): Ship {
  const imageKey = `${record.manufacturer}::${record.name}`.toLowerCase() as keyof typeof shipWikiImages
  const wikiImage = shipWikiImages[imageKey]
  const cardStatsKey = `${record.manufacturer}::${record.name}`.toLowerCase() as keyof typeof shipCardStats
  const cardStats = shipCardStats[cardStatsKey]

  return {
    manufacturer: record.manufacturer,
    name: record.name,
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
  Object.entries(shipRecordDatasets).map(([key, records]) => [key, records.map(toShip)])
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
