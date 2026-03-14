import { useEffect, useMemo } from 'react'
import { shipThresholds } from '../data/shipThresholds'
import { resolveShipHardpointGroups } from '../data/ships/hardpointProfiles'
import { weapons } from '../data/weapons/weapons'
import {
  buildAxisMaxByType,
  buildSelectedShipResult,
  getDefaultCollapsedGroups,
  getDefaultSelectedShips,
  getWeaponKey,
  resolveAxisMaxByType,
  SHIP_SIZE_GROUPS,
} from '../lib/calculations'
import { mergeShipOverride, mergeWeaponOverride } from '../lib/mergeOverrides'
import { sortShips } from '../lib/sortShips'
import type {
  AxisScaleMode,
  ComparisonSlot,
  Ship,
  ShipBalanceChangeEntry,
  ShipBalanceSnapshot,
  ShipHardpointGroup,
  SelectedWeaponComparison,
  ShipSidebarGroup,
  ShipSortKey,
  ShipSizeGroup,
  SlotTone,
  WeaponRecord,
  WeaponThresholdType,
} from '../types'
import { useLocalStorageState } from './useLocalStorageState'
import { useOverrides } from './useOverrides'

const SLOT_TONES: SlotTone[] = ['cyan', 'violet', 'amber', 'emerald']
const VALID_SORT_KEYS: ShipSortKey[] = [
  'health-desc',
  'ballistic-desc',
  'energy-desc',
  'manufacturer-asc',
]
const VALID_AXIS_SCALE_MODES: AxisScaleMode[] = ['global', 'by-size', 'per-row']

function buildDefaultSlots(): ComparisonSlot[] {
  return [
    { id: 'slot-1', weaponKey: null, label: 'Pilot Group 1', size: 3, count: 1 },
  ]
}

function buildSlotsFromHardpointGroups(
  hardpointGroups: ShipHardpointGroup[]
): ComparisonSlot[] {
  if (hardpointGroups.length === 0) return buildDefaultSlots()

  return hardpointGroups.map((group) => ({
    id: group.id,
    weaponKey: null,
    label: group.label,
    role: group.role,
    size: group.size,
    count: group.count,
  }))
}

function isComparisonSlot(value: unknown): value is ComparisonSlot {
  if (!value || typeof value !== 'object') return false

  const slot = value as ComparisonSlot

  return (
    typeof slot.id === 'string' &&
    (typeof slot.weaponKey === 'string' || slot.weaponKey === null) &&
    (slot.label === undefined || typeof slot.label === 'string') &&
    (slot.role === undefined || slot.role === 'pilot' || slot.role === 'turret') &&
    (slot.size === undefined || typeof slot.size === 'number') &&
    (slot.count === undefined || typeof slot.count === 'number')
  )
}

function normalizeSlots(
  value: ComparisonSlot[],
  hardpointGroups: ShipHardpointGroup[]
): ComparisonSlot[] {
  const defaults = buildSlotsFromHardpointGroups(hardpointGroups)

  if (Array.isArray(value) && value.every(isComparisonSlot)) {
    const previousById = new Map(
      value.map((slot) => [slot.id, slot] as const)
    )

    return defaults.map((fallbackSlot) => ({
      ...fallbackSlot,
      weaponKey: previousById.get(fallbackSlot.id)?.weaponKey ?? null,
    }))
  }

  if (value && typeof value === 'object') {
    const legacyValue = value as {
      ballistic?: Array<{ id?: string; weaponName?: string | null }>
      energy?: Array<{ id?: string; weaponName?: string | null }>
    }

    const legacySlots = [
      ...(legacyValue.ballistic ?? []),
      ...(legacyValue.energy ?? []),
    ]
      .filter((slot) => typeof slot?.weaponName === 'string' && slot.weaponName)
      .slice(0, 4)

    return defaults.map((fallbackSlot, index) => ({
      id: legacySlots[index]?.id || fallbackSlot.id,
      weaponKey: null,
      label: fallbackSlot.label,
      role: fallbackSlot.role,
      size: fallbackSlot.size,
      count: fallbackSlot.count,
    }))
  }

  return defaults
}

function normalizeSortKey(value: ShipSortKey): ShipSortKey {
  return VALID_SORT_KEYS.includes(value) ? value : 'health-desc'
}

