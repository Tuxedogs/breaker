import { useRef, useState, useLayoutEffect } from 'react'
import type { GunneryState } from '../../hooks/useGunneryState'
import { PRIORITY_LABELS } from '../../data/ships'

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
}

type PctPoint  = { x: number; y: number }
type DrawnBox  = { x: number; y: number; w: number; h: number; wPx: number; hPx: number }

export function SubTargetSection({
  ships, selectedShipId, selectedShip,
  activeView, setActiveView,
  activeZoneId, setActiveZoneId,
  activeZone, selectShip,
}: Props) {
  const trainerRef    = useRef<HTMLDivElement>(null)
  const silhouetteRef = useRef<HTMLDivElement>(null)
  const resultRef     = useRef<HTMLDivElement>(null)
  const zoneRefs      = useRef<Map<string, HTMLButtonElement>>(new Map())

  const [debugMode, setDebugMode]         = useState(false)
  const [connection, setConnection]       = useState<ConnectionState | null>(null)

  // Drag-to-measure state
  const [dragStart, setDragStart]         = useState<PctPoint | null>(null)
  const [dragCurrent, setDragCurrent]     = useState<PctPoint | null>(null)
  const [isDragging, setIsDragging]       = useState(false)
  const [drawnBox, setDrawnBox]           = useState<DrawnBox | null>(null)
  const [hoverCoords, setHoverCoords]     = useState<PctPoint | null>(null)

  const visibleZones = selectedShip?.zones.filter(z => z.positions[activeView]) ?? []

  function getPct(e: React.MouseEvent<HTMLDivElement>): PctPoint | null {
    const el = silhouetteRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    return {
      x: Math.round(((e.clientX - rect.left) / rect.width)  * 1000) / 10,
      y: Math.round(((e.clientY - rect.top)  / rect.height) * 1000) / 10,
    }
  }

  function computeBox(a: PctPoint, b: PctPoint): DrawnBox | null {
    const el = silhouetteRef.current
    if (!el) return null
    const { width, height } = el.getBoundingClientRect()
    const x = Math.min(a.x, b.x)
    const y = Math.min(a.y, b.y)
    const w = Math.abs(a.x - b.x)
    const h = Math.abs(a.y - b.y)
    return {
      x:   Math.round(x * 10) / 10,
      y:   Math.round(y * 10) / 10,
      w:   Math.round(w * 10) / 10,
      h:   Math.round(h * 10) / 10,
      wPx: Math.round(w / 100 * width),
      hPx: Math.round(h / 100 * height),
    }
  }

  function handleMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (!debugMode) return
    e.preventDefault()
    const pt = getPct(e)
    if (!pt) return
    setDragStart(pt)
    setDragCurrent(pt)
    setIsDragging(true)
    setDrawnBox(null)
  }

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const pt = getPct(e)
    if (!pt) return
    setHoverCoords(pt)
    if (isDragging && dragStart) {
      setDragCurrent(pt)
    }
  }

  function handleMouseUp(e: React.MouseEvent<HTMLDivElement>) {
    if (!isDragging || !dragStart) return
    const pt = getPct(e)
    if (pt) {
      const box = computeBox(dragStart, pt)
      setDrawnBox(box)
    }
    setIsDragging(false)
    setDragStart(null)
    setDragCurrent(null)
  }

  // Live drag rectangle (% values, top-left origin)
  const liveRect = (isDragging && dragStart && dragCurrent) ? {
    x: Math.min(dragStart.x, dragCurrent.x),
    y: Math.min(dragStart.y, dragCurrent.y),
    w: Math.abs(dragStart.x - dragCurrent.x),
    h: Math.abs(dragStart.y - dragCurrent.y),
  } : null

  // Recompute SVG connection lines after every relevant state change
  useLayoutEffect(() => {
    if (!activeZone || !trainerRef.current || !resultRef.current) {
      setConnection(null)
      return
    }

    const trainerRect = trainerRef.current.getBoundingClientRect()
    const resultRect  = resultRef.current.getBoundingClientRect()

    const groupId = activeZone.groupId
    const groupZones = selectedShip?.zones.filter(z =>
      groupId
        ? z.groupId === groupId && z.positions[activeView]
        : z.id === activeZone.id && z.positions[activeView]
    ) ?? []

    const zoneCenters = groupZones
      .map(z => {
        const el = zoneRefs.current.get(z.id)
        if (!el) return null
        const r = el.getBoundingClientRect()
        return { id: z.id, x: r.left + r.width / 2 - trainerRect.left, y: r.top + r.height / 2 - trainerRect.top }
      })
      .filter((c): c is { id: string; x: number; y: number } => c !== null)
      .sort((a, b) => a.x - b.x)

    if (zoneCenters.length === 0) {
      setConnection(null)
      return
    }

    const ARC_H = 20
    const paths: string[] = []
    const dots: Dot[] = zoneCenters.map(c => ({ x: c.x, y: c.y }))

    for (let i = 0; i < zoneCenters.length - 1; i++) {
      const a = zoneCenters[i], b = zoneCenters[i + 1]
      const mx = (a.x + b.x) / 2
      const cy = Math.min(a.y, b.y) - ARC_H
      paths.push(`M ${a.x} ${a.y} Q ${mx} ${cy} ${b.x} ${b.y}`)
    }

    const right = zoneCenters[zoneCenters.length - 1]
    const rx = resultRect.left - trainerRect.left
    const ry = resultRect.top + resultRect.height / 2 - trainerRect.top
    const midX = (right.x + rx) / 2
    paths.push(`M ${right.x} ${right.y} C ${midX} ${right.y} ${midX} ${ry} ${rx} ${ry}`)
    dots.push({ x: rx, y: ry })

    setConnection({ svgW: trainerRect.width, svgH: trainerRect.height, paths, dots })
  }, [activeZoneId, activeView, selectedShipId]) // eslint-disable-line react-hooks/exhaustive-deps

  function setZoneRef(id: string, el: HTMLButtonElement | null) {
    if (el) zoneRefs.current.set(id, el)
    else zoneRefs.current.delete(id)
  }

  function toggleDebug() {
    setDebugMode(d => !d)
    setDragStart(null)
    setDragCurrent(null)
    setIsDragging(false)
    setDrawnBox(null)
    setHoverCoords(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Ship picker */}
      <div className="gun-ship-picker">
        {ships.map(ship => (
          <button
            key={ship.id}
            className={`gun-ship-btn${selectedShipId === ship.id ? ' is-active' : ''}`}
            onClick={() => selectShip(selectedShipId === ship.id ? null : ship.id)}
          >
            {ship.label}
          </button>
        ))}
      </div>

      {selectedShip ? (
        <>
          {/* View selector + debug toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="gun-view-selector">
              {selectedShip.viewDefs.map(v => (
                <button
                  key={v.id}
                  className={`gun-view-btn${activeView === v.id ? ' is-active' : ''}`}
                  onClick={() => { setActiveView(v.id); setActiveZoneId(null) }}
                >
                  {v.label}
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

          {/* Trainer — relative container for the SVG overlay */}
          <div ref={trainerRef} className="gun-trainer">

            {/* Connection lines SVG */}
            {!debugMode && connection && (
              <svg
                width={connection.svgW}
                height={connection.svgH}
                style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5, overflow: 'visible' }}
              >
                {connection.paths.map((d, i) => (
                  <path
                    key={i} d={d}
                    stroke="var(--gun-accent)" strokeWidth="1.5"
                    strokeDasharray="5 3" fill="none" opacity="0.7"
                  />
                ))}
                {connection.dots.map((dot, i) => (
                  <circle key={i} cx={dot.x} cy={dot.y} r="3" fill="var(--gun-accent)" opacity="0.9" />
                ))}
              </svg>
            )}

            {/* Silhouette + zones */}
            <div
              ref={silhouetteRef}
              className="gun-silhouette-shell"
              style={{ cursor: debugMode ? 'crosshair' : undefined, userSelect: 'none' }}
              onMouseDown={debugMode ? handleMouseDown : undefined}
              onMouseMove={debugMode ? handleMouseMove : undefined}
              onMouseUp={debugMode ? handleMouseUp : undefined}
              onMouseLeave={debugMode ? () => { setHoverCoords(null); if (isDragging) { setIsDragging(false); setDragStart(null); setDragCurrent(null) } } : undefined}
            >
              <img
                key={`${selectedShip.id}-${activeView}`}
                src={selectedShip.views[activeView]}
                alt={`${selectedShip.label} — ${activeView} view`}
                className="gun-silhouette-img"
                draggable={false}
              />

              {/* Zone overlays (normal mode only) */}
              {!debugMode && visibleZones.map(zone => {
                const pos = zone.positions[activeView]!
                const isGroupActive = activeZone?.groupId
                  ? zone.groupId === activeZone.groupId
                  : zone.id === activeZoneId
                return (
                  <button
                    key={zone.id}
                    ref={el => setZoneRef(zone.id, el)}
                    className={`gun-zone${isGroupActive ? ' is-active' : ''}`}
                    style={{
                      left:           `${pos.x}%`,
                      top:            `${pos.y}%`,
                      width:          pos.wPx ? `${pos.wPx}px` : `${pos.w}%`,
                      height:         pos.hPx ? `${pos.hPx}px` : `${pos.h}%`,
                      '--zone-color': zone.color,
                    } as React.CSSProperties}
                    onClick={() => setActiveZoneId(activeZoneId === zone.id ? null : zone.id)}
                    title={zone.label}
                  >
                    <span className="gun-zone-label">{zone.shortLabel ?? zone.label}</span>
                  </button>
                )
              })}

              {/* Live drag rectangle */}
              {debugMode && liveRect && (
                <div
                  style={{
                    position: 'absolute',
                    left:    `${liveRect.x}%`,
                    top:     `${liveRect.y}%`,
                    width:   `${liveRect.w}%`,
                    height:  `${liveRect.h}%`,
                    border:  '1px solid var(--accent-gold)',
                    background: 'rgba(245, 158, 11, 0.12)',
                    pointerEvents: 'none',
                  }}
                />
              )}

              {/* Frozen drawn box */}
              {debugMode && drawnBox && !isDragging && (
                <div
                  style={{
                    position: 'absolute',
                    left:    `${drawnBox.x}%`,
                    top:     `${drawnBox.y}%`,
                    width:   `${drawnBox.w}%`,
                    height:  `${drawnBox.h}%`,
                    border:  '1px solid var(--gun-accent)',
                    background: 'rgba(74, 222, 128, 0.1)',
                    pointerEvents: 'none',
                  }}
                />
              )}

              {/* Hover crosshair readout */}
              {debugMode && hoverCoords && (
                <div className="gun-debug-overlay">
                  <div className="gun-debug-coords">
                    {hoverCoords.x}%, {hoverCoords.y}%
                  </div>
                </div>
              )}
            </div>

            {/* Zone result / debug panel */}
            <div ref={resultRef} className="gun-zone-result">
              {debugMode ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                  <div className="gun-diagnosis-block-label">Zone Calibration</div>

                  {drawnBox && !isDragging ? (
                    <>
                      <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: '0.8rem', lineHeight: 2, color: 'var(--gun-accent)' }}>
                        x: {drawnBox.x}<br />
                        y: {drawnBox.y}<br />
                        w: {drawnBox.w} <span style={{ color: 'rgba(180,200,220,0.4)' }}>({drawnBox.wPx}px)</span><br />
                        h: {drawnBox.h} <span style={{ color: 'rgba(180,200,220,0.4)' }}>({drawnBox.hPx}px)</span>
                      </div>
                      <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: '0.72rem', color: 'rgba(180,200,220,0.45)', lineHeight: 1.6 }}>
                        wPx: {drawnBox.wPx}<br />
                        hPx: {drawnBox.hPx}
                      </div>
                      <button
                        className="gun-view-btn"
                        style={{ alignSelf: 'flex-start', marginTop: '0.25rem' }}
                        onClick={() => setDrawnBox(null)}
                      >
                        Clear
                      </button>
                    </>
                  ) : (
                    <div className="gun-zone-effect" style={{ fontSize: '0.8rem' }}>
                      Drag on the image to measure a zone box.<br />
                      Release to see % and px dimensions.
                    </div>
                  )}
                </div>
              ) : activeZone ? (
                <>
                  <div className="gun-zone-result-name">{activeZone.label}</div>
                  <div
                    className="gun-priority-badge"
                    style={{
                      color:      activeZone.color,
                      background: `color-mix(in srgb, ${activeZone.color} 12%, transparent)`,
                      border:     `1px solid color-mix(in srgb, ${activeZone.color} 40%, transparent)`,
                    }}
                  >
                    P{activeZone.priority} — {PRIORITY_LABELS[activeZone.priority]}
                  </div>
                  <div className="gun-zone-effect">{activeZone.effect}</div>
                </>
              ) : (
                <div className="gun-zone-result-empty">
                  Click a component zone to see priority and expected effect.
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="gun-result">
          <div className="gun-result-empty">Select a ship to begin sub-target training.</div>
        </div>
      )}
    </div>
  )
}
