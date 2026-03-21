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

const COMMON_PICK_SHIP_NAMES = [
  'Idris',
  'Perseus',
  'Guardian',
  'Vanguard',
  'Gladius',
  'Arrow',
] as const

function getShipSelectionKey(ship: Pick<Ship, 'manufacturer' | 'name'>): string {
  return `${ship.manufacturer}::${ship.name}`
}

function ShipRow({
  ship,
  isSelected,
  isLocked,
  onToggleShip,
}: {
  ship: Ship
  isSelected: boolean
  isLocked: boolean
  onToggleShip: (shipName: string) => void
}) {
  const shipKey = getShipSelectionKey(ship)

  return (
    <button
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
}

export function ShipSelectorPanel({
  allShips,
  selectedShips,
  selectedShipNames,
  maxVictimShips,
  onToggleShip,
}: Props) {
  const [query, setQuery] = useState('')
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({
    'common-picks': false,
    capital: true,
    large: true,
    medium: true,
    small: true,
  })

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

  const commonPickShips = useMemo(() => {
    const commonPickSet = new Set(COMMON_PICK_SHIP_NAMES)

    return filteredShips.filter((ship) =>
      commonPickSet.has(ship.name as (typeof COMMON_PICK_SHIP_NAMES)[number])
    )
  }, [filteredShips])

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

  function toggleGroup(groupId: string) {
    setCollapsedGroups((current) => ({
      ...current,
      [groupId]: !(current[groupId] ?? true),
    }))
  }

  return (
    <section className="alpha-drawer-workflow" aria-labelledby="alpha-drawer-ship-slots">
      <div className="alpha-drawer-selection-summary">
        <header className="alpha-selection-panel-head">
          <div>
            <p className="alpha-control-label" id="alpha-drawer-ship-slots">
              Selected Ships
            </p>
            <p className="alpha-selection-panel-copy">
              Choose up to {maxVictimShips} victim ships for the analysis columns.
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
        {commonPickShips.length > 0 || groupedShips.length > 0 ? (
          <>
            {commonPickShips.length > 0 ? (
              <section className="alpha-drawer-group">
                <button
                  type="button"
                  className="alpha-drawer-group-toggle"
                  onClick={() => toggleGroup('common-picks')}
                  aria-expanded={!(collapsedGroups['common-picks'] ?? false)}
                >
                  <span>Common Picks</span>
                  <span>{(collapsedGroups['common-picks'] ?? false) ? '+' : '-'}</span>
                </button>

                {!(collapsedGroups['common-picks'] ?? false) ? (
                  <div className="alpha-drawer-group-body">
                    <div className="alpha-drawer-ship-list">
                      {commonPickShips.map((ship) => {
                        const shipKey = getShipSelectionKey(ship)
                        const isSelected = selectedKeySet.has(shipKey)
                        const isLocked = !isSelected && selectedKeySet.size >= maxVictimShips

                        return (
                          <ShipRow
                            key={`common-${shipKey}`}
                            ship={ship}
                            isSelected={isSelected}
                            isLocked={isLocked}
                            onToggleShip={onToggleShip}
                          />
                        )
                      })}
                    </div>
                  </div>
                ) : null}
              </section>
            ) : null}

            {groupedShips.map((group) => (
              <section key={group.id} className="alpha-drawer-group">
                <button
                  type="button"
                  className="alpha-drawer-group-toggle"
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={!(collapsedGroups[group.id] ?? true)}
                >
                  <span>{group.label}</span>
                  <span>{(collapsedGroups[group.id] ?? true) ? '+' : '-'}</span>
                </button>

                {!(collapsedGroups[group.id] ?? true) ? (
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
                            const isLocked = !isSelected && selectedKeySet.size >= maxVictimShips

                            return (
                              <ShipRow
                                key={shipKey}
                                ship={ship}
                                isSelected={isSelected}
                                isLocked={isLocked}
                                onToggleShip={onToggleShip}
                              />
                            )
                          })}
                        </div>
                      </section>
                    ))}
                  </div>
                ) : null}
              </section>
            ))}
          </>
        ) : (
          <section className="alpha-empty-state">
            <h3 className="title-font text-base text-slate-50">No ships match the current search.</h3>
          </section>
        )}
      </div>
    </section>
  )
}
