import type {
  GroupedWeaponClass,
  GroupedWeaponDamageType,
  GroupedWeaponSize,
  WeaponRecord,
  WeaponThresholdType,
} from './types'
import {
  formatWeaponSizeLabel,
} from './normalize'

const WEAPON_CLASS_ORDER = [
  'repeater',
  'cannon',
  'gatling',
  'scattergun',
  'mass driver',
  'other',
] as const

export function filterWeaponRecords(
  weapons: WeaponRecord[],
  query: string
): WeaponRecord[] {
  const normalizedQuery = query.trim().toLowerCase()

  if (!normalizedQuery) return weapons

  return weapons.filter((weapon) => {
    const haystack = [
      weapon.name,
      formatWeaponSizeLabel(weapon.size),
      weapon.damageType,
      weapon.weaponClass,
      weapon.alpha ?? '',
      weapon.burstDps ?? '',
      weapon.projectileSpeed ?? '',
      weapon.source ?? '',
      weapon.patch ?? '',
    ]
      .join(' ')
      .toLowerCase()

    return haystack.includes(normalizedQuery)
  })
}

function sortWeaponClassGroups(left: GroupedWeaponClass, right: GroupedWeaponClass) {
  const leftIndex = WEAPON_CLASS_ORDER.indexOf(
    left.weaponClass as (typeof WEAPON_CLASS_ORDER)[number]
  )
  const rightIndex = WEAPON_CLASS_ORDER.indexOf(
    right.weaponClass as (typeof WEAPON_CLASS_ORDER)[number]
  )

  if (leftIndex === -1 && rightIndex === -1) {
    return left.weaponClass.localeCompare(right.weaponClass)
  }

  if (leftIndex === -1) return 1
  if (rightIndex === -1) return -1

  return leftIndex - rightIndex
}

function sortWeaponRecords(left: WeaponRecord, right: WeaponRecord) {
  const leftAlpha = left.alpha ?? -1
  const rightAlpha = right.alpha ?? -1

  if (leftAlpha !== rightAlpha) return rightAlpha - leftAlpha

  return left.name.localeCompare(right.name)
}

export function groupWeaponRecords(
  weapons: WeaponRecord[]
): GroupedWeaponSize[] {
  const sizes = new Map<number, Map<WeaponThresholdType, Map<string, WeaponRecord[]>>>()

  weapons.forEach((weapon) => {
    if (weapon.damageType === 'distortion') return

    const sizeGroup =
      sizes.get(weapon.size) ??
      new Map<WeaponThresholdType, Map<string, WeaponRecord[]>>()
    const damageTypeGroup =
      sizeGroup.get(weapon.damageType) ?? new Map<string, WeaponRecord[]>()
    const classGroup = damageTypeGroup.get(weapon.weaponClass) ?? []

    classGroup.push(weapon)
    damageTypeGroup.set(weapon.weaponClass, classGroup)
    sizeGroup.set(weapon.damageType, damageTypeGroup)
    sizes.set(weapon.size, sizeGroup)
  })

  return Array.from(sizes.entries())
    .sort((left, right) => left[0] - right[0])
    .map(([size, damageTypeMap]) => {
      const damageTypes: GroupedWeaponDamageType[] = ([
        'ballistic',
        'energy',
      ] as const)
        .map((damageType) => {
          const classMap = damageTypeMap.get(damageType)

          if (!classMap || classMap.size === 0) return null

          const classes: GroupedWeaponClass[] = Array.from(classMap.entries())
            .map(([weaponClass, groupedWeapons]) => ({
              weaponClass,
              weapons: [...groupedWeapons].sort(sortWeaponRecords),
            }))
            .sort(sortWeaponClassGroups)

          return {
            damageType,
            classes,
          }
        })
        .filter(Boolean) as GroupedWeaponDamageType[]

      return {
        size,
        damageTypes,
      }
    })
    .filter((group) => group.damageTypes.length > 0)
}
