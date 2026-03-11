import type {
  ShipOverride,
  ShipOverridesMap,
  WeaponOverride,
  WeaponOverridesMap,
} from '../types'
import { useLocalStorageState } from './useLocalStorageState'

export function useOverrides() {
  const [shipOverrides, setShipOverrides] = useLocalStorageState<ShipOverridesMap>(
    'alpha-threshold.ship-overrides',
    {}
  )

  const [weaponOverrides, setWeaponOverrides] =
    useLocalStorageState<WeaponOverridesMap>(
      'alpha-threshold.weapon-overrides',
      {}
    )

  function setShipOverride(shipName: string, patch: ShipOverride) {
    setShipOverrides((prev) => ({
      ...prev,
      [shipName]: {
        ...prev[shipName],
        ...patch,
      },
    }))
  }

  function resetShipOverride(shipName: string) {
    setShipOverrides((prev) => {
      const next = { ...prev }
      delete next[shipName]
      return next
    })
  }

  function setWeaponOverride(weaponName: string, patch: WeaponOverride) {
    setWeaponOverrides((prev) => ({
      ...prev,
      [weaponName]: {
        ...prev[weaponName],
        ...patch,
      },
    }))
  }

  function resetWeaponOverride(weaponName: string) {
    setWeaponOverrides((prev) => {
      const next = { ...prev }
      delete next[weaponName]
      return next
    })
  }

  function resetAllOverrides() {
    setShipOverrides({})
    setWeaponOverrides({})
  }

  return {
    shipOverrides,
    weaponOverrides,
    setShipOverride,
    resetShipOverride,
    setWeaponOverride,
    resetWeaponOverride,
    resetAllOverrides,
  }
}
