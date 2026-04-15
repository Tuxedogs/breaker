import { useRef, useState, useLayoutEffect, useCallback, useEffect } from 'react'
import type { CSSProperties } from 'react'
import type { GunneryState } from '../../hooks/useGunneryState'
import { PRIORITY_LABELS } from '../../data/ships'
import {
  PowerPlantIcon,
  ShieldGeneratorIcon,
  QuantumDriveIcon,
  RadarIcon,
  TurretStationIcon,
  AirlockIcon,
} from '../../../../components/icons/DeckMarkerIcons'

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
  color: string
}
type OverlayBounds = {
  left: number
  top: number
  width: number
  height: number
}

const COMPONENT_TYPE_RE = /--component-(\w+)/

function ZoneIcon({ color, className }: { color: string; className?: string }) {
  const type = COMPONENT_TYPE_RE.exec(color)?.[1] ?? ''
  switch (type) {
    case 'power':      return <PowerPlantIcon className={className} />
    case 'shield':     return <ShieldGeneratorIcon className={className} />
    case 'qt':         return <QuantumDriveIcon className={className} />
    case 'radar':      return <RadarIcon className={className} />
    case 'gun':        return <TurretStationIcon className={className} />
    case 'navigation': return <AirlockIcon className={className} />
    default:           return null
  }
}

export function SubTargetSection({
  ships, selectedShipId, selectedShip,
  activeView, setActiveView,
  activeZoneId, setActiveZoneId,
  activeZone, selectShip,
}: Props) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const resultRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const zoneRefs = useRef<Map<string, HTMLButtonElement>>(new Map())

  const [connection, setConnection] = useState<ConnectionState | null>(null)
  const [overlayBounds, setOverlayBounds] = useState<OverlayBounds | null>(null)
  const [layoutVersion, setLayoutVersion] = useState(0)

  const visibleZones = selectedShip?.zones.filter(zone => zone.positions[activeView]) ?? []
  const activeViewLabel = selectedShip?.viewDefs.find(view => view.id === activeView)?.label ?? activeView
  const activeGroupZones = activeZone
    ? visibleZones.filter(zone => activeZone.groupId ? zone.groupId === activeZone.groupId : zone.id === activeZone.id)
    : []

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
        color: activeZone.color,
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

  return (
    <div className="gun-subtarget">

      {/* ── Header ─────────────────────────────────── */}
      <div className="gun-subtarget-head">
        <div className="gun-ship-picker">
          {ships.map(ship => (
            <button
              key={ship.id}
              className={`gun-ship-btn${selectedShipId === ship.id ? ' is-active' : ''}`}
              aria-pressed={selectedShipId === ship.id}
              onClick={() => selectShip(selectedShipId === ship.id ? null : ship.id)}
            >
              {ship.label}
            </button>
          ))}
        </div>

        {selectedShip && (
          <div className="gun-view-selector">
            {selectedShip.viewDefs.map(view => (
              <button
                key={view.id}
                className={`gun-view-btn${activeView === view.id ? ' is-active' : ''}`}
                aria-pressed={activeView === view.id}
                onClick={() => { setActiveView(view.id); setActiveZoneId(null) }}
              >
                {view.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Body ───────────────────────────────────── */}
      <div ref={bodyRef} className="gun-trainer">

        {/* SVG connection overlay */}
        {connection && (
          <svg
            width={connection.svgW}
            height={connection.svgH}
            className="gun-connection-svg"
          >
            {connection.paths.map((path, i) => (
              <path
                key={i}
                d={path}
                stroke={connection.color}
                strokeWidth="1.5"
                strokeDasharray="5 3"
                fill="none"
                opacity="0.55"
              />
            ))}
            {connection.dots.map((dot, i) => (
              <circle key={i} cx={dot.x} cy={dot.y} r="2.5" fill={connection.color} opacity="0.8" />
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
                src={selectedShip.views[activeView]}
                alt={`${selectedShip.label} ${activeView}`}
                className="gun-silhouette-img"
                draggable={false}
                onLoad={handleImageLoad}
              />
            </div>
          ) : (
            <div className="gun-canvas-empty">
              Select a hull to begin
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
              {visibleZones.map(zone => {
                const pos = zone.positions[activeView]!
                const isGroupActive = activeZone?.groupId
                  ? zone.groupId === activeZone.groupId
                  : zone.id === activeZoneId

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
                    <ZoneIcon color={zone.color} className="gun-zone-icon" />
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="gun-zone-sidebar">
          <div ref={resultRef} className="gun-zone-result">
            {activeZone ? (
              <div className="gun-zone-intel">
                <div className="gun-zone-intel-head">
                  <div className="gun-zone-result-name">{activeZone.label}</div>
                  <div
                    className="gun-priority-badge"
                    style={{
                      color: activeZone.color,
                      background: `color-mix(in srgb, ${activeZone.color} 10%, transparent)`,
                      border: `1px solid color-mix(in srgb, ${activeZone.color} 36%, transparent)`,
                    }}
                  >
                    P{activeZone.priority} · {PRIORITY_LABELS[activeZone.priority]}
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
