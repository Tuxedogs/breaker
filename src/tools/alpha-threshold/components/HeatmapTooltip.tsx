import { createPortal } from 'react-dom'

type Props = {
  open: boolean
  x: number
  y: number
  title: string
  sectionTitle?: string
  lines: Array<{ label: string; value: string; tone?: 'immediate' }>
}

export function HeatmapTooltip({ open, x, y, title, sectionTitle, lines }: Props) {
  if (!open) return null

  return createPortal(
    <div className="alpha-tool-route alpha-heatmap-tooltip-portal-root">
      <div
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
          <dl className="alpha-heatmap-tooltip-list">
            {lines.map((line) => (
              <div key={line.label} className="alpha-heatmap-tooltip-row">
                <dt>{line.label}</dt>
                <dd className={line.tone ? `alpha-heatmap-tooltip-value-${line.tone}` : undefined}>
                  {line.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>,
    document.body
  )
}
