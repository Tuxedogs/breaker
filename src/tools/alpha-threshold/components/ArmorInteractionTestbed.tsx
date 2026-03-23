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
  onShieldModeChange: (mode: DefenseShieldState) => void
  onFilterChipClick?: (chip: ArmorInteractionFilterChip) => void
  onOpenWeapons: () => void
  onOpenShips: () => void
}

export function ArmorInteractionTestbed({
  controlStrip,
  ships,
  selectedWeapons,
  shieldMode,
  onShieldModeChange,
  onFilterChipClick,
  onOpenWeapons,
  onOpenShips,
}: Props) {
  return (
    <ThresholdComparisonMatrix
      controlStrip={controlStrip}
      ships={ships}
      selectedWeapons={selectedWeapons}
      shieldMode={shieldMode}
      onShieldModeChange={onShieldModeChange}
      onFilterChipClick={onFilterChipClick}
      onOpenWeapons={onOpenWeapons}
      onOpenShips={onOpenShips}
    />
  )
}
