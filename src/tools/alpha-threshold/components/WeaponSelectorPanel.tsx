import { useMemo, useState } from 'react'
import { formatMetric, getWeaponKey } from '../lib/calculations'
import { filterWeaponRecords, groupWeaponRecords } from '../lib/weapons/grouping'
import { formatWeaponTypeLabel } from '../lib/weapons/normalize'
import type { ComparisonSlot, SlotTone, WeaponRecord } from '../types'

type Props = {
  slots: ComparisonSlot[]
  weapons: WeaponRecord[]
  onSlotChange: (slotId: string, weaponKey: string | null) => void
}

const SLOT_TONES: SlotTone[] = ['cyan', 'violet', 'amber', 'emerald']
const DAMAGE_FILTERS = ['all', 'ballistic', 'energy'] as const
const COMMON_PICK_WEAPON_MATCHERS = [
  'CF-337 Panther',
  'NDB-30',
  'Revenant',
  'Mantis GT-220',
  'Shredder',
] as const

type DamageFilter = (typeof DAMAGE_FILTERS)[number]

function WeaponRow({
  weapon,
  isAssigned,
  isActiveAssignment,
  onAssign,
}: {
  weapon: WeaponRecord
  isAssigned: boolean
  isActiveAssignment: boolean
  onAssign: (weapon: WeaponRecord) => void
}) {
  return (
    <button
      type="button"
      className={[
        'alpha-drawer-weapon-row',
        isAssigned ? 'alpha-drawer-weapon-row-assigned' : '',
        isActiveAssignment ? 'alpha-drawer-weapon-row-active-assignment' : '',
      ].join(' ')}
      onClick={() => onAssign(weapon)}
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
          Â· S{weapon.size}
        </p>
      </div>
      <div className="alpha-drawer-weapon-stats">
        <span>{formatMetric(weapon.alpha ?? 0)} alpha</span>
        <span>{formatMetric(weapon.projectileSpeed ?? 0)} m/s</span>
        {isAssigned ? (
          <span className="alpha-drawer-weapon-chip">Assigned</span>
        ) : null}
      </div>
    </button>
  )
}

