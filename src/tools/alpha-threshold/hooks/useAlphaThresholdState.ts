import { useEffect, useMemo } from 'react'
import { getShipThresholdsForSource } from '../data/ships/ships'
import { getWeaponsForSource } from '../data/weapons/weapons'
import {
  getDefaultCollapsedGroups,
  getDefaultSelectedShips,
  getWeaponKey,
  SHIP_SIZE_GROUPS,
} from '../lib/calculations'
import { mergeShipOverride, mergeWeaponOverride } from '../lib/mergeOverrides'
import { sortShips } from '../lib/sortShips'
import type {
  ComparisonSlot,
  Ship,
  ShipBalanceChangeEntry,
  ShipBalanceFieldChange,
  ShipBalanceFieldKey,
  ShipBalanceSnapshot,
  ShipManufacturerOption,
  SelectedWeaponComparison,
  ShipSidebarGroup,
  ShipSortKey,
  ShipSizeGroup,
  SlotTone,
  ThresholdDataSourceKey,
  WeaponRecord,
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
const VALID_DATA_SOURCES: ThresholdDataSourceKey[] = ['merged', 'manual', 'erkul-live', 'erkul-ptu', 'spviewer']
const MAX_VICTIM_SHIPS = 4
const MOBILE_MAX_VICTIM_SHIPS = 2
const DEFAULT_WEAPON_SLOTS: ComparisonSlot[] = [
  { id: 'slot-1', operator: 'weapon', hardpointSize: 0, weaponKey: null, label: 'Weapon 1' },
  { id: 'slot-2', operator: 'weapon', hardpointSize: 0, weaponKey: null, label: 'Weapon 2' },
  { id: 'slot-3', operator: 'weapon', hardpointSize: 0, weaponKey: null, label: 'Weapon 3' },
  { id: 'slot-4', operator: 'weapon', hardpointSize: 0, weaponKey: null, label: 'Weapon 4' },
]

function getShipSelectionKey(ship: Pick<Ship, 'manufacturer' | 'name'>): string {
  return `${ship.manufacturer}::${ship.name}`
}

function buildDefaultWeaponSlots(): ComparisonSlot[] {
  return DEFAULT_WEAPON_SLOTS.map((slot) => ({ ...slot }))
}

function isComparisonSlot(value: unknown): value is ComparisonSlot {
  if (!value || typeof value !== 'object') return false

  const slot = value as ComparisonSlot

  return (
    typeof slot.id === 'string' &&
    (slot.operator === 'pilot' || slot.operator === 'turret' || slot.operator === 'weapon') &&
    typeof slot.hardpointSize === 'number' &&
    (typeof slot.weaponKey === 'string' || slot.weaponKey === null)
  )
}

function normalizeSlots(value: ComparisonSlot[]): ComparisonSlot[] {
  const baseSlots = buildDefaultWeaponSlots()
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

function normalizeDataSource(value: ThresholdDataSourceKey): ThresholdDataSourceKey {
  return VALID_DATA_SOURCES.includes(value) ? value : 'merged'
}

function resolveAvailableDataSource(
  source: ThresholdDataSourceKey,
  ships: Ship[],
  weapons: WeaponRecord[]
): ThresholdDataSourceKey {
  if (ships.length > 0 && weapons.length > 0) {
    return source
  }

  return 'merged'
}

function normalizeSelectedShipNames(value: Array<string | null>, ships: Ship[]): Array<string | null> {
  const shipKeys = new Set(ships.map((ship) => getShipSelectionKey(ship)))
  const defaults = getDefaultSelectedShips()

  if (!Array.isArray(value)) {
    return Array.from({ length: MAX_VICTIM_SHIPS }, (_, index) => {
      const defaultShip = ships.find((ship) => ship.name === defaults[index])
      return defaultShip ? getShipSelectionKey(defaultShip) : null
    })
  }

  const trimmed = value.slice(0, MAX_VICTIM_SHIPS).map((shipName) => {
    if (!shipName) return null
    return shipKeys.has(shipName) ? shipName : null
  })

  return Array.from({ length: MAX_VICTIM_SHIPS }, (_, index) => trimmed[index] ?? null)
}

function normalizeVictimManufacturer(
  value: string,
  options: ShipManufacturerOption[]
): string {
  if (value === 'all') return value
  return options.some((option) => option.value === value) ? value : 'all'
}

function normalizeCollapsedGroups(
  value: Record<ShipSizeGroup, boolean>
): Record<ShipSizeGroup, boolean> {
  const defaults = getDefaultCollapsedGroups()

  if (!value || typeof value !== 'object') {
    return defaults
  }

  return {
    capital: typeof value.capital === 'boolean' ? value.capital : defaults.capital,
    large: typeof value.large === 'boolean' ? value.large : defaults.large,
    medium: typeof value.medium === 'boolean' ? value.medium : defaults.medium,
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

function compareByManufacturerThenName(
  left: { manufacturer: string; name: string },
  right: { manufacturer: string; name: string }
) {
  const makeCompare = left.manufacturer.localeCompare(right.manufacturer)
  if (makeCompare !== 0) return makeCompare
  return left.name.localeCompare(right.name)
}

function getShipDatasetKey(ship: Pick<Ship, 'manufacturer' | 'name'>): string {
  return `${ship.manufacturer}::${ship.name}`.toLowerCase()
}

function shouldExcludeWeapon(weapon: WeaponRecord): boolean {
  const normalizedName = weapon.name.trim().toLowerCase()
  const normalizedClass = weapon.weaponClass.trim().toLowerCase()

  return (
    normalizedName.includes('suregrip') ||
    normalizedName.includes('viselock') ||
    normalizedClass === 'rocket pod'
  )
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

const BALANCE_FIELD_LABELS: Record<ShipBalanceFieldKey, string> = {
  ballisticThreshold: 'Ballistic Deflection',
  energyThreshold: 'Energy Deflection',
  armor: 'Armor',
  armorHp: 'Armor HP',
  vitalHp: 'Vital HP',
}

function buildBalanceFieldChanges(
  current: ShipBalanceSnapshot,
  previous: ShipBalanceSnapshot
): ShipBalanceFieldChange[] {
  const keys: ShipBalanceFieldKey[] = [
    'ballisticThreshold',
    'energyThreshold',
    'armor',
    'armorHp',
    'vitalHp',
  ]

  return keys
    .map((key) => {
      const before = previous[key]
      const after = current[key]
      const delta = after - before

      if (delta === 0) return null

      return {
        key,
        label: BALANCE_FIELD_LABELS[key],
        before,
        after,
        delta,
        direction: delta > 0 ? 'up' : 'down',
      }
    })
    .filter(Boolean) as ShipBalanceFieldChange[]
}

export function useAlphaThresholdState() {
  const [isMobileViewport, setIsMobileViewport] = useLocalStorageState<boolean>(
    'alpha-threshold.mobile-viewport',
    false
  )
  const [sortKey, setSortKey] = useLocalStorageState<ShipSortKey>(
    'alpha-threshold.sort',
    'health-desc'
  )
  const [storedSlots, setSlots] = useLocalStorageState<ComparisonSlot[]>(
    'alpha-threshold.slots',
    buildDefaultWeaponSlots()
  )
  const [selectedShipNames, setSelectedShipNames] = useLocalStorageState<Array<string | null>>(
    'alpha-threshold.selected-ships',
    []
  )
  const [shipSearch, setShipSearch] = useLocalStorageState<string>(
    'alpha-threshold.ship-search',
    ''
  )
  const [victimManufacturer, setVictimManufacturer] = useLocalStorageState<string>(
    'alpha-threshold.victim-manufacturer',
    'all'
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
  const [activeSource, setActiveSource] = useLocalStorageState<ThresholdDataSourceKey>(
    'alpha-threshold.data-source',
    'merged'
  )

  const normalizedActiveSource = useMemo(
    () => normalizeDataSource(activeSource),
    [activeSource]
  )

  const sourceShips = useMemo(
    () => getShipThresholdsForSource(normalizedActiveSource),
    [normalizedActiveSource]
  )

  const sourceWeapons = useMemo(
    () => getWeaponsForSource(normalizedActiveSource),
    [normalizedActiveSource]
  )

  const resolvedActiveSource = useMemo(
    () => resolveAvailableDataSource(normalizedActiveSource, sourceShips, sourceWeapons),
    [normalizedActiveSource, sourceShips, sourceWeapons]
  )

  const activeShips = useMemo(
    () =>
      resolvedActiveSource === normalizedActiveSource
        ? sourceShips
        : getShipThresholdsForSource(resolvedActiveSource),
    [normalizedActiveSource, resolvedActiveSource, sourceShips]
  )

  const activeWeapons = useMemo(
    () =>
      resolvedActiveSource === normalizedActiveSource
        ? sourceWeapons
        : getWeaponsForSource(resolvedActiveSource),
    [normalizedActiveSource, resolvedActiveSource, sourceWeapons]
  )

  const slots = useMemo(
    () => normalizeSlots(storedSlots),
    [storedSlots]
  )

  const normalizedSortKey = useMemo(() => normalizeSortKey(sortKey), [sortKey])
  const normalizedSelectedShipNames = useMemo(
    () => normalizeSelectedShipNames(selectedShipNames, activeShips),
    [activeShips, selectedShipNames]
  )
  const normalizedCollapsedGroups = useMemo(
    () => normalizeCollapsedGroups(collapsedGroups),
    [collapsedGroups]
  )
  const maxVictimShips = isMobileViewport ? MOBILE_MAX_VICTIM_SHIPS : MAX_VICTIM_SHIPS

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)')
    const updateViewport = () => setIsMobileViewport(mediaQuery.matches)

    updateViewport()
    mediaQuery.addEventListener('change', updateViewport)

    return () => mediaQuery.removeEventListener('change', updateViewport)
  }, [setIsMobileViewport])

  useEffect(() => {
    if (activeSource !== resolvedActiveSource) {
      setActiveSource(resolvedActiveSource)
    }
  }, [activeSource, resolvedActiveSource, setActiveSource])

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
    if (JSON.stringify(selectedShipNames) !== JSON.stringify(normalizedSelectedShipNames)) {
      setSelectedShipNames(normalizedSelectedShipNames)
    }
  }, [normalizedSelectedShipNames, selectedShipNames, setSelectedShipNames])

  useEffect(() => {
    const limitedSelection = normalizedSelectedShipNames.map((shipName, index) =>
      index < maxVictimShips ? shipName : null
    )

    if (JSON.stringify(selectedShipNames) !== JSON.stringify(limitedSelection)) {
      setSelectedShipNames(limitedSelection)
    }
  }, [maxVictimShips, normalizedSelectedShipNames, selectedShipNames, setSelectedShipNames])

  useEffect(() => {
    if (JSON.stringify(collapsedGroups) !== JSON.stringify(normalizedCollapsedGroups)) {
      setCollapsedGroups(normalizedCollapsedGroups)
    }
  }, [collapsedGroups, normalizedCollapsedGroups, setCollapsedGroups])

  const {
    shipOverrides,
    weaponOverrides,
    setShipOverride,
    resetShipOverride,
    setWeaponOverride,
    resetWeaponOverride,
    resetAllOverrides,
  } = useOverrides()

  const allWeapons = useMemo<WeaponRecord[]>(
    () => activeWeapons.filter((weapon) => !shouldExcludeWeapon(weapon)),
    [activeWeapons]
  )

  const effectiveShips = useMemo(() => {
    const merged = activeShips.map((ship) =>
      mergeShipOverride(ship, shipOverrides[ship.name])
    )

    return sortShips(merged, normalizedSortKey)
  }, [activeShips, normalizedSortKey, shipOverrides])

  const selectedShipNameSet = useMemo(
    () =>
      new Set(
        normalizedSelectedShipNames
          .slice(0, maxVictimShips)
          .filter((shipName): shipName is string => Boolean(shipName))
      ),
    [maxVictimShips, normalizedSelectedShipNames]
  )

  const victimManufacturerOptions = useMemo<ShipManufacturerOption[]>(() => {
    const byManufacturer = new Map<string, number>()
    effectiveShips.forEach((ship) => {
      byManufacturer.set(ship.manufacturer, (byManufacturer.get(ship.manufacturer) ?? 0) + 1)
    })

    const options = Array.from(byManufacturer.entries())
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([value, count]) => ({
        value,
        label: value,
        count,
      }))

    return [{ value: 'all', label: 'All Manufacturers', count: effectiveShips.length }, ...options]
  }, [effectiveShips])

  const normalizedVictimManufacturer = useMemo(
    () => normalizeVictimManufacturer(victimManufacturer, victimManufacturerOptions),
    [victimManufacturer, victimManufacturerOptions]
  )

  useEffect(() => {
    if (victimManufacturer !== normalizedVictimManufacturer) {
      setVictimManufacturer(normalizedVictimManufacturer)
    }
  }, [normalizedVictimManufacturer, setVictimManufacturer, victimManufacturer])

  const visibleSidebarShips = useMemo(() => {
    return effectiveShips.filter((ship) => {
      if (showSelectedOnly && !selectedShipNameSet.has(getShipSelectionKey(ship))) return false
      if (normalizedVictimManufacturer !== 'all' && ship.manufacturer !== normalizedVictimManufacturer) {
        return false
      }
      return matchesShipSearch(ship, shipSearch)
    })
  }, [
    effectiveShips,
    normalizedVictimManufacturer,
    selectedShipNameSet,
    shipSearch,
    showSelectedOnly,
  ])

  const visibleVictimShips = useMemo(
    () => [...visibleSidebarShips].sort((left, right) => left.name.localeCompare(right.name)),
    [visibleSidebarShips]
  )

  const allShips = useMemo(
    () => [...effectiveShips].sort(compareByManufacturerThenName),
    [effectiveShips]
  )

  const sidebarGroups = useMemo<ShipSidebarGroup[]>(() => {
    return SHIP_SIZE_GROUPS.map((group) => {
      const ships = visibleSidebarShips.filter((ship) => ship.sizeGroup === group.id)

      return {
        id: group.id,
        label: group.label,
        ships,
        visibleCount: ships.length,
        selectedCount: ships.filter((ship) => selectedShipNameSet.has(getShipSelectionKey(ship))).length,
        collapsed: normalizedCollapsedGroups[group.id] ?? false,
      }
    })
  }, [normalizedCollapsedGroups, selectedShipNameSet, visibleSidebarShips])

  const visibleShipNames = useMemo(
    () => visibleVictimShips.map((ship) => getShipSelectionKey(ship)),
    [visibleVictimShips]
  )

  const selectedShips = useMemo(
    () => effectiveShips.filter((ship) => selectedShipNameSet.has(getShipSelectionKey(ship))),
    [effectiveShips, selectedShipNameSet]
  )

  const selectedWeapons = useMemo<SelectedWeaponComparison[]>(() => {
    return slots
      .map((slot, index) => {
        const baseWeapon = allWeapons.find(
          (weapon) =>
            getWeaponKey(weapon) === slot.weaponKey &&
            (slot.hardpointSize <= 0 || weapon.size <= slot.hardpointSize)
        )

        if (!baseWeapon) return null

        const weaponKey = getWeaponKey(baseWeapon)
        const effectiveWeapon = mergeWeaponOverride(
          baseWeapon,
          weaponOverrides[weaponKey]
        )
        const mountCount = Math.max(1, slot.count ?? 1)
        const effectiveAlpha = effectiveWeapon.alpha == null ? null : effectiveWeapon.alpha * mountCount
        const effectiveBurstDps =
          effectiveWeapon.burstDps == null ? null : effectiveWeapon.burstDps * mountCount
        const groupedWeapon: WeaponRecord = {
          ...effectiveWeapon,
          alpha: effectiveAlpha,
          burstDps: effectiveBurstDps,
          calculatorProfile: {
            damageChannel: effectiveWeapon.damageType === 'ballistic' ? 'physical' : 'energy',
            mountCount,
            baseAlpha: effectiveWeapon.alpha,
            effectiveAlpha,
            baseBurstDps: effectiveWeapon.burstDps,
            effectiveBurstDps,
            projectileSpeed: effectiveWeapon.projectileSpeed,
          },
        }

        return {
          slotId: slot.id,
          slotLabel: slot.label ?? `Weapon ${index + 1}`,
          tone: SLOT_TONES[index] ?? 'cyan',
          weapon: groupedWeapon,
        }
      })
      .filter(Boolean) as SelectedWeaponComparison[]
  }, [allWeapons, slots, weaponOverrides])

  const shipBalanceChanges = useMemo<ShipBalanceChangeEntry[]>(() => {
    const liveShips = getShipThresholdsForSource('erkul-live')
    const ptuShips = getShipThresholdsForSource('erkul-ptu')
    const liveShipMap = new Map(liveShips.map((ship) => [getShipDatasetKey(ship), ship]))

    return ptuShips
      .map((ship) => {
        const liveShip = liveShipMap.get(getShipDatasetKey(ship))
        if (!liveShip) return null

        const current = buildCurrentBalanceSnapshot({
          ...ship,
          patch: ship.patch ?? 'Erkul PTU',
        })
        const previous = buildCurrentBalanceSnapshot({
          ...liveShip,
          patch: liveShip.patch ?? 'Erkul Live',
        })
        const fields = buildBalanceFieldChanges(current, previous)
        const changeMagnitude = fields.reduce(
          (total, field) => total + Math.abs(field.delta),
          0
        )

        return {
          ship,
          current,
          previous,
          fields,
          changeMagnitude,
        }
      })
      .filter((entry): entry is ShipBalanceChangeEntry => Boolean(entry && entry.fields.length > 0))
      .sort((left, right) => {
        if (right.changeMagnitude !== left.changeMagnitude) {
          return right.changeMagnitude - left.changeMagnitude
        }
        return left.ship.name.localeCompare(right.ship.name)
      })
  }, [])

  function setSlotWeapon(slotId: string, weaponKey: string | null) {
    setSlots((prev) =>
      prev.map((slot) =>
        slot.id === slotId ? { ...slot, weaponKey } : slot
      )
    )
  }

  function toggleShipSelected(shipName: string) {
    setSelectedShipNames((prev) => {
      if (prev.includes(shipName)) {
        return prev.map((name) => (name === shipName ? null : name))
      }

      const emptyIndex = prev.findIndex((name) => name === null)
      if (emptyIndex === -1 || emptyIndex >= maxVictimShips) return prev

      const next = [...prev]
      next[emptyIndex] = shipName
      return next
    })
  }

  function clearAllShips() {
    setSelectedShipNames(Array.from({ length: MAX_VICTIM_SHIPS }, () => null))
  }

  function selectVisibleShips() {
    setSelectedShipNames((prev) => {
      const next = [...prev]
      visibleShipNames.forEach((shipName) => {
        if (next.includes(shipName)) return
        const emptyIndex = next.findIndex((name) => name === null)
        if (emptyIndex !== -1 && emptyIndex < maxVictimShips) {
          next[emptyIndex] = shipName
        }
      })
      return next.slice(0, MAX_VICTIM_SHIPS)
    })
  }

  function setVictimShipAt(slotIndex: number, shipName: string | null) {
    setSelectedShipNames((prev) => {
      const next = Array.from({ length: MAX_VICTIM_SHIPS }, (_, index) => prev[index] ?? null)

      if (!shipName) {
        next[slotIndex] = null
        return next
      }

      const existingIndex = next.findIndex((name) => name === shipName)
      if (existingIndex !== -1) {
        next[existingIndex] = null
      }

      if (slotIndex >= maxVictimShips) {
        return next
      }

      next[slotIndex] = shipName
      return next
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
    activeSource: resolvedActiveSource,
    setActiveSource,
    sortKey: normalizedSortKey,
    setSortKey,
    slots,
    setSlotWeapon,
    allWeapons,
    allShips,
    selectedShips,
    selectedWeapons,
    victimManufacturer: normalizedVictimManufacturer,
    setVictimManufacturer,
    victimManufacturerOptions,
    visibleVictimShips,
    sidebarGroups,
    selectedShipNames: normalizedSelectedShipNames.slice(0, maxVictimShips),
    victimSlotShipNames: normalizedSelectedShipNames.slice(0, maxVictimShips),
    selectedShipCount: normalizedSelectedShipNames.slice(0, maxVictimShips).filter(Boolean).length,
    maxVictimShips,
    visibleShipCount: visibleShipNames.length,
    toggleShipSelected,
    clearAllShips,
    selectVisibleShips,
    setVictimShipAt,
    shipSearch,
    setShipSearch,
    showSelectedOnly,
    toggleShowSelectedOnly,
    mobileSidebarOpen,
    setMobileSidebarOpen,
    toggleGroupCollapsed,
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
