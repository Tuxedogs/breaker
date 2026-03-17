import { useEffect, useRef, useState } from 'react'
import { formatMetric } from '../lib/calculations'
import { HeatmapTooltip } from './HeatmapTooltip'
import { PenetrationMarker } from './PenetrationMarker'
import type { HeatmapTraceModel } from '../types'

type Props = {
  shipName: string
  trace: HeatmapTraceModel
}

function getStatusLabel(trace: HeatmapTraceModel) {
  switch (trace.status) {
    case 'always-deflects':
      return 'Always Deflects'
    case 'always-penetrates':
      return 'Always Penetrates'
    case 'penetrates-early':
      return 'Penetrates Early'
    default:
      return 'Crosses Late'
  }
}

function clampTooltipCoordinate(value: number, max: number) {
  return Math.max(16, Math.min(value, max))
}

export function HeatmapWeaponTrace({ shipName, trace }: Props) {
  const [tooltipState, setTooltipState] = useState({
    open: false,
    x: 0,
    y: 0,
  })
  const frameRef = useRef<number | null>(null)
  const nextPointRef = useRef({ x: 0, y: 0 })
  const damageStart = trace.alwaysPenetrates ? 0 : trace.nearCrossoverBandEnd * 100
  const transitionStart = trace.nearCrossoverBandStart * 100
  const transitionWidth = (trace.nearCrossoverBandEnd - trace.nearCrossoverBandStart) * 100
  const statusLabel = getStatusLabel(trace)

  useEffect(() => {
    return () => {
      if (frameRef.current != null) {
        window.cancelAnimationFrame(frameRef.current)
      }
    }
  }, [])

  function queueTooltipPosition(clientX: number, clientY: number) {
    const tooltipWidth = 304
    const tooltipHeight = 224
    const gutter = 16
    const preferredX = clientX + 18
    const preferredY = clientY + 18

    nextPointRef.current = {
      x: clampTooltipCoordinate(
        preferredX,
        window.innerWidth - tooltipWidth - gutter
      ),
      y: clampTooltipCoordinate(
        preferredY,
        window.innerHeight - tooltipHeight - gutter
      ),
    }

    if (frameRef.current != null) return

    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null
      setTooltipState({
        open: true,
        x: nextPointRef.current.x,
        y: nextPointRef.current.y,
      })
    })
  }

  function closeTooltip() {
    if (frameRef.current != null) {
      window.cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }

    setTooltipState((current) => ({ ...current, open: false }))
  }

  return (
    <section
      className={`alpha-heatmap-trace alpha-heatmap-trace-${trace.matchedDamageType}`}
    >
      <header className="alpha-heatmap-trace-head">
        <div className="alpha-heatmap-trace-copy">
          <p className="alpha-heatmap-trace-slot">{trace.weapon.slotLabel}</p>
          <h4 className="alpha-heatmap-trace-name">{trace.weapon.weapon.name}</h4>
          <p className="alpha-heatmap-trace-meta">
            {trace.matchedDamageType} · {formatMetric(trace.weaponAlpha)} alpha
          </p>
        </div>
      </header>

      <div
        className="alpha-heatmap-trace-bar-shell"
        tabIndex={0}
        onPointerEnter={(event) =>
          queueTooltipPosition(event.clientX, event.clientY)
        }
        onPointerMove={(event) =>
          queueTooltipPosition(event.clientX, event.clientY)
        }
        onPointerLeave={closeTooltip}
        onFocus={(event) => {
          const rect = event.currentTarget.getBoundingClientRect()
          setTooltipState({
            open: true,
            x: clampTooltipCoordinate(
              rect.left + rect.width / 2 + 18,
              window.innerWidth - 304 - 16
            ),
            y: clampTooltipCoordinate(rect.top + 18, window.innerHeight - 224 - 16),
          })
        }}
        onBlur={closeTooltip}
      >
        <div className="alpha-heatmap-trace-deflect" aria-hidden="true" />
        {!trace.alwaysDeflects ? (
          <>
            <div
              className="alpha-heatmap-trace-transition"
              aria-hidden="true"
              style={{
                left: `${transitionStart}%`,
                width: `${transitionWidth}%`,
              }}
            />
            <div
              className="alpha-heatmap-trace-damage"
              aria-hidden="true"
              style={{
                left: `${damageStart}%`,
                width: `${100 - damageStart}%`,
              }}
            />
          </>
        ) : null}
        <PenetrationMarker trace={trace} />
        <HeatmapTooltip
          open={tooltipState.open}
          x={tooltipState.x}
          y={tooltipState.y}
          title={`${trace.weapon.weapon.name} vs ${shipName}`}
          lines={[
            { label: 'Weapon Type', value: trace.matchedDamageType },
            { label: 'Alpha', value: formatMetric(trace.weaponAlpha) },
            {
              label: 'Penetration Start',
              value: `${Math.round(trace.penetrationStartArmorPercent)}% armor`,
            },
            {
              label: 'Crossover Threshold',
              value: formatMetric(trace.effectiveThresholdAtCrossover),
            },
            {
              label: 'Full Armor Delta',
              value: `${trace.overUnderDeltaAtFullArmor >= 0 ? '+' : '-'}${formatMetric(
                Math.abs(trace.overUnderDeltaAtFullArmor)
              )}`,
            },
            { label: 'Status', value: statusLabel },
          ]}
        />
      </div>
    </section>
  )
}
