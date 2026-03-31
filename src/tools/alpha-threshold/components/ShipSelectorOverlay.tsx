import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { formatEntityLabel } from '../lib/calculations'
import type { Ship } from '../types'

const FIRST_MATRIX_CELL_SELECTOR =
  '.alpha-threshold-tool .acm-body .acm-row:first-child article.acm-cell'

type Props = {
  open: boolean
  allShips: Ship[]
  selectedShipNames: Array<string | null>
  activeSlotIndex: number
  selectionNotice: string | null
  /** When true, use default half-panel layout (e.g. mobile bottom sheet). */
  disableAnchor?: boolean
  onSelectShip: (shipName: string) => void
  onActivateSlot?: (slotIndex: number) => void
  onClearSlot?: (slotIndex: number) => void
  onClose: () => void
}

const SLOT_TONES = ['cyan', 'violet', 'amber', 'emerald'] as const

type ShipManufacturerGroup = {
  id: string
  label: string
  ships: Ship[]
}

/** Min search length before auto-expanding manufacturer groups that have matches. */
const SHIP_SEARCH_EXPAND_MIN_CHARS = 3
const MANUFACTURER_ALIASES: Record<string, string> = {
  AEGS: 'aegis dynamics',
  ANVL: 'anvil aerospace',
  ARGO: 'argo astronautics',
  BANU: 'banu',
  CNOU: 'consolidated outland',
  CRUS: 'crusader industries',
  DRAK: 'drake interplanetary',
  ESPR: 'esperia',
  GAMA: 'gatac manufacture',
  KRIG: 'kruger intergalactic',
  MISC: 'musashi industrial and starflight concern',
  MRAI: 'mirai',
  ORIG: 'origin jumpworks',
  RSI: 'roberts space industries',
  TMBL: 'tumbril land systems',
}

function getShipCollapsedGroupsForQuery(
  groupedShipIds: string[],
  queryTrimmed: string
): Record<string, boolean> {
  const searchActive = queryTrimmed.length >= SHIP_SEARCH_EXPAND_MIN_CHARS
  return Object.fromEntries(
    groupedShipIds.map((groupId) => {
      if (!searchActive) return [groupId, true]
      return [groupId, false]
    })
  )
}

function getShipSelectionKey(ship: Pick<Ship, 'manufacturer' | 'name'>): string {
  return `${ship.manufacturer}::${ship.name}`
}

function formatShipCardName(ship: Ship): string {
  return formatEntityLabel(ship.name)
}

