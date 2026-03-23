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
  const [activeShipSlotIndex, setActiveShipSlotIndex] = useState(0)
  const [activeWeaponSlotIndex, setActiveWeaponSlotIndex] = useState(0)
  const [shipAutoAdvance, setShipAutoAdvance] = useState(true)
  const [weaponAutoAdvance, setWeaponAutoAdvance] = useState(true)
  const [selectionNotice, setSelectionNotice] = useState<string | null>(null)
  const [hoveredShipSlotIndex, setHoveredShipSlotIndex] = useState<number | null>(null)
  const [hoveredWeaponSlotIndex, setHoveredWeaponSlotIndex] = useState<number | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const {
    slots,
    setSlotWeapon,
    allWeapons,
    allShips,
    selectedWeapons,
    selectedShipNames,
    setVictimShipAt,
    maxVictimShips,
  } = useAlphaThresholdState()
  const shieldMode = parseShieldMode(searchParams.get('shield'))
  function getShipSelectionKey(ship: Pick<Ship, 'manufacturer' | 'name'>): string {
    return `${ship.manufacturer}::${ship.name}`
  }
  const nextShipSlotIndex = useMemo(() => {
    const openIndex = selectedShipNames.findIndex((shipName) => shipName === null)
    return openIndex === -1 ? Math.max(0, maxVictimShips - 1) : openIndex
  }, [maxVictimShips, selectedShipNames])
  const nextWeaponSlotIndex = useMemo(() => {
    const openIndex = slots.findIndex((slot) => slot.weaponKey == null)
    return openIndex === -1 ? Math.max(0, slots.length - 1) : openIndex
  }, [slots])
  const effectiveShipSlotIndex = Math.max(
    0,
    Math.min(maxVictimShips - 1, hoveredShipSlotIndex ?? activeShipSlotIndex)
  )
  const effectiveWeaponSlotIndex = Math.max(
    0,
    Math.min(slots.length - 1, hoveredWeaponSlotIndex ?? activeWeaponSlotIndex)
  )

  const shipBySelectionKey = useMemo(() => {
    return new Map(allShips.map((ship) => [getShipSelectionKey(ship), ship] as const))
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
    const currentIndex = Math.max(0, Math.min(maxVictimShips - 1, activeShipSlotIndex))
    const currentSlotEmpty = selectedShipNames[currentIndex] == null
    const targetIndex = shipAutoAdvance ? nextShipSlotIndex : currentIndex
    const targetSlotEmpty = selectedShipNames[targetIndex] == null

    if (shipAutoAdvance && !targetSlotEmpty) {
      setSelectionNotice('All ship slots are filled. Clear a slot or select one to replace.')
      return
    }

    setSelectionNotice(null)
    setVictimShipAt(targetIndex, shipKey)

    if (shipAutoAdvance && currentSlotEmpty) {
      const nextIndex = selectedShipNames.findIndex(
        (shipName, index) => index > targetIndex && shipName === null
      )
      setActiveShipSlotIndex(
        nextIndex === -1 ? targetIndex : Math.max(0, Math.min(maxVictimShips - 1, nextIndex))
      )
    }
  }

  function handleWeaponSelect(weaponKey: string) {
    const currentIndex = Math.max(0, Math.min(slots.length - 1, activeWeaponSlotIndex))
    const currentSlot = slots[currentIndex]
    const currentSlotEmpty = currentSlot?.weaponKey == null
    const targetIndex = weaponAutoAdvance ? nextWeaponSlotIndex : currentIndex
    const slot = slots[targetIndex]
    if (!slot) return
    if (weaponAutoAdvance && !currentSlotEmpty && slot.weaponKey != null) {
      setSelectionNotice('All weapon slots are filled. Clear a slot or select one to replace.')
      return
    }

    setSelectionNotice(null)
    setSlotWeapon(slot.id, weaponKey)

    if (weaponAutoAdvance && currentSlotEmpty) {
      const nextIndex = slots.findIndex(
        (entry, index) => index > targetIndex && entry.weaponKey === null
      )
      setActiveWeaponSlotIndex(
        nextIndex === -1 ? targetIndex : Math.max(0, Math.min(slots.length - 1, nextIndex))
      )
    }
  }

  function handleOpenShipsAt(slotIndex: number, autoAdvance = false) {
    setActiveShipSlotIndex(Math.max(0, Math.min(maxVictimShips - 1, slotIndex)))
    setHoveredShipSlotIndex(null)
    setShipAutoAdvance(autoAdvance)
    setSelectionNotice(null)
    setSelectionMode('ship')
  }

  function handleOpenWeaponsAt(slotIndex: number, autoAdvance = false) {
    setActiveWeaponSlotIndex(Math.max(0, Math.min(slots.length - 1, slotIndex)))
    setHoveredWeaponSlotIndex(null)
    setWeaponAutoAdvance(autoAdvance)
    setSelectionNotice(null)
    setSelectionMode('weapon')
  }

  function handleOpenShips() {
    handleOpenShipsAt(nextShipSlotIndex, true)
  }

  function handleOpenWeapons() {
    handleOpenWeaponsAt(nextWeaponSlotIndex, true)
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
              nextShipSlotIndex={effectiveShipSlotIndex}
              nextWeaponSlotIndex={effectiveWeaponSlotIndex}
              onShieldModeChange={handleShieldModeChange}
              onOpenWeapons={handleOpenWeapons}
              onOpenShips={handleOpenShips}
              onOpenWeaponsAt={handleOpenWeaponsAt}
              onOpenShipsAt={handleOpenShipsAt}
              onAssignWeapon={setSlotWeapon}
              selectionNotice={selectionNotice}
            />
          }
          overlay={
            selectionMode === 'ship' ? (
              <ShipSelectorOverlay
                open
                allShips={allShips}
                selectedShipNames={selectedShipNames}
                maxVictimShips={maxVictimShips}
                targetSlotIndex={Math.max(0, Math.min(maxVictimShips - 1, activeShipSlotIndex))}
                activeSlotIndex={Math.max(0, Math.min(maxVictimShips - 1, activeShipSlotIndex))}
                onSetActiveSlot={setActiveShipSlotIndex}
                onHoverSlot={setHoveredShipSlotIndex}
                onSelectShip={handleShipSelect}
                onClearShip={(slotIndex) => setVictimShipAt(slotIndex, null)}
                onClose={() => setSelectionMode(null)}
              />
            ) : selectionMode === 'weapon' ? (
              <WeaponSelectorOverlay
                open
                slots={slots}
                weapons={allWeapons}
                targetSlotIndex={Math.max(0, Math.min(slots.length - 1, activeWeaponSlotIndex))}
                activeSlotIndex={Math.max(0, Math.min(slots.length - 1, activeWeaponSlotIndex))}
                onSetActiveSlot={setActiveWeaponSlotIndex}
                onHoverSlot={setHoveredWeaponSlotIndex}
                onSelectWeapon={handleWeaponSelect}
                onClearWeapon={(slotIndex) => {
                  const slot = slots[slotIndex]
                  if (!slot) return
                  setSlotWeapon(slot.id, null)
                }}
                onClose={() => setSelectionMode(null)}
              />
            ) : null
          }
        />
      </div>
    </section>
  )
}