export default function WeaponSelectorPanel({ slots, weapons, onSlotChange }: Props) {
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [damageFilter, setDamageFilter] = useState<DamageFilter>('all')
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({
    'common-picks': false,
  })

  const slotCards = useMemo(
    () =>
      slots.map((slot, index) => {
        const assignedWeapon =
          weapons.find(
            (weapon) =>
              getWeaponKey(weapon) === slot.weaponKey &&
              (slot.hardpointSize <= 0 || weapon.size <= slot.hardpointSize)
          ) ?? null

        return {
          slot,
          tone: SLOT_TONES[index] ?? 'cyan',
          label: slot.label ?? `Weapon ${index + 1}`,
          assignedWeapon,
        }
      }),
    [slots, weapons]
  )

  const resolvedActiveSlotId = useMemo(() => {
    if (activeSlotId && slotCards.some((entry) => entry.slot.id === activeSlotId)) {
      return activeSlotId
    }

    return (
      slotCards.find((entry) => entry.slot.weaponKey === null)?.slot.id ??
      slotCards[0]?.slot.id ??
      null
    )
  }, [activeSlotId, slotCards])

  const activeSlot = useMemo(
    () => slotCards.find((entry) => entry.slot.id === resolvedActiveSlotId) ?? slotCards[0] ?? null,
    [resolvedActiveSlotId, slotCards]
  )

  const filteredWeapons = useMemo(() => {
    const compatibleWeapons = weapons.filter((weapon) =>
      activeSlot?.slot.hardpointSize && activeSlot.slot.hardpointSize > 0
        ? weapon.size <= activeSlot.slot.hardpointSize
        : true
    )
    const damageFiltered =
      damageFilter === 'all'
        ? compatibleWeapons
        : compatibleWeapons.filter((weapon) => weapon.damageType === damageFilter)

    return filterWeaponRecords(damageFiltered, query)
  }, [activeSlot, damageFilter, query, weapons])

  const groupedWeapons = useMemo(
    () => groupWeaponRecords(filteredWeapons),
    [filteredWeapons]
  )

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
        slotCards
          .map((entry) => entry.slot.weaponKey)
          .filter((weaponKey): weaponKey is string => Boolean(weaponKey))
      ),
    [slotCards]
  )

  function moveToNextOpenSlot(currentSlotId: string) {
    const currentIndex = slotCards.findIndex((entry) => entry.slot.id === currentSlotId)
    const nextEmpty = slotCards.find(
      (entry, index) => index > currentIndex && entry.slot.weaponKey === null
    )
    const firstEmpty = slotCards.find((entry) => entry.slot.weaponKey === null)

    setActiveSlotId(nextEmpty?.slot.id ?? firstEmpty?.slot.id ?? currentSlotId)
  }

  function handleAssignWeapon(weapon: WeaponRecord) {
    if (!activeSlot) return

    onSlotChange(activeSlot.slot.id, getWeaponKey(weapon))
    moveToNextOpenSlot(activeSlot.slot.id)
  }

  function toggleGroup(groupId: string) {
    setCollapsedGroups((current) => ({
      ...current,
      [groupId]: !(current[groupId] ?? true),
    }))
  }

  return (
    <section className="alpha-drawer-workflow" aria-labelledby="alpha-drawer-weapon-slots">
      <div className="alpha-drawer-selection-summary">
        <header className="alpha-selection-panel-head">
          <div>
            <p className="alpha-control-label" id="alpha-drawer-weapon-slots">
              Loadout Assignment
            </p>
            <p className="alpha-selection-panel-copy">
              Pick an active slot, then assign directly from the browser below.
            </p>
          </div>
        </header>

        <div className="alpha-weapon-drawer-slot-grid">
          {slotCards.map((entry) => {
            const isActive = entry.slot.id === activeSlot?.slot.id

            return (
              <article
                key={entry.slot.id}
                className={[
                  'alpha-weapon-drawer-slot-card',
                  isActive ? 'alpha-weapon-drawer-slot-card-active' : '',
                  `alpha-weapon-drawer-slot-card-${entry.tone}`,
                ].join(' ')}
              >
                <div className="alpha-weapon-drawer-slot-top">
                  <span className="alpha-weapon-drawer-slot-label">{entry.label}</span>
                  {isActive ? (
                    <span className="alpha-weapon-drawer-slot-badge">Active</span>
                  ) : null}
                </div>

                <button
                  type="button"
                  className="alpha-weapon-drawer-slot-activate"
                  onClick={() => setActiveSlotId(entry.slot.id)}
                >
                  {entry.assignedWeapon ? (
                    <>
                      <strong className="alpha-weapon-drawer-slot-name">
                        {entry.assignedWeapon.name}
                      </strong>
                      <span className="alpha-weapon-drawer-slot-meta">
                        {formatWeaponTypeLabel({
                          damageType: entry.assignedWeapon.damageType,
                          weaponClass: entry.assignedWeapon.weaponClass,
                        })}{' '}
                        · {formatMetric(entry.assignedWeapon.alpha ?? 0)} alpha
                      </span>
                    </>
                  ) : (
                    <>
                      <strong className="alpha-weapon-drawer-slot-name alpha-weapon-drawer-slot-name-empty">
                        Unassigned
                      </strong>
                      <span className="alpha-weapon-drawer-slot-meta">
                        Select a weapon from the browser
                      </span>
                    </>
                  )}
                </button>

                {entry.assignedWeapon ? (
                  <div className="alpha-weapon-drawer-slot-actions">
                    <span className="alpha-weapon-drawer-slot-size">
                      S{entry.assignedWeapon.size}
                    </span>
                    <button
                      type="button"
                      className="alpha-weapon-drawer-slot-clear"
                      onClick={() => {
                        onSlotChange(entry.slot.id, null)
                        setActiveSlotId(entry.slot.id)
                      }}
                    >
                      Clear
                    </button>
                  </div>
                ) : null}
              </article>
            )
          })}
        </div>
      </div>

      <div className="alpha-drawer-filter-bar">
        <div className="alpha-drawer-filter-field">
          <label className="alpha-control-label" htmlFor="alpha-weapon-search">
            Search
          </label>
          <input
            id="alpha-weapon-search"
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
                        const isActiveAssignment = activeSlot?.slot.weaponKey === weaponKey

                        return (
                          <WeaponRow
                            key={`common-${weaponKey}`}
                            weapon={weapon}
                            isAssigned={isAssigned}
                            isActiveAssignment={isActiveAssignment}
                            onAssign={handleAssignWeapon}
                          />
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
                      {sizeGroup.damageTypes.map((damageTypeGroup) => (
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
                                const isActiveAssignment = activeSlot?.slot.weaponKey === weaponKey

                                return (
                                  <WeaponRow
                                    key={weaponKey}
                                    weapon={weapon}
                                    isAssigned={isAssigned}
                                    isActiveAssignment={isActiveAssignment}
                                    onAssign={handleAssignWeapon}
                                  />
                                )
                              })}
                            </div>
                          </section>
                        ))
                      ))}
                    </div>
                  ) : null}
                </section>
              )
            })}
          </>
        ) : (
          <section className="alpha-empty-state">
            <h3 className="title-font text-base text-slate-50">No weapons match the current filters.</h3>
          </section>
        )}
      </div>
    </section>
  )
}



