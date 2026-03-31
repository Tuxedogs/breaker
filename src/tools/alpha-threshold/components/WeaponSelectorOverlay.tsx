import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { formatMetric, getWeaponKey } from '../lib/calculations'
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
  anchorSlotIndex?: number
  selectionNotice: string | null
  /** When opening from matrix header chips (Ballistic / class), seed overlay filters */
  weaponFilterPreset?: ArmorInteractionFilterChip | null
  /** When true, use default half-panel layout (e.g. mobile bottom sheet). */
  disableAnchor?: boolean
  onSelectWeapon: (weaponKey: string) => void
  onActivateSlot?: (slotIndex: number) => void
  onClearSlot?: (slotIndex: number) => void
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
  anchorSlotIndex,
  selectionNotice,
  weaponFilterPreset = null,
  disableAnchor = false,
  onSelectWeapon,
  onActivateSlot,
  onClearSlot,
  onClose,
}: Props) {
  const [query, setQuery] = useState('')
  const [damageFilter, setDamageFilter] = useState<DamageFilter>('all')
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const searchRef = useRef<HTMLInputElement | null>(null)
  const overlayRef = useRef<HTMLElement | null>(null)
  const lastCollapseSeedKeyRef = useRef<string | null>(null)
  const [firstCellAnchorStyle, setFirstCellAnchorStyle] = useState<CSSProperties | undefined>(
    undefined
  )
  const resolvedAnchorSlotIndex = anchorSlotIndex ?? activeSlotIndex

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
      const header = document.querySelector(
        `.alpha-threshold-tool .acm-header-row .acm-weapon-header[data-col-index="${resolvedAnchorSlotIndex}"]`
      )
      if (!(header instanceof HTMLElement)) {
        setFirstCellAnchorStyle(undefined)
        return
      }
      const lastRow = document.querySelector('.alpha-threshold-tool .acm-body .acm-row:last-child')
      if (!(lastRow instanceof HTMLElement)) {
        setFirstCellAnchorStyle(undefined)
        return
      }
      const firstRow = document.querySelector('.alpha-threshold-tool .acm-body .acm-row:first-child')
      if (!(firstRow instanceof HTMLElement)) {
        setFirstCellAnchorStyle(undefined)
        return
      }

      const firstRowCells = Array.from(firstRow.querySelectorAll<HTMLElement>('article.acm-cell'))
      const lastRowCells = Array.from(lastRow.querySelectorAll<HTMLElement>('article.acm-cell'))
      const firstColumnCell =
        firstRowCells[Math.max(0, Math.min(resolvedAnchorSlotIndex, firstRowCells.length - 1))]
      const lastColumnCell =
        lastRowCells[Math.max(0, Math.min(resolvedAnchorSlotIndex, lastRowCells.length - 1))]
      if (!firstColumnCell || !lastColumnCell) {
        setFirstCellAnchorStyle(undefined)
        return
      }

      const overlayRect = overlay.getBoundingClientRect()
      const headerRect = header.getBoundingClientRect()
      const firstCellRect = firstColumnCell.getBoundingClientRect()
      const lastCellRect = lastColumnCell.getBoundingClientRect()
      const anchorHeight = Math.max(firstCellRect.height, lastCellRect.bottom - firstCellRect.top)
      setFirstCellAnchorStyle({
        '--alpha-weapon-anchor-top': `${firstCellRect.top - overlayRect.top}px`,
        '--alpha-weapon-anchor-left': `${headerRect.left - overlayRect.left}px`,
        '--alpha-weapon-anchor-width': `${headerRect.width}px`,
        '--alpha-weapon-anchor-height': `${anchorHeight}px`,
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
  }, [open, disableAnchor, resolvedAnchorSlotIndex])

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
    if (!open) {
      lastCollapseSeedKeyRef.current = null
      return
    }
    const collapseSeedKey = `${queryTrimmed}::${sizesInView.join('|')}`
    if (lastCollapseSeedKeyRef.current === collapseSeedKey) return
    lastCollapseSeedKeyRef.current = collapseSeedKey
    setCollapsedGroups((current) => {
      const nextDefaults = getWeaponCollapsedGroupsForQuery(sizesInView, queryTrimmed)
      const preservedEntries = Object.fromEntries(
        sizesInView
          .map((size) => String(size))
          .filter((groupId) => groupId in current)
          .map((groupId) => [groupId, current[groupId]])
      )
      return {
        ...nextDefaults,
        ...preservedEntries,
      }
    })
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

  const useColumnAnchor = Boolean(firstCellAnchorStyle)

  return (
    <section
      ref={overlayRef}
      className="alpha-selection-overlay alpha-selection-overlay--weapon-bay"
      aria-label="Weapon selection overlay"
      style={firstCellAnchorStyle}
      data-weapon-column-anchor={useColumnAnchor ? 'true' : undefined}
    >
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
          {disableAnchor ? (
            <div
              className="alpha-selector-bay-mobile-slots alpha-selector-bay-mobile-slots-top"
              aria-label="Selected weapons"
            >
              {slots.map((slot, slotIndex) => {
                const weapon = slot.weaponKey ? weaponByKey.get(slot.weaponKey) : null
                const isActive = slotIndex === activeSlotIndex
                return (
                  <section
                    key={slot.id}
                    className={[
                      'alpha-selector-bay-mobile-slot',
                      isActive ? 'alpha-selector-bay-mobile-slot-active' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <div className="alpha-selector-bay-mobile-slot-copy">
                      <p className="alpha-selector-bay-mobile-slot-label">{slot.label ?? `Weapon ${slotIndex + 1}`}</p>
                      <p className="alpha-selector-bay-mobile-slot-value">
                        {weapon ? weapon.name : 'Empty'}
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

          <div className="alpha-selector-bay-head">
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
                                  <div className="alpha-drawer-ship-card-grid alpha-drawer-weapon-overlay-list">
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
                                            'alpha-drawer-ship-card--list',
                                            'alpha-drawer-weapon-overlay-card--list',
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
