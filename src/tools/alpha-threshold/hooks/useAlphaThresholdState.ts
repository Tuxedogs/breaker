import { useMemo } from 'react'
import { ballisticWeapons } from '../data/ballisticWeapons'
import { energyWeapons } from '../data/energyWeapons'
import { shipThresholds } from '../data/shipThresholds'
import { getWeaponKey } from '../lib/calculations'
import { mergeShipOverride, mergeWeaponOverride } from '../lib/mergeOverrides'
import { sortShips } from '../lib/sortShips'
import type {
  ComparisonSlot,
  ShipSortKey,
  ThresholdMode,
  Weapon,
} from '../types'
import { useLocalStorageState } from './useLocalStorageState'
import { useOverrides } from './useOverrides'

type SlotsByMode = Record<ThresholdMode, ComparisonSlot[]>

function buildDefaultSlots(): ComparisonSlot[] {
  return [
    { id: 'slot-1', weaponName: null },
    { id: 'slot-2', weaponName: null },
    { id: 'slot-3', weaponName: null },
  ]
}

function buildDefaultSlotState(): SlotsByMode {
  return {
    ballistic: buildDefaultSlots(),
    energy: buildDefaultSlots(),
  }
}

export function useAlphaThresholdState() {
  const [mode, setMode] = useLocalStorageState<ThresholdMode>(
    'alpha-threshold.mode',
    'ballistic'
  )
  const [sortKey, setSortKey] = useLocalStorageState<ShipSortKey>(
    'alpha-threshold.sort',
    'threshold-desc'
  )
  const [slotState, setSlotState] = useLocalStorageState<SlotsByMode>(
    'alpha-threshold.slots',
    buildDefaultSlotState()
  )

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

  const availableWeapons = useMemo(() => {
    return allWeapons.filter((weapon) => weapon.type === mode)
  }, [allWeapons, mode])

  const slots = useMemo(() => {
    return slotState[mode] ?? buildDefaultSlots()
  }, [mode, slotState])

  const effectiveShips = useMemo(() => {
    const merged = shipThresholds.map((ship) =>
      mergeShipOverride(ship, shipOverrides[ship.name])
    )

    return sortShips(merged, sortKey, mode)
  }, [mode, shipOverrides, sortKey])

  const selectedWeapons = useMemo(() => {
    return slots
      .map((slot) => {
        const baseWeapon = availableWeapons.find(
          (weapon) => getWeaponKey(weapon) === slot.weaponName
        )

        if (!baseWeapon) return null

        const weaponKey = getWeaponKey(baseWeapon)
        const effectiveWeapon = mergeWeaponOverride(
          baseWeapon,
          weaponOverrides[weaponKey]
        )

        return {
          slotId: slot.id,
          weapon: effectiveWeapon,
        }
      })
      .filter(Boolean) as { slotId: string; weapon: Weapon }[]
  }, [availableWeapons, slots, weaponOverrides])

  function setSlotWeapon(slotId: string, weaponName: string | null) {
    setSlotState((prev) => ({
      ...prev,
      [mode]: (prev[mode] ?? buildDefaultSlots()).map((slot) =>
        slot.id === slotId ? { ...slot, weaponName } : slot
      ),
    }))
  }

  return {
    mode,
    setMode,
    sortKey,
    setSortKey,
    slots,
    setSlotWeapon,
    availableWeapons,
    effectiveShips,
    selectedWeapons,
    shipOverrides,
    weaponOverrides,
    setShipOverride,
    resetShipOverride,
    setWeaponOverride,
    resetWeaponOverride,
    resetAllOverrides,
  }
}
