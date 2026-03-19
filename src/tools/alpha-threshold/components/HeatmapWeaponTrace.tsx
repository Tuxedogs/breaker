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
  switch (trace.penetrationState) {
    case 'blocked':
      return 'Blocked'
    case 'immediate':
      return 'Immediate penetration'
    case 'threshold':
      return 'Armor Damage Required.'
  }
}

function getPenetrationStartLabel(trace: HeatmapTraceModel) {
  switch (trace.penetrationState) {
    case 'blocked':
      return 'No penetration point'
    case 'immediate':
      return '100% intact armor'
    case 'threshold':
      return `${Math.round(trace.penetrationStartArmorPercent)}% armor remaining`
  }
}

function getLegacyStatusLabel(trace: HeatmapTraceModel) {
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
  const statusLabel = getStatusLabel(trace)
  const destroyedArmorWidth = trace.penetrationStartX * 100
  const activeWidth = 100 - destroyedArmorWidth

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
      <div
        className={`alpha-heatmap-trace-bar-shell alpha-heatmap-trace-bar-shell-${trace.penetrationState}`}
        aria-label={statusLabel}
        tabIndex={0}
        onPointerEnter={(event) => queueTooltipPosition(event.clientX, event.clientY)}
        onPointerMove={(event) => queueTooltipPosition(event.clientX, event.clientY)}
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
        <div
          className={`alpha-heatmap-trace-copy alpha-heatmap-trace-copy-${trace.matchedDamageType}`}
        >
          <h4 className="alpha-heatmap-trace-name">{trace.weapon.weapon.name}</h4>
          <p className="alpha-heatmap-trace-hint">Tap for details</p>
        </div>
        {trace.penetrationState === 'blocked' ? (
          <div className="alpha-heatmap-trace-deflect" aria-hidden="true" />
        ) : null}
        {trace.penetrationState === 'threshold' ? (
          <>
            <div
              className="alpha-heatmap-trace-deflect alpha-heatmap-trace-deflect-threshold"
              aria-hidden="true"
              style={{
                inset: '0 auto 0 0',
                width: `${destroyedArmorWidth}%`,
              }}
            />
            <div
              className="alpha-heatmap-trace-damage"
              aria-hidden="true"
              style={{
                left: `${destroyedArmorWidth}%`,
                width: `${activeWidth}%`,
              }}
            />
          </>
        ) : null}
        {trace.penetrationState === 'immediate' ? (
          <div
            className="alpha-heatmap-trace-damage alpha-heatmap-trace-damage-immediate"
            aria-hidden="true"
            style={{ inset: 0 }}
          />
        ) : null}
        <PenetrationMarker trace={trace} />
        <HeatmapTooltip
          open={tooltipState.open}
          x={tooltipState.x}
          y={tooltipState.y}
          title={shipName}
          sectionTitle={trace.weapon.weapon.name}
          lines={[
            {
              label: 'Penetration Start',
              value: getPenetrationStartLabel(trace),
              tone: trace.penetrationState === 'immediate' ? 'immediate' : undefined,
            },
            { label: 'Weapon Type', value: trace.matchedDamageType },
            { label: 'Alpha', value: formatMetric(trace.weaponAlpha) },
            { label: 'Threshold Used', value: formatMetric(trace.baseThreshold) },
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
            { label: 'Legacy Status', value: getLegacyStatusLabel(trace) },
          ]}
        />
      </div>
    </section>
  )
}

