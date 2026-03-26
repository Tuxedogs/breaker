import type { DefenseShieldState, SelectedWeaponComparison, Ship, WeaponRecord } from '../types'
import type { ArmorInteractionFilterChip } from './ArmorInteractionSummaryPanel'
import type { AlphaThresholdOnboardingHighlight } from './AlphaThresholdOnboardingModal'
import { ThresholdComparisonMatrix } from './ThresholdComparisonMatrix'

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

export function ArmorInteractionTestbed({
  ships,
  selectedWeapons,
  allWeapons,
  shieldMode,
  matrixMode,
  hideHeaderRow = false,
  targetWeaponSizeFilter,
  onTargetWeaponSizeFilterChange,
  selectionMode,
  nextShipSlotIndex,
  nextWeaponSlotIndex,
  onShieldModeChange,
  onMatrixModeChange,
  targetWeaponFilterPreset,
  onTargetWeaponFilterPresetChange,
  onOpenWeapons,
  onOpenShips,
  onOpenWeaponsAt,
  onOpenShipsAt,
  onboardingHighlight = null,
}: Props) {
  return (
    <ThresholdComparisonMatrix
      ships={ships}
      selectedWeapons={selectedWeapons}
      allWeapons={allWeapons}
      shieldMode={shieldMode}
      matrixMode={matrixMode}
      targetWeaponFilterPreset={targetWeaponFilterPreset}
      onTargetWeaponFilterPresetChange={onTargetWeaponFilterPresetChange}
      targetWeaponSizeFilter={targetWeaponSizeFilter}
      onTargetWeaponSizeFilterChange={onTargetWeaponSizeFilterChange}
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
  )
}
