import { normalizeErkulWeapon } from '../../lib/weapons/adapters/erkul'
import { normalizeManualWeaponRecord } from '../../lib/weapons/adapters/manual'
import { normalizeSpviewerWeapon } from '../../lib/weapons/adapters/spviewer'
import { isExcludedFromThresholdWeaponPool } from '../../lib/weapons/exclusions'
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

function filterThresholdWeaponPool(records: WeaponRecord[]): WeaponRecord[] {
  return records.filter((weapon) => !isExcludedFromThresholdWeaponPool(weapon))
}

const weaponDatasets: Record<ThresholdDataSourceKey, WeaponRecord[]> = {
  manual: filterThresholdWeaponPool(manualRecords),
  'erkul-live': filterThresholdWeaponPool(erkulLiveRecords),
  'erkul-ptu': filterThresholdWeaponPool(erkulPtuRecords),
  spviewer: filterThresholdWeaponPool(spviewerRecords),
  merged: mergeWeaponRecords([
    ...filterThresholdWeaponPool(manualRecords),
    ...filterThresholdWeaponPool(spviewerRecords),
    ...filterThresholdWeaponPool(erkulLiveRecords),
    ...filterThresholdWeaponPool(erkulPtuRecords),
  ]),
}

export const weapons: WeaponRecord[] = weaponDatasets.merged

export function getWeaponsForSource(source: ThresholdDataSourceKey): WeaponRecord[] {
  return weaponDatasets[source]
}
