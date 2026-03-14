import { useEffect, useMemo } from 'react'
import { shipThresholds } from '../data/shipThresholds'
import { getAttackerHardpointProfile } from '../data/ships/ships'
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
  AttackerHardpointProfile,
  AxisScaleMode,
  ComparisonSlot,
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

function buildSlotsFromProfile(profile: AttackerHardpointProfile): ComparisonSlot[] {
  const next: ComparisonSlot[] = []

  if (profile.pilotHardpointSize) {
    next.push({
      id: 'slot-pilot',
      operator: 'pilot',
      hardpointSize: profile.pilotHardpointSize,
      weaponKey: null,
    })
  }

  if (profile.turretHardpointSize) {
    next.push({
      id: 'slot-turret',
      operator: 'turret',
      hardpointSize: profile.turretHardpointSize,
      weaponKey: null,
    })
  }

  return next
}

function isComparisonSlot(value: unknown): value is ComparisonSlot {
  if (!value || typeof value !== 'object') return false

  const slot = value as ComparisonSlot

  return (
    typeof slot.id === 'string' &&
    (slot.operator === 'pilot' || slot.operator === 'turret') &&
    typeof slot.hardpointSize === 'number' &&
    (typeof slot.weaponKey === 'string' || slot.weaponKey === null)
  )
}

function normalizeSlots(value: ComparisonSlot[], profile: AttackerHardpointProfile): ComparisonSlot[] {
  const baseSlots = buildSlotsFromProfile(profile)

  if (baseSlots.length === 0) return []
  if (!Array.isArray(value) || !value.every(isComparisonSlot)) return baseSlots

  return baseSlots.map((baseSlot) => {
    const existingSlot = value.find((slot) => slot.id === baseSlot.id)

    if (!existingSlot) return baseSlot

    return {
      ...baseSlot,
      weaponKey: existingSlot.weaponKey,
    }
  })
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

export function useAlphaThresholdState() {
  const [sortKey, setSortKey] = useLocalStorageState<ShipSortKey>(
    'alpha-threshold.sort',
    'health-desc'
  )
  const [attackerShipName, setAttackerShipName] = useLocalStorageState<string>(
    'alpha-threshold.attacker-ship',
    'Hornet_F7CS'
  )
  const [storedSlots, setSlots] = useLocalStorageState<ComparisonSlot[]>(
    'alpha-threshold.slots',
    []
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

  const attackerProfile = useMemo(
    () => getAttackerHardpointProfile(attackerShipName),
    [attackerShipName]
  )

  const slots = useMemo(
    () => normalizeSlots(storedSlots, attackerProfile),
    [attackerProfile, storedSlots]
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
    if (shipThresholds.some((ship) => ship.name === attackerShipName)) return

    setAttackerShipName(shipThresholds[0]?.name ?? '')
  }, [attackerShipName, setAttackerShipName])

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

        if (!baseWeapon || baseWeapon.size !== slot.hardpointSize) return null

        const weaponKey = getWeaponKey(baseWeapon)
        const effectiveWeapon = mergeWeaponOverride(
          baseWeapon,
          weaponOverrides[weaponKey]
        )

        return {
          slotId: slot.id,
          slotLabel: `${slot.operator === 'pilot' ? 'Pilot' : 'Turret'} S${slot.hardpointSize}`,
          tone: SLOT_TONES[index] ?? 'cyan',
          weapon: effectiveWeapon,
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
    attackerShipName,
    setAttackerShipName,
    attackerProfile,
    slots,
    setSlotWeapon,
    allWeapons,
    allShips: effectiveShips,
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
    shipOverrides,
    weaponOverrides,
    setShipOverride,
    resetShipOverride,
    setWeaponOverride,
    resetWeaponOverride,
    resetAllOverrides,
  }
}
