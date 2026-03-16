import { createShipId, normalizeShipManufacturer, normalizeShipName, normalizeShipSizeGroup } from '../normalize'
import type { ShipRecord, ShipSizeGroup } from '../types'

type JsonRecord = Record<string, unknown>

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : null
}

function asNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function inferManufacturer(input: JsonRecord, rawData: JsonRecord | null): string {
  if (typeof input.manufacturer === 'string' && input.manufacturer.trim()) {
    return input.manufacturer
  }

  const entityClassName = asRecord(rawData?.insurance)?.shipEntityClassName
  if (typeof entityClassName === 'string' && entityClassName.includes('_')) {
    return entityClassName.split('_')[0]
  }

  return ''
}

function inferSizeGroup(input: JsonRecord, rawData: JsonRecord | null): ShipSizeGroup {
  if (typeof input.sizeGroup === 'string') {
    return normalizeShipSizeGroup(input.sizeGroup as ShipSizeGroup)
  }

  const size = asNumber(rawData?.size, -1)
  if (size >= 5) return 'capital'
  if (size >= 4) return 'large'
  if (size >= 3) return 'medium'
  return 'small'
}

function flattenHullParts(parts: unknown, result: Array<{ name: string; hp: number }> = []) {
  if (!Array.isArray(parts)) return result

  for (const part of parts) {
    const partRecord = asRecord(part)
    if (!partRecord) continue

    const name = typeof partRecord.name === 'string' ? partRecord.name : ''
    const hp = asNumber(partRecord.hp, 0)

    if (name && hp > 0) {
      result.push({ name, hp })
    }

    flattenHullParts(partRecord.parts, result)
  }

  return result
}

function inferVitalHp(rawData: JsonRecord | null, fallback: number): number {
  const hull = asRecord(rawData?.hull)
  const allParts = flattenHullParts(hull?.hp)
  if (!allParts.length) return fallback

  const preferredPart = allParts
    .filter((part) => /cockpit|canopy|bridge|pilot|command|neck|nose|body|core/i.test(part.name))
    .sort((left, right) => right.hp - left.hp)[0]

  if (preferredPart) return preferredPart.hp

  return allParts.sort((left, right) => right.hp - left.hp)[0]?.hp ?? fallback
}

function extractNestedWeaponSize(port: JsonRecord): number | null {
  const loadout = Array.isArray(port.loadout) ? port.loadout : []

  for (const entry of loadout) {
    const child = asRecord(entry)
    if (!child) continue

    const itemPortName = typeof child.itemPortName === 'string' ? child.itemPortName : ''
    const directMatch = itemPortName.match(/hardpoint_class_(\d+)/i)
    if (directMatch) return asNumber(directMatch[1], 0)

    const nestedSize = extractNestedWeaponSize(child)
    if (nestedSize !== null) return nestedSize

    const localName = typeof child.localName === 'string' ? child.localName : ''
    const localMatch = localName.match(/_s(\d+)/i)
    if (localMatch) return asNumber(localMatch[1], 0)
  }

  return null
}

function buildHardpointSummary(rawData: JsonRecord | null) {
  const groups = new Map<string, NonNullable<ShipRecord['hardpointGroups']>[number]>()
  const loadout = Array.isArray(rawData?.loadout) ? rawData.loadout : []

  for (const entry of loadout) {
    const port = asRecord(entry)
    if (!port) continue

    const itemTypes = Array.isArray(port.itemTypes) ? port.itemTypes : []
    const itemPortName = typeof port.itemPortName === 'string' ? port.itemPortName : ''
    const role = itemTypes.some((type) => asRecord(type)?.type === 'TurretBase') || /turret/i.test(itemPortName)
      ? 'turret'
      : itemTypes.some((type) => asRecord(type)?.type === 'WeaponGun') || /weapon/i.test(itemPortName)
        ? 'pilot'
        : null

    if (!role) continue

    const size = extractNestedWeaponSize(port) ?? asNumber(port.maxSize, 0)
    if (size <= 0) continue

    const key = `${role}:${size}`
    const existing = groups.get(key)
    if (existing) {
      existing.count += 1
      continue
    }

    groups.set(key, {
      id: key,
      role,
      label: `${role === 'pilot' ? 'Pilot' : 'Turret'} S${size}`,
      size,
      count: 1,
    })
  }

  const hardpointGroups = Array.from(groups.values())
  const pilotHardpointSize = hardpointGroups
    .filter((group) => group.role === 'pilot')
    .reduce<number | null>((max, group) => (max === null || group.size > max ? group.size : max), null)
  const turretHardpointSize = hardpointGroups
    .filter((group) => group.role === 'turret')
    .reduce<number | null>((max, group) => (max === null || group.size > max ? group.size : max), null)

  return {
    hardpointGroups,
    pilotHardpointSize,
    turretHardpointSize,
  }
}

export function normalizeErkulShip(
  input: Record<string, unknown>
): ShipRecord {
  const rawData = asRecord(input.data)
  const rawArmor = asRecord(rawData?.armor)
  const rawArmorData = asRecord(rawArmor?.data)
  const rawArmorHealth = asRecord(rawArmorData?.health)
  const rawArmorStats = asRecord(rawArmorData?.armor)
  const rawArmorDeflection = asRecord(rawArmorStats?.armorDeflection)
  const manufacturer = normalizeShipManufacturer(inferManufacturer(input, rawData))
  const name = normalizeShipName(String(input.name ?? rawData?.shortName ?? rawData?.name ?? ''))
  const health = asNumber(input.health ?? asRecord(rawData?.hull)?.totalHp ?? asRecord(rawData?.health)?.hp, 0)
  const ballisticThreshold = Math.round(
    asNumber(input.ballisticThreshold ?? rawArmorDeflection?.damagePhysical)
  )
  const energyThreshold = Math.round(
    asNumber(input.energyThreshold ?? rawArmorDeflection?.damageEnergy)
  )
  const armorHp = asNumber(input.armorHp ?? rawArmorHealth?.hp, health)
  const vitalHp = asNumber(input.vitalHp, inferVitalHp(rawData, health))
  const { hardpointGroups, pilotHardpointSize, turretHardpointSize } = buildHardpointSummary(rawData)
  const armor = asNumber(input.armor, Math.max(0, Math.round((ballisticThreshold + energyThreshold) / 2)))

  return {
    id: createShipId({ manufacturer, name }),
    manufacturer,
    name,
    sizeGroup: inferSizeGroup(input, rawData),
    health,
    armor,
    armorHp,
    vitalHp,
    ballisticThreshold,
    energyThreshold,
    history: Array.isArray(input.history) ? (input.history as ShipRecord['history']) : [],
    hardpointGroups,
    source: 'erkul',
    sourceId: String(input.id ?? rawData?.ref ?? rawData?.name ?? ''),
    patch: typeof input.patch === 'string' ? input.patch : undefined,
    pilotHardpointSize: typeof input.pilotHardpointSize === 'number' ? input.pilotHardpointSize : pilotHardpointSize,
    turretHardpointSize: typeof input.turretHardpointSize === 'number' ? input.turretHardpointSize : turretHardpointSize,
  }
}
