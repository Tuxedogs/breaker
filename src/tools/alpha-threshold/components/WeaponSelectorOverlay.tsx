import { useEffect, useMemo, useRef, useState } from 'react'
import { formatMetric, getWeaponKey } from '../lib/calculations'
import { filterWeaponRecords, groupWeaponRecords } from '../lib/weapons/grouping'
import { formatWeaponTypeLabel } from '../lib/weapons/normalize'
import type { ComparisonSlot, WeaponRecord } from '../types'

type Props = {
  open: boolean
  slots: ComparisonSlot[]
  weapons: WeaponRecord[]
  targetSlotIndex: number
  activeSlotIndex: number
  onSetActiveSlot: (slotIndex: number) => void
  onHoverSlot: (slotIndex: number | null) => void
  onSelectWeapon: (weaponKey: string) => void
  onClearWeapon: (slotIndex: number) => void
  onClose: () => void
}

const DAMAGE_FILTERS = ['all', 'ballistic', 'energy'] as const
const COMMON_PICK_WEAPON_MATCHERS = [
  'CF-337 Panther',
  'NDB-30',
  'Revenant',
  'Mantis GT-220',
  'Shredder',
] as const
const SLOT_TONES = ['cyan', 'violet', 'amber', 'emerald'] as const

type DamageFilter = (typeof DAMAGE_FILTERS)[number]

