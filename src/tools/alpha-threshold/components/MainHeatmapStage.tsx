import type { ReactNode } from 'react'

type Props = {
  board: ReactNode
  overlay?: ReactNode
}

export function MainHeatmapStage({ board, overlay }: Props) {
  return (
    <section className="alpha-main-heatmap-stage" aria-label="Armor interaction analysis stage">
      <div className="alpha-main-heatmap-board">{board}</div>
      {overlay}
    </section>
  )
}
