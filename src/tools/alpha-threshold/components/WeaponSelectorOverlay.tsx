import { useEffect, useMemo, useRef, useState } from 'react'
import { formatEntityLabel, formatMetric, getWeaponKey } from '../lib/calculations'
import { filterWeaponRecords, groupWeaponRecords } from '../lib/weapons/grouping'
import { formatWeaponClassLabel, formatWeaponTypeLabel } from '../lib/weapons/normalize'
import type { ArmorInteractionFilterChip } from './ArmorInteractionSummaryPanel'
import type { ComparisonSlot, WeaponRecord } from '../types'

type Props = {
  open: boolean
  slots: ComparisonSlot[]
  weapons: WeaponRecord[]
  targetSlotIndex: number
  activeSlotIndex: number
  selectionNotice: string | null
  /** When opening from matrix header chips (Ballistic / class), seed overlay filters */
  weaponFilterPreset?: ArmorInteractionFilterChip | null
  onSetActiveSlot: (slotIndex: number) => void
  onSelectWeapon: (weaponKey: string) => void
  onClearWeapon: (slotIndex: number) => void
  onClose: () => void
}

const DAMAGE_FILTERS = ['all', 'ballistic', 'energy'] as const
const SLOT_TONES = ['cyan', 'violet', 'amber', 'emerald'] as const

/** Min search length before auto-expanding size groups with matches. */
const WEAPON_SEARCH_EXPAND_MIN_CHARS = 3

type DamageFilter = (typeof DAMAGE_FILTERS)[number]

/**
 * All size groups collapsed until search is long enough; then size 3+ with matches
 * expand — sizes 1 and 2 stay collapsed even when they have matches.
 */
function getWeaponCollapsedGroupsForQuery(sizesInView: number[], queryTrimmed: string): Record<string, boolean> {
  if (sizesInView.length === 0) return {}
  const searchActive = queryTrimmed.length >= WEAPON_SEARCH_EXPAND_MIN_CHARS
  return Object.fromEntries(
    sizesInView.map((size) => {
      const key = String(size)
      if (!searchActive) return [key, true]
      if (size <= 2) return [key, true]
      return [key, false]
    })
  )
}

