import { Fragment, useRef, useState, useLayoutEffect, useCallback, useEffect } from 'react'
import type { CSSProperties } from 'react'
import type { GunneryState } from '../../hooks/useGunneryState'
import {
  ZONE_CATEGORY_GROUP_META,
  ZONE_CATEGORY_GROUP_ORDER,
  ZONE_CATEGORY_META,
  ZONE_CATEGORY_ORDER,
} from '../../data/subtarget-ships/componentMeta'
import type { ZoneCategory, ZoneCategoryGroup } from '../../data/subtarget-ships/types'
import { getIntelImage } from '../../lib/getIntelImage'

type Props = Pick<GunneryState,
  | 'ships' | 'selectedShipId' | 'selectedShip'
  | 'activeView' | 'setActiveView'
  | 'activeZoneId' | 'setActiveZoneId'
  | 'activeZone' | 'selectShip'
>

type Dot = { x: number; y: number }
type ConnectionState = {
  svgW: number
  svgH: number
  paths: string[]
  dots: Dot[]
  zoneType: string
}
type PctPoint = { x: number; y: number }
type DrawnBox = { x: number; y: number; w: number; h: number; wPx: number; hPx: number }
type OverlayBounds = {
  left: number
  top: number
  width: number
  height: number
}

type VisibilityByCategory = Record<ZoneCategory, boolean>
type ExpandedGroups = Record<ZoneCategoryGroup, boolean>
type LegendState = {
  shipId: string | null
  visibleCategories: VisibilityByCategory
  expandedGroups: ExpandedGroups
}

function formatNormalizedPosition(percent: number): string {
  return (Math.round(percent * 10) / 1000).toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
}

function buildDefaultCategoryVisibility(): VisibilityByCategory {
  return Object.fromEntries(
    ZONE_CATEGORY_ORDER.map((category) => [
      category,
      ZONE_CATEGORY_GROUP_META[ZONE_CATEGORY_META[category].group].defaultChecked,
    ])
  ) as VisibilityByCategory
}

function buildDefaultExpandedGroups(): ExpandedGroups {
  return Object.fromEntries(
    ZONE_CATEGORY_GROUP_ORDER.map((group) => [group, ZONE_CATEGORY_GROUP_META[group].defaultExpanded])
  ) as ExpandedGroups
}

