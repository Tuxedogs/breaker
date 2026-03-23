import './threshold.css'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MainHeatmapStage } from './components/MainHeatmapStage'
import { ShipSelectorOverlay } from './components/ShipSelectorOverlay'
import { ThresholdHeatmapBoard } from './components/ThresholdHeatmapBoard'
import { WeaponSelectorOverlay } from './components/WeaponSelectorOverlay'
import { useAlphaThresholdState } from './hooks/useAlphaThresholdState'
import type { Ship, SelectedWeaponComparison, SlotTone, WeaponRecord } from './types'
import { parseShieldMode } from './lib/shieldMode'

const PREVIEW_WEAPON_COUNT = 4
const SLOT_TONES: SlotTone[] = ['cyan', 'violet', 'amber', 'emerald']

export default function AlphaThresholdToolPage() {
  const [selectionMode, setSelectionMode] = useState<'ship' | 'weapon' | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const {
    slots,
    setSlotWeapon,
    allWeapons,
    allShips,
    selectedWeapons,
    selectedShips,
    selectedShipNames,
    setVictimShipAt,
    maxVictimShips,
  } = useAlphaThresholdState()
  const shieldMode = parseShieldMode(searchParams.get('shield'))
  const nextShipSlotIndex = useMemo(() => {
    const openIndex = selectedShipNames.findIndex((shipName) => shipName === null)
    return openIndex === -1 ? Math.max(0, maxVictimShips - 1) : openIndex
  }, [maxVictimShips, selectedShipNames])
  const nextWeaponSlotIndex = useMemo(() => {
    const openIndex = slots.findIndex((slot) => slot.weaponKey == null)
    return openIndex === -1 ? Math.max(0, slots.length - 1) : openIndex
  }, [slots])

  const shipBySelectionKey = useMemo(() => {
    return new Map(allShips.map((ship) => [`${ship.manufacturer}::${ship.name}`, ship] as const))
  }, [allShips])

  const previewShips = useMemo(() => {
    const placeholderHistory: Ship['history'] = []
    return Array.from({ length: maxVictimShips }, (_, index): Ship => {
      const shipKey = selectedShipNames[index]
      const selectedShip = shipKey ? shipBySelectionKey.get(shipKey) : null
      if (selectedShip) return selectedShip

      return {
        id: `placeholder-ship-${index + 1}`,
        manufacturer: '',
        name: '',
        sizeGroup: 'small',
        health: 0,
        ballisticThreshold: 0,
        energyThreshold: 0,
        armor: 0,
        armorHp: 0,
        vitalHp: 0,
        history: placeholderHistory,
      }
    })
  }, [maxVictimShips, selectedShipNames, shipBySelectionKey])

  const previewWeapons = useMemo<SelectedWeaponComparison[]>(() => {
    const selectedWeaponBySlotId = new Map(
      selectedWeapons.map((selection) => [selection.slotId, selection] as const)
    )

    return slots
      .slice(0, PREVIEW_WEAPON_COUNT)
      .map((slot, index) => {
        const selectedWeapon = selectedWeaponBySlotId.get(slot.id)
        if (selectedWeapon) return selectedWeapon

        const placeholderWeapon: WeaponRecord = {
          id: `placeholder-weapon-${index + 1}`,
          name: '',
          size: 0,
          damageType: index % 2 === 0 ? 'ballistic' : 'energy',
          weaponClass: '',
          alpha: null,
          burstDps: null,
          projectileSpeed: null,
        }

        return {
          slotId: slot.id,
          slotLabel: slot.label ?? `Weapon ${index + 1}`,
          tone: SLOT_TONES[index] ?? 'cyan',
          weapon: placeholderWeapon,
        }
      })
  }, [selectedWeapons, slots])

  function handleShieldModeChange(mode: 'up' | 'down') {
    const next = new URLSearchParams(searchParams)
    next.set('shield', mode)
    setSearchParams(next, { replace: true })
  }

  useEffect(() => {
    document.body.classList.add('alpha-threshold-page')

    return () => {
      document.body.classList.remove('alpha-threshold-page')
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (!selectionMode) return
      event.preventDefault()
      setSelectionMode(null)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectionMode])

  function handleShipSelect(shipKey: string) {
    setVictimShipAt(nextShipSlotIndex, shipKey)
  }

  function handleWeaponSelect(weaponKey: string) {
    const slot = slots[nextWeaponSlotIndex]
    if (!slot) return
    setSlotWeapon(slot.id, weaponKey)
  }

  return (
    <section className="alpha-tool-route" aria-label="Alpha threshold tool">
      <div className="alpha-app-edge-rail" aria-hidden="true" />
      <div className="alpha-command-shell">
        <MainHeatmapStage
          board={
            <ThresholdHeatmapBoard
              ships={previewShips}
              selectedWeapons={previewWeapons}
              allWeapons={allWeapons}
              shieldMode={shieldMode}
              selectionMode={selectionMode}
              nextShipSlotIndex={nextShipSlotIndex}
              nextWeaponSlotIndex={nextWeaponSlotIndex}
              onShieldModeChange={handleShieldModeChange}
              onOpenWeapons={() => setSelectionMode('weapon')}
              onOpenShips={() => setSelectionMode('ship')}
              onAssignWeapon={setSlotWeapon}
            />
          }
          overlay={
            selectionMode === 'ship' ? (
              <ShipSelectorOverlay
                open
                allShips={allShips}
                selectedShipNames={selectedShipNames}
                maxVictimShips={maxVictimShips}
                targetSlotIndex={nextShipSlotIndex}
                onSelectShip={handleShipSelect}
                onClose={() => setSelectionMode(null)}
              />
            ) : selectionMode === 'weapon' ? (
              <WeaponSelectorOverlay
                open
                slots={slots}
                weapons={allWeapons}
                targetSlotIndex={nextWeaponSlotIndex}
                onSelectWeapon={handleWeaponSelect}
                onClose={() => setSelectionMode(null)}
              />
            ) : null
          }
        />
      </div>
    </section>
  )
}