export function ShipSelectorOverlay({
  open,
  allShips,
  selectedShipNames,
  activeSlotIndex,
  selectionNotice,
  disableAnchor = false,
  onSelectShip,
  onActivateSlot,
  onClearSlot,
  onClose,
}: Props) {
  const [query, setQuery] = useState('')
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const searchRef = useRef<HTMLInputElement | null>(null)
  const overlayRef = useRef<HTMLElement | null>(null)
  const lastCollapseSeedKeyRef = useRef<string | null>(null)
  const [firstCellAnchorStyle, setFirstCellAnchorStyle] = useState<CSSProperties | undefined>(
    undefined
  )

  /** Top-left + width of the first matrix body cell; keep ship bay anchored to that column footprint. */
  useLayoutEffect(() => {
    if (!open || disableAnchor) {
      setFirstCellAnchorStyle(undefined)
      return
    }

    const overlay = overlayRef.current
    if (!overlay) {
      setFirstCellAnchorStyle(undefined)
      return
    }

    const update = () => {
      const cell = document.querySelector(FIRST_MATRIX_CELL_SELECTOR)
      if (!(cell instanceof HTMLElement)) {
        setFirstCellAnchorStyle(undefined)
        return
      }
      const overlayRect = overlay.getBoundingClientRect()
      const cellRect = cell.getBoundingClientRect()
      setFirstCellAnchorStyle({
        '--alpha-ship-anchor-top': `${cellRect.top - overlayRect.top}px`,
        '--alpha-ship-anchor-left': `${cellRect.left - overlayRect.left}px`,
        '--alpha-ship-anchor-width': `${cellRect.width}px`,
      } as CSSProperties)
    }

    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
      setFirstCellAnchorStyle(undefined)
    }
  }, [open, disableAnchor])

  useEffect(() => {
    if (!open) return
    searchRef.current?.focus()
  }, [open, activeSlotIndex])

  const shipBySelectionKey = useMemo(
    () => new Map(allShips.map((ship) => [getShipSelectionKey(ship), ship] as const)),
    [allShips]
  )

  const selectedKeySet = useMemo(
    () => new Set(selectedShipNames.filter((shipKey): shipKey is string => Boolean(shipKey))),
    [selectedShipNames]
  )

  const selectedManufacturerSet = useMemo(() => {
    const selectedManufacturers = new Set<string>()
    selectedShipNames.forEach((shipKey) => {
      if (!shipKey) return
      const ship = shipBySelectionKey.get(shipKey)
      if (!ship) return
      selectedManufacturers.add(ship.manufacturer)
    })
    return selectedManufacturers
  }, [selectedShipNames, shipBySelectionKey])

  const selectedCountByManufacturer = useMemo(() => {
    const counts = new Map<string, number>()
    selectedShipNames.forEach((shipKey) => {
      if (!shipKey) return
      const ship = shipBySelectionKey.get(shipKey)
      if (!ship) return
      counts.set(ship.manufacturer, (counts.get(ship.manufacturer) ?? 0) + 1)
    })
    return counts
  }, [selectedShipNames, shipBySelectionKey])

  const queryTrimmed = query.trim().toLowerCase()

  const filteredShips = useMemo(
    () =>
      allShips.filter((ship) => {
        if (!queryTrimmed) return true
        const manufacturerAliases = MANUFACTURER_ALIASES[ship.manufacturer] ?? ''
        const haystack =
          `${ship.manufacturer} ${manufacturerAliases} ${ship.name} ${ship.sizeGroup} ${ship.role ?? ''}`.toLowerCase()
        return haystack.includes(queryTrimmed)
      }),
    [allShips, queryTrimmed]
  )

  const groupedShips = useMemo<ShipManufacturerGroup[]>(
    () =>
      Array.from(
        filteredShips.reduce((map, ship) => {
          const existing = map.get(ship.manufacturer)
          if (existing) {
            existing.push(ship)
            return map
          }
          map.set(ship.manufacturer, [ship])
          return map
        }, new Map<string, Ship[]>())
      )
        .map(([manufacturer, ships]) => ({
          id: manufacturer,
          label: formatEntityLabel(manufacturer),
          ships: ships.slice().sort((left, right) => left.name.localeCompare(right.name)),
        }))
        .sort((left, right) => left.label.localeCompare(right.label)),
    [filteredShips]
  )

  useEffect(() => {
    if (!open) {
      lastCollapseSeedKeyRef.current = null
      return
    }
    const groupedShipIds = groupedShips.map((group) => group.id)
    const collapseSeedKey = `${queryTrimmed}::${groupedShipIds.join('|')}`
    if (lastCollapseSeedKeyRef.current === collapseSeedKey) return
    lastCollapseSeedKeyRef.current = collapseSeedKey
    setCollapsedGroups((current) => {
      const nextDefaults = getShipCollapsedGroupsForQuery(groupedShipIds, queryTrimmed)
      const preservedEntries = Object.fromEntries(
        groupedShipIds
          .filter((groupId) => groupId in current)
          .map((groupId) => [groupId, current[groupId]])
      )
      return {
        ...nextDefaults,
        ...preservedEntries,
      }
    })
  }, [open, groupedShips, queryTrimmed])

  function toggleGroup(groupId: string) {
    setCollapsedGroups((current) => ({
      ...current,
      [groupId]: !(current[groupId] ?? true),
    }))
  }

  const accentTone = SLOT_TONES[activeSlotIndex % SLOT_TONES.length]
  const useFirstCellAnchor = Boolean(firstCellAnchorStyle)

  return (
    <section
      ref={overlayRef}
      className="alpha-selection-overlay alpha-selection-overlay--ship-bay"
      aria-label="Ship selection overlay"
      style={firstCellAnchorStyle}
      data-ship-first-cell-anchor={useFirstCellAnchor ? 'true' : undefined}
    >
      <section
        className={[
          'alpha-overlay-panel',
          'alpha-selector-bay',
          'alpha-selector-bay--ship',
          `alpha-selector-bay--tone-${accentTone}`,
        ].join(' ')}
        aria-label="Ship loadout bay"
      >
        <div className="alpha-selector-bay-shell">
          <div className="alpha-selector-bay-head">
            <div className="alpha-selector-bay-search-wrap">
              <label className="alpha-selector-bay-visually-hidden" htmlFor="alpha-overlay-ship-search">
                Search ships
              </label>
              <input
                ref={searchRef}
                id="alpha-overlay-ship-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search - name, manufacturer, role..."
                className="alpha-selector-bay-search"
                autoComplete="off"
              />
            </div>
            <button
              type="button"
              className="alpha-selector-bay-close"
              onClick={onClose}
              aria-label="Close ship selector"
            >
              <span aria-hidden="true">x</span>
            </button>
          </div>

          {disableAnchor ? (
            <div className="alpha-selector-bay-mobile-slots" aria-label="Selected ships">
              {selectedShipNames.map((shipKey, slotIndex) => {
                const ship = shipKey ? shipBySelectionKey.get(shipKey) : null
                const isActive = slotIndex === activeSlotIndex
                return (
                  <section
                    key={`ship-slot-${slotIndex + 1}`}
                    className={[
                      'alpha-selector-bay-mobile-slot',
                      isActive ? 'alpha-selector-bay-mobile-slot-active' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <div className="alpha-selector-bay-mobile-slot-copy">
                      <p className="alpha-selector-bay-mobile-slot-label">Ship {slotIndex + 1}</p>
                      <p className="alpha-selector-bay-mobile-slot-value">
                        {ship
                          ? `${formatEntityLabel(ship.manufacturer)} ${formatShipCardName(ship)}`
                          : 'Empty'}
                      </p>
                    </div>
                    <div className="alpha-selector-bay-mobile-slot-actions">
                      <button
                        type="button"
                        className="alpha-selector-bay-mobile-slot-button"
                        onClick={() => onActivateSlot?.(slotIndex)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="alpha-selector-bay-mobile-slot-button alpha-selector-bay-mobile-slot-button-clear"
                        onClick={() => onClearSlot?.(slotIndex)}
                      >
                        Clear
                      </button>
                    </div>
                  </section>
                )
              })}
            </div>
          ) : null}

          {selectionNotice ? (
            <p className="alpha-overlay-selection-notice" role="status" aria-live="polite">
              {selectionNotice}
            </p>
          ) : null}

          <div className="alpha-selector-bay-surface alpha-selector-bay-surface-ship">
            <div className="alpha-selector-bay-scroll alpha-drawer-results">
              {groupedShips.length > 0 ? (
                groupedShips.map((group) => (
                  <section key={group.id} className="alpha-selector-bay-group">
                    <button
                      type="button"
                      className="alpha-selector-bay-group-toggle"
                      onClick={() => toggleGroup(group.id)}
                      aria-expanded={!(collapsedGroups[group.id] ?? true)}
                    >
                      <span className="alpha-selector-bay-group-toggle-label">
                        {selectedCountByManufacturer.get(group.id) ? (
                          <span className="alpha-selector-bay-group-toggle-prefix">
                            <span className="alpha-selector-bay-group-toggle-selected-count">
                              {selectedCountByManufacturer.get(group.id)}
                            </span>
                            <span className="alpha-selector-bay-group-toggle-plus" aria-hidden="true">
                              +
                            </span>
                          </span>
                        ) : null}
                        <span>{group.label}</span>
                      </span>
                      <span className="alpha-selector-bay-group-toggle-chev" aria-hidden="true">
                        {(collapsedGroups[group.id] ?? true) ? '+' : '-'}
                      </span>
                    </button>
                    {!(collapsedGroups[group.id] ?? true) ? (
                      <div className="alpha-selector-bay-group-body">
                        <div className="alpha-drawer-ship-card-grid alpha-drawer-ship-card-grid--list">
                          {group.ships.map((ship) => {
                            const shipKey = getShipSelectionKey(ship)
                            const isSelected = selectedKeySet.has(shipKey)
                            const isManufacturerActive = selectedManufacturerSet.has(ship.manufacturer)

                            return (
                              <button
                                key={shipKey}
                                type="button"
                                className={[
                                  'alpha-drawer-ship-card',
                                  'alpha-drawer-ship-card--list',
                                  'alpha-selector-bay-sc',
                                  isSelected ? 'alpha-drawer-ship-card-selected' : '',
                                  isManufacturerActive ? 'alpha-drawer-ship-card-role-active' : '',
                                ]
                                  .filter(Boolean)
                                  .join(' ')}
                                onClick={() => onSelectShip(shipKey)}
                              >
                                <div className="alpha-drawer-ship-card-body alpha-drawer-ship-card-body--list">
                                  <span className="alpha-drawer-ship-card-list-primary">
                                    <span className="alpha-drawer-ship-card-manufacturer">
                                      {formatEntityLabel(ship.manufacturer)}
                                    </span>
                                    <span className="alpha-drawer-ship-card-name">
                                      {formatShipCardName(ship)}
                                    </span>
                                  </span>
                                  <span className="alpha-drawer-ship-card-list-stats">
                                    B {ship.ballisticThreshold} · E {ship.energyThreshold}
                                  </span>
                                </div>
                                {isSelected ? (
                                  <span className="alpha-drawer-ship-card-chip">Selected</span>
                                ) : null}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ) : null}
                  </section>
                ))
              ) : (
                <section className="alpha-selector-bay-empty">
                  <p className="alpha-selector-bay-empty-title">
                    {queryTrimmed ? 'No ships match the current search.' : 'No ships available.'}
                  </p>
                </section>
              )}
            </div>
          </div>
        </div>
      </section>
    </section>
  )
}
