import { normalizeErkulWeapon } from '../../lib/weapons/adapters/erkul'
import { normalizeManualWeaponRecord } from '../../lib/weapons/adapters/manual'
import { normalizeSpviewerWeapon } from '../../lib/weapons/adapters/spviewer'
import { mergeWeaponRecords } from '../../lib/weapons/merge'
import type { WeaponRecord } from '../../types'
import { erkulWeaponSeeds } from './erkulSeeds'
import { manualWeaponSeeds } from './manualSeeds'
import { spviewerWeaponSeeds } from './spviewerSeeds'

const sourceRecords = [
  ...spviewerWeaponSeeds.map((seed) => normalizeSpviewerWeapon({ ...seed })),
  ...erkulWeaponSeeds.map((seed) => normalizeErkulWeapon({ ...seed })),
]

const manualRecords = manualWeaponSeeds.map((weaponSeed) =>
  normalizeManualWeaponRecord(weaponSeed)
)

export const weapons: WeaponRecord[] = mergeWeaponRecords([
  ...manualRecords,
  ...sourceRecords,
])
