import { useEffect, useMemo } from 'react'
import { ballisticWeapons } from '../data/ballisticWeapons'
import { energyWeapons } from '../data/energyWeapons'
import { shipThresholds } from '../data/shipThresholds'
import {
  buildSelectedShipResult,
  getDefaultCollapsedGroups,
  getDefaultSelectedShips,
  getLaneAxisMax,
  getWeaponKey,
  SHIP_SIZE_GROUPS,
} from '../lib/calculations'
import { mergeShipOverride, mergeWeaponOverride } from '../lib/mergeOverrides'
import { sortShips } from '../lib/sortShips'
import type {
  ComparisonSlot,
  SelectedWeaponComparison,
  ShipSidebarGroup,
  ShipSortKey,
  ShipSizeGroup,
  SlotTone,
  Weapon,
  WeaponType,
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

function buildDefaultSlots(): ComparisonSlot[] {
  return [
    { id: 'slot-1', weaponKey: null },
    { id: 'slot-2', weaponKey: null },
    { id: 'slot-3', weaponKey: null },
    { id: 'slot-4', weaponKey: null },
  ]
}

function isComparisonSlot(value: unknown): value is ComparisonSlot {
  if (!value || typeof value !== 'object') return false

  const slot = value as ComparisonSlot

  return (
    typeof slot.id === 'string' &&
    (typeof slot.weaponKey === 'string' || slot.weaponKey === null)
  )
}

function normalizeSlots(value: ComparisonSlot[]): ComparisonSlot[] {
  if (Array.isArray(value) && value.every(isComparisonSlot)) {
    return buildDefaultSlots().map((fallbackSlot, index) => {
      const slot = value[index]

      return slot
        ? {
            id: slot.id || fallbackSlot.id,
            weaponKey: slot.weaponKey,
          }
        : fallbackSlot
    })
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

    return buildDefaultSlots().map((fallbackSlot, index) => ({
      id: legacySlots[index]?.id || fallbackSlot.id,
      weaponKey: null,
    }))
  }

  return buildDefaultSlots()
}

function normalizeSortKey(value: ShipSortKey): ShipSortKey {
  return VALID_SORT_KEYS.includes(value) ? value : 'health-desc'
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

export function useAlphaThresholdState() {
  const [sortKey, setSortKey] = useLocalStorageState<ShipSortKey>(
    'alpha-threshold.sort',
    'health-desc'
  )
  const [storedSlots, setSlots] = useLocalStorageState<ComparisonSlot[]>(
    'alpha-threshold.slots',
    buildDefaultSlots()
  )
  const [activeSlotCount, setActiveSlotCount] = useLocalStorageState<number>(
    'alpha-threshold.slot-count',
    4
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

  const slots = useMemo(
    () => normalizeSlots(storedSlots),
    [storedSlots]
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

  const {
    shipOverrides,
    weaponOverrides,
    setShipOverride,
    resetShipOverride,
    setWeaponOverride,
    resetWeaponOverride,
    resetAllOverrides,
  } = useOverrides()

  const allWeapons = useMemo<Weapon[]>(
    () => [...ballisticWeapons, ...energyWeapons],
    []
  )

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

  const visibleSlots = useMemo(() => {
    const clampedCount = Math.min(4, Math.max(1, activeSlotCount))
    return slots.slice(0, clampedCount)
  }, [activeSlotCount, slots])

  const selectedWeapons = useMemo<SelectedWeaponComparison[]>(() => {
    return visibleSlots
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

        return {
          slotId: slot.id,
          slotLabel: `W${index + 1}`,
          tone: SLOT_TONES[index] ?? 'cyan',
          weapon: effectiveWeapon,
        }
      })
      .filter(Boolean) as SelectedWeaponComparison[]
  }, [allWeapons, visibleSlots, weaponOverrides])

  const axisMaxByType = useMemo<Record<WeaponType, number>>(() => {
    return {
      ballistic: getLaneAxisMax(selectedShips, selectedWeapons, 'ballistic'),
      energy: getLaneAxisMax(selectedShips, selectedWeapons, 'energy'),
    }
  }, [selectedShips, selectedWeapons])

  const selectedShipResults = useMemo(() => {
    return selectedShips.map((ship) =>
      buildSelectedShipResult(ship, selectedWeapons, axisMaxByType)
    )
  }, [axisMaxByType, selectedShips, selectedWeapons])

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

  function setSlotCount(nextCount: number) {
    setActiveSlotCount(Math.min(4, Math.max(1, nextCount)))
  }

  function toggleShowSelectedOnly() {
    setShowSelectedOnly((prev) => !prev)
  }

  return {
    sortKey: normalizedSortKey,
    setSortKey,
    slots,
    visibleSlots,
    activeSlotCount,
    setSlotCount,
    setSlotWeapon,
    allWeapons,
    selectedWeapons,
    axisMaxByType,
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
    shipOverrides,
    weaponOverrides,
    setShipOverride,
    resetShipOverride,
    setWeaponOverride,
    resetWeaponOverride,
    resetAllOverrides,
  }
}
