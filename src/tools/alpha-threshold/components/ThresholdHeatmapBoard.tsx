import { ArmorInteractionTestbed } from './ArmorInteractionTestbed'
import type { ArmorInteractionFilterChip } from './ArmorInteractionSummaryPanel'
import type { AlphaThresholdOnboardingHighlight } from './AlphaThresholdOnboardingModal'
import type { DefenseShieldState, SelectedWeaponComparison, Ship, WeaponRecord } from '../types'

type Props = {
  ships: Ship[]
  selectedWeapons: SelectedWeaponComparison[]
  allWeapons: WeaponRecord[]
  shieldMode: DefenseShieldState
  matrixMode: 'analysis' | 'target'
  targetWeaponFilterPreset?: ArmorInteractionFilterChip | null
  onTargetWeaponFilterPresetChange?: (chip: ArmorInteractionFilterChip | null) => void
  targetWeaponSizeFilter?: number | null
  onTargetWeaponSizeFilterChange?: (size: number | null) => void
  analysisColumnCount?: number
  onAnalysisColumnCountChange?: (count: number) => void
  targetColumnCount?: number
  onTargetColumnCountChange?: (count: number) => void
  hideHeaderRow?: boolean
  selectionMode: 'ship' | 'weapon' | null
  nextShipSlotIndex: number
  nextWeaponSlotIndex: number
  onShieldModeChange: (mode: DefenseShieldState) => void
  onMatrixModeChange: (mode: 'analysis' | 'target') => void
  onOpenWeapons: () => void
  onOpenShips: () => void
  onOpenWeaponsAt?: (slotIndex: number, autoAdvance?: boolean) => void
  onOpenShipsAt?: (slotIndex: number, autoAdvance?: boolean) => void
  onboardingHighlight?: AlphaThresholdOnboardingHighlight
}

export function ThresholdHeatmapBoard({
  ships,
  selectedWeapons,
  allWeapons,
  shieldMode,
  matrixMode,
  targetWeaponFilterPreset,
  onTargetWeaponFilterPresetChange,
  targetWeaponSizeFilter,
  onTargetWeaponSizeFilterChange,
  analysisColumnCount,
  onAnalysisColumnCountChange,
  targetColumnCount,
  onTargetColumnCountChange,
  hideHeaderRow = false,
  selectionMode,
  nextShipSlotIndex,
  nextWeaponSlotIndex,
  onShieldModeChange,
  onMatrixModeChange,
  onOpenWeapons,
  onOpenShips,
  onOpenWeaponsAt,
  onOpenShipsAt,
  onboardingHighlight = null,
}: Props) {
  return (
    <section className="alpha-threshold-board alpha-threshold-board-app" aria-label="Weapons Analysis board">
      <ArmorInteractionTestbed
        ships={ships}
        selectedWeapons={selectedWeapons}
        allWeapons={allWeapons}
        shieldMode={shieldMode}
        matrixMode={matrixMode}
        targetWeaponFilterPreset={targetWeaponFilterPreset}
        onTargetWeaponFilterPresetChange={onTargetWeaponFilterPresetChange}
        targetWeaponSizeFilter={targetWeaponSizeFilter}
        onTargetWeaponSizeFilterChange={onTargetWeaponSizeFilterChange}
        analysisColumnCount={analysisColumnCount}
        onAnalysisColumnCountChange={onAnalysisColumnCountChange}
        targetColumnCount={targetColumnCount}
        onTargetColumnCountChange={onTargetColumnCountChange}
        hideHeaderRow={hideHeaderRow}
        selectionMode={selectionMode}
        nextShipSlotIndex={nextShipSlotIndex}
        nextWeaponSlotIndex={nextWeaponSlotIndex}
        onShieldModeChange={onShieldModeChange}
        onMatrixModeChange={onMatrixModeChange}
        onOpenWeapons={onOpenWeapons}
        onOpenShips={onOpenShips}
        onOpenWeaponsAt={onOpenWeaponsAt}
        onOpenShipsAt={onOpenShipsAt}
        onboardingHighlight={onboardingHighlight}
      />
    </section>
  )
}
