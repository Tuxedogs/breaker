import type { WeaponDamageType, WeaponRecord } from '../../types'

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
  if (
    /(^|\b)(9-series|10-series|11-series|havoc|jericho|liberator|tigerstrike|t a r a n t u l a|tarantula|yebira|viselock)(\b|$)/.test(
      normalizedName
    )
  ) {
    return 'mass driver'
  }

  if (
    /(^|\b)(scorpion|buzzsaw|sawbuck|yellowjacket|gatling)(\b|$)/.test(
      normalizedName
    )
  ) {
    return 'gatling'
  }

  if (normalizedName.includes('scatter')) return 'scattergun'
  if (
    /(^|\b)(dominance|swarm)(\b|$)/.test(normalizedName)
  ) {
    return 'scattergun'
  }

  if (
    /(^|\b)(attrition|ardor|bulldog|badger|panther|model-xj|fl-\d+|ndb-\d+|nn-\d+|suckerpunch|wasp|whip|weak|warlord)(\b|$)/.test(
      normalizedName
    )
  ) {
    return 'repeater'
  }

  if (normalizedName.includes('gatling')) return 'gatling'
  if (normalizedName.includes('cannon')) return 'cannon'
  if (normalizedName.includes('repeater')) return 'repeater'

  if (
    /(^|\b)(deadbolt|omnisky|lightstrike|singe|torrent|thlilye|m\d+a|atvs|brvs|cvsa|evsd|gvsr|mvsa|suregrip)(\b|$)/.test(
      normalizedName
    )
  ) {
    return 'cannon'
  }

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

export function formatWeaponTypeLabel({
  damageType,
  weaponClass,
}: {
  damageType: WeaponDamageType
  weaponClass: string
}): string {
  const normalizedClass = normalizeWeaponClass(weaponClass)

  if (
    normalizedClass.startsWith('ballistic ') ||
    normalizedClass.startsWith('laser ') ||
    normalizedClass.startsWith('energy ') ||
    normalizedClass.startsWith('distortion ') ||
    normalizedClass.startsWith('plasma ') ||
    normalizedClass.startsWith('tachyon ')
  ) {
    return formatWeaponClassLabel(normalizedClass)
  }

  if (weaponClass === 'other') {
    return `${formatWeaponClassLabel(damageType)} Weapon`
  }

  if (normalizedClass === 'cannon' && damageType === 'ballistic') {
    return 'Mass Cannon'
  }

  return `${formatWeaponClassLabel(damageType)} ${formatWeaponClassLabel(
    normalizedClass
  )}`
}
