import { useEffect, useMemo, useRef, useState } from 'react'
import { formatEntityLabel } from '../lib/calculations'
import type { Ship } from '../types'

type Props = {
  ships: Ship[]
  selectedShipName: string | null
  onChange: (shipName: string | null) => void
  placeholder?: string
}

function matchesQuery(ship: Ship, query: string): boolean {
  if (!query) return true
  const normalized = query.trim().toLowerCase()
  const haystack = `${ship.manufacturer} ${ship.name}`.toLowerCase()
  return haystack.includes(normalized)
}

export function ShipCascadeDropdown({
  ships,
  selectedShipName,
  onChange,
  placeholder = 'Select Ship',
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [expandedManufacturers, setExpandedManufacturers] = useState<string[]>([])
  const rootRef = useRef<HTMLDivElement | null>(null)

  const selectedShip = useMemo(
    () =>
      selectedShipName
        ? ships.find((ship) => ship.name === selectedShipName) ?? null
        : null,
    [selectedShipName, ships]
  )

  const filteredShips = useMemo(
    () => ships.filter((ship) => matchesQuery(ship, query)),
    [query, ships]
  )

  const manufacturerGroups = useMemo(() => {
    const byManufacturer = new Map<string, Ship[]>()

    filteredShips.forEach((ship) => {
      const current = byManufacturer.get(ship.manufacturer)
      if (current) {
        current.push(ship)
        return
      }
      byManufacturer.set(ship.manufacturer, [ship])
    })

    return Array.from(byManufacturer.entries())
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([manufacturer, groupedShips]) => ({
        manufacturer,
        ships: [...groupedShips].sort((left, right) => left.name.localeCompare(right.name)),
      }))
  }, [filteredShips])

  useEffect(() => {
    if (!open) return

    const onWindowMouseDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    const onWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
      }
    }

    window.addEventListener('mousedown', onWindowMouseDown)
    window.addEventListener('keydown', onWindowKeyDown)

    return () => {
      window.removeEventListener('mousedown', onWindowMouseDown)
      window.removeEventListener('keydown', onWindowKeyDown)
    }
  }, [open])

  const visibleExpandedManufacturers = useMemo(() => {
    const availableManufacturers = new Set(
      manufacturerGroups.map((group) => group.manufacturer)
    )
    if (query.trim()) {
      return availableManufacturers
    }
    return new Set(
      expandedManufacturers.filter((manufacturer) =>
        availableManufacturers.has(manufacturer)
      )
    )
  }, [expandedManufacturers, manufacturerGroups, query])

  function toggleManufacturer(manufacturer: string) {
    setExpandedManufacturers((prev) => {
      if (prev.includes(manufacturer)) {
        return prev.filter((entry) => entry !== manufacturer)
      }
      return [...prev, manufacturer]
    })
  }

  const hasMatches = useMemo(
    () => manufacturerGroups.some((group) => group.ships.length > 0),
    [manufacturerGroups]
  )

  return (
    <div ref={rootRef} className="alpha-ship-cascade">
      <button
        type="button"
        className="alpha-input alpha-ship-cascade-trigger"
        onClick={() => setOpen((prev) => !prev)}
      >
        {selectedShip ? (
          <span className="alpha-ship-cascade-selected">
            <span className="alpha-ship-cascade-selected-make">
              <span className="alpha-ship-cascade-logo" aria-hidden="true">
                <svg viewBox="0 0 16 16" className="alpha-ship-cascade-logo-icon">
                  <circle cx="8" cy="8" r="6" fill="currentColor" />
                </svg>
              </span>
              {formatEntityLabel(selectedShip.manufacturer)}
            </span>
            <span>{formatEntityLabel(selectedShip.name)}</span>
          </span>
        ) : (
          <span>{placeholder}</span>
        )}
      </button>

      {open ? (
        <section className="alpha-ship-cascade-menu" role="listbox" aria-label="Ship selector">
          <label className="alpha-ship-cascade-search">
            <span className="alpha-control-label">Search</span>
            <input
              className="alpha-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Type manufacturer or ship..."
            />
          </label>

          <ul className="alpha-ship-cascade-groups">
            {hasMatches ? (
              manufacturerGroups.map((group) => {
                const isExpanded = visibleExpandedManufacturers.has(group.manufacturer)
                return (
                  <li key={group.manufacturer} className="alpha-ship-cascade-group">
                    <button
                      type="button"
                      className={[
                        'alpha-ship-cascade-make',
                        isExpanded ? 'alpha-ship-cascade-make-active' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      aria-expanded={isExpanded}
                      onClick={() => toggleManufacturer(group.manufacturer)}
                    >
                      <span className="alpha-ship-cascade-logo" aria-hidden="true">
                        <svg viewBox="0 0 16 16" className="alpha-ship-cascade-logo-icon">
                          <circle cx="8" cy="8" r="6" fill="currentColor" />
                        </svg>
                      </span>
                      <span className="alpha-ship-cascade-make-label">
                        {formatEntityLabel(group.manufacturer)}
                      </span>
                      <span className="alpha-ship-cascade-make-chevron" aria-hidden="true">
                        {isExpanded ? '▾' : '▸'}
                      </span>
                    </button>

                    {isExpanded ? (
                      <ul className="alpha-ship-cascade-ships">
                        {group.ships.map((ship) => (
                          <li key={`${ship.manufacturer}:${ship.name}`}>
                            <button
                              type="button"
                              className="alpha-ship-cascade-ship"
                              onClick={() => {
                                onChange(ship.name)
                                setOpen(false)
                              }}
                            >
                              {formatEntityLabel(ship.name)}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                )
              })
            ) : (
              <li className="alpha-ship-cascade-ships alpha-ship-cascade-ships-empty">
                <p className="text-sm text-slate-500">No ships match.</p>
              </li>
            )}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