function normalizeAxisScaleMode(value: AxisScaleMode): AxisScaleMode {
  return VALID_AXIS_SCALE_MODES.includes(value) ? value : 'by-size'
}

function normalizeSelectedShipNames(value: string[]): string[] {
  if (!Array.isArray(value)) return getDefaultSelectedShips()

  const shipNames = new Set(shipThresholds.map((ship) => ship.name))
  const next = value.filter((shipName) => shipNames.has(shipName))

  return next.length > 0 ? next : getDefaultSelectedShips()
}

function normalizeCollapsedGroups(
  value: Record<ShipSizeGroup, boolean>
): Record<ShipSizeGroup, boolean> {
  const defaults = getDefaultCollapsedGroups()

  if (!value || typeof value !== 'object') {
    return defaults
  }

  return {
    capital:
      typeof value.capital === 'boolean' ? value.capital : defaults.capital,
    large: typeof value.large === 'boolean' ? value.large : defaults.large,
    medium:
      typeof value.medium === 'boolean' ? value.medium : defaults.medium,
    small: typeof value.small === 'boolean' ? value.small : defaults.small,
  }
}

function areSlotsEqual(left: ComparisonSlot[], right: ComparisonSlot[]) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function matchesShipSearch(ship: { manufacturer: string; name: string }, query: string) {
  if (!query) return true

  const haystack = `${ship.manufacturer} ${ship.name}`.toLowerCase()
  return haystack.includes(query.trim().toLowerCase())
}

function buildCurrentBalanceSnapshot(ship: Ship): ShipBalanceSnapshot {
  return {
    patch: ship.patch ?? 'Current',
    armor: ship.armor,
    ballisticThreshold: ship.ballisticThreshold,
    energyThreshold: ship.energyThreshold,
    armorHp: ship.armorHp,
    vitalHp: ship.vitalHp,
  }
}

