import { createPortal } from 'react-dom'
import { useLayoutEffect, useRef } from 'react'

type Props = {
  open: boolean
  x: number
  y: number
  title: string
  sectionTitle?: string
  hero?: {
    leftLabel: string
    leftValue: string
    rightLabel: string
    rightValue: string
    description: string
  }
  lines: Array<{
    label: string
    value: string
    tone?: 'immediate' | 'cyan' | 'danger' | 'amber'
    kind?: 'section'
    pills?: string[]
  }>
}

export function HeatmapTooltip({ open, x, y, title, sectionTitle, hero, lines }: Props) {
  const tooltipRef = useRef<HTMLDivElement | null>(null)

  useLayoutEffect(() => {
    if (!open) return

    const tooltip = tooltipRef.current
    if (!tooltip) return

    const viewportPadding = 12
    const rect = tooltip.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    const clampedLeft = Math.min(
      Math.max(viewportPadding, x),
      Math.max(viewportPadding, viewportWidth - rect.width - viewportPadding)
    )
    const clampedTop = Math.min(
      Math.max(viewportPadding, y),
      Math.max(viewportPadding, viewportHeight - rect.height - viewportPadding)
    )

    tooltip.style.left = `${clampedLeft}px`
    tooltip.style.top = `${clampedTop}px`
  }, [open, x, y, title, sectionTitle, hero, lines])

  if (!open) return null

  return createPortal(
    <div className="alpha-tool-route alpha-heatmap-tooltip-portal-root">
      <div
        ref={tooltipRef}
        className="alpha-heatmap-tooltip"
        role="tooltip"
        style={{
          left: `${x}px`,
          top: `${y}px`,
        }}
      >
        <div className="alpha-heatmap-tooltip-body">
          <p className="alpha-heatmap-tooltip-ship-title">{title}</p>
          {sectionTitle ? <p className="alpha-heatmap-tooltip-section-title">{sectionTitle}</p> : null}
          {hero ? (
            <div className="alpha-heatmap-tooltip-hero">
              <div className="alpha-heatmap-tooltip-hero-head">
                <div className="alpha-heatmap-tooltip-hero-metric">
                  <span className="alpha-heatmap-tooltip-hero-label">{hero.leftLabel}</span>
                  <span className="alpha-heatmap-tooltip-hero-value">{hero.leftValue}</span>
                </div>
                <div className="alpha-heatmap-tooltip-hero-metric alpha-heatmap-tooltip-hero-metric-right">
                  <span className="alpha-heatmap-tooltip-hero-label">{hero.rightLabel}</span>
                  <span className="alpha-heatmap-tooltip-hero-value">{hero.rightValue}</span>
                </div>
              </div>
              <p className="alpha-heatmap-tooltip-hero-copy">{hero.description}</p>
            </div>
          ) : null}
          <dl className="alpha-heatmap-tooltip-list">
            {lines.map((line) => (
              line.kind === 'section' ? (
                <div key={line.label} className="alpha-heatmap-tooltip-section-row">
                  {line.label}
                </div>
              ) : line.pills ? (
                <div key={line.label} className="alpha-heatmap-tooltip-row">
                  <dt>{line.label}</dt>
                  <dd className={line.tone ? `alpha-heatmap-tooltip-value-${line.tone}` : undefined}>
                    <span className="alpha-heatmap-tooltip-pill-row">
                      {line.pills.map((pill) => (
                        <span key={pill} className="alpha-heatmap-tooltip-pill">
                          {pill}
                        </span>
                      ))}
                    </span>
                  </dd>
                </div>
              ) : (
                <div key={line.label} className="alpha-heatmap-tooltip-row">
                  <dt>{line.label}</dt>
                  <dd className={line.tone ? `alpha-heatmap-tooltip-value-${line.tone}` : undefined}>
                    {line.value}
                  </dd>
                </div>
              )
            ))}
          </dl>
        </div>
      </div>
    </div>,
    document.body
  )
}
