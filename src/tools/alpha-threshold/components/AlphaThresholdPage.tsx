import { useMemo } from 'react'
import { ControlsPanel } from './ControlsPanel'
import { Legend } from './Legend'
import { ShipTable } from './ShipTable'
import { WeaponCard } from './WeaponCard'
import { getWeaponKey } from '../lib/calculations'
import { useAlphaThresholdState } from '../hooks/useAlphaThresholdState'
import type { SelectedWeaponComparison, SlotTone } from '../types'

const SLOT_TONES: SlotTone[] = ['cyan', 'violet', 'amber']

export function AlphaThresholdPage() {
  const {
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
  } = useAlphaThresholdState()

  const comparisonWeapons = useMemo<SelectedWeaponComparison[]>(() => {
    return selectedWeapons.map(({ slotId, weapon }) => {
      const slotIndex = slots.findIndex((slot) => slot.id === slotId)
      const slotNumber = slotIndex >= 0 ? slotIndex + 1 : 1

      return {
        slotId,
        slotLabel: `Weapon ${slotNumber}`,
        tone: SLOT_TONES[Math.max(0, slotNumber - 1)] ?? 'cyan',
        weapon,
      }
    })
  }, [selectedWeapons, slots])

  return (
    <div className="alpha-tool-layout">
      <ControlsPanel
        mode={mode}
        sortKey={sortKey}
        slots={slots}
        tones={SLOT_TONES}
        weapons={availableWeapons}
        onModeChange={setMode}
        onSortChange={setSortKey}
        onSlotChange={setSlotWeapon}
        onResetAllOverrides={resetAllOverrides}
      />

      <Legend mode={mode} selectedWeapons={comparisonWeapons} />

      {comparisonWeapons.length > 0 ? (
        <section className="grid gap-4 lg:grid-cols-3">
          {comparisonWeapons.map((selectedWeapon) => {
            const weaponKey = getWeaponKey(selectedWeapon.weapon)

            return (
              <WeaponCard
                key={selectedWeapon.slotId}
                label={selectedWeapon.slotLabel}
                tone={selectedWeapon.tone}
                weapon={selectedWeapon.weapon}
                override={weaponOverrides[weaponKey]}
                onSaveOverride={(patch) => setWeaponOverride(weaponKey, patch)}
                onResetOverride={() => resetWeaponOverride(weaponKey)}
              />
            )
          })}
        </section>
      ) : null}

      <ShipTable
        ships={effectiveShips}
        mode={mode}
        selectedWeapons={comparisonWeapons}
        shipOverrides={shipOverrides}
        onSaveOverride={setShipOverride}
        onResetOverride={resetShipOverride}
      />
    </div>
  )
}
