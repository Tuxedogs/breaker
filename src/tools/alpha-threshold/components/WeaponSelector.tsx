import {
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { formatMetric, getWeaponKey } from '../lib/calculations'
import { filterWeaponRecords, groupWeaponRecords } from '../lib/weapons/grouping'
import { formatWeaponClassLabel } from '../lib/weapons/normalize'
import type { SlotTone, WeaponRecord } from '../types'

type WeaponSelectorSlot = {
  id: string
  label: string
  tone: SlotTone
  weaponKey: string | null
  weaponName: string | null
  weaponClass: string | null
}

type Props = {
  open: boolean
  activeSlotId: string | null
  slots: WeaponSelectorSlot[]
  tone?: SlotTone
  weapons: WeaponRecord[]
  onClose: () => void
  onActiveSlotChange: (slotId: string | null) => void
  onAssignWeapon: (slotId: string, weaponKey: string) => void
  onClearSlot: (slotId: string) => void
  onClearAllSlots: () => void
}

const selectedToneClassName: Record<SlotTone, string> = {
  cyan: 'alpha-weapon-select-card-selected-cyan',
  violet: 'alpha-weapon-select-card-selected-violet',
  amber: 'alpha-weapon-select-card-selected-amber',
  emerald: 'alpha-weapon-select-card-selected-emerald',
}

const bookmarkToneClassName = {
  ballistic: 'alpha-weapon-bookmark-ballistic',
  energy: 'alpha-weapon-bookmark-energy',
} as const

function getNextOpenSlotId(
  slots: WeaponSelectorSlot[],
  currentSlotId: string
): string | null {
  const currentIndex = slots.findIndex((slot) => slot.id === currentSlotId)

  if (currentIndex === -1) return null

  const nextOpenSlot =
    [...slots.slice(currentIndex + 1), ...slots.slice(0, currentIndex)].find(
      (slot) => slot.weaponKey === null
    ) ?? null

  return nextOpenSlot?.id ?? null
}

function getFirstOpenSlotId(slots: WeaponSelectorSlot[]): string | null {
  return slots.find((slot) => slot.weaponKey === null)?.id ?? null
}

export function WeaponSelector({
  open,
  activeSlotId,
  slots,
  tone = 'cyan',
  weapons,
  onClose,
  onActiveSlotChange,
  onAssignWeapon,
  onClearSlot,
  onClearAllSlots,
}: Props) {
  const listboxId = useId()
  const dialogTitleId = useId()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const scrollPanelRef = useRef<HTMLUListElement | null>(null)
  const sectionRefMap = useRef(new Map<string, HTMLElement>())
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [activeBookmark, setActiveBookmark] = useState<{
    size: number
    damageType: 'ballistic' | 'energy'
  } | null>(null)
  const [assignmentError, setAssignmentError] = useState('')
  const deferredQuery = useDeferredValue(query)

  const activeSlot = useMemo(
    () =>
      slots.find((slot) => slot.id === activeSlotId) ??
      slots.find((slot) => slot.weaponKey === null) ??
      slots[0] ??
      null,
    [activeSlotId, slots]
  )
  const activeTone = activeSlot?.tone ?? tone

  const groupedWeapons = useMemo(
    () => groupWeaponRecords(filterWeaponRecords(weapons, deferredQuery)),
    [deferredQuery, weapons]
  )

  const flatWeapons = useMemo(
    () =>
      groupedWeapons.flatMap((sizeGroup) =>
        sizeGroup.damageTypes.flatMap((damageTypeGroup) =>
          damageTypeGroup.classes.flatMap(
            (weaponClassGroup) => weaponClassGroup.weapons
          )
        )
      ),
    [groupedWeapons]
  )

  const defaultBookmark = groupedWeapons[0]?.damageTypes[0]
    ? {
        size: groupedWeapons[0].size,
        damageType: groupedWeapons[0].damageTypes[0].damageType,
      }
    : null

  const weaponSlotLabels = useMemo(() => {
    const next = new Map<string, string[]>()

    slots.forEach((slot) => {
      if (!slot.weaponKey) return

      const labels = next.get(slot.weaponKey) ?? []
      labels.push(slot.label)
      next.set(slot.weaponKey, labels)
    })

    return next
  }, [slots])

  useEffect(() => {
    if (!open) return

    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', handleWindowKeyDown)

    return () => {
      window.removeEventListener('keydown', handleWindowKeyDown)
    }
  }, [onClose, open])

  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })
  }, [open])

  useEffect(() => {
    if (!open) return

    const scrollPanel = scrollPanelRef.current
    if (!scrollPanel) return

    const updateActiveBookmark = () => {
      const sections = Array.from(sectionRefMap.current.entries())
        .map(([key, node]) => {
          const [sizeValue, damageType] = key.split(':')

          return {
            size: Number(sizeValue),
            damageType: damageType as 'ballistic' | 'energy',
            top: node.offsetTop - scrollPanel.scrollTop,
          }
        })
        .sort((left, right) => left.top - right.top)

      if (sections.length === 0) {
        setActiveBookmark(null)
        return
      }

      const nextBookmark =
        [...sections].reverse().find((section) => section.top <= 64) ??
        sections[0]

      setActiveBookmark((current) => {
        if (
          current?.size === nextBookmark.size &&
          current.damageType === nextBookmark.damageType
        ) {
          return current
        }

        return {
          size: nextBookmark.size,
          damageType: nextBookmark.damageType,
        }
      })
    }

    updateActiveBookmark()
    scrollPanel.addEventListener('scroll', updateActiveBookmark, {
      passive: true,
    })

    return () => {
      scrollPanel.removeEventListener('scroll', updateActiveBookmark)
    }
  }, [groupedWeapons, open])

  function handleAssignWeapon(weapon: WeaponRecord) {
    if (!activeSlot) {
      setAssignmentError(
        'All weapon slots are filled. Clear a slot to select another weapon.'
      )
      return
    }

    onAssignWeapon(activeSlot.id, getWeaponKey(weapon))
    setAssignmentError('')
    onActiveSlotChange(getNextOpenSlotId(slots, activeSlot.id))
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((prev) =>
        flatWeapons.length === 0 ? 0 : (prev + 1) % flatWeapons.length
      )
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((prev) =>
        flatWeapons.length === 0
          ? 0
          : (prev - 1 + flatWeapons.length) % flatWeapons.length
      )
      return
    }

    if (event.key === 'Enter' && flatWeapons[activeIndex]) {
      event.preventDefault()
      handleAssignWeapon(flatWeapons[activeIndex])
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    }
  }

  if (!open) return null

  return createPortal(
    <div className="alpha-modal-backdrop" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogTitleId}
        className="alpha-modal-shell alpha-select-panel"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="alpha-modal-head">
          <div>
            <p className="page-kicker">Weapon Selector</p>
            <h2 id={dialogTitleId} className="surface-title mt-2">
              {activeSlot ? `Select Weapon for ${activeSlot.label}` : 'Assign Weapons'}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="alpha-action-button"
          >
            Close
          </button>
        </div>

        <div className="alpha-modal-slot-strip" role="tablist" aria-label="Weapon slots">
          {slots.map((slot) => {
            const isActive = slot.id === activeSlot?.id
            const isFilled = Boolean(slot.weaponKey)

            return (
              <button
                key={slot.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => {
                  setAssignmentError('')
                  onActiveSlotChange(slot.id)
                }}
                className={[
                  'alpha-modal-slot-tab',
                  isActive ? `alpha-modal-slot-tab-active-${slot.tone}` : '',
                  isActive && !isFilled
                    ? `alpha-modal-slot-tab-next-${slot.tone}`
                    : '',
                  isFilled
                    ? 'alpha-modal-slot-tab-filled'
                    : 'alpha-modal-slot-tab-empty',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <span className="alpha-modal-slot-top">
                  <span className="alpha-modal-slot-label">{slot.label}</span>
                  {isActive ? (
                    <span
                      className={[
                        'alpha-modal-slot-badge',
                        !slot.weaponKey
                          ? `alpha-modal-slot-badge-next-${slot.tone}`
                          : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {slot.weaponKey ? 'Active' : 'Next'}
                    </span>
                  ) : null}
                </span>

                {slot.weaponName ? (
                  <span className="alpha-modal-slot-row">
                    <span className="alpha-modal-slot-content">
                      <span className="alpha-modal-slot-weapon">
                        {slot.weaponName}
                      </span>
                      {slot.weaponClass ? (
                        <span className="alpha-modal-slot-state">
                          {formatWeaponClassLabel(slot.weaponClass)}
                        </span>
                      ) : null}
                    </span>

                    <span className="alpha-modal-slot-actions">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          setAssignmentError('')
                          onClearSlot(slot.id)
                          onActiveSlotChange(
                            getFirstOpenSlotId(slots) ?? slot.id
                          )
                        }}
                        className="alpha-modal-slot-clear"
                      >
                        Clear
                      </button>
                    </span>
                  </span>
                ) : (
                  <span className="alpha-modal-slot-state">Empty slot</span>
                )}
              </button>
            )
          })}
        </div>

        <div className="alpha-modal-search">
          <div className="alpha-modal-search-head">
            <button
              type="button"
              onClick={() => {
                setAssignmentError('')
                onClearAllSlots()
              }}
              className="alpha-action-button alpha-modal-clear-all"
            >
              Clear All
            </button>
          </div>

          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              role="combobox"
              value={query}
              aria-autocomplete="list"
              aria-expanded={open}
              aria-controls={listboxId}
              aria-activedescendant={
                flatWeapons[activeIndex]
                  ? `${listboxId}-${getWeaponKey(flatWeapons[activeIndex])}`
                  : undefined
              }
              onChange={(event) => {
                setAssignmentError('')
                setQuery(event.target.value)
                setActiveIndex(0)
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search S5, Repeater, Gatling..."
              className="alpha-input alpha-input-weapon-modal"
            />

          </div>

          <p className="alpha-modal-feedback" role="status" aria-live="polite">
            {assignmentError}
          </p>
        </div>

        <div className="alpha-modal-body">
          {activeBookmark ?? defaultBookmark ? (
            <div className="alpha-weapon-bookmark-wrap">
              <div
                className={[
                  'alpha-weapon-bookmark',
                  bookmarkToneClassName[(activeBookmark ?? defaultBookmark)!.damageType],
                ].join(' ')}
              >
                <span>S{(activeBookmark ?? defaultBookmark)!.size}</span>
                <span>{(activeBookmark ?? defaultBookmark)!.damageType}</span>
              </div>
            </div>
          ) : null}

          <ul
            ref={scrollPanelRef}
            id={listboxId}
            role="listbox"
            className="alpha-modal-list"
          >
            {flatWeapons.length > 0 ? (
              groupedWeapons.map((sizeGroup) => (
                <li key={sizeGroup.size} className="alpha-weapon-size-group">
                  <div className="alpha-weapon-size-head">
                    <span>Size {sizeGroup.size}</span>
                  </div>

                  <div className="alpha-weapon-type-groups">
                    {sizeGroup.damageTypes.map((damageTypeGroup) => (
                      <section
                        key={`${sizeGroup.size}-${damageTypeGroup.damageType}`}
                        className="alpha-weapon-type-group"
                        ref={(node) => {
                          const sectionKey = `${sizeGroup.size}:${damageTypeGroup.damageType}`

                          if (node) {
                            sectionRefMap.current.set(sectionKey, node)
                          } else {
                            sectionRefMap.current.delete(sectionKey)
                          }
                        }}
                      >
                        {!(sizeGroup.size === 1 &&
                        damageTypeGroup.damageType === 'ballistic') ? (
                          <div
                            className={[
                              'alpha-weapon-type-head',
                              damageTypeGroup.damageType === 'ballistic'
                                ? 'alpha-weapon-type-head-ballistic'
                                : 'alpha-weapon-type-head-energy',
                            ].join(' ')}
                          >
                            {damageTypeGroup.damageType}
                          </div>
                        ) : null}

                        {damageTypeGroup.classes.map((weaponClassGroup) => (
                          <section
                            key={`${sizeGroup.size}-${damageTypeGroup.damageType}-${weaponClassGroup.weaponClass}`}
                            className="alpha-weapon-class-group"
                          >
                            <div className="alpha-weapon-class-head">
                              {formatWeaponClassLabel(weaponClassGroup.weaponClass)}
                            </div>

                            <div className="alpha-weapon-card-grid">
                              {weaponClassGroup.weapons.map((weapon) => {
                                const weaponKey = getWeaponKey(weapon)
                                const index = flatWeapons.findIndex(
                                  (candidate) => getWeaponKey(candidate) === weaponKey
                                )
                                const isActive = index === activeIndex
                                const assignedLabels =
                                  weaponSlotLabels.get(weaponKey) ?? []
                                const isSelected = assignedLabels.length > 0

                                return (
                                  <button
                                    key={weaponKey}
                                    id={`${listboxId}-${weaponKey}`}
                                    type="button"
                                    role="option"
                                    aria-selected={isSelected}
                                    onMouseEnter={() => setActiveIndex(index)}
                                    onClick={() => handleAssignWeapon(weapon)}
                                    className={[
                                      'alpha-weapon-select-card',
                                      isActive
                                        ? 'alpha-weapon-select-card-active'
                                        : '',
                                      isSelected
                                        ? selectedToneClassName[activeTone]
                                        : '',
                                    ]
                                      .filter(Boolean)
                                      .join(' ')}
                                  >
                                    {assignedLabels.length > 0 ? (
                                      <span className="alpha-weapon-select-badges">
                                        {assignedLabels.map((slotLabel) => (
                                          <span
                                            key={`${weaponKey}-${slotLabel}`}
                                            className="alpha-weapon-select-badge"
                                          >
                                            {slotLabel}
                                          </span>
                                        ))}
                                      </span>
                                    ) : null}

                                    <span className="alpha-weapon-select-name">
                                      {weapon.name}
                                    </span>
                                    <span className="alpha-weapon-select-meta">
                                      {formatWeaponClassLabel(weapon.weaponClass)}
                                    </span>
                                    <dl className="alpha-weapon-select-stats">
                                      <div>
                                        <dt>Alpha</dt>
                                        <dd>{formatMetric(weapon.alpha ?? 0)}</dd>
                                      </div>
                                      <div>
                                        <dt>Burst</dt>
                                        <dd>{formatMetric(weapon.burstDps ?? 0)}</dd>
                                      </div>
                                      <div>
                                        <dt>Speed</dt>
                                        <dd>
                                          {formatMetric(
                                            weapon.projectileSpeed ?? 0
                                          )}
                                        </dd>
                                      </div>
                                    </dl>
                                  </button>
                                )
                              })}
                            </div>
                          </section>
                        ))}
                      </section>
                    ))}
                  </div>
                </li>
              ))
            ) : (
              <li className="px-3 py-4 text-sm text-slate-400">
                No weapons match that search.
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>,
    document.body
  )
}
