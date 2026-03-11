import { Legend } from './Legend'
import { ShipTable } from './ShipTable'
import { WeaponCard } from './WeaponCard'
import { getWeaponKey } from '../lib/calculations'
import type {
  SelectedShipResult,
  SelectedWeaponComparison,
  ShipOverride,
  WeaponOverride,
} from '../types'

type Props = {
  selectedWeapons: SelectedWeaponComparison[]
  selectedShipResults: SelectedShipResult[]
  axisMaxByType: {
    ballistic: number
    energy: number
  }
  shipOverrides: Record<string, ShipOverride>
  weaponOverrides: Record<string, WeaponOverride>
  onSaveShipOverride: (shipName: string, patch: ShipOverride) => void
  onResetShipOverride: (shipName: string) => void
  onSaveWeaponOverride: (weaponKey: string, patch: WeaponOverride) => void
  onResetWeaponOverride: (weaponKey: string) => void
}

export function AlphaThresholdPage({
  selectedWeapons,
  selectedShipResults,
  axisMaxByType,
  shipOverrides,
  weaponOverrides,
  onSaveShipOverride,
  onResetShipOverride,
  onSaveWeaponOverride,
  onResetWeaponOverride,
}: Props) {
  return (
    <div className="alpha-results-column">
      <Legend selectedWeapons={selectedWeapons} />

      {selectedWeapons.length > 0 ? (
        <section className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-4">
          {selectedWeapons.map((selectedWeapon) => {
            const weaponKey = getWeaponKey(selectedWeapon.weapon)

            return (
              <WeaponCard
                key={selectedWeapon.slotId}
                label={selectedWeapon.slotLabel}
                tone={selectedWeapon.tone}
                weapon={selectedWeapon.weapon}
                override={weaponOverrides[weaponKey]}
                onSaveOverride={(patch) =>
                  onSaveWeaponOverride(weaponKey, patch)
                }
                onResetOverride={() => onResetWeaponOverride(weaponKey)}
              />
            )
          })}
        </section>
      ) : null}

      <ShipTable
        shipResults={selectedShipResults}
        axisMaxByType={axisMaxByType}
        shipOverrides={shipOverrides}
        onSaveOverride={onSaveShipOverride}
        onResetOverride={onResetShipOverride}
      />
    </div>
  )
}
