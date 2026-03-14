import { formatEntityLabel, formatMetric } from '../lib/calculations'
import type { Ship, ShipHardpointGroup, ShipSidebarGroup, ShipSizeGroup } from '../types'
import type { ReactNode } from 'react'

type Props = {
  groups: ShipSidebarGroup[]
  attackerShip: Ship | null
  attackerOptions: Ship[]
  attackerHardpointGroups: ShipHardpointGroup[]
  selectedShipNames: string[]
  searchValue: string
  showSelectedOnly: boolean
  mobileOpen: boolean
  onSearchChange: (value: string) => void
  onToggleShowSelectedOnly: () => void
  onToggleShipSelected: (shipName: string) => void
  onToggleGroup: (groupId: ShipSizeGroup) => void
  onAttackerShipChange: (shipName: string) => void
  onSelectVisible: () => void
  onClearAll: () => void
  children?: ReactNode
}

export function ShipSelectionSidebar({
  groups,
  attackerShip,
  attackerOptions,
  attackerHardpointGroups,
  selectedShipNames,
  searchValue,
  showSelectedOnly,
  mobileOpen,
  onSearchChange,
  onToggleShowSelectedOnly,
  onToggleShipSelected,
  onToggleGroup,
  onAttackerShipChange,
  onSelectVisible,
  onClearAll,
  children,
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
            <p className="page-kicker">Attacker</p>
            <h2 className="surface-title mt-3">Attacking Ship</h2>
          </div>

          <label className="space-y-2">
            <span className="alpha-control-label">Select attacker</span>
            <select
              value={attackerShip?.name ?? ''}
              onChange={(event) => onAttackerShipChange(event.target.value)}
              className="alpha-input"
            >
              {attackerOptions.map((ship) => (
                <option key={ship.name} value={ship.name}>
                  {formatEntityLabel(ship.manufacturer)} {formatEntityLabel(ship.name)}
                </option>
              ))}
            </select>
          </label>

          <article className="alpha-attacker-panel">
            <div className="alpha-attacker-image" aria-hidden="true">
              {attackerShip ? formatEntityLabel(attackerShip.name).slice(0, 2) : '??'}
            </div>
            <div className="alpha-attacker-copy">
              <p className="alpha-ship-option-meta">
                {attackerShip ? formatEntityLabel(attackerShip.manufacturer) : 'No ship selected'}
              </p>
              <h3 className="alpha-compare-ship-name">
                {attackerShip ? formatEntityLabel(attackerShip.name) : 'Awaiting attacker'}
              </h3>
              <div className="alpha-attacker-stats">
                <span>HP {formatMetric(attackerShip?.health ?? 0)}</span>
                <span>B {formatMetric(attackerShip?.ballisticThreshold ?? 0)}</span>
                <span>E {formatMetric(attackerShip?.energyThreshold ?? 0)}</span>
              </div>
            </div>
          </article>

          <section>
            <p className="alpha-control-label">Hardpoint groups</p>
            <div className="alpha-attacker-hardpoints">
              {attackerHardpointGroups.map((group) => (
                <div key={group.id} className="alpha-chip alpha-chip-muted">
                  {group.label}
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-3 border-b border-white/10 py-4">
          <div>
            <p className="page-kicker">Victims</p>
            <h2 className="surface-title mt-3">Victim Ships</h2>
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
                <div className="alpha-ship-option-list">
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
                          <span className="alpha-ship-option-main">
                            <span className="alpha-ship-option-meta">
                              {ship.manufacturer}
                            </span>
                            <span className="alpha-ship-option-name">
                              {formatEntityLabel(ship.name)}
                            </span>
                          </span>
                          <span className="alpha-ship-option-stats">
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

        {children ? (
          <section className="alpha-sidebar-merged-section">
            {children}
          </section>
        ) : null}
      </div>
    </aside>
  )
}
