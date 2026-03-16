import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { formatEntityLabel } from '../lib/calculations'
import type { Ship } from '../types'

type Props = {
  ships: Ship[]
  onChange: (shipName: string | null) => void
  open: boolean
  menuPosition: { x: number; y: number } | null
  onOpenChange: (open: boolean) => void
  ariaLabel: string
}

function getShipSelectionKey(ship: Pick<Ship, 'manufacturer' | 'name'>): string {
  return `${ship.manufacturer}::${ship.name}`
}

function matchesQuery(ship: Ship, query: string): boolean {
  if (!query) return true
  const normalized = query.trim().toLowerCase()
  const haystack = `${ship.manufacturer} ${ship.name}`.toLowerCase()
  return haystack.includes(normalized)
}

function dedupeShips(ships: Ship[]): Ship[] {
  const seen = new Set<string>()

  return ships.filter((ship) => {
    const key = `${ship.manufacturer}::${ship.name}`.toLowerCase()
    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

export function ShipCascadeDropdown({
  ships,
  onChange,
  open,
  menuPosition,
  onOpenChange,
  ariaLabel,
}: Props) {
  const [activeManufacturer, setActiveManufacturer] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [flyoutStyle, setFlyoutStyle] = useState<{ top?: number; bottom?: number; maxHeight?: number }>({})
  const rootRef = useRef<HTMLDivElement | null>(null)
  const panelsRef = useRef<HTMLDivElement | null>(null)
  const shipsFlyoutRef = useRef<HTMLUListElement | null>(null)
  const manufacturerButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  const uniqueShips = useMemo(() => dedupeShips(ships), [ships])

  const filteredShips = useMemo(() => uniqueShips.filter((ship) => matchesQuery(ship, '')), [uniqueShips])

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

  const hasMatches = manufacturerGroups.length > 0

  const resolvedActiveManufacturer = useMemo(() => {
    if (activeManufacturer && manufacturerGroups.some((group) => group.manufacturer === activeManufacturer)) {
      return activeManufacturer
    }

    return manufacturerGroups[0]?.manufacturer ?? null
  }, [activeManufacturer, manufacturerGroups])

  const activeManufacturerGroup = useMemo(
    () =>
      resolvedActiveManufacturer
        ? manufacturerGroups.find((group) => group.manufacturer === resolvedActiveManufacturer) ?? null
        : null,
    [manufacturerGroups, resolvedActiveManufacturer]
  )

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)')
    const updateViewportMode = () => setIsMobile(mediaQuery.matches)

    updateViewportMode()
    mediaQuery.addEventListener('change', updateViewportMode)

    return () => {
      mediaQuery.removeEventListener('change', updateViewportMode)
    }
  }, [])

  useEffect(() => {
    if (!open) return

    const onWindowMouseDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        onOpenChange(false)
      }
    }

    const onWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onOpenChange(false)
      }
    }

    window.addEventListener('mousedown', onWindowMouseDown)
    window.addEventListener('keydown', onWindowKeyDown)

    return () => {
      window.removeEventListener('mousedown', onWindowMouseDown)
      window.removeEventListener('keydown', onWindowKeyDown)
    }
  }, [onOpenChange, open])

  useLayoutEffect(() => {
    if (isMobile || !open || !panelsRef.current || !shipsFlyoutRef.current || !resolvedActiveManufacturer) return

    const activeButton = manufacturerButtonRefs.current[resolvedActiveManufacturer]
    if (!activeButton) return

    const panelsRect = panelsRef.current.getBoundingClientRect()
    const buttonRect = activeButton.getBoundingClientRect()
    const flyoutRect = shipsFlyoutRef.current.getBoundingClientRect()
    const viewportPadding = 12
    const availableBelow = window.innerHeight - buttonRect.top - viewportPadding
    const availableAbove = buttonRect.bottom - viewportPadding
    const naturalHeight = flyoutRect.height
    const alignTop = buttonRect.top - panelsRect.top
    const alignBottom = panelsRect.bottom - buttonRect.bottom

    if (naturalHeight <= availableBelow) {
      setFlyoutStyle({
        top: alignTop,
        bottom: undefined,
        maxHeight: undefined,
      })
      return
    }

    const preferredMaxHeight = Math.max(Math.max(availableAbove, availableBelow), 160)

    if (availableAbove > availableBelow) {
      setFlyoutStyle({
        top: undefined,
        bottom: alignBottom,
        maxHeight: preferredMaxHeight,
      })
      return
    }

    setFlyoutStyle({
      top: alignTop,
      bottom: undefined,
      maxHeight: preferredMaxHeight,
    })
  }, [isMobile, manufacturerGroups, open, resolvedActiveManufacturer])

  useLayoutEffect(() => {
    if (!open || !shipsFlyoutRef.current) return

    const flyout = shipsFlyoutRef.current
    flyout.scrollTop = 0
    flyout.scrollLeft = 0
  }, [activeManufacturerGroup, flyoutStyle, open])

  return (
    <div ref={rootRef} className="alpha-ship-cascade alpha-ship-cascade-card-root">
      {open ? (
        <section
          className="alpha-ship-cascade-menu"
          role="listbox"
          aria-label={ariaLabel}
          style={
            !isMobile && menuPosition
              ? {
                  left: menuPosition.x,
                  top: menuPosition.y,
                }
              : undefined
          }
        >
          {hasMatches ? (
            <div ref={panelsRef} className="alpha-ship-cascade-panels">
              <ul className="alpha-ship-cascade-groups">
                {manufacturerGroups.map((group) => {
                  const isActive = resolvedActiveManufacturer === group.manufacturer

                  return (
                    <li key={group.manufacturer} className="alpha-ship-cascade-group">
                      <button
                        ref={(element) => {
                          manufacturerButtonRefs.current[group.manufacturer] = element
                        }}
                        type="button"
                        className={[
                          'alpha-ship-cascade-make',
                          isActive ? 'alpha-ship-cascade-make-active' : '',
                        ].filter(Boolean).join(' ')}
                        aria-current={isActive ? 'true' : undefined}
                        onMouseEnter={() => setActiveManufacturer(group.manufacturer)}
                        onFocus={() => setActiveManufacturer(group.manufacturer)}
                        onClick={() => setActiveManufacturer(group.manufacturer)}
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
                          {'>'}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>

              <ul
                key={resolvedActiveManufacturer ?? 'ships-flyout'}
                ref={shipsFlyoutRef}
                className="alpha-ship-cascade-ships alpha-ship-cascade-ships-flyout"
                style={isMobile ? undefined : flyoutStyle}
              >
                {activeManufacturerGroup?.ships.map((ship) => (
                  <li key={`${ship.manufacturer}:${ship.name}`}>
                    <button
                      type="button"
                      className="alpha-ship-cascade-ship"
                      onClick={() => {
                        onChange(getShipSelectionKey(ship))
                        onOpenChange(false)
                      }}
                    >
                      {formatEntityLabel(ship.name)}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="alpha-ship-cascade-ships alpha-ship-cascade-ships-empty">
              <p className="text-sm text-slate-500">No ships match.</p>
            </div>
          )}
        </section>
      ) : null}
    </div>
  )
}
