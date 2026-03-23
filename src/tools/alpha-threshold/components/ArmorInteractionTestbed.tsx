import type { DefenseShieldState, SelectedWeaponComparison, Ship } from '../types'
import {
  type ArmorInteractionFilterChip,
} from './ArmorInteractionSummaryPanel'
import { ThresholdComparisonMatrix } from './ThresholdComparisonMatrix'

type Props = {
  ships: Ship[]
  selectedWeapons: SelectedWeaponComparison[]
  shieldMode: DefenseShieldState
  selectionMode: 'ship' | 'weapon' | null
  nextShipSlotIndex: number
  nextWeaponSlotIndex: number
  onShieldModeChange: (mode: DefenseShieldState) => void
  onWeaponHeaderChipClick?: (payload: {
    columnIndex: number
    chip: ArmorInteractionFilterChip
  }) => void
  onOpenWeapons: () => void
  onOpenShips: () => void
  onOpenWeaponsAt?: (slotIndex: number, autoAdvance?: boolean) => void
  onOpenShipsAt?: (slotIndex: number, autoAdvance?: boolean) => void
}

export function ArmorInteractionTestbed({
  ships,
  selectedWeapons,
  shieldMode,
  selectionMode,
  nextShipSlotIndex,
  nextWeaponSlotIndex,
  onShieldModeChange,
  onWeaponHeaderChipClick,
  onOpenWeapons,
  onOpenShips,
  onOpenWeaponsAt,
  onOpenShipsAt,
}: Props) {
  return (
    <ThresholdComparisonMatrix
      ships={ships}
      selectedWeapons={selectedWeapons}
      shieldMode={shieldMode}
      selectionMode={selectionMode}
      nextShipSlotIndex={nextShipSlotIndex}
      nextWeaponSlotIndex={nextWeaponSlotIndex}
      onShieldModeChange={onShieldModeChange}
      onWeaponHeaderChipClick={onWeaponHeaderChipClick}
      onOpenWeapons={onOpenWeapons}
      onOpenShips={onOpenShips}
      onOpenWeaponsAt={onOpenWeaponsAt}
      onOpenShipsAt={onOpenShipsAt}
    />
  )
}
