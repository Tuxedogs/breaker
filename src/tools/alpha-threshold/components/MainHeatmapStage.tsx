import type { ReactNode } from 'react'

type Props = {
  board: ReactNode
  drawer?: ReactNode
}

export function MainHeatmapStage({ board, drawer }: Props) {
  return (
    <section className="alpha-main-heatmap-stage" aria-label="Armor interaction analysis stage">
      <div className="alpha-main-heatmap-board">{board}</div>
      {drawer}
    </section>
  )
}
