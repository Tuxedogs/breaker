import { useMemo, useState } from 'react'
import { SHIP_SIZE_GROUPS, formatEntityLabel } from '../lib/calculations'
import type { Ship } from '../types'

type Props = {
  allShips: Ship[]
  selectedShips: Ship[]
  selectedShipNames: Array<string | null>
  maxVictimShips: number
  onToggleShip: (shipName: string) => void
}

function getShipSelectionKey(ship: Pick<Ship, 'manufacturer' | 'name'>): string {
  return `${ship.manufacturer}::${ship.name}`
}

export function ShipSelectorPanel({
  allShips,
  selectedShips,
  selectedShipNames,
  maxVictimShips,
  onToggleShip,
}: Props) {
  const [query, setQuery] = useState('')

  const selectedKeySet = useMemo(
    () => new Set(selectedShipNames.filter((shipKey): shipKey is string => Boolean(shipKey))),
    [selectedShipNames]
  )

  const filteredShips = useMemo(
    () =>
      allShips.filter((ship) => {
        if (!query.trim()) return true
        const haystack = `${ship.manufacturer} ${ship.name} ${ship.sizeGroup}`.toLowerCase()
        return haystack.includes(query.trim().toLowerCase())
      }),
    [allShips, query]
  )

  const groupedShips = useMemo(
    () =>
      SHIP_SIZE_GROUPS.map((group) => {
        const shipsInGroup = filteredShips.filter((ship) => ship.sizeGroup === group.id)
        const byManufacturer = new Map<string, Ship[]>()

        shipsInGroup.forEach((ship) => {
          const ships = byManufacturer.get(ship.manufacturer) ?? []
          ships.push(ship)
          byManufacturer.set(ship.manufacturer, ships)
        })

        return {
          id: group.id,
          label: group.label,
          manufacturers: Array.from(byManufacturer.entries())
            .sort((left, right) => left[0].localeCompare(right[0]))
            .map(([manufacturer, ships]) => ({
              manufacturer,
              ships: ships.sort((left, right) => left.name.localeCompare(right.name)),
            })),
        }
      }).filter((group) => group.manufacturers.length > 0),
    [filteredShips]
  )

  return (
    <section className="alpha-drawer-workflow" aria-labelledby="alpha-drawer-ship-slots">
      <div className="alpha-drawer-selection-summary">
        <header className="alpha-selection-panel-head">
          <div>
            <p className="alpha-control-label" id="alpha-drawer-ship-slots">
              Selected Ships
            </p>
            <p className="alpha-selection-panel-copy">
              Choose up to {maxVictimShips} victim ships for the heatmap columns.
            </p>
          </div>
        </header>

        <div className="alpha-drawer-ship-pill-list">
          {selectedShips.length > 0 ? (
            selectedShips.map((ship) => {
              const shipKey = getShipSelectionKey(ship)

              return (
                <button
                  key={shipKey}
                  type="button"
                  className="alpha-drawer-ship-pill"
                  onClick={() => onToggleShip(shipKey)}
                >
                  <span>{formatEntityLabel(ship.name)}</span>
                  <span className="alpha-drawer-ship-pill-remove">Remove</span>
                </button>
              )
            })
          ) : (
            <span className="alpha-drawer-empty-copy">No ships selected yet.</span>
          )}
        </div>
      </div>

      <div className="alpha-drawer-filter-bar">
        <div className="alpha-drawer-filter-field">
          <label className="alpha-control-label" htmlFor="alpha-ship-search">
            Search
          </label>
          <input
            id="alpha-ship-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Gladius, RSI, medium..."
            className="alpha-input"
          />
        </div>
      </div>

      <div className="alpha-drawer-results">
        {groupedShips.length > 0 ? (
          groupedShips.map((group) => (
            <section key={group.id} className="alpha-drawer-group">
              <div className="alpha-drawer-group-toggle alpha-drawer-group-toggle-static">
                <span>{group.label}</span>
                <span>
                  {group.manufacturers.reduce((total, manufacturerGroup) => total + manufacturerGroup.ships.length, 0)}
                </span>
              </div>

              <div className="alpha-drawer-group-body">
                {group.manufacturers.map((manufacturerGroup) => (
                  <section
                    key={`${group.id}-${manufacturerGroup.manufacturer}`}
                    className="alpha-drawer-ship-manufacturer"
                  >
                    <h4 className="alpha-drawer-weapon-class-title">
                      {formatEntityLabel(manufacturerGroup.manufacturer)}
                    </h4>

                    <div className="alpha-drawer-ship-list">
                      {manufacturerGroup.ships.map((ship) => {
                        const shipKey = getShipSelectionKey(ship)
                        const isSelected = selectedKeySet.has(shipKey)
                        const isLocked =
                          !isSelected &&
                          selectedKeySet.size >= maxVictimShips

                        return (
                          <button
                            key={shipKey}
                            type="button"
                            className={[
                              'alpha-drawer-ship-row',
                              isSelected ? 'alpha-drawer-ship-row-selected' : '',
                            ].join(' ')}
                            onClick={() => onToggleShip(shipKey)}
                            disabled={isLocked}
                          >
                            <div>
                              <strong className="alpha-drawer-weapon-name">
                                {formatEntityLabel(ship.name)}
                              </strong>
                              <p className="alpha-drawer-weapon-meta">
                                {formatEntityLabel(ship.manufacturer)} · B {ship.ballisticThreshold} · E {ship.energyThreshold}
                              </p>
                            </div>
                            <div className="alpha-drawer-weapon-stats">
                              <span>{ship.sizeGroup}</span>
                              {isSelected ? (
                                <span className="alpha-drawer-weapon-chip">Selected</span>
                              ) : null}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </section>
          ))
        ) : (
          <section className="alpha-empty-state">
            <h3 className="title-font text-base text-slate-50">No ships match the current search.</h3>
          </section>
        )}
      </div>
    </section>
  )
}
