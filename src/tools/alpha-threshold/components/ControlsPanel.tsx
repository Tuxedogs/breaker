import { WeaponComparisonSlots } from './WeaponComparisonSlots'
import type {
  ComparisonSlot,
  ShipSortKey,
  Weapon,
} from '../types'

type Props = {
  sortKey: ShipSortKey
  slots: ComparisonSlot[]
  activeSlotCount: number
  weapons: Weapon[]
  selectedShipCount: number
  mobileSidebarOpen: boolean
  onSortChange: (sortKey: ShipSortKey) => void
  onSlotCountChange: (count: number) => void
  onSlotChange: (slotId: string, weaponKey: string | null) => void
  onResetAllOverrides: () => void
  onToggleMobileSidebar: () => void
}

const slotCountOptions = [1, 2, 3, 4]

export function ControlsPanel({
  sortKey,
  slots,
  activeSlotCount,
  weapons,
  selectedShipCount,
  mobileSidebarOpen,
  onSortChange,
  onSlotCountChange,
  onSlotChange,
  onResetAllOverrides,
  onToggleMobileSidebar,
}: Props) {
  return (
    <section className="alpha-tool-panel" aria-label="Alpha threshold controls">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 border-b border-white/10 pb-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-3">
            <div>
              <p className="page-kicker">Comparison Controls</p>
              <p className="mt-3 max-w-3xl text-sm text-slate-300/80">
                Mix ballistic and energy weapons across up to four slots and compare them only against the ships you care about.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {slotCountOptions.map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => onSlotCountChange(count)}
                  className={[
                    'alpha-segment-button',
                    activeSlotCount === count ? 'alpha-segment-button-active' : '',
                  ].join(' ')}
                >
                  {count} slot{count > 1 ? 's' : ''}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,220px)_minmax(0,220px)_auto] sm:items-end">
            <label className="space-y-2">
              <span className="alpha-control-label">Sort selected ships</span>
              <select
                value={sortKey}
                onChange={(event) => onSortChange(event.target.value as ShipSortKey)}
                className="alpha-input"
              >
                <option value="health-desc">Health descending</option>
                <option value="ballistic-desc">Ballistic threshold</option>
                <option value="energy-desc">Energy threshold</option>
                <option value="manufacturer-asc">Manufacturer</option>
              </select>
            </label>

            <button
              type="button"
              onClick={onToggleMobileSidebar}
              className="alpha-action-button min-h-11 lg:hidden"
            >
              {mobileSidebarOpen ? 'Hide ships' : `Select ships (${selectedShipCount})`}
            </button>

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
          weapons={weapons}
          onChange={onSlotChange}
        />
      </div>
    </section>
  )
}
