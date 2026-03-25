import type { DefenseShieldState, SelectedWeaponComparison, Ship } from '../types'
import {
  type ArmorInteractionFilterChip,
} from './ArmorInteractionSummaryPanel'
import type { AlphaThresholdOnboardingHighlight } from './AlphaThresholdOnboardingModal'
import { ThresholdComparisonMatrix } from './ThresholdComparisonMatrix'

type Props = {
  ships: Ship[]
  selectedWeapons: SelectedWeaponComparison[]
  shieldMode: DefenseShieldState
  matrixMode: 'analysis' | 'target'
  selectionMode: 'ship' | 'weapon' | null
  nextShipSlotIndex: number
  nextWeaponSlotIndex: number
  onShieldModeChange: (mode: DefenseShieldState) => void
  onMatrixModeChange: (mode: 'analysis' | 'target') => void
  onWeaponHeaderChipClick?: (payload: {
    columnIndex: number
    chip: ArmorInteractionFilterChip
  }) => void
  onOpenWeapons: () => void
  onOpenShips: () => void
  onOpenWeaponsAt?: (slotIndex: number, autoAdvance?: boolean) => void
  onOpenShipsAt?: (slotIndex: number, autoAdvance?: boolean) => void
  onboardingHighlight?: AlphaThresholdOnboardingHighlight
}

export function ArmorInteractionTestbed({
  ships,
  selectedWeapons,
  shieldMode,
  matrixMode,
  selectionMode,
  nextShipSlotIndex,
  nextWeaponSlotIndex,
  onShieldModeChange,
  onMatrixModeChange,
  onWeaponHeaderChipClick,
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
      shieldMode={shieldMode}
      matrixMode={matrixMode}
      selectionMode={selectionMode}
      nextShipSlotIndex={nextShipSlotIndex}
      nextWeaponSlotIndex={nextWeaponSlotIndex}
      onShieldModeChange={onShieldModeChange}
      onMatrixModeChange={onMatrixModeChange}
      onWeaponHeaderChipClick={onWeaponHeaderChipClick}
      onOpenWeapons={onOpenWeapons}
      onOpenShips={onOpenShips}
      onOpenWeaponsAt={onOpenWeaponsAt}
      onOpenShipsAt={onOpenShipsAt}
      onboardingHighlight={onboardingHighlight}
    />
  )
}
