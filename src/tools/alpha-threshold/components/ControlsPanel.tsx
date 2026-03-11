import { ThresholdModeToggle } from './ThresholdModeToggle'
import { WeaponComparisonSlots } from './WeaponComparisonSlots'
import type {
  ComparisonSlot,
  ShipSortKey,
  SlotTone,
  ThresholdMode,
  Weapon,
} from '../types'

type Props = {
  mode: ThresholdMode
  sortKey: ShipSortKey
  slots: ComparisonSlot[]
  tones: SlotTone[]
  weapons: Weapon[]
  onModeChange: (mode: ThresholdMode) => void
  onSortChange: (sortKey: ShipSortKey) => void
  onSlotChange: (slotId: string, weaponName: string | null) => void
  onResetAllOverrides: () => void
}

export function ControlsPanel({
  mode,
  sortKey,
  slots,
  tones,
  weapons,
  onModeChange,
  onSortChange,
  onSlotChange,
  onResetAllOverrides,
}: Props) {
  return (
    <section className="alpha-tool-panel alpha-tool-panel-sticky" aria-label="Alpha threshold controls">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="page-kicker">Comparison Controls</p>
            <ThresholdModeToggle mode={mode} onChange={onModeChange} />
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,220px)_auto] sm:items-end">
            <label className="space-y-2">
              <span className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                Sort ships
              </span>
              <select
                value={sortKey}
                onChange={(event) => onSortChange(event.target.value as ShipSortKey)}
                className="alpha-input"
              >
                <option value="threshold-desc">Threshold descending</option>
                <option value="health-desc">Health descending</option>
                <option value="manufacturer-asc">Manufacturer</option>
              </select>
            </label>

            <button
              type="button"
              onClick={onResetAllOverrides}
              className="alpha-action-button min-h-11"
            >
              Reset overrides
            </button>
          </div>
        </div>

        <WeaponComparisonSlots
          slots={slots}
          tones={tones}
          weapons={weapons}
          onChange={onSlotChange}
        />
      </div>
    </section>
  )
}
