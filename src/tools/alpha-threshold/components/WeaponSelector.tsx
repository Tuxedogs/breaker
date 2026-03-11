import {
  useDeferredValue,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import { formatMetric, getWeaponKey } from '../lib/calculations'
import type { Weapon } from '../types'

type Props = {
  label: string
  value: string | null
  weapons: Weapon[]
  onChange: (weaponKey: string | null) => void
}

const SIZE_ORDER = ['S4', 'S3', 'S2', 'S1']

function getWeaponSubtypeLabel(weapon: Weapon) {
  const normalizedName = weapon.name.toLowerCase()

  if (normalizedName.includes('mass driver')) {
    return `${weapon.type === 'ballistic' ? 'Ballistic' : 'Energy'} Mass Driver`
  }

  if (normalizedName.includes('gatling')) {
    return `${weapon.type === 'ballistic' ? 'Ballistic' : 'Energy'} Gatling`
  }

  if (normalizedName.includes('cannon')) {
    return `${weapon.type === 'ballistic' ? 'Ballistic' : 'Laser'} Cannon`
  }

  if (normalizedName.includes('repeater')) {
    return `${weapon.type === 'ballistic' ? 'Ballistic' : 'Energy'} Repeater`
  }

  return weapon.type === 'ballistic' ? 'Ballistic Weapon' : 'Energy Weapon'
}

function getWeaponLabel(weapon: Weapon) {
  return `${weapon.name} (${weapon.size})`
}

function weaponMatchesQuery(weapon: Weapon, query: string) {
  const haystack = [
    weapon.name,
    weapon.size,
    weapon.type,
    String(weapon.alpha),
    String(weapon.burstDps),
    String(weapon.speed),
  ]
    .join(' ')
    .toLowerCase()

  return haystack.includes(query)
}

export function WeaponSelector({
  label,
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
  const [query, setQuery] = useState(
    selectedWeapon ? getWeaponLabel(selectedWeapon) : ''
  )
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const deferredQuery = useDeferredValue(query)

  const groupedWeapons = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase()
    const baseWeapons = normalizedQuery
      ? weapons.filter((weapon) => weaponMatchesQuery(weapon, normalizedQuery))
      : weapons

    const sortedWeapons = [...baseWeapons].sort((left, right) => {
      const sizeDelta =
        SIZE_ORDER.indexOf(left.size) - SIZE_ORDER.indexOf(right.size)

      if (sizeDelta !== 0) return sizeDelta

      const subtypeDelta = getWeaponSubtypeLabel(left).localeCompare(
        getWeaponSubtypeLabel(right)
      )

      if (subtypeDelta !== 0) return subtypeDelta

      return left.name.localeCompare(right.name)
    })

    const groups = new Map<string, Weapon[]>()

    sortedWeapons.forEach((weapon) => {
      const key = `${weapon.size} ${getWeaponSubtypeLabel(weapon)}`
      const currentGroup = groups.get(key) ?? []
      currentGroup.push(weapon)
      groups.set(key, currentGroup)
    })

    return Array.from(groups.entries()).map(([groupLabel, groupWeapons]) => ({
      groupLabel,
      weapons: groupWeapons,
    }))
  }, [deferredQuery, weapons])

  const flatWeapons = useMemo(
    () => groupedWeapons.flatMap((group) => group.weapons),
    [groupedWeapons]
  )

  function selectWeapon(weapon: Weapon | null) {
    onChange(weapon ? getWeaponKey(weapon) : null)
    setOpen(false)
    setQuery(weapon ? getWeaponLabel(weapon) : '')
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
      setQuery(selectedWeapon ? getWeaponLabel(selectedWeapon) : '')
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
    setQuery(selectedWeapon ? getWeaponLabel(selectedWeapon) : '')
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
              selectedWeapon.type === 'ballistic'
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
            className="max-h-72 overflow-y-auto py-2"
          >
            {flatWeapons.length > 0 ? (
              groupedWeapons.map((group) => (
                <li key={group.groupLabel}>
                  <div className="px-3 pb-2 pt-3 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                    {group.groupLabel}
                  </div>
                  <ul>
                    {group.weapons.map((weapon) => {
                      const weaponKey = getWeaponKey(weapon)
                      const index = flatWeapons.findIndex(
                        (candidate) => getWeaponKey(candidate) === weaponKey
                      )
                      const isActive = index === activeIndex
                      const isSelected = weaponKey === value

                      return (
                        <li key={weaponKey}>
                          <button
                            id={`${listboxId}-${weaponKey}`}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            onMouseDown={(event) => event.preventDefault()}
                            onMouseEnter={() => setActiveIndex(index)}
                            onClick={() => selectWeapon(weapon)}
                            className={[
                              'flex min-h-11 w-full flex-col items-start gap-1 border-l-2 border-transparent px-3 py-2 text-left transition',
                              isActive || isSelected
                                ? weapon.type === 'ballistic'
                                  ? 'border-cyan-300/45 bg-white/8 text-white'
                                  : 'border-amber-300/45 bg-white/8 text-white'
                                : 'text-slate-300 hover:bg-white/5 hover:text-white',
                            ].join(' ')}
                          >
                            <span className="text-sm font-semibold">
                              {weapon.name}
                            </span>
                            <span className="text-xs uppercase tracking-[0.14em] text-slate-400">
                              {getWeaponSubtypeLabel(weapon)} / alpha {formatMetric(weapon.alpha)} / burst{' '}
                              {formatMetric(weapon.burstDps)} / {formatMetric(weapon.speed)} m/s
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
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
