import {
  useDeferredValue,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import { formatMetric, getWeaponKey } from '../lib/calculations'
import {
  filterWeaponRecords,
  groupWeaponRecords,
} from '../lib/weapons/grouping'
import {
  formatWeaponClassLabel,
  formatWeaponSizeLabel,
} from '../lib/weapons/normalize'
import type { SlotTone, WeaponRecord } from '../types'

type Props = {
  label: string
  tone?: SlotTone
  value: string | null
  weapons: WeaponRecord[]
  onChange: (weaponKey: string | null) => void
}

const selectedToneClassName: Record<SlotTone, string> = {
  cyan: 'alpha-weapon-select-card-selected-cyan',
  violet: 'alpha-weapon-select-card-selected-violet',
  amber: 'alpha-weapon-select-card-selected-amber',
  emerald: 'alpha-weapon-select-card-selected-emerald',
}

export function WeaponSelector({
  label,
  tone = 'cyan',
  value,
  weapons,
  onChange,
}: Props) {
  const listboxId = useId()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const selectedWeapon = useMemo(
    () => weapons.find((weapon) => getWeaponKey(weapon) === value) ?? null,
    [value, weapons]
  )
  const [query, setQuery] = useState(selectedWeapon ? selectedWeapon.name : '')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const deferredQuery = useDeferredValue(query)

  const groupedWeapons = useMemo(
    () => groupWeaponRecords(filterWeaponRecords(weapons, deferredQuery)),
    [deferredQuery, weapons]
  )

  const flatWeapons = useMemo(
    () =>
      groupedWeapons.flatMap((sizeGroup) =>
        sizeGroup.damageTypes.flatMap((damageTypeGroup) =>
          damageTypeGroup.classes.flatMap((weaponClassGroup) => weaponClassGroup.weapons)
        )
      ),
    [groupedWeapons]
  )

  function selectWeapon(weapon: WeaponRecord | null) {
    onChange(weapon ? getWeaponKey(weapon) : null)
    setOpen(false)
    setQuery(weapon ? weapon.name : '')
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault()
      setOpen(true)
      return
    }

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

    if (event.key === 'Enter' && open && flatWeapons[activeIndex]) {
      event.preventDefault()
      selectWeapon(flatWeapons[activeIndex])
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      setQuery(selectedWeapon ? selectedWeapon.name : '')
    }
  }

  function handleBlur(event: React.FocusEvent<HTMLDivElement>) {
    const nextFocusTarget = event.relatedTarget

    if (
      nextFocusTarget instanceof Node &&
      containerRef.current?.contains(nextFocusTarget)
    ) {
      return
    }

    setOpen(false)
    setQuery(selectedWeapon ? selectedWeapon.name : '')
  }

  return (
    <div
      ref={containerRef}
      onBlurCapture={handleBlur}
      className="relative space-y-2"
    >
      <label className="alpha-control-label">{label}</label>

      <div className="relative">
        {selectedWeapon ? (
          <span
            aria-hidden
            className={[
              'pointer-events-none absolute left-3 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full',
              selectedWeapon.damageType === 'ballistic'
                ? 'bg-cyan-300 ring-1 ring-cyan-300/35'
                : 'bg-amber-300 ring-1 ring-amber-300/35',
            ].join(' ')}
          />
        ) : null}

        <input
          ref={inputRef}
          type="text"
          role="combobox"
          value={query}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={
            open && flatWeapons[activeIndex]
              ? `${listboxId}-${getWeaponKey(flatWeapons[activeIndex])}`
              : undefined
          }
          onFocus={() => {
            setOpen(true)
            setActiveIndex(0)
          }}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
            setActiveIndex(0)
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search any weapon"
          className={`alpha-input pr-20 ${selectedWeapon ? 'pl-9' : ''}`}
        />

        {value ? (
          <button
            type="button"
            onClick={() => {
              selectWeapon(null)
              inputRef.current?.focus()
            }}
            className="absolute right-2 top-1/2 inline-flex min-h-8 -translate-y-1/2 items-center rounded-lg border border-white/10 bg-slate-900/70 px-3 text-[11px] uppercase tracking-[0.16em] text-slate-200 transition hover:border-white/20 hover:bg-slate-800/80 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
          >
            Clear
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="alpha-select-panel absolute left-0 right-0 z-20 mt-1">
          <ul
            id={listboxId}
            role="listbox"
            className="max-h-[32rem] overflow-y-auto p-3"
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
                      >
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
                                const isSelected = weaponKey === value

                                return (
                                  <button
                                    key={weaponKey}
                                    id={`${listboxId}-${weaponKey}`}
                                    type="button"
                                    role="option"
                                    aria-selected={isSelected}
                                    onMouseDown={(event) => event.preventDefault()}
                                    onMouseEnter={() => setActiveIndex(index)}
                                    onClick={() => selectWeapon(weapon)}
                                    className={[
                                      'alpha-weapon-select-card',
                                      isActive ? 'alpha-weapon-select-card-active' : '',
                                      isSelected ? selectedToneClassName[tone] : '',
                                    ]
                                      .filter(Boolean)
                                      .join(' ')}
                                  >
                                    <span className="alpha-weapon-select-name">
                                      {weapon.name}
                                    </span>
                                    <span className="alpha-weapon-select-meta">
                                      {formatWeaponClassLabel(weapon.weaponClass)}
                                    </span>
                                    <span className="alpha-weapon-select-submeta">
                                      {formatWeaponSizeLabel(weapon.size)}
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
                                        <dd>{formatMetric(weapon.projectileSpeed ?? 0)}</dd>
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
      ) : null}
    </div>
  )
}