export function useAlphaThresholdState() {
  const [sortKey, setSortKey] = useLocalStorageState<ShipSortKey>(
    'alpha-threshold.sort',
    'health-desc'
  )
  const [storedSlots, setSlots] = useLocalStorageState<ComparisonSlot[]>(
    'alpha-threshold.slots',
    buildDefaultSlots()
  )
  const [attackerShipName, setAttackerShipName] = useLocalStorageState<string | null>(
    'alpha-threshold.attacker-ship',
    null
  )
  const [selectedShipNames, setSelectedShipNames] = useLocalStorageState<string[]>(
    'alpha-threshold.selected-ships',
    getDefaultSelectedShips()
  )
  const [shipSearch, setShipSearch] = useLocalStorageState<string>(
    'alpha-threshold.ship-search',
    ''
  )
  const [showSelectedOnly, setShowSelectedOnly] = useLocalStorageState<boolean>(
    'alpha-threshold.show-selected-only',
    false
  )
  const [mobileSidebarOpen, setMobileSidebarOpen] = useLocalStorageState<boolean>(
    'alpha-threshold.mobile-sidebar-open',
    false
  )
  const [collapsedGroups, setCollapsedGroups] = useLocalStorageState<
    Record<ShipSizeGroup, boolean>
  >('alpha-threshold.collapsed-groups', getDefaultCollapsedGroups())
  const [axisScaleMode, setAxisScaleMode] = useLocalStorageState<AxisScaleMode>(
    'alpha-threshold.axis-scale-mode',
    'by-size'
  )

  const attackerShip = useMemo<Ship | null>(() => {
    if (typeof attackerShipName === 'string' && attackerShipName.length > 0) {
      return shipThresholds.find((ship) => ship.name === attackerShipName) ?? null
    }

    return shipThresholds.find((ship) => ship.name === 'Scorpius') ?? shipThresholds[0] ?? null
  }, [attackerShipName])

  const attackerHardpointGroups = useMemo(
    () => resolveShipHardpointGroups(attackerShip),
    [attackerShip]
  )

  const slots = useMemo(
    () => normalizeSlots(storedSlots, attackerHardpointGroups),
    [attackerHardpointGroups, storedSlots]
  )
  const normalizedSortKey = useMemo(
    () => normalizeSortKey(sortKey),
    [sortKey]
  )
  const normalizedSelectedShipNames = useMemo(
    () => normalizeSelectedShipNames(selectedShipNames),
    [selectedShipNames]
  )
  const normalizedCollapsedGroups = useMemo(
    () => normalizeCollapsedGroups(collapsedGroups),
    [collapsedGroups]
  )
  const normalizedAxisScaleMode = useMemo(
    () => normalizeAxisScaleMode(axisScaleMode),
    [axisScaleMode]
  )

  useEffect(() => {
    if (!areSlotsEqual(storedSlots, slots)) {
      setSlots(slots)
    }
  }, [setSlots, slots, storedSlots])

  useEffect(() => {
    if (sortKey !== normalizedSortKey) {
      setSortKey(normalizedSortKey)
    }
  }, [normalizedSortKey, setSortKey, sortKey])

  useEffect(() => {
    if (
      JSON.stringify(selectedShipNames) !==
      JSON.stringify(normalizedSelectedShipNames)
    ) {
      setSelectedShipNames(normalizedSelectedShipNames)
    }
  }, [
    normalizedSelectedShipNames,
    selectedShipNames,
    setSelectedShipNames,
  ])

  useEffect(() => {
    if (
      JSON.stringify(collapsedGroups) !==
      JSON.stringify(normalizedCollapsedGroups)
    ) {
      setCollapsedGroups(normalizedCollapsedGroups)
    }
  }, [
    collapsedGroups,
    normalizedCollapsedGroups,
    setCollapsedGroups,
  ])

  useEffect(() => {
    if (axisScaleMode !== normalizedAxisScaleMode) {
      setAxisScaleMode(normalizedAxisScaleMode)
    }
  }, [axisScaleMode, normalizedAxisScaleMode, setAxisScaleMode])

  const {
    shipOverrides,
    weaponOverrides,
    setShipOverride,
    resetShipOverride,
    setWeaponOverride,
    resetWeaponOverride,
    resetAllOverrides,
  } = useOverrides()

  const allWeapons = useMemo<WeaponRecord[]>(() => weapons, [])

  const effectiveShips = useMemo(() => {
    const merged = shipThresholds.map((ship) =>
      mergeShipOverride(ship, shipOverrides[ship.name])
    )

    return sortShips(merged, normalizedSortKey)
  }, [normalizedSortKey, shipOverrides])

  const selectedShipNameSet = useMemo(
    () => new Set(normalizedSelectedShipNames),
    [normalizedSelectedShipNames]
  )

  const visibleSidebarShips = useMemo(() => {
    return effectiveShips.filter((ship) => {
      if (showSelectedOnly && !selectedShipNameSet.has(ship.name)) return false
      return matchesShipSearch(ship, shipSearch)
    })
  }, [effectiveShips, selectedShipNameSet, shipSearch, showSelectedOnly])

  const attackerOptions = useMemo(() => {
    return [...effectiveShips].sort((left, right) => left.name.localeCompare(right.name))
  }, [effectiveShips])

  const sidebarGroups = useMemo<ShipSidebarGroup[]>(() => {
    return SHIP_SIZE_GROUPS.map((group) => {
      const ships = visibleSidebarShips.filter(
        (ship) => ship.sizeGroup === group.id
      )

      return {
        id: group.id,
        label: group.label,
        ships,
        visibleCount: ships.length,
        selectedCount: ships.filter((ship) => selectedShipNameSet.has(ship.name))
          .length,
        collapsed: normalizedCollapsedGroups[group.id] ?? false,
      }
    })
  }, [normalizedCollapsedGroups, selectedShipNameSet, visibleSidebarShips])

  const visibleShipNames = useMemo(
    () => visibleSidebarShips.map((ship) => ship.name),
    [visibleSidebarShips]
  )

  const selectedShips = useMemo(() => {
    return effectiveShips.filter((ship) => selectedShipNameSet.has(ship.name))
  }, [effectiveShips, selectedShipNameSet])

  const selectedWeapons = useMemo<SelectedWeaponComparison[]>(() => {
    return slots
      .map((slot, index) => {
        const baseWeapon = allWeapons.find(
          (weapon) => getWeaponKey(weapon) === slot.weaponKey
        )

        if (!baseWeapon) return null

        const weaponKey = getWeaponKey(baseWeapon)
        const effectiveWeapon = mergeWeaponOverride(
          baseWeapon,
          weaponOverrides[weaponKey]
        )
        const mountCount = Math.max(1, slot.count ?? 1)
        const groupedWeapon: WeaponRecord = {
          ...effectiveWeapon,
          alpha:
            effectiveWeapon.alpha == null
              ? null
              : effectiveWeapon.alpha * mountCount,
          burstDps:
            effectiveWeapon.burstDps == null
              ? null
              : effectiveWeapon.burstDps * mountCount,
        }

        return {
          slotId: slot.id,
          slotLabel: slot.label ?? `W${index + 1}`,
          tone: SLOT_TONES[index] ?? 'cyan',
          weapon: groupedWeapon,
        }
      })
      .filter(Boolean) as SelectedWeaponComparison[]
  }, [allWeapons, slots, weaponOverrides])

  const globalAxisMaxByType = useMemo<Record<WeaponThresholdType, number>>(
    () => buildAxisMaxByType(selectedShips, selectedWeapons),
    [selectedShips, selectedWeapons]
  )

  const selectedShipResults = useMemo(() => {
    return selectedShips.map((ship) =>
      buildSelectedShipResult(
        ship,
        selectedWeapons,
        resolveAxisMaxByType(
          ship,
          selectedShips,
          selectedWeapons,
          normalizedAxisScaleMode
        )
      )
    )
  }, [normalizedAxisScaleMode, selectedShips, selectedWeapons])

  const shipBalanceChanges = useMemo<ShipBalanceChangeEntry[]>(() => {
    return shipThresholds
      .filter((ship) => ship.history.length > 0)
      .map((ship) => {
        const current = buildCurrentBalanceSnapshot(ship)
        const previous = ship.history[0]

        return {
          ship,
          current,
          previous,
          delta: {
            armor: current.armor - previous.armor,
            ballisticThreshold:
              current.ballisticThreshold - previous.ballisticThreshold,
            energyThreshold: current.energyThreshold - previous.energyThreshold,
            armorHp: current.armorHp - previous.armorHp,
            vitalHp: current.vitalHp - previous.vitalHp,
          },
        }
      })
      .sort((left, right) => left.ship.name.localeCompare(right.ship.name))
  }, [])

  function setSlotWeapon(slotId: string, weaponKey: string | null) {
    setSlots((prev) =>
      prev.map((slot) =>
        slot.id === slotId ? { ...slot, weaponKey } : slot
      )
    )
  }

  function toggleShipSelected(shipName: string) {
    setSelectedShipNames((prev) =>
      prev.includes(shipName)
        ? prev.filter((name) => name !== shipName)
        : [...prev, shipName]
    )
  }

  function clearAllShips() {
    setSelectedShipNames([])
  }

  function selectVisibleShips() {
    setSelectedShipNames((prev) => {
      const next = new Set(prev)
      visibleShipNames.forEach((shipName) => next.add(shipName))
      return Array.from(next)
    })
  }

  function toggleGroupCollapsed(groupId: ShipSizeGroup) {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupId]: !(prev[groupId] ?? false),
    }))
  }

  function toggleShowSelectedOnly() {
    setShowSelectedOnly((prev) => !prev)
  }

  return {
    sortKey: normalizedSortKey,
    setSortKey,
    attackerShip,
    attackerOptions,
    setAttackerShipName,
    attackerHardpointGroups,
    slots,
    setSlotWeapon,
    allWeapons,
    selectedWeapons,
    axisScaleMode: normalizedAxisScaleMode,
    setAxisScaleMode,
    globalAxisMaxByType,
    sidebarGroups,
    selectedShipNames: normalizedSelectedShipNames,
    selectedShipCount: normalizedSelectedShipNames.length,
    visibleShipCount: visibleShipNames.length,
    toggleShipSelected,
    clearAllShips,
    selectVisibleShips,
    shipSearch,
    setShipSearch,
    showSelectedOnly,
    toggleShowSelectedOnly,
    mobileSidebarOpen,
    setMobileSidebarOpen,
    toggleGroupCollapsed,
    selectedShipResults,
    shipBalanceChanges,
    shipOverrides,
    weaponOverrides,
    setShipOverride,
    resetShipOverride,
    setWeaponOverride,
    resetWeaponOverride,
    resetAllOverrides,
  }
}
