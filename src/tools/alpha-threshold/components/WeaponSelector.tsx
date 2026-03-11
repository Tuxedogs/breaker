import {
  useDeferredValue,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import { formatMetric, getWeaponKey } from '../lib/calculations'
import type { SlotTone, Weapon } from '../types'

type Props = {
  label: string
  tone: SlotTone
  value: string | null
  weapons: Weapon[]
  onChange: (weaponName: string | null) => void
}

const toneDotClassName: Record<SlotTone, string> = {
  cyan: 'bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.45)]',
  violet: 'bg-violet-300 shadow-[0_0_12px_rgba(196,181,253,0.45)]',
  amber: 'bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.45)]',
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
  tone,
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
  const [query, setQuery] = useState(selectedWeapon ? getWeaponLabel(selectedWeapon) : '')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const deferredQuery = useDeferredValue(query)

  const filteredWeapons = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase()
    const baseWeapons = normalizedQuery
      ? weapons.filter((weapon) => weaponMatchesQuery(weapon, normalizedQuery))
      : weapons

    return baseWeapons.slice(0, 12)
  }, [deferredQuery, weapons])

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
        filteredWeapons.length === 0
          ? 0
          : (prev + 1) % filteredWeapons.length
      )
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((prev) =>
        filteredWeapons.length === 0
          ? 0
          : (prev - 1 + filteredWeapons.length) % filteredWeapons.length
      )
      return
    }

    if (event.key === 'Enter' && open && filteredWeapons[activeIndex]) {
      event.preventDefault()
      selectWeapon(filteredWeapons[activeIndex])
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
      <label className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
        {label}
      </label>

      <div className="relative">
        <span
          aria-hidden
          className={[
            'pointer-events-none absolute left-3 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full',
            toneDotClassName[tone],
          ].join(' ')}
        />

        <input
          ref={inputRef}
          type="text"
          role="combobox"
          value={query}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={
            open && filteredWeapons[activeIndex]
              ? `${listboxId}-${getWeaponKey(filteredWeapons[activeIndex])}`
              : undefined
          }
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
            setActiveIndex(0)
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search weapons"
          className="alpha-input pl-9 pr-20"
        />

        {value ? (
          <button
            type="button"
            onClick={() => {
              selectWeapon(null)
              inputRef.current?.focus()
            }}
            className="absolute right-2 top-1/2 inline-flex min-h-9 -translate-y-1/2 items-center rounded-lg px-3 text-xs uppercase tracking-[0.16em] text-slate-300 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
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
            {filteredWeapons.length > 0 ? (
              filteredWeapons.map((weapon, index) => {
                const weaponKey = getWeaponKey(weapon)
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
                        'flex min-h-11 w-full flex-col items-start gap-1 px-3 py-2 text-left transition',
                        isActive || isSelected
                          ? 'bg-white/8 text-white'
                          : 'text-slate-300 hover:bg-white/5 hover:text-white',
                      ].join(' ')}
                    >
                      <span className="text-sm font-semibold">
                        {weapon.name}
                      </span>
                      <span className="text-xs uppercase tracking-[0.14em] text-slate-400">
                        {weapon.size} · Alpha {formatMetric(weapon.alpha)} · Burst{' '}
                        {formatMetric(weapon.burstDps)} · {formatMetric(weapon.speed)}{' '}
                        m/s
                      </span>
                    </button>
                  </li>
                )
              })
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