export function WeaponSelectorOverlay({
  open,
  slots,
  weapons,
  targetSlotIndex,
  activeSlotIndex,
  onSetActiveSlot,
  onHoverSlot,
  onSelectWeapon,
  onClearWeapon,
  onClose,
}: Props) {
  const [query, setQuery] = useState('')
  const [damageFilter, setDamageFilter] = useState<DamageFilter>('all')
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({
    'common-picks': false,
  })
  const searchRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!open) return
    searchRef.current?.focus()
  }, [open])

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

  const commonPickWeapons = useMemo(
    () =>
      filteredWeapons.filter((weapon) =>
        COMMON_PICK_WEAPON_MATCHERS.some((token) => weapon.name.includes(token))
      ),
    [filteredWeapons]
  )

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

  function toggleGroup(groupId: string) {
    setCollapsedGroups((current) => ({
      ...current,
      [groupId]: !(current[groupId] ?? true),
    }))
  }

  return (
    <section className="alpha-selection-overlay" aria-label="Weapon selection overlay">
      <section className="alpha-overlay-panel" aria-labelledby="alpha-overlay-weapon-title">
        <div className="alpha-drawer-workflow">
          <div className="alpha-drawer-selection-summary">
            <header className="alpha-selection-panel-head">
              <div>
                <p className="alpha-control-label" id="alpha-overlay-weapon-title">
                  Selecting Weapon {'\u2192'} Column {targetSlotIndex + 1}
                </p>
              </div>
              <button type="button" className="alpha-action-button" onClick={onClose}>
                Close
              </button>
            </header>
            <div className="alpha-overlay-slot-grid" role="list" aria-label="Weapon slots">
              {slots.slice(0, 4).map((slot, index) => {
                const assignedWeapon = slot.weaponKey ? weaponByKey.get(slot.weaponKey) : null
                const isActive = index === activeSlotIndex
                return (
                  <div
                    key={slot.id}
                    className={[
                      'alpha-overlay-slot-card',
                      `alpha-overlay-slot-tone-${SLOT_TONES[index % SLOT_TONES.length]}`,
                      isActive ? 'alpha-overlay-slot-card-active' : '',
                      assignedWeapon ? 'alpha-overlay-slot-card-filled' : '',
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
                        {assignedWeapon ? assignedWeapon.name : `Weapon ${index + 1}`}
                      </span>
                    </button>
                    {assignedWeapon ? (
                      <button
                        type="button"
                        className="alpha-overlay-slot-clear"
                        onClick={() => onClearWeapon(index)}
                        aria-label={`Clear weapon slot ${index + 1}`}
                      >
                        Clear
                      </button>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="alpha-drawer-filter-bar">
            <div className="alpha-drawer-filter-field">
              <label className="alpha-control-label" htmlFor="alpha-overlay-weapon-search">
                Search
              </label>
              <input
                ref={searchRef}
                id="alpha-overlay-weapon-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Attrition, cannon, S4..."
                className="alpha-input"
              />
            </div>

            <div className="alpha-drawer-segmented" aria-label="Weapon damage filter">
              {DAMAGE_FILTERS.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={[
                    'alpha-drawer-segmented-button',
                    damageFilter === value ? 'alpha-drawer-segmented-button-active' : '',
                  ].join(' ')}
                  onClick={() => setDamageFilter(value)}
                >
                  {value === 'all' ? 'All' : value}
                </button>
              ))}
            </div>
          </div>

          <div className="alpha-drawer-results">
            {commonPickWeapons.length > 0 || groupedWeapons.length > 0 ? (
              <>
                {commonPickWeapons.length > 0 ? (
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
                        <div className="alpha-drawer-weapon-list">
                          {commonPickWeapons.map((weapon) => {
                            const weaponKey = getWeaponKey(weapon)
                            const isAssigned = assignedWeaponKeys.has(weaponKey)

                            return (
                              <button
                                key={`common-${weaponKey}`}
                                type="button"
                                className={[
                                  'alpha-drawer-weapon-row',
                                  isAssigned ? 'alpha-drawer-weapon-row-assigned' : '',
                                ].join(' ')}
                                onClick={() => onSelectWeapon(weaponKey)}
                              >
                                <div>
                                  <strong className="alpha-drawer-weapon-name">{weapon.name}</strong>
                                  <p className="alpha-drawer-weapon-meta">
                                    {formatWeaponTypeLabel({
                                      damageType: weapon.damageType,
                                      weaponClass: weapon.weaponClass,
                                    })}{' '}
                                    - S{weapon.size}
                                  </p>
                                </div>
                                <div className="alpha-drawer-weapon-stats">
                                  <span>{formatMetric(weapon.alpha ?? 0)} alpha</span>
                                  <span>{formatMetric(weapon.projectileSpeed ?? 0)} m/s</span>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ) : null}
                  </section>
                ) : null}

                {groupedWeapons.map((sizeGroup) => {
                  const groupKey = String(sizeGroup.size)
                  const isCollapsed = collapsedGroups[groupKey] ?? true

                  return (
                    <section key={sizeGroup.size} className="alpha-drawer-group">
                      <button
                        type="button"
                        className="alpha-drawer-group-toggle"
                        onClick={() => toggleGroup(groupKey)}
                        aria-expanded={!isCollapsed}
                      >
                        <span>Size {sizeGroup.size}</span>
                        <span>{isCollapsed ? '+' : '-'}</span>
                      </button>

                      {!isCollapsed ? (
                        <div className="alpha-drawer-group-body">
                          {sizeGroup.damageTypes.map((damageTypeGroup) =>
                            damageTypeGroup.classes.map((weaponClassGroup) => (
                              <section
                                key={`${sizeGroup.size}-${damageTypeGroup.damageType}-${weaponClassGroup.weaponClass}`}
                                className="alpha-drawer-weapon-class"
                              >
                                <h4 className="alpha-drawer-weapon-class-title">
                                  {formatWeaponTypeLabel({
                                    damageType: damageTypeGroup.damageType,
                                    weaponClass: weaponClassGroup.weaponClass,
                                  })}
                                </h4>

                                <div className="alpha-drawer-weapon-list">
                                  {weaponClassGroup.weapons.map((weapon) => {
                                    const weaponKey = getWeaponKey(weapon)
                                    const isAssigned = assignedWeaponKeys.has(weaponKey)

                                    return (
                                      <button
                                        key={weaponKey}
                                        type="button"
                                        className={[
                                          'alpha-drawer-weapon-row',
                                          isAssigned ? 'alpha-drawer-weapon-row-assigned' : '',
                                        ].join(' ')}
                                        onClick={() => onSelectWeapon(weaponKey)}
                                      >
                                        <div>
                                          <strong className="alpha-drawer-weapon-name">
                                            {weapon.name}
                                          </strong>
                                          <p className="alpha-drawer-weapon-meta">
                                            {formatWeaponTypeLabel({
                                              damageType: weapon.damageType,
                                              weaponClass: weapon.weaponClass,
                                            })}{' '}
                                            - S{weapon.size}
                                          </p>
                                        </div>
                                        <div className="alpha-drawer-weapon-stats">
                                          <span>{formatMetric(weapon.alpha ?? 0)} alpha</span>
                                          <span>{formatMetric(weapon.projectileSpeed ?? 0)} m/s</span>
                                        </div>
                                      </button>
                                    )
                                  })}
                                </div>
                              </section>
                            ))
                          )}
                        </div>
                      ) : null}
                    </section>
                  )
                })}
              </>
            ) : (
              <section className="alpha-empty-state">
                <h3 className="title-font text-base text-slate-50">
                  No weapons match the current filters.
                </h3>
              </section>
            )}
          </div>
        </div>
      </section>
    </section>
  )
}
