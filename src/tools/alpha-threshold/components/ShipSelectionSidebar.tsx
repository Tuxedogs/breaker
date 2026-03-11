import { formatEntityLabel, formatMetric } from '../lib/calculations'
import type { ShipSidebarGroup, ShipSizeGroup } from '../types'

type Props = {
  groups: ShipSidebarGroup[]
  selectedShipNames: string[]
  searchValue: string
  showSelectedOnly: boolean
  selectedShipCount: number
  visibleShipCount: number
  mobileOpen: boolean
  onSearchChange: (value: string) => void
  onToggleShowSelectedOnly: () => void
  onToggleShipSelected: (shipName: string) => void
  onToggleGroup: (groupId: ShipSizeGroup) => void
  onSelectVisible: () => void
  onClearAll: () => void
}

export function ShipSelectionSidebar({
  groups,
  selectedShipNames,
  searchValue,
  showSelectedOnly,
  selectedShipCount,
  visibleShipCount,
  mobileOpen,
  onSearchChange,
  onToggleShowSelectedOnly,
  onToggleShipSelected,
  onToggleGroup,
  onSelectVisible,
  onClearAll,
}: Props) {
  const selectedShipSet = new Set(selectedShipNames)

  return (
    <aside
      className={[
        'alpha-sidebar',
        mobileOpen ? 'block' : 'hidden',
        'lg:block',
      ].join(' ')}
    >
      <div className="alpha-sidebar-inner">
        <div className="space-y-3 border-b border-white/10 pb-4">
          <div>
            <p className="page-kicker">Ship Selection</p>
            <h2 className="surface-title mt-3">Results Scope</h2>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="alpha-chip alpha-chip-muted">
              Selected {selectedShipCount}
            </span>
            <span className="alpha-chip alpha-chip-muted">
              Visible {visibleShipCount}
            </span>
          </div>

          <label className="space-y-2">
            <span className="alpha-control-label">Search ships</span>
            <input
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Idris, RSI, fighter..."
              className="alpha-input"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onSelectVisible}
              className="alpha-action-button"
            >
              Select visible
            </button>
            <button
              type="button"
              onClick={onClearAll}
              className="alpha-action-button"
            >
              Clear all
            </button>
            <button
              type="button"
              onClick={onToggleShowSelectedOnly}
              className={[
                'alpha-action-button',
                showSelectedOnly ? 'alpha-action-button-primary' : '',
              ].join(' ')}
            >
              {showSelectedOnly ? 'Showing selected' : 'Show selected only'}
            </button>
          </div>
        </div>

        <div className="alpha-sidebar-groups">
          {groups.map((group) => (
            <section key={group.id} className="alpha-sidebar-group">
              <button
                type="button"
                onClick={() => onToggleGroup(group.id)}
                className="alpha-sidebar-group-toggle"
              >
                <span>
                  {group.label}
                  <span className="ml-2 text-slate-500">
                    {group.selectedCount}/{group.visibleCount}
                  </span>
                </span>
                <span aria-hidden>{group.collapsed ? '+' : '-'}</span>
              </button>

              {!group.collapsed ? (
                <div className="mt-2 space-y-2">
                  {group.ships.length > 0 ? (
                    group.ships.map((ship) => {
                      const isSelected = selectedShipSet.has(ship.name)

                      return (
                        <button
                          key={ship.name}
                          type="button"
                          onClick={() => onToggleShipSelected(ship.name)}
                          className="alpha-ship-option-button"
                          data-selected={isSelected}
                        >
                          <span
                            aria-hidden
                            className={[
                              'alpha-ship-option-check',
                              isSelected ? 'alpha-ship-option-check-selected' : '',
                            ].join(' ')}
                          />
                          <span className="alpha-ship-option-main">
                            <span className="alpha-ship-option-name">
                              {formatEntityLabel(ship.name)}
                            </span>
                            <span className="alpha-ship-option-meta">
                              {ship.manufacturer}
                            </span>
                          </span>
                          <span className="alpha-ship-option-stats">
                            <span>Hull {formatMetric(ship.health)}</span>
                            <span>B {formatMetric(ship.ballisticThreshold)}</span>
                            <span>E {formatMetric(ship.energyThreshold)}</span>
                          </span>
                        </button>
                      )
                    })
                  ) : (
                    <p className="px-1 text-sm text-slate-500">
                      No ships visible in this group.
                    </p>
                  )}
                </div>
              ) : null}
            </section>
          ))}
        </div>
      </div>
    </aside>
  )
}
