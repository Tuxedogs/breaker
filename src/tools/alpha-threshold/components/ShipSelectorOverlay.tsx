import { useEffect, useMemo, useRef, useState } from 'react'
import { formatEntityLabel } from '../lib/calculations'
import {
  getShipThumbnailCandidates,
  type ShipThumbnailCandidate,
} from '../lib/ships/thumbnail'
import type { Ship } from '../types'

type Props = {
  open: boolean
  allShips: Ship[]
  selectedShipNames: Array<string | null>
  maxVictimShips: number
  activeSlotIndex: number
  selectionNotice: string | null
  onSetActiveSlot: (slotIndex: number) => void
  onSelectShip: (shipName: string) => void
  onClearShip: (slotIndex: number) => void
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
  { id: 'capital', label: 'Capital' },
  { id: 'large', label: 'Large' },
  { id: 'medium', label: 'Medium' },
  { id: 'small', label: 'Small' },
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

function getShipFallbackMonogram(ship: Ship): string {
  const make = formatEntityLabel(ship.manufacturer).replace(/\s+/g, '').slice(0, 1)
  const name = formatEntityLabel(ship.name).replace(/\s+/g, '').slice(0, 1)
  return `${make}${name}`.trim() || '??'
}

function OverlayShipThumbnail({ ship }: { ship: Ship }) {
  const candidates = useMemo(
    () => getShipThumbnailCandidates(ship),
    [ship.id, ship.imageAlt, ship.imageSrc, ship.manufacturer, ship.name]
  )
  const [candidateIndex, setCandidateIndex] = useState(0)

  useEffect(() => {
    setCandidateIndex(0)
  }, [ship.id, ship.imageSrc, ship.name])

  const current = candidates[Math.min(candidateIndex, candidates.length - 1)] as ShipThumbnailCandidate
  const canAdvance = candidateIndex < candidates.length - 1

  return (
    <div className="alpha-drawer-ship-card-media">
      <img
        src={current.src}
        alt={current.alt}
        loading="lazy"
        onError={() => {
          if (!canAdvance) return
          setCandidateIndex((value) => Math.min(value + 1, candidates.length - 1))
        }}
      />
      {current.source === 'placeholder' ? (
        <div className="alpha-drawer-ship-card-media-fallback" aria-hidden="true">
          {getShipFallbackMonogram(ship)}
        </div>
      ) : null}
      <span className="alpha-drawer-ship-card-media-source" aria-hidden="true">
        {current.source}
      </span>
    </div>
  )
}

export function ShipSelectorOverlay({
  open,
  allShips,
  selectedShipNames,
  maxVictimShips,
  activeSlotIndex,
  selectionNotice,
  onSetActiveSlot,
  onSelectShip,
  onClearShip,
  onClose,
}: Props) {
  const [query, setQuery] = useState('')
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const searchRef = useRef<HTMLInputElement | null>(null)

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

  return (
    <section className="alpha-selection-overlay" aria-label="Ship selection overlay">
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
            <div className="alpha-selector-bay-slot-row alpha-selector-bay-slot-row-ship" role="list" aria-label="Ship slots">
              {Array.from({ length: maxVictimShips }, (_, index) => {
                const shipKey = selectedShipNames[index]
                const selectedShip = shipKey ? shipBySelectionKey.get(shipKey) : null
                const isActive = index === activeSlotIndex
                const toneClass = `acm-panel-tone-${SLOT_TONES[index % SLOT_TONES.length]}`
                return (
                  <article
                    key={`ship-slot-${index + 1}`}
                    className={[
                      'acm-ship-card',
                      'alpha-selector-bay-ship-slot',
                      !selectedShip ? 'acm-ship-card-empty' : '',
                      toneClass,
                      isActive ? 'alpha-selector-bay-ship-slot-active' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    role="listitem"
                  >
                    <button
                      type="button"
                      className="alpha-selector-bay-ship-slot-main"
                      onClick={() => onSetActiveSlot(index)}
                    >
                      {selectedShip ? (
                        <>
                          <p className="acm-ship-role">
                            {formatEntityLabel(selectedShip.manufacturer)}
                          </p>
                          <h3 className="acm-ship-name">
                            {formatShipCardName(selectedShip)}
                          </h3>
                        </>
                      ) : (
                        <div className="acm-ship-empty">
                          <p className="acm-ship-empty-label">Ship {index + 1}</p>
                        </div>
                      )}
                    </button>
                    {selectedShip ? (
                      <button
                        type="button"
                        className="alpha-selector-bay-slot-clear"
                        onClick={(event) => {
                          event.stopPropagation()
                          onClearShip(index)
                        }}
                        aria-label={`Clear ship slot ${index + 1}`}
                      >
                        Clear
                      </button>
                    ) : null}
                  </article>
                )
              })}
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
            <div className="alpha-selector-bay-controls">
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
            </div>

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
                                <div className="alpha-drawer-ship-card-grid">
                                  {roleGroup.ships.map((ship) => {
                                    const shipKey = getShipSelectionKey(ship)
                                    const isSelected = selectedKeySet.has(shipKey)
                                    return (
                                      <button
                                        key={shipKey}
                                        type="button"
                                        className={[
                                          'alpha-drawer-ship-card',
                                          'alpha-selector-bay-sc',
                                          isSelected ? 'alpha-drawer-ship-card-selected' : '',
                                          isRoleActive ? 'alpha-drawer-ship-card-role-active' : '',
                                        ]
                                          .filter(Boolean)
                                          .join(' ')}
                                        onClick={() => onSelectShip(shipKey)}
                                      >
                                        <OverlayShipThumbnail ship={ship} />
                                        <div className="alpha-drawer-ship-card-body">
                                          <p className="alpha-drawer-ship-card-manufacturer">
                                            {formatEntityLabel(ship.manufacturer)}
                                          </p>
                                          <strong className="alpha-drawer-ship-card-name">
                                            {formatShipCardName(ship)}
                                          </strong>
                                          <p className="alpha-drawer-ship-card-meta">
                                            B {ship.ballisticThreshold} · E {ship.energyThreshold}
                                          </p>
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
