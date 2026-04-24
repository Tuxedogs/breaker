import { getWeaponKey } from './calculations'
import {
  type ShipPresetDefinition,
  type ShipPresetEntry,
  type WeaponPresetDefinition,
  type WeaponPresetEntry,
  type WeaponSizePresetDefinition,
} from '../data/presets'
import type { Ship, WeaponRecord } from '../types'

function normalizeToken(value: string | null | undefined) {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replaceAll('_', ' ')
    .replace(/\s+/g, ' ')
}

function toShipSelectionKey(ship: Pick<Ship, 'manufacturer' | 'name'>): string {
  return `${ship.manufacturer}::${ship.name}`
}

function resolveShipEntry(
  entry: ShipPresetEntry,
  ships: Ship[],
  shipSelectionKeySet: Set<string>
): string | null {
  if (entry.selectionKey && shipSelectionKeySet.has(entry.selectionKey)) {
    return entry.selectionKey
  }

  if (entry.shipId) {
    const byId = ships.find((ship) => ship.id === entry.shipId)
    if (byId) return toShipSelectionKey(byId)
  }

  const manufacturer = normalizeToken(entry.manufacturer)
  const name = normalizeToken(entry.name)

  if (!manufacturer && !name) {
    return null
  }

  const fallback = ships.find((ship) => {
    const sameManufacturer = !manufacturer || normalizeToken(ship.manufacturer) === manufacturer
    const sameName = !name || normalizeToken(ship.name) === name
    return sameManufacturer && sameName
  })

  return fallback ? toShipSelectionKey(fallback) : null
}

function resolveWeaponEntry(entry: WeaponPresetEntry, weapons: WeaponRecord[]): string | null {
  if (entry.weaponKey) {
    const byKey = weapons.find((weapon) => getWeaponKey(weapon) === entry.weaponKey)
    if (byKey) return getWeaponKey(byKey)
  }

  if (entry.weaponId) {
    const byId = weapons.find((weapon) => weapon.id === entry.weaponId)
    if (byId) return getWeaponKey(byId)
  }

  const name = normalizeToken(entry.name)

  const fallback = weapons.find((weapon) => {
    const sameName = !name || normalizeToken(weapon.name) === name
    const sameSize = entry.size == null || weapon.size === entry.size
    const sameDamageType = entry.damageType == null || weapon.damageType === entry.damageType
    return sameName && sameSize && sameDamageType
  })

  return fallback ? getWeaponKey(fallback) : null
}

function weaponSort(left: WeaponRecord, right: WeaponRecord) {
  if (left.size !== right.size) return left.size - right.size
  return left.name.localeCompare(right.name)
}

function devWarn(message: string) {
  if (!import.meta.env.DEV) return
  console.warn(`[alpha-threshold presets] ${message}`)
}

export function resolveShipPresetSelection(
  preset: ShipPresetDefinition | null | undefined,
  ships: Ship[],
  slotLimit: number
) {
  if (!preset) return []

  const shipSelectionKeySet = new Set(ships.map((ship) => toShipSelectionKey(ship)))
  const resolved = preset.entries
    .slice(0, slotLimit)
    .map((entry, index) => {
      const key = resolveShipEntry(entry, ships, shipSelectionKeySet)
      if (!key) {
        devWarn(`Ship preset "${preset.id}" entry ${index + 1} could not be resolved and was skipped.`)
      }
      return key
    })
    .filter((key): key is string => Boolean(key))

  if (preset.entries.length > slotLimit) {
    devWarn(`Ship preset "${preset.id}" has ${preset.entries.length} entries but only ${slotLimit} slots exist.`)
  }

  return resolved
}

function resolveExplicitWeaponEntries(
  preset: WeaponPresetDefinition,
  weapons: WeaponRecord[],
  slotLimit: number
) {
  if (!preset.entries?.length) return null

  const resolved = preset.entries
    .slice(0, slotLimit)
    .map((entry, index) => {
      const key = resolveWeaponEntry(entry, weapons)
      if (!key) {
        devWarn(`Weapon preset "${preset.id}" entry ${index + 1} could not be resolved and was skipped.`)
      }
      return key
    })
    .filter((key): key is string => Boolean(key))

  if (preset.entries.length > slotLimit) {
    devWarn(
      `Weapon preset "${preset.id}" has ${preset.entries.length} entries but only ${slotLimit} slots exist.`
    )
  }

  return resolved
}

export function resolveWeaponPresetSelection(
  preset: WeaponPresetDefinition | null | undefined,
  weapons: WeaponRecord[],
  slotLimit: number,
  options?: {
    sizePreset?: WeaponSizePresetDefinition | null
  }
) {
  if (!preset) return []

  const explicitEntries = resolveExplicitWeaponEntries(preset, weapons, slotLimit)
  if (explicitEntries) return explicitEntries

  if (!preset.filter) return []

  const sizeSet = new Set(options?.sizePreset?.sizes ?? [])
  const resolved = weapons
    .filter((weapon) => {
      const sizeAllowed = sizeSet.size === 0 || sizeSet.has(weapon.size)
      return (
        sizeAllowed &&
        weapon.damageType === preset.filter?.damageType &&
        normalizeToken(weapon.weaponClass) === normalizeToken(preset.filter?.weaponClass)
      )
    })
    .sort(weaponSort)

  if (resolved.length === 0) {
    const sizeLabel = options?.sizePreset?.name ? ` for size preset "${options.sizePreset.name}"` : ''
    devWarn(`Weapon preset "${preset.id}" resolved no weapons${sizeLabel}.`)
  }

  if (resolved.length > slotLimit) {
    devWarn(
      `Weapon preset "${preset.id}" resolved ${resolved.length} weapons but only ${slotLimit} slots exist.`
    )
  }

  return resolved.slice(0, slotLimit).map((weapon) => getWeaponKey(weapon))
}
