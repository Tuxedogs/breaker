import { ThresholdComparisonMatrix } from './ThresholdComparisonMatrix'
import type { ArmorInteractionFilterChip } from './ArmorInteractionSummaryPanel'
import type { AlphaThresholdOnboardingHighlight } from './AlphaThresholdOnboardingModal'
import type {
  ShipPresetDefinition,
  WeaponPresetDefinition,
  WeaponSizePresetDefinition,
} from '../data/presets'
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
  onClearShipAt?: (slotIndex: number) => void
  onClearWeaponAt?: (slotIndex: number) => void
  shipPresets: ShipPresetDefinition[]
  weaponSizePresets: WeaponSizePresetDefinition[]
  weaponPresets: WeaponPresetDefinition[]
  activeShipPresetId: string | null
  activeWeaponPresetId: string | null
  activeWeaponSizePresetId: string | null
  onApplyShipPreset: (presetId: string) => void
  onApplyWeaponSizePreset: (presetId: string) => void
  onApplyWeaponPreset: (presetId: string) => void
  onClearShipPreset: () => void
  onClearWeaponPreset: () => void
  onboardingHighlight?: AlphaThresholdOnboardingHighlight
}

export function ThresholdHeatmapBoard(props: Props) {
  return <ThresholdComparisonMatrix {...props} />
}
