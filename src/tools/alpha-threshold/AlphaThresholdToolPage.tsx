import './threshold.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  AlphaThresholdOnboardingModal,
  type AlphaThresholdOnboardingHighlight,
} from './components/AlphaThresholdOnboardingModal'
import { AlphaThresholdMobileOnboardingTip } from './components/AlphaThresholdMobileOnboardingTip'
import { MainHeatmapStage } from './components/MainHeatmapStage'
import { ShipSelectorOverlay } from './components/ShipSelectorOverlay'
import { ThresholdHeatmapBoard } from './components/ThresholdHeatmapBoard'
import { WeaponSelectorOverlay } from './components/WeaponSelectorOverlay'
import { useAlphaThresholdState } from './hooks/useAlphaThresholdState'
import { useLocalStorageState } from './hooks/useLocalStorageState'
import type { ArmorInteractionFilterChip } from './components/ArmorInteractionSummaryPanel'
import type { Ship, SelectedWeaponComparison, SlotTone, WeaponRecord } from './types'
import { parseShieldMode } from './lib/shieldMode'

const PREVIEW_WEAPON_COUNT = 4
const MOBILE_PREVIEW_WEAPON_COUNT = 4
const MOBILE_PREVIEW_SHIP_COUNT = 4
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
  const [weaponOverlayFilterPreset, setWeaponOverlayFilterPreset] =
    useState<ArmorInteractionFilterChip | null>(null)
  const [targetWeaponFilterPreset, setTargetWeaponFilterPreset] =
    useState<ArmorInteractionFilterChip | null>(null)
  const [targetWeaponSizeFilter, setTargetWeaponSizeFilter] = useState<number | null>(null)
  /** Clears in the overlay; at 2+ re-enable auto-advance (per ship / weapon flows). */
  const shipClearStreakRef = useRef(0)
  const weaponClearStreakRef = useRef(0)
  const [searchParams, setSearchParams] = useSearchParams()
  const [onboardingDismissed, setOnboardingDismissed] = useLocalStorageState<boolean>(
    'moonbreaker.alphaThreshold.onboarding.v1',
    false
  )
  const [mobileOnboardingDismissed, setMobileOnboardingDismissed] = useLocalStorageState<boolean>(
    'moonbreaker.alphaThreshold.mobileOnboarding.v1',
    false
  )
  const [onboardingHighlight, setOnboardingHighlight] =
    useState<AlphaThresholdOnboardingHighlight>(null)
  const [isMobileViewport, setIsMobileViewport] = useState(false)
  const [matrixMode, setMatrixMode] = useState<'analysis' | 'target'>('analysis')
  const {
    slots,
    setSlotWeapon,
    allWeapons,
    allShips,
    selectedWeapons,
    selectedShipNames,
    setVictimShipAt,
    maxVictimShips,
  } = useAlphaThresholdState(matrixMode)
  const shieldMode = parseShieldMode(searchParams.get('shield'))
  const visibleShipCount = isMobileViewport
    ? Math.min(maxVictimShips, MOBILE_PREVIEW_SHIP_COUNT)
    : maxVictimShips
  const visibleWeaponCount = isMobileViewport
    ? Math.min(slots.length, MOBILE_PREVIEW_WEAPON_COUNT)
    : Math.min(slots.length, PREVIEW_WEAPON_COUNT)

  const handleOnboardingHighlight = useCallback((highlight: AlphaThresholdOnboardingHighlight) => {
    setOnboardingHighlight(highlight)
  }, [])

  const handleOnboardingComplete = useCallback(() => {
    setOnboardingDismissed(true)
    setOnboardingHighlight(null)
  }, [setOnboardingDismissed])

  function getShipSelectionKey(ship: Pick<Ship, 'manufacturer' | 'name'>): string {
    return `${ship.manufacturer}::${ship.name}`
  }
  const nextShipSlotIndex = useMemo(() => {
    const openIndex = selectedShipNames.slice(0, visibleShipCount).findIndex((shipName) => shipName === null)
    return openIndex === -1 ? Math.max(0, visibleShipCount - 1) : openIndex
  }, [selectedShipNames, visibleShipCount])
  const nextWeaponSlotIndex = useMemo(() => {
    const openIndex = slots.slice(0, visibleWeaponCount).findIndex((slot) => slot.weaponKey == null)
    return openIndex === -1 ? Math.max(0, visibleWeaponCount - 1) : openIndex
  }, [slots, visibleWeaponCount])

  /** Column shown in weapon overlay + matrix when auto-advance: prefer active slot if empty (e.g. after clear). */
  const weaponOverlayTargetIndex = useMemo(() => {
    const clamped = Math.max(0, Math.min(visibleWeaponCount - 1, activeWeaponSlotIndex))
    if (!weaponAutoAdvance) return clamped
    return slots[clamped]?.weaponKey == null ? clamped : nextWeaponSlotIndex
  }, [weaponAutoAdvance, activeWeaponSlotIndex, slots, nextWeaponSlotIndex])
  /** Matrix destination highlight: overlay hover must not move row/column — use active slot only while selector is open. */
  const effectiveShipSlotIndex = Math.max(
    0,
    Math.min(
      visibleShipCount - 1,
      selectionMode === 'ship' ? activeShipSlotIndex : hoveredShipSlotIndex ?? activeShipSlotIndex
    )
  )
  const effectiveWeaponSlotIndex = Math.max(
    0,
    Math.min(
      visibleWeaponCount - 1,
      selectionMode === 'weapon' ? activeWeaponSlotIndex : hoveredWeaponSlotIndex ?? activeWeaponSlotIndex
    )
  )

  const shipBySelectionKey = useMemo(() => {
    return new Map(allShips.map((ship) => [getShipSelectionKey(ship), ship] as const))
  }, [allShips])

  const previewShips = useMemo(() => {
    const placeholderHistory: Ship['history'] = []
    return Array.from({ length: visibleShipCount }, (_, index): Ship => {
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
  }, [selectedShipNames, shipBySelectionKey, visibleShipCount])

  const previewWeapons = useMemo<SelectedWeaponComparison[]>(() => {
    const selectedWeaponBySlotId = new Map(
      selectedWeapons.map((selection) => [selection.slotId, selection] as const)
    )

    return slots
      .slice(0, visibleWeaponCount)
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
  }, [selectedWeapons, slots, visibleWeaponCount])

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
    const mq = window.matchMedia('(max-width: 768px)')
    const sync = () => setIsMobileViewport(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (!selectionMode) return
      event.preventDefault()
      setSelectionMode(null)
    }

    const onPointerDown = (event: PointerEvent) => {
      if (!selectionMode) return
      const target = event.target
      if (!(target instanceof Element)) return

      // Dismiss unless the hit target is part of the overlay UI or an established
      // matrix slot control (ship column, weapon headers, chart corner). Clicks on
      // matrix cells / chart panels close the overlay.
      if (target.closest('.alpha-overlay-panel')) return
      if (target.closest('.alpha-comparison-matrix-ship-card')) return
      if (target.closest('.alpha-comparison-matrix-weapon-header')) return
      if (target.closest('.alpha-comparison-matrix-corner')) return

      setSelectionMode(null)
      setSelectionNotice(null)
      setHoveredShipSlotIndex(null)
      setHoveredWeaponSlotIndex(null)
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('pointerdown', onPointerDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('pointerdown', onPointerDown)
    }
  }, [selectionMode])

  function handleShipSelect(shipKey: string) {
    const allShipSlotsFull = selectedShipNames.slice(0, visibleShipCount).every((name) => name != null)

    if (shipAutoAdvance && allShipSlotsFull) {
      setSelectionNotice('All ship slots are filled. Clear a slot or select one to replace.')
      return
    }

    const currentIndex = Math.max(0, Math.min(visibleShipCount - 1, activeShipSlotIndex))
    const currentSlotEmpty = selectedShipNames[currentIndex] == null
    const targetIndex = shipAutoAdvance
      ? selectedShipNames[currentIndex] == null
        ? currentIndex
        : nextShipSlotIndex
      : currentIndex

    setSelectionNotice(null)
    setVictimShipAt(targetIndex, shipKey)

    if (shipAutoAdvance && currentSlotEmpty) {
      const nextIndex = selectedShipNames.findIndex(
        (shipName, index) => index > targetIndex && shipName === null
      )
      setActiveShipSlotIndex(
        nextIndex === -1 ? targetIndex : Math.max(0, Math.min(visibleShipCount - 1, nextIndex))
      )
    }
  }

  function handleWeaponSelect(weaponKey: string) {
    const allWeaponSlotsFull = slots.slice(0, visibleWeaponCount).every((s) => s.weaponKey != null)

    if (weaponAutoAdvance && allWeaponSlotsFull) {
      setSelectionNotice('All weapon slots are filled. Clear a slot or select one to replace.')
      return
    }

    const currentIndex = Math.max(0, Math.min(visibleWeaponCount - 1, activeWeaponSlotIndex))
    const currentSlot = slots[currentIndex]
    const currentSlotEmpty = currentSlot?.weaponKey == null
    const targetIndex = weaponAutoAdvance
      ? currentSlotEmpty
        ? currentIndex
        : nextWeaponSlotIndex
      : currentIndex
    const slot = slots[targetIndex]
    if (!slot) return

    setSelectionNotice(null)
    setSlotWeapon(slot.id, weaponKey)

    if (weaponAutoAdvance && currentSlotEmpty) {
      const nextIndex = slots.slice(0, visibleWeaponCount).findIndex(
        (entry, index) => index > targetIndex && entry.weaponKey === null
      )
      setActiveWeaponSlotIndex(
        nextIndex === -1 ? targetIndex : Math.max(0, Math.min(visibleWeaponCount - 1, nextIndex))
      )
    }
  }

  function handleOpenShipsAt(slotIndex: number, autoAdvance = false) {
    setActiveShipSlotIndex(Math.max(0, Math.min(visibleShipCount - 1, slotIndex)))
    setHoveredShipSlotIndex(null)
    setShipAutoAdvance(autoAdvance)
    if (autoAdvance) {
      shipClearStreakRef.current = 0
    }
    setSelectionNotice(null)
    setSelectionMode('ship')
  }

  function handleOpenWeaponsAt(slotIndex: number, autoAdvance = false) {
    setWeaponOverlayFilterPreset(null)
    setActiveWeaponSlotIndex(Math.max(0, Math.min(visibleWeaponCount - 1, slotIndex)))
    setHoveredWeaponSlotIndex(null)
    setWeaponAutoAdvance(autoAdvance)
    if (autoAdvance) {
      weaponClearStreakRef.current = 0
    }
    setSelectionNotice(null)
    setSelectionMode('weapon')
  }

  /** Overlay slot button: manual target — next pick goes to this slot. */
  function handleShipOverlaySlotActivate(index: number) {
    setActiveShipSlotIndex(Math.max(0, Math.min(visibleShipCount - 1, index)))
    setShipAutoAdvance(false)
    setHoveredShipSlotIndex(null)
    setSelectionNotice(null)
  }

  function handleWeaponOverlaySlotActivate(index: number) {
    setActiveWeaponSlotIndex(Math.max(0, Math.min(visibleWeaponCount - 1, index)))
    setWeaponAutoAdvance(false)
    setHoveredWeaponSlotIndex(null)
    setSelectionNotice(null)
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
              matrixMode={matrixMode}
              targetWeaponFilterPreset={targetWeaponFilterPreset}
              onTargetWeaponFilterPresetChange={setTargetWeaponFilterPreset}
              targetWeaponSizeFilter={targetWeaponSizeFilter}
              onTargetWeaponSizeFilterChange={setTargetWeaponSizeFilter}
              hideHeaderRow={false}
              selectionMode={selectionMode}
              nextShipSlotIndex={effectiveShipSlotIndex}
              nextWeaponSlotIndex={effectiveWeaponSlotIndex}
              onShieldModeChange={handleShieldModeChange}
              onMatrixModeChange={setMatrixMode}
              onOpenWeapons={handleOpenWeapons}
              onOpenShips={handleOpenShips}
              onOpenWeaponsAt={handleOpenWeaponsAt}
              onOpenShipsAt={handleOpenShipsAt}
              onboardingHighlight={onboardingHighlight}
            />
          }
          overlay={
            selectionMode === 'ship' ? (
              <ShipSelectorOverlay
                open
                allShips={allShips}
                selectedShipNames={selectedShipNames}
                maxVictimShips={visibleShipCount}
                activeSlotIndex={Math.max(0, Math.min(visibleShipCount - 1, activeShipSlotIndex))}
                selectionNotice={selectionMode === 'ship' ? selectionNotice : null}
                onSetActiveSlot={handleShipOverlaySlotActivate}
                onSelectShip={handleShipSelect}
                onClearShip={(slotIndex) => {
                  setVictimShipAt(slotIndex, null)
                  setActiveShipSlotIndex(slotIndex)
                  setHoveredShipSlotIndex(null)
                  setSelectionNotice(null)
                  shipClearStreakRef.current += 1
                  if (shipClearStreakRef.current >= 2) {
                    setShipAutoAdvance(true)
                    shipClearStreakRef.current = 0
                  }
                }}
                onClose={() => setSelectionMode(null)}
              />
            ) : selectionMode === 'weapon' ? (
              <WeaponSelectorOverlay
                open
                slots={slots.slice(0, visibleWeaponCount)}
                weapons={allWeapons}
                targetSlotIndex={Math.max(
                  0,
                  Math.min(visibleWeaponCount - 1, weaponOverlayTargetIndex)
                )}
                activeSlotIndex={Math.max(0, Math.min(visibleWeaponCount - 1, activeWeaponSlotIndex))}
                selectionNotice={selectionMode === 'weapon' ? selectionNotice : null}
                weaponFilterPreset={weaponOverlayFilterPreset}
                onSetActiveSlot={handleWeaponOverlaySlotActivate}
                onSelectWeapon={handleWeaponSelect}
                onClearWeapon={(slotIndex) => {
                  const slot = slots[slotIndex]
                  if (!slot) return
                  setSlotWeapon(slot.id, null)
                  setActiveWeaponSlotIndex(slotIndex)
                  setHoveredWeaponSlotIndex(null)
                  setSelectionNotice(null)
                  weaponClearStreakRef.current += 1
                  if (weaponClearStreakRef.current >= 2) {
                    setWeaponAutoAdvance(true)
                    weaponClearStreakRef.current = 0
                  }
                }}
                onClose={() => {
                  setWeaponOverlayFilterPreset(null)
                  setSelectionMode(null)
                }}
              />
            ) : null
          }
        />
      </div>
      {!onboardingDismissed && !isMobileViewport ? (
        <AlphaThresholdOnboardingModal
          onHighlightChange={handleOnboardingHighlight}
          onComplete={handleOnboardingComplete}
        />
      ) : null}
      {!mobileOnboardingDismissed && isMobileViewport ? (
        <AlphaThresholdMobileOnboardingTip onComplete={() => setMobileOnboardingDismissed(true)} />
      ) : null}
    </section>
  )
}

