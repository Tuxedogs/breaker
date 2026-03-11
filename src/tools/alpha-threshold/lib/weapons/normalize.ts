import type { WeaponRecord } from '../../types'

export const WEAPON_SIZE_ORDER = [1, 2, 3, 4, 5, 6, 7, 8]

export function parseWeaponSize(size: string | number): number {
  if (typeof size === 'number') return size

  const parsedSize = Number.parseInt(String(size).replace(/[^0-9]/g, ''), 10)
  return Number.isNaN(parsedSize) ? 0 : parsedSize
}

export function normalizeWeaponClass(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function inferWeaponClass(name: string): string {
  const normalizedName = name.toLowerCase()

  if (normalizedName.includes('mass driver')) return 'mass driver'
  if (normalizedName.includes('scatter')) return 'scattergun'
  if (normalizedName.includes('gatling')) return 'gatling'
  if (normalizedName.includes('cannon')) return 'cannon'
  if (normalizedName.includes('repeater')) return 'repeater'

  return 'other'
}

export function createWeaponId({
  damageType,
  size,
  name,
}: Pick<WeaponRecord, 'damageType' | 'size' | 'name'>): string {
  return `${damageType}:${size}:${name}`
}

export function formatWeaponSizeLabel(size: number): string {
  return `S${size}`
}

export function formatWeaponClassLabel(weaponClass: string): string {
  return weaponClass
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
