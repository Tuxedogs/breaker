import { normalizeErkulWeapon } from '../../lib/weapons/adapters/erkul'
import { normalizeManualWeaponRecord } from '../../lib/weapons/adapters/manual'
import { normalizeSpviewerWeapon } from '../../lib/weapons/adapters/spviewer'
import { mergeWeaponRecords } from '../../lib/weapons/merge'
import type { ThresholdDataSourceKey, WeaponRecord } from '../../types'
import { erkulLiveWeaponSeeds } from './erkulLiveSeeds'
import { erkulPtuWeaponSeeds } from './erkulPtuSeeds'
import { manualWeaponSeeds } from './manualSeeds'
import { spviewerWeaponSeeds } from './spviewerSeeds'

const manualRecords = manualWeaponSeeds.map((weaponSeed) =>
  normalizeManualWeaponRecord(weaponSeed)
)
const erkulLiveRecords = erkulLiveWeaponSeeds.map((seed) => normalizeErkulWeapon(seed))
const erkulPtuRecords = erkulPtuWeaponSeeds.map((seed) => normalizeErkulWeapon(seed))
const spviewerRecords = spviewerWeaponSeeds.map((seed) => normalizeSpviewerWeapon(seed))

const weaponDatasets: Record<ThresholdDataSourceKey, WeaponRecord[]> = {
  manual: manualRecords,
  'erkul-live': erkulLiveRecords,
  'erkul-ptu': erkulPtuRecords,
  spviewer: spviewerRecords,
  merged: mergeWeaponRecords([
    ...manualRecords,
    ...spviewerRecords,
    ...erkulLiveRecords,
    ...erkulPtuRecords,
  ]),
}

export const weapons: WeaponRecord[] = weaponDatasets.merged

export function getWeaponsForSource(source: ThresholdDataSourceKey): WeaponRecord[] {
  return weaponDatasets[source]
}