export function WeaponSelectorOverlay({
  open,
  slots,
  weapons,
  targetSlotIndex,
  activeSlotIndex,
  selectionNotice,
  weaponFilterPreset = null,
  onSetActiveSlot,
  onSelectWeapon,
  onClearWeapon,
  onClose,
}: Props) {
  const [query, setQuery] = useState('')
  const [damageFilter, setDamageFilter] = useState<DamageFilter>('all')
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const searchRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!open) {
      setQuery('')
      setDamageFilter('all')
      return
    }

    if (!weaponFilterPreset) {
      setQuery('')
      setDamageFilter('all')
      return
    }

    switch (weaponFilterPreset.kind) {
      case 'damageType': {
        setDamageFilter(weaponFilterPreset.value === 'energy' ? 'energy' : 'ballistic')
        setQuery('')
        break
      }
      case 'weaponClass': {
        setDamageFilter('all')
        setQuery(weaponFilterPreset.value)
        break
      }
      case 'velocity': {
        setDamageFilter('all')
        const v = weaponFilterPreset.value
        if (v != null && v > 0) {
          const bandFloor = Math.floor(v / 250) * 250
          setQuery(String(bandFloor))
        } else {
          setQuery(weaponFilterPreset.label)
        }
        break
      }
    }
  }, [open, weaponFilterPreset])

  useEffect(() => {
    if (!open) return
    searchRef.current?.focus()
  }, [open, activeSlotIndex])

  const filteredWeapons = useMemo(() => {
    const activeSlot = slots[targetSlotIndex]
    const compatibleWeapons = weapons.filter((weapon) =>
      activeSlot?.hardpointSize && activeSlot.hardpointSize > 0
        ? weapon.size <= activeSlot.hardpointSize
        : true
    )
    const damageFiltered =
      damageFilter === 'all'
        ? compatibleWeapons
        : compatibleWeapons.filter((weapon) => weapon.damageType === damageFilter)

    return filterWeaponRecords(damageFiltered, query)
  }, [damageFilter, query, slots, targetSlotIndex, weapons])

  const groupedWeapons = useMemo(() => groupWeaponRecords(filteredWeapons), [filteredWeapons])

  const sizesInView = useMemo(
    () => groupedWeapons.map((g) => g.size).sort((left, right) => left - right),
    [groupedWeapons]
  )

  const queryTrimmed = query.trim()

  useEffect(() => {
    if (!open) return
    setCollapsedGroups(getWeaponCollapsedGroupsForQuery(sizesInView, queryTrimmed))
  }, [open, sizesInView, queryTrimmed])

  const assignedWeaponKeys = useMemo(
    () =>
      new Set(
        slots
          .map((slot) => slot.weaponKey)
          .filter((weaponKey): weaponKey is string => Boolean(weaponKey))
      ),
    [slots]
  )
  const weaponByKey = useMemo(
    () => new Map(weapons.map((weapon) => [getWeaponKey(weapon), weapon] as const)),
    [weapons]
  )

  const accentTone = SLOT_TONES[activeSlotIndex % SLOT_TONES.length]

  function toggleGroup(groupId: string) {
    setCollapsedGroups((current) => ({
      ...current,
      [groupId]: !(current[groupId] ?? true),
    }))
  }

  return (
    <section className="alpha-selection-overlay" aria-label="Weapon selection overlay">
      <section
        className={[
          'alpha-overlay-panel',
          'alpha-selector-bay',
          'alpha-selector-bay--weapon',
          `alpha-selector-bay--tone-${accentTone}`,
        ].join(' ')}
        aria-label="Weapon loadout bay"
      >
        <div className="alpha-selector-bay-shell">
          <div className="alpha-selector-bay-head">
            <div className="alpha-selector-bay-slot-row" role="list" aria-label="Weapon slots">
              {slots.slice(0, 4).map((slot, index) => {
                const assignedWeapon = slot.weaponKey ? weaponByKey.get(slot.weaponKey) : null
                const isActive = index === activeSlotIndex
                const toneClass = `acm-panel-tone-${SLOT_TONES[index % SLOT_TONES.length]}`
                return (
                  <header
                    key={slot.id}
                    className={[
                      'acm-weapon-header',
                      'alpha-selector-bay-slot',
                      !assignedWeapon ? 'acm-weapon-header-empty' : '',
                      toneClass,
                      isActive ? 'acm-weapon-header-active' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    role="listitem"
                  >
                    <button
                      type="button"
                      className="alpha-selector-bay-slot-main"
                      onClick={() => onSetActiveSlot(index)}
                    >
                      {assignedWeapon ? (
                        <h3 className="acm-weapon-name">
                          {formatEntityLabel(assignedWeapon.name)}
                        </h3>
                      ) : (
                        <div className="acm-weapon-empty">
                          <p className="acm-weapon-empty-label">
                            Weapon {index + 1}
                          </p>
                        </div>
                      )}
                    </button>
                    {assignedWeapon ? (
                      <button
                        type="button"
                        className="alpha-selector-bay-slot-clear"
                        onClick={(event) => {
                          event.stopPropagation()
                          onClearWeapon(index)
                        }}
                        aria-label={`Clear weapon slot ${index + 1}`}
                      >
                        Clear
                      </button>
                    ) : null}
                  </header>
                )
              })}
            </div>
            <button
              type="button"
              className="alpha-selector-bay-close"
              onClick={onClose}
              aria-label="Close weapon selector"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>

          {selectionNotice ? (
            <p className="alpha-overlay-selection-notice" role="status" aria-live="polite">
              {selectionNotice}
            </p>
          ) : null}

          <div className="alpha-selector-bay-surface">
            <div className="alpha-selector-bay-controls">
              <div className="alpha-selector-bay-search-wrap">
                <label className="alpha-selector-bay-visually-hidden" htmlFor="alpha-overlay-weapon-search">
                  Search weapons
                </label>
                <input
                  ref={searchRef}
                  id="alpha-overlay-weapon-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search — name, class, size…"
                  className="alpha-selector-bay-search"
                  autoComplete="off"
                />
              </div>

              <div className="alpha-selector-bay-segments" aria-label="Weapon damage filter">
                {DAMAGE_FILTERS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={[
                      'alpha-selector-bay-segment',
                      damageFilter === value ? 'alpha-selector-bay-segment-active' : '',
                    ].join(' ')}
                    onClick={() => setDamageFilter(value)}
                  >
                    {value === 'all' ? 'All' : value}
                  </button>
                ))}
              </div>
            </div>

            <div className="alpha-selector-bay-scroll alpha-drawer-results">
              {groupedWeapons.length > 0 ? (
                groupedWeapons.map((sizeGroup) => {
                  const sizeKey = String(sizeGroup.size)
                  const isSizeCollapsed = collapsedGroups[sizeKey] ?? true
                  return (
                    <section key={sizeGroup.size} className="alpha-selector-bay-group">
                      <button
                        type="button"
                        className="alpha-selector-bay-group-toggle"
                        onClick={() => toggleGroup(sizeKey)}
                        aria-expanded={!isSizeCollapsed}
                      >
                        <span className="alpha-selector-bay-group-toggle-label">
                          Size {sizeGroup.size}
                        </span>
                        <span className="alpha-selector-bay-group-toggle-chev" aria-hidden="true">
                          {isSizeCollapsed ? '+' : '−'}
                        </span>
                      </button>
                      {!isSizeCollapsed ? (
                        <div className="alpha-selector-bay-group-body">
                          {sizeGroup.damageTypes.flatMap((damageTypeGroup) =>
                            damageTypeGroup.classes.map((weaponClassGroup) => {
                              const groupLabel = formatWeaponTypeLabel({
                                damageType: damageTypeGroup.damageType,
                                weaponClass: weaponClassGroup.weaponClass,
                              })
                              const groupKey = `${sizeGroup.size}-${damageTypeGroup.damageType}-${weaponClassGroup.weaponClass}`
                              return (
                                <section key={groupKey} className="alpha-selector-bay-subgroup">
                                  <header className="alpha-selector-bay-subhead">
                                    <h4 className="alpha-selector-bay-subhead-title">{groupLabel}</h4>
                                    <span className="alpha-selector-bay-subhead-count">
                                      {weaponClassGroup.weapons.length}
                                    </span>
                                  </header>
                                  <div className="alpha-drawer-ship-card-grid alpha-drawer-weapon-overlay-card-grid">
                                    {weaponClassGroup.weapons.map((weapon) => {
                                      const weaponKey = getWeaponKey(weapon)
                                      const isAssigned = assignedWeaponKeys.has(weaponKey)
                                      return (
                                        <button
                                          key={weaponKey}
                                          type="button"
                                          className={[
                                            'alpha-drawer-ship-card',
                                            'alpha-drawer-weapon-overlay-card',
                                            'alpha-selector-bay-wc',
                                            isAssigned ? 'alpha-drawer-ship-card-selected' : '',
                                          ]
                                            .filter(Boolean)
                                            .join(' ')}
                                          onClick={() => onSelectWeapon(weaponKey)}
                                        >
                                          <div className="alpha-drawer-weapon-overlay-card-body">
                                            <p className="alpha-drawer-ship-card-manufacturer alpha-selector-bay-wc-kicker">
                                              S{weapon.size} · {formatWeaponClassLabel(weapon.weaponClass)}
                                            </p>
                                            <span className="alpha-selector-bay-wc-name">
                                              {weapon.name}
                                            </span>
                                            <p className="alpha-drawer-ship-card-meta alpha-selector-bay-wc-meta">
                                              {formatMetric(weapon.alpha ?? 0)} α ·{' '}
                                              {formatMetric(weapon.projectileSpeed ?? 0)} m/s
                                            </p>
                                          </div>
                                          {isAssigned ? (
                                            <span className="alpha-drawer-ship-card-chip">Assigned</span>
                                          ) : null}
                                        </button>
                                      )
                                    })}
                                  </div>
                                </section>
                              )
                            })
                          )}
                        </div>
                      ) : null}
                    </section>
                  )
                })
              ) : (
                <section className="alpha-selector-bay-empty">
                  <p className="alpha-selector-bay-empty-title">
                    {queryTrimmed || damageFilter !== 'all'
                      ? 'No weapons match the current filters.'
                      : 'No weapons available.'}
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
