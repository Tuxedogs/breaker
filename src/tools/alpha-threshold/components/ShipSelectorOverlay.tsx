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
  targetSlotIndex: number
  activeSlotIndex: number
  selectionNotice: string | null
  onSetActiveSlot: (slotIndex: number) => void
  onHoverSlot: (slotIndex: number | null) => void
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

function getDefaultCollapsedGroups(): Record<string, boolean> {
  return Object.fromEntries(
    OVERLAY_SIZE_GROUPS.map((group) => [group.id, group.id !== 'capital'])
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
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(
    getDefaultCollapsedGroups()
  )
  const searchRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!open) return
    searchRef.current?.focus()
  }, [open])

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
    if (!queryTrimmed) {
      setCollapsedGroups(getDefaultCollapsedGroups())
      return
    }
    setCollapsedGroups(
      Object.fromEntries(OVERLAY_SIZE_GROUPS.map((group) => [group.id, false]))
    )
  }, [queryTrimmed])

  function toggleGroup(groupId: string) {
    setCollapsedGroups((current) => ({
      ...current,
      [groupId]: !(current[groupId] ?? false),
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
                  Selecting Ship {'\u2192'} Row {targetSlotIndex + 1}
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
                placeholder="Gladius, RSI, fighter, medium..."
                className="alpha-input"
              />
            </div>
          </div>

          <div className="alpha-drawer-results">
            {groupedShips.length > 0 ? (
              groupedShips.map((group) => (
                <section key={group.id} className="alpha-drawer-group">
                  <button
                    type="button"
                    className="alpha-drawer-group-toggle"
                    onClick={() => toggleGroup(group.id)}
                    aria-expanded={!(collapsedGroups[group.id] ?? false)}
                  >
                    <span>{group.label}</span>
                    <span>{(collapsedGroups[group.id] ?? false) ? '+' : '-'}</span>
                  </button>
                  {!(collapsedGroups[group.id] ?? false) ? (
                    <div className="alpha-drawer-group-body">
                      {group.roles.map((roleGroup) => {
                        const sizeSelectedRoles = selectedRoleBySize[group.id] ?? new Set<string>()
                        const isRoleActive = sizeSelectedRoles.has(roleGroup.roleKey)
                        return (
                          <section
                            key={`${group.id}-${roleGroup.roleKey}`}
                            className="alpha-drawer-ship-role-group"
                          >
                            <header className="alpha-drawer-ship-role-head">
                              <h4 className="alpha-drawer-weapon-class-title">{roleGroup.label}</h4>
                              <span className="alpha-drawer-ship-role-count">{roleGroup.ships.length}</span>
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
                                      isSelected ? 'alpha-drawer-ship-card-selected' : '',
                                      isRoleActive ? 'alpha-drawer-ship-card-role-active' : '',
                                    ].join(' ')}
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
              <section className="alpha-empty-state">
                <h3 className="title-font text-base text-slate-50">
                  {queryTrimmed ? 'No ships match the current search.' : 'No ships available.'}
                </h3>
              </section>
            )}
          </div>
        </div>
      </section>
    </section>
  )
}
