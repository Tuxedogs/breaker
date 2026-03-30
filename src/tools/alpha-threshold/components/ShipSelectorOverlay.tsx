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
  onClose: () => void
}

const SLOT_TONES = ['cyan', 'violet', 'amber', 'emerald'] as const

type ShipRoleGroup = {
  roleKey: string
  label: string
  ships: Ship[]
}

type ShipSizeRoleGroup = {
  id: string
  label: string
  roles: ShipRoleGroup[]
}

const OVERLAY_SIZE_GROUPS: Array<{ id: string; label: string }> = [
  { id: 'small', label: 'Small' },
  { id: 'medium', label: 'Medium' },
  { id: 'large', label: 'Large' },
  { id: 'capital', label: 'Capital' },
  { id: 'ground', label: 'Ground' },
]

/** Min search length before auto-expanding size groups that have matches. */
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

/** All collapsed until search is long enough; then groups with matches expand. */
function getShipCollapsedGroupsForQuery(
  groupedShipIds: string[],
  queryTrimmed: string
): Record<string, boolean> {
  const searchActive = queryTrimmed.length >= SHIP_SEARCH_EXPAND_MIN_CHARS
  return Object.fromEntries(
    OVERLAY_SIZE_GROUPS.map((group) => {
      const hasMatches = groupedShipIds.includes(group.id)
      if (!searchActive) return [group.id, true]
      return [group.id, !hasMatches]
    })
  )
}

function getShipSelectionKey(ship: Pick<Ship, 'manufacturer' | 'name'>): string {
  return `${ship.manufacturer}::${ship.name}`
}

function getShipRoleGroup(ship: Ship): { key: string; label: string } {
  const roleLabel = ship.role?.trim()
  if (!roleLabel) {
    return {
      key: 'utility',
      label: 'Utility',
    }
  }

  return {
    key: roleLabel.toLowerCase(),
    label: formatEntityLabel(roleLabel),
  }
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
  onClose,
}: Props) {
  const [query, setQuery] = useState('')
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const searchRef = useRef<HTMLInputElement | null>(null)
  const overlayRef = useRef<HTMLElement | null>(null)
  const [firstCellAnchorStyle, setFirstCellAnchorStyle] = useState<CSSProperties | undefined>(
    undefined
  )

  /** Top-left of the first matrix body cell only; size stays default (CSS `--alpha-overlay-width`). */
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

  const selectedRoleBySize = useMemo<Record<string, Set<string>>>(
    () => {
      const selectedRoles: Record<string, Set<string>> = Object.fromEntries(
        OVERLAY_SIZE_GROUPS.map((group) => [group.id, new Set<string>()])
      )
      selectedShipNames.forEach((shipKey) => {
        if (!shipKey) return
        const ship = shipBySelectionKey.get(shipKey)
        if (!ship) return
        const sizeGroupId = ship.isGroundVehicle ? 'ground' : ship.sizeGroup
        selectedRoles[sizeGroupId]?.add(getShipRoleGroup(ship).key)
      })
      return selectedRoles
    },
    [selectedShipNames, shipBySelectionKey]
  )

  const queryTrimmed = query.trim().toLowerCase()

  const filteredShips = useMemo(
    () =>
      allShips.filter((ship) => {
        if (!queryTrimmed) return true
        const manufacturerAliases = MANUFACTURER_ALIASES[ship.manufacturer] ?? ''
        const haystack =
          `${ship.manufacturer} ${manufacturerAliases} ${ship.name} ${ship.sizeGroup} ${ship.role ?? ''} ${getShipRoleGroup(ship).label}`.toLowerCase()
        return haystack.includes(queryTrimmed)
      }),
    [allShips, queryTrimmed]
  )

  const groupedShips = useMemo<ShipSizeRoleGroup[]>(
    () =>
      OVERLAY_SIZE_GROUPS.map((group) => {
        const shipsInGroup = filteredShips.filter((ship) =>
          group.id === 'ground' ? ship.isGroundVehicle : !ship.isGroundVehicle && ship.sizeGroup === group.id
        )
        const roleMap = new Map<string, ShipRoleGroup>()
        shipsInGroup.forEach((ship) => {
          const roleGroup = getShipRoleGroup(ship)
          const existing = roleMap.get(roleGroup.key)
          if (!existing) {
            roleMap.set(roleGroup.key, {
              roleKey: roleGroup.key,
              label: roleGroup.label,
              ships: [ship],
            })
            return
          }
          existing.ships.push(ship)
        })
        return {
          id: group.id,
          label: group.label,
          roles: Array.from(roleMap.values())
            .map((roleGroup) => ({
              ...roleGroup,
              ships: roleGroup.ships.slice().sort((left, right) => left.name.localeCompare(right.name)),
            }))
            .sort((left, right) => left.label.localeCompare(right.label)),
        }
      }).filter((group) => group.roles.length > 0),
    [filteredShips]
  )

  useEffect(() => {
    if (!open) return
    const groupedShipIds = groupedShips.map((g) => g.id)
    setCollapsedGroups(getShipCollapsedGroupsForQuery(groupedShipIds, queryTrimmed))
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
                placeholder="Search — name, manufacturer, role…"
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
              <span aria-hidden="true">×</span>
            </button>
          </div>

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
                        <span className="alpha-selector-bay-group-toggle-label">{group.label}</span>
                        <span className="alpha-selector-bay-group-toggle-chev" aria-hidden="true">
                          {(collapsedGroups[group.id] ?? true) ? '+' : '−'}
                        </span>
                      </button>
                      {!(collapsedGroups[group.id] ?? true) ? (
                        <div className="alpha-selector-bay-group-body">
                          {group.roles.map((roleGroup) => {
                            const sizeSelectedRoles = selectedRoleBySize[group.id] ?? new Set<string>()
                            const isRoleActive = sizeSelectedRoles.has(roleGroup.roleKey)
                            return (
                              <section
                                key={`${group.id}-${roleGroup.roleKey}`}
                                className="alpha-selector-bay-subgroup"
                              >
                                <header className="alpha-selector-bay-subhead">
                                  <h4 className="alpha-selector-bay-subhead-title">{roleGroup.label}</h4>
                                  <span className="alpha-selector-bay-subhead-count">{roleGroup.ships.length}</span>
                                </header>
                                <div className="alpha-drawer-ship-card-grid alpha-drawer-ship-card-grid--list">
                                  {roleGroup.ships.map((ship) => {
                                    const shipKey = getShipSelectionKey(ship)
                                    const isSelected = selectedKeySet.has(shipKey)
                                    return (
                                      <button
                                        key={shipKey}
                                        type="button"
                                        className={[
                                          'alpha-drawer-ship-card',
                                          'alpha-drawer-ship-card--list',
                                          'alpha-selector-bay-sc',
                                          isSelected ? 'alpha-drawer-ship-card-selected' : '',
                                          isRoleActive ? 'alpha-drawer-ship-card-role-active' : '',
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
                                            <span className="alpha-drawer-ship-card-list-sep" aria-hidden="true">
                                              ·
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
                              </section>
                            )
                          })}
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
