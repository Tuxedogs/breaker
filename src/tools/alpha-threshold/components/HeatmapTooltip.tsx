import { createPortal } from 'react-dom'

type Props = {
  open: boolean
  x: number
  y: number
  title: string
  lines: Array<{ label: string; value: string }>
}

export function HeatmapTooltip({ open, x, y, title, lines }: Props) {
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
        <p className="alpha-heatmap-tooltip-title">{title}</p>
        <dl className="alpha-heatmap-tooltip-list">
          {lines.map((line) => (
            <div key={line.label} className="alpha-heatmap-tooltip-row">
              <dt>{line.label}</dt>
              <dd>{line.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>,
    document.body
  )
}
