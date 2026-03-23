import type { ReactNode } from 'react'

import type { DefenseShieldState, SelectedWeaponComparison, Ship } from '../types'
import {
  type ArmorInteractionFilterChip,
} from './ArmorInteractionSummaryPanel'
import { ThresholdComparisonMatrix } from './ThresholdComparisonMatrix'

type Props = {
  controlStrip?: ReactNode
  ships: Ship[]
  selectedWeapons: SelectedWeaponComparison[]
  shieldMode: DefenseShieldState
  selectionMode: 'ship' | 'weapon' | null
  nextShipSlotIndex: number
  nextWeaponSlotIndex: number
  onShieldModeChange: (mode: DefenseShieldState) => void
  onFilterChipClick?: (chip: ArmorInteractionFilterChip) => void
  onOpenWeapons: () => void
  onOpenShips: () => void
  onOpenWeaponsAt?: (slotIndex: number, autoAdvance?: boolean) => void
  onOpenShipsAt?: (slotIndex: number, autoAdvance?: boolean) => void
}

export function ArmorInteractionTestbed({
  controlStrip,
  ships,
  selectedWeapons,
  shieldMode,
  selectionMode,
  nextShipSlotIndex,
  nextWeaponSlotIndex,
  onShieldModeChange,
  onFilterChipClick,
  onOpenWeapons,
  onOpenShips,
  onOpenWeaponsAt,
  onOpenShipsAt,
}: Props) {
  return (
    <ThresholdComparisonMatrix
      controlStrip={controlStrip}
      ships={ships}
      selectedWeapons={selectedWeapons}
      shieldMode={shieldMode}
      selectionMode={selectionMode}
      nextShipSlotIndex={nextShipSlotIndex}
      nextWeaponSlotIndex={nextWeaponSlotIndex}
      onShieldModeChange={onShieldModeChange}
      onFilterChipClick={onFilterChipClick}
      onOpenWeapons={onOpenWeapons}
      onOpenShips={onOpenShips}
      onOpenWeaponsAt={onOpenWeaponsAt}
      onOpenShipsAt={onOpenShipsAt}
    />
  )
}