export function SubTargetSection({
  ships, selectedShipId, selectedShip,
  activeView, setActiveView,
  activeZoneId, setActiveZoneId,
  activeZone, selectShip,
}: Props) {
  const subtargetRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const resultRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const zoneRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const shipBtnRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const hullPromptRef = useRef<HTMLDivElement>(null)

  const [debugMode, setDebugMode] = useState(false)
  const [connection, setConnection] = useState<ConnectionState | null>(null)
  const [overlayBounds, setOverlayBounds] = useState<OverlayBounds | null>(null)
  const [layoutVersion, setLayoutVersion] = useState(0)
  const [dragStart, setDragStart] = useState<PctPoint | null>(null)
  const [dragCurrent, setDragCurrent] = useState<PctPoint | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [drawnBox, setDrawnBox] = useState<DrawnBox | null>(null)
  const [hoverCoords, setHoverCoords] = useState<PctPoint | null>(null)
  const [hullPromptLine, setHullPromptLine] = useState<{ path: string; svgW: number; svgH: number } | null>(null)

  const [legendState, setLegendState] = useState<LegendState>(() => ({
    shipId: selectedShipId,
    visibleCategories: buildDefaultCategoryVisibility(),
    expandedGroups: buildDefaultExpandedGroups(),
  }))
  const visibleCategories = legendState.shipId === selectedShipId
    ? legendState.visibleCategories
    : buildDefaultCategoryVisibility()
  const expandedGroups = legendState.shipId === selectedShipId
    ? legendState.expandedGroups
    : buildDefaultExpandedGroups()

  const shipCategories = ZONE_CATEGORY_ORDER.filter((category) =>
    selectedShip?.zones.some((zone) => zone.category === category)
  )
  const groupCategories = Object.fromEntries(
    ZONE_CATEGORY_GROUP_ORDER.map((group) => [
      group,
      shipCategories.filter((category) => ZONE_CATEGORY_META[category].group === group),
    ])
  ) as Record<ZoneCategoryGroup, ZoneCategory[]>
  const visibleZones = (selectedShip?.zonesByView[activeView] ?? [])
    .filter((zone) => visibleCategories[zone.category])
  const activeViewLabel = selectedShip?.viewTabs.find(view => view.id === activeView)?.label ?? activeView
  const activeGroupZones = activeZone
    ? visibleZones.filter(zone => activeZone.groupId ? zone.groupId === activeZone.groupId : zone.id === activeZone.id)
    : []
  const liveRect = (isDragging && dragStart && dragCurrent)
    ? {
        x: Math.min(dragStart.x, dragCurrent.x),
        y: Math.min(dragStart.y, dragCurrent.y),
        w: Math.abs(dragStart.x - dragCurrent.x),
        h: Math.abs(dragStart.y - dragCurrent.y),
      }
    : null

  const recomputeOverlayBounds = useCallback(() => {
    const canvas = canvasRef.current
    const image = imageRef.current
    if (!canvas || !image) {
      setOverlayBounds(null)
      return
    }

    const canvasRect = canvas.getBoundingClientRect()
    const imageRect = image.getBoundingClientRect()

    if (imageRect.width <= 0 || imageRect.height <= 0) {
      setOverlayBounds(null)
      return
    }

    setOverlayBounds({
      left: imageRect.left - canvasRect.left,
      top: imageRect.top - canvasRect.top,
      width: imageRect.width,
      height: imageRect.height,
    })
  }, [])

  const getPct = useCallback((clientX: number, clientY: number): PctPoint | null => {
    const bounds = overlayBounds
    const canvas = canvasRef.current
    if (!bounds || !canvas) return null

    const canvasRect = canvas.getBoundingClientRect()
    const imageLeft = canvasRect.left + bounds.left
    const imageTop = canvasRect.top + bounds.top

    const localX = clientX - imageLeft
    const localY = clientY - imageTop
    const x = Math.max(0, Math.min(bounds.width, localX))
    const y = Math.max(0, Math.min(bounds.height, localY))

    return {
      x: Math.round((x / bounds.width) * 1000) / 10,
      y: Math.round((y / bounds.height) * 1000) / 10,
    }
  }, [overlayBounds])

  const computeBox = useCallback((a: PctPoint, b: PctPoint): DrawnBox | null => {
    const bounds = overlayBounds
    if (!bounds) return null

    const tlX = Math.min(a.x, b.x)
    const tlY = Math.min(a.y, b.y)
    const w = Math.abs(a.x - b.x)
    const h = Math.abs(a.y - b.y)

    return {
      x: Math.round((tlX + w / 2) * 10) / 10,
      y: Math.round((tlY + h / 2) * 10) / 10,
      w: Math.round(w * 10) / 10,
      h: Math.round(h * 10) / 10,
      wPx: Math.round((w / 100) * bounds.width),
      hPx: Math.round((h / 100) * bounds.height),
    }
  }, [overlayBounds])

  const handleDebugMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!debugMode) return
    event.preventDefault()
    const point = getPct(event.clientX, event.clientY)
    if (!point) return
    setDragStart(point)
    setDragCurrent(point)
    setIsDragging(true)
    setDrawnBox(null)
  }, [debugMode, getPct])

  const handleDebugMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const point = getPct(event.clientX, event.clientY)
    if (!point) return
    setHoverCoords(point)
    if (isDragging && dragStart) {
      setDragCurrent(point)
    }
  }, [dragStart, getPct, isDragging])

  const handleDebugMouseUp = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !dragStart) return
    const point = getPct(event.clientX, event.clientY)
    if (point) {
      setDrawnBox(computeBox(dragStart, point))
    }
    setIsDragging(false)
    setDragStart(null)
    setDragCurrent(null)
  }, [computeBox, dragStart, getPct, isDragging])

  const handleDebugMouseLeave = useCallback(() => {
    setHoverCoords(null)
    if (isDragging) {
      setIsDragging(false)
      setDragStart(null)
      setDragCurrent(null)
    }
  }, [isDragging])

  const toggleDebug = useCallback(() => {
    setDebugMode((current) => !current)
    setDragStart(null)
    setDragCurrent(null)
    setIsDragging(false)
    setDrawnBox(null)
    setHoverCoords(null)
  }, [])

  const toggleCategoryVisibility = useCallback((category: ZoneCategory) => {
    setLegendState((current) => {
      const currentVisibility = current.shipId === selectedShipId
        ? current.visibleCategories
        : buildDefaultCategoryVisibility()

      return {
        shipId: selectedShipId,
        visibleCategories: {
          ...currentVisibility,
          [category]: !currentVisibility[category],
        },
        expandedGroups: current.shipId === selectedShipId
          ? current.expandedGroups
          : buildDefaultExpandedGroups(),
      }
    })
  }, [selectedShipId])

  const toggleGroupVisibility = useCallback((group: ZoneCategoryGroup) => {
    const categories = groupCategories[group]
    if (categories.length === 0) return

    const nextValue = !categories.every((category) => visibleCategories[category])

    setLegendState((current) => {
      const currentVisibility = current.shipId === selectedShipId
        ? current.visibleCategories
        : buildDefaultCategoryVisibility()
      const next = { ...currentVisibility }
      for (const category of categories) {
        next[category] = nextValue
      }
      return {
        shipId: selectedShipId,
        visibleCategories: next,
        expandedGroups: current.shipId === selectedShipId
          ? current.expandedGroups
          : buildDefaultExpandedGroups(),
      }
    })
  }, [groupCategories, selectedShipId, visibleCategories])

  const toggleGroupExpanded = useCallback((group: ZoneCategoryGroup) => {
    if (!ZONE_CATEGORY_GROUP_META[group].collapsible) return
    setLegendState((current) => {
      const currentExpanded = current.shipId === selectedShipId
        ? current.expandedGroups
        : buildDefaultExpandedGroups()

      return {
        shipId: selectedShipId,
        visibleCategories: current.shipId === selectedShipId
          ? current.visibleCategories
          : buildDefaultCategoryVisibility(),
        expandedGroups: {
          ...currentExpanded,
          [group]: !currentExpanded[group],
        },
      }
    })
  }, [selectedShipId])

  useEffect(() => {
    if (activeZone && !visibleCategories[activeZone.category]) {
      setActiveZoneId(null)
    }
  }, [activeZone, setActiveZoneId, visibleCategories])

  useLayoutEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      recomputeOverlayBounds()
    })

    return () => window.cancelAnimationFrame(frame)
  }, [recomputeOverlayBounds, activeView, selectedShipId, layoutVersion])

  useEffect(() => {
    const body = bodyRef.current
    const canvas = canvasRef.current
    const result = resultRef.current
    const image = imageRef.current
    if (!body || !canvas || !result || !image) return

    let frame = 0
    const schedule = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        recomputeOverlayBounds()
        setLayoutVersion(version => version + 1)
      })
    }

    const observer = new ResizeObserver(schedule)
    observer.observe(body)
    observer.observe(canvas)
    observer.observe(result)
    observer.observe(image)
    window.addEventListener('resize', schedule)

    schedule()

    return () => {
      window.cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('resize', schedule)
    }
  }, [recomputeOverlayBounds, activeView, selectedShipId])

  useLayoutEffect(() => {
    let frame = 0

    if (!activeZone || !bodyRef.current || !resultRef.current) {
      frame = window.requestAnimationFrame(() => setConnection(null))
      return () => window.cancelAnimationFrame(frame)
    }

    const bodyRect = bodyRef.current.getBoundingClientRect()
    const resultRect = resultRef.current.getBoundingClientRect()

    const groupId = activeZone.groupId
    const groupZones = selectedShip?.zones.filter(zone =>
      groupId
        ? zone.groupId === groupId && zone.positions[activeView]
        : zone.id === activeZone.id && zone.positions[activeView]
    ) ?? []

    const zoneCenters = groupZones
      .map(zone => {
        const el = zoneRefs.current.get(zone.id)
        if (!el) return null
        const rect = el.getBoundingClientRect()
        return {
          id: zone.id,
          x: rect.left + rect.width / 2 - bodyRect.left,
          y: rect.top + rect.height / 2 - bodyRect.top,
        }
      })
      .filter((c): c is { id: string; x: number; y: number } => c !== null)
      .sort((a, b) => a.x - b.x)

    if (zoneCenters.length === 0) {
      frame = window.requestAnimationFrame(() => setConnection(null))
      return () => window.cancelAnimationFrame(frame)
    }

    const arcHeight = 20
    const paths: string[] = []
    const dots: Dot[] = zoneCenters.map(c => ({ x: c.x, y: c.y }))

    for (let i = 0; i < zoneCenters.length - 1; i++) {
      const a = zoneCenters[i]
      const b = zoneCenters[i + 1]
      const mid = (a.x + b.x) / 2
      const cy = Math.min(a.y, b.y) - arcHeight
      paths.push(`M ${a.x} ${a.y} Q ${mid} ${cy} ${b.x} ${b.y}`)
    }

    const last = zoneCenters[zoneCenters.length - 1]
    const rx = resultRect.left - bodyRect.left
    const ry = 100
    const mx = (last.x + rx) / 2
    paths.push(`M ${last.x} ${last.y} C ${mx} ${last.y} ${mx} ${ry} ${rx} ${ry}`)
    dots.push({ x: rx, y: ry })

    frame = window.requestAnimationFrame(() => {
      setConnection({
        svgW: bodyRect.width,
        svgH: bodyRect.height,
        paths,
        dots,
        zoneType: activeZone.type,
      })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [activeZoneId, activeView, selectedShipId, layoutVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleImageLoad = useCallback(() => {
    recomputeOverlayBounds()
    setLayoutVersion(version => version + 1)
  }, [recomputeOverlayBounds])

  function setZoneRef(id: string, el: HTMLButtonElement | null) {
    if (el) zoneRefs.current.set(id, el)
    else zoneRefs.current.delete(id)
  }

  function setShipBtnRef(id: string, el: HTMLButtonElement | null) {
    if (el) shipBtnRefs.current.set(id, el)
    else shipBtnRefs.current.delete(id)
  }

  useLayoutEffect(() => {
    if (selectedShipId) {
      setHullPromptLine(null)
      return
    }

    let frame = 0
    frame = window.requestAnimationFrame(() => {
      const container = subtargetRef.current
      const prompt = hullPromptRef.current
      if (!container || !prompt || ships.length < 2) {
        setHullPromptLine(null)
        return
      }

      const perseusBtn = shipBtnRefs.current.get(ships[0].id)
      const idrisBtn = shipBtnRefs.current.get(ships[1].id)
      if (!perseusBtn || !idrisBtn) {
        setHullPromptLine(null)
        return
      }

      const containerRect = container.getBoundingClientRect()
      const promptRect = prompt.getBoundingClientRect()
      const perseusRect = perseusBtn.getBoundingClientRect()
      const idrisRect = idrisBtn.getBoundingClientRect()

      const startX = promptRect.left + promptRect.width / 2 - containerRect.left
      const startY = promptRect.top - containerRect.top

      const shipBottomY = Math.max(perseusRect.bottom, idrisRect.bottom) - containerRect.top
      const totalDist = startY - shipBottomY
      const turnY = startY - totalDist * 0.7

      const midX = (perseusRect.right + idrisRect.left) / 2 - containerRect.left

      setHullPromptLine({
        path: `M ${startX} ${startY} L ${startX} ${turnY} L ${midX} ${turnY} L ${midX} ${shipBottomY}`,
        svgW: containerRect.width,
        svgH: containerRect.height,
      })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [selectedShipId, layoutVersion, ships])

  return (
    <div ref={subtargetRef} className="gun-subtarget">

      {/* ── Hull prompt connector SVG ───────────────── */}
      {!selectedShipId && hullPromptLine && (
        <svg
          width={hullPromptLine.svgW}
          height={hullPromptLine.svgH}
          className="gun-hull-prompt-svg"
        >
          <path d={hullPromptLine.path} className="gun-hull-prompt-path-underlay" fill="none" />
          <path d={hullPromptLine.path} className="gun-hull-prompt-path" fill="none" />
        </svg>
      )}

      {/* ── Header ─────────────────────────────────── */}
      <div className="gun-subtarget-head">
        <div className="gun-ship-picker">
          {ships.map(ship => (
            <button
              key={ship.id}
              ref={el => setShipBtnRef(ship.id, el)}
              className={`gun-ship-btn${selectedShipId === ship.id ? ' is-active' : ''}`}
              aria-pressed={selectedShipId === ship.id}
              onClick={() => selectShip(selectedShipId === ship.id ? null : ship.id)}
            >
              {ship.label}
            </button>
          ))}
        </div>

      </div>

      {selectedShip && (
        <div className="gun-toolbar-row">
          <div className="gun-view-selector">
            {selectedShip.viewTabs.map(view => (
              <button
                key={`toolbar-${view.id}`}
                className={`gun-view-btn${activeView === view.id ? ' is-active' : ''}`}
                aria-pressed={activeView === view.id}
                onClick={() => { setActiveView(view.id); setActiveZoneId(null) }}
              >
                {view.label}
              </button>
            ))}
          </div>

          <button
            className={`gun-view-btn${debugMode ? ' is-active' : ''}`}
            onClick={toggleDebug}
            title="Toggle zone calibration tool"
          >
            {debugMode ? 'Debug ON' : 'Debug'}
          </button>
        </div>
      )}

      {/* ── Body ───────────────────────────────────── */}
      <div ref={bodyRef} className="gun-trainer">

        {/* SVG connection overlay */}
        {!debugMode && connection && (
          <svg
            width={connection.svgW}
            height={connection.svgH}
            className="gun-connection-svg"
            data-zone-type={connection.zoneType}
          >
            {connection.paths.map((path, i) => (
              <Fragment key={i}>
                <path
                  d={path}
                  className="gun-connection-path-underlay"
                  fill="none"
                />
                <path
                  d={path}
                  className="gun-connection-path-main"
                  fill="none"
                />
              </Fragment>
            ))}
            {connection.dots.map((dot, i) => (
              <Fragment key={i}>
                <circle cx={dot.x} cy={dot.y} r="4" className="gun-connection-dot-underlay" />
                <circle cx={dot.x} cy={dot.y} r="2.5" className="gun-connection-dot-main" />
              </Fragment>
            ))}
          </svg>
        )}

        {/* Canvas */}
        <div ref={canvasRef} className="gun-canvas-area">
          {selectedShip ? (
            <div className="gun-silhouette-shell">
              <img
                key={`${selectedShip.id}-${activeView}`}
                ref={imageRef}
                src={selectedShip.viewAssets[activeView]}
                alt={`${selectedShip.label} ${activeView}`}
                className="gun-silhouette-img"
                draggable={false}
                onLoad={handleImageLoad}
              />
            </div>
          ) : (
            <div className="gun-canvas-empty">
              <div ref={hullPromptRef} className="gun-hull-prompt">
                Select a hull to begin
              </div>
            </div>
          )}

          {selectedShip && overlayBounds && (
            <div
              className="gun-overlay-layer"
              style={{
                left: `${overlayBounds.left}px`,
                top: `${overlayBounds.top}px`,
                width: `${overlayBounds.width}px`,
                height: `${overlayBounds.height}px`,
              }}
            >
              {!debugMode && shipCategories.length > 0 && (
                <div className="gun-zone-legend" aria-label="Zone visibility filters">
                  {ZONE_CATEGORY_GROUP_ORDER.map((group) => {
                    const categories = groupCategories[group]
                    if (categories.length === 0) return null

                    const groupMeta = ZONE_CATEGORY_GROUP_META[group]
                    const allChecked = categories.every((category) => visibleCategories[category])
                    const someChecked = categories.some((category) => visibleCategories[category])
                    const showChildren = groupMeta.collapsible && expandedGroups[group]

                    return (
                      <section key={group} className="gun-zone-legend-group">
                        <div className="gun-zone-legend-head">
                          <label className="gun-zone-legend-toggle">
                            <input
                              type="checkbox"
                              className="gun-zone-legend-checkbox"
                              checked={allChecked}
                              ref={(element) => {
                                if (element) {
                                  element.indeterminate = someChecked && !allChecked
                                }
                              }}
                              onChange={() => toggleGroupVisibility(group)}
                            />
                            <span>{groupMeta.label}</span>
                          </label>

                          {groupMeta.collapsible ? (
                            <button
                              type="button"
                              className="gun-zone-legend-collapse"
                              aria-expanded={expandedGroups[group]}
                              onClick={() => toggleGroupExpanded(group)}
                            >
                              <span aria-hidden="true">{expandedGroups[group] ? '⌄' : '›'}</span>
                            </button>
                          ) : null}
                        </div>

                        {showChildren ? (
                          <div className="gun-zone-legend-items">
                            {categories.map((category) => (
                              <label key={category} className="gun-zone-legend-item">
                                <input
                                  type="checkbox"
                                  className="gun-zone-legend-checkbox"
                                  checked={visibleCategories[category]}
                                  onChange={() => toggleCategoryVisibility(category)}
                                />
                                <span
                                  className="gun-zone-legend-swatch"
                                  style={{ '--legend-color': ZONE_CATEGORY_META[category].color } as CSSProperties}
                                  aria-hidden="true"
                                />
                                <span>{ZONE_CATEGORY_META[category].label}</span>
                              </label>
                            ))}
                          </div>
                        ) : null}
                      </section>
                    )
                  })}
                </div>
              )}

              {!debugMode && visibleZones.map(zone => {
                const pos = zone.positions[activeView]!
                const isGroupActive = activeZone?.groupId
                  ? zone.groupId === activeZone.groupId
                  : zone.id === activeZoneId
                const ZoneIcon = zone.Icon

                return (
                  <button
                    key={zone.id}
                    ref={el => setZoneRef(zone.id, el)}
                    className="gun-zone"
                    data-priority={zone.priority}
                    data-state={isGroupActive ? 'selected' : activeZone ? 'inactive' : 'ready'}
                    style={{
                      left: `${pos.x * 100}%`,
                      top: `${pos.y * 100}%`,
                      width: pos.wPx ? `${pos.wPx}px` : `${pos.w * 100}%`,
                      height: pos.hPx ? `${pos.hPx}px` : `${pos.h * 100}%`,
                      '--zone-color': zone.color,
                    } as CSSProperties}
                    aria-pressed={isGroupActive}
                    onClick={() => setActiveZoneId(activeZoneId === zone.id ? null : zone.id)}
                    title={`${zone.label} | P${zone.priority}`}
                  >
                    <ZoneIcon className="gun-zone-icon" />
                  </button>
                )
              })}

              {debugMode && (
                <div
                  className="gun-debug-capture"
                  onMouseDown={handleDebugMouseDown}
                  onMouseMove={handleDebugMouseMove}
                  onMouseUp={handleDebugMouseUp}
                  onMouseLeave={handleDebugMouseLeave}
                >
                  {liveRect && (
                    <div
                      style={{
                        position: 'absolute',
                        left: `${liveRect.x}%`,
                        top: `${liveRect.y}%`,
                        width: `${liveRect.w}%`,
                        height: `${liveRect.h}%`,
                        border: '1px solid var(--accent-gold)',
                        background: 'rgba(245, 158, 11, 0.12)',
                        pointerEvents: 'none',
                      }}
                    />
                  )}

                  {drawnBox && !isDragging && (
                    <div
                      style={{
                        position: 'absolute',
                        left: `calc(${drawnBox.x}% - ${drawnBox.w / 2}%)`,
                        top: `calc(${drawnBox.y}% - ${drawnBox.h / 2}%)`,
                        width: `${drawnBox.w}%`,
                        height: `${drawnBox.h}%`,
                        border: '1px solid var(--gun-accent)',
                        background: 'rgba(74, 222, 128, 0.1)',
                        pointerEvents: 'none',
                      }}
                    />
                  )}

                  {hoverCoords && (
                    <div className="gun-debug-overlay">
                      <div className="gun-debug-coords">
                        x: {formatNormalizedPosition(hoverCoords.x)} ({hoverCoords.x}%)
                        <br />
                        y: {formatNormalizedPosition(hoverCoords.y)} ({hoverCoords.y}%)
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="gun-zone-sidebar">
          <div ref={resultRef} className="gun-zone-result">
            {debugMode ? (
              <div className="gun-debug-stack">
                <div className="gun-diagnosis-block-label tool-section-label">Zone Calibration</div>

                {drawnBox && !isDragging ? (
                  <>
                    <div className="gun-debug-readout">
                      x: {formatNormalizedPosition(drawnBox.x)}, y: {formatNormalizedPosition(drawnBox.y)}<br />
                      w: {formatNormalizedPosition(drawnBox.w)} <span className="gun-debug-readout-dim">({drawnBox.w}% / {drawnBox.wPx}px)</span><br />
                      h: {formatNormalizedPosition(drawnBox.h)} <span className="gun-debug-readout-dim">({drawnBox.h}% / {drawnBox.hPx}px)</span>
                    </div>
                    <div className="gun-debug-readout-secondary">
                      positions: {'{'} x: {formatNormalizedPosition(drawnBox.x)}, y: {formatNormalizedPosition(drawnBox.y)}, w: 0, h: 0, wPx: {drawnBox.wPx}, hPx: {drawnBox.hPx} {'}'}<br />
                      <br />
                      wPx: {drawnBox.wPx}<br />
                      hPx: {drawnBox.hPx}
                    </div>
                    <button
                      className="gun-view-btn tool-choice-button tool-choice-button--compact gun-debug-clear"
                      onClick={() => setDrawnBox(null)}
                    >
                      Clear
                    </button>
                  </>
                ) : (
                  <div className="gun-zone-effect gun-zone-effect-debug">
                    Drag on the image to measure a zone box.<br />
                    Release to see % and px dimensions.
                  </div>
                )}
              </div>
            ) : activeZone ? (
              <div className="gun-zone-intel">
                <div className="gun-zone-intel-head">
                  <div className="gun-zone-result-name">{activeZone.resultName}</div>
                  <div
                    className="gun-priority-badge"
                    style={{
                      color: activeZone.color,
                      background: `color-mix(in srgb, ${activeZone.color} 10%, transparent)`,
                      border: `1px solid color-mix(in srgb, ${activeZone.color} 36%, transparent)`,
                    }}
                  >
                    P{activeZone.priority} · {activeZone.priorityLabel}
                  </div>
                </div>

                <div className="gun-zone-intel-meta">
                  <div className="gun-zone-meta-block">
                    <span className="gun-zone-meta-label">View</span>
                    <span className="gun-zone-meta-value">{activeViewLabel}</span>
                  </div>
                  <div className="gun-zone-meta-block">
                    <span className="gun-zone-meta-label">Group</span>
                    <span className="gun-zone-meta-value">
                      {activeGroupZones.length > 1 ? `${activeGroupZones.length} zones` : 'Single'}
                    </span>
                  </div>
                </div>

                <p className="gun-zone-effect">{activeZone.effect}</p>

                {selectedShip && (() => {
                  const intelImage = getIntelImage(selectedShip, activeZone)
                  return intelImage ? (
                    <>
                      <div className="gun-zone-result-name">Component Outline</div>
                      <img
                        src={intelImage}
                        alt={`${activeZone.type} component reference`}
                        className="gun-zone-intel-img"
                      />
                    </>
                  ) : null
                })()}
              </div>
            ) : (
              <div className="gun-zone-result-empty">
                <p className="gun-empty-title">No component selected</p>
                <p className="gun-empty-copy">
                  Click a zone on the hull to inspect its priority and combat effect.
                </p>
              </div>
            )}
          </div>
        </aside>

      </div>
    </div>
  )
}
