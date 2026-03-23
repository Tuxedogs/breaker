import { useEffect, useMemo, useRef, useState } from 'react'
import { SHIP_SIZE_GROUPS, formatEntityLabel } from '../lib/calculations'
import type { Ship } from '../types'

type Props = {
  open: boolean
  allShips: Ship[]
  selectedShipNames: Array<string | null>
  maxVictimShips: number
  targetSlotIndex: number
  activeSlotIndex: number
  selectionNotice: string | null
  onSetActiveSlot: (slotIndex: number) => void
  onHoverSlot: (slotIndex: number | null) => void
  onSelectShip: (shipName: string) => void
  onClearShip: (slotIndex: number) => void
  onClose: () => void
}

const COMMON_PICK_SHIP_NAMES = [
  'Idris',
  'Perseus',
  'Guardian',
  'Vanguard',
  'Gladius',
  'Arrow',
] as const
const SLOT_TONES = ['cyan', 'violet', 'amber', 'emerald'] as const

function getShipSelectionKey(ship: Pick<Ship, 'manufacturer' | 'name'>): string {
  return `${ship.manufacturer}::${ship.name}`
}

export function ShipSelectorOverlay({
  open,
  allShips,
  selectedShipNames,
  maxVictimShips,
  targetSlotIndex,
  activeSlotIndex,
  selectionNotice,
  onSetActiveSlot,
  onHoverSlot,
  onSelectShip,
  onClearShip,
  onClose,
}: Props) {
  const [query, setQuery] = useState('')
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({
    'common-picks': false,
    capital: true,
    large: true,
    medium: true,
    small: true,
  })
  const searchRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!open) return
    searchRef.current?.focus()
  }, [open])

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
  const shipBySelectionKey = useMemo(
    () => new Map(allShips.map((ship) => [getShipSelectionKey(ship), ship] as const)),
    [allShips]
  )

  function toggleGroup(groupId: string) {
    setCollapsedGroups((current) => ({
      ...current,
      [groupId]: !(current[groupId] ?? true),
    }))
  }

  return (
    <section className="alpha-selection-overlay" aria-label="Ship selection overlay">
      <section className="alpha-overlay-panel" aria-labelledby="alpha-overlay-ship-title">
        <div className="alpha-drawer-workflow">
          <div className="alpha-drawer-selection-summary">
            <header className="alpha-selection-panel-head">
              <div>
                <p className="alpha-control-label" id="alpha-overlay-ship-title">
                  Selecting Ship {'\u2192'} Row {Math.min(targetSlotIndex + 1, maxVictimShips)}
                </p>
              </div>
              <button type="button" className="alpha-action-button" onClick={onClose}>
                Close
              </button>
            </header>
            <div className="alpha-overlay-slot-grid" role="list" aria-label="Ship slots">
              {Array.from({ length: maxVictimShips }, (_, index) => {
                const shipKey = selectedShipNames[index]
                const selectedShip = shipKey ? shipBySelectionKey.get(shipKey) : null
                const isActive = index === activeSlotIndex
                return (
                  <div
                    key={`ship-slot-${index + 1}`}
                    className={[
                      'alpha-overlay-slot-card',
                      `alpha-overlay-slot-tone-${SLOT_TONES[index % SLOT_TONES.length]}`,
                      isActive ? 'alpha-overlay-slot-card-active' : '',
                      selectedShip ? 'alpha-overlay-slot-card-filled' : '',
                    ].join(' ')}
                    role="listitem"
                  >
                    <button
                      type="button"
                      className="alpha-overlay-slot-button"
                      onClick={() => onSetActiveSlot(index)}
                      onPointerEnter={() => onHoverSlot(index)}
                      onPointerLeave={() => onHoverSlot(null)}
                    >
                      <span className="alpha-overlay-slot-label">
                        {selectedShip ? formatEntityLabel(selectedShip.name) : `Ship ${index + 1}`}
                      </span>
                    </button>
                    {selectedShip ? (
                      <button
                        type="button"
                        className="alpha-overlay-slot-clear"
                        onClick={() => onClearShip(index)}
                        aria-label={`Clear ship slot ${index + 1}`}
                      >
                        Clear
                      </button>
                    ) : null}
                  </div>
                )
              })}
            </div>
            {selectionNotice ? (
              <p className="alpha-overlay-selection-notice" role="status" aria-live="polite">
                {selectionNotice}
              </p>
            ) : null}
          </div>

          <div className="alpha-drawer-filter-bar">
            <div className="alpha-drawer-filter-field">
              <label className="alpha-control-label" htmlFor="alpha-overlay-ship-search">
                Search
              </label>
              <input
                ref={searchRef}
                id="alpha-overlay-ship-search"
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

                            return (
                              <button
                                key={`common-${shipKey}`}
                                type="button"
                                className={[
                                  'alpha-drawer-ship-row',
                                  isSelected ? 'alpha-drawer-ship-row-selected' : '',
                                ].join(' ')}
                                onClick={() => onSelectShip(shipKey)}
                              >
                                <div>
                                  <strong className="alpha-drawer-weapon-name">
                                    {formatEntityLabel(ship.name)}
                                  </strong>
                                  <p className="alpha-drawer-weapon-meta">
                                    {formatEntityLabel(ship.manufacturer)} · B {ship.ballisticThreshold} · E{' '}
                                    {ship.energyThreshold}
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

                                return (
                                  <button
                                    key={shipKey}
                                    type="button"
                                    className={[
                                      'alpha-drawer-ship-row',
                                      isSelected ? 'alpha-drawer-ship-row-selected' : '',
                                    ].join(' ')}
                                    onClick={() => onSelectShip(shipKey)}
                                  >
                                    <div>
                                      <strong className="alpha-drawer-weapon-name">
                                        {formatEntityLabel(ship.name)}
                                      </strong>
                                      <p className="alpha-drawer-weapon-meta">
                                        {formatEntityLabel(ship.manufacturer)} · B {ship.ballisticThreshold} · E{' '}
                                        {ship.energyThreshold}
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
                    ) : null}
                  </section>
                ))}
              </>
            ) : (
              <section className="alpha-empty-state">
                <h3 className="title-font text-base text-slate-50">
                  No ships match the current search.
                </h3>
              </section>
            )}
          </div>
        </div>
      </section>
    </section>
  )
}
