import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

type Props = {
  board: ReactNode
  overlay?: ReactNode
}

/** Positions the selection overlay to the first body matrix cell (weapon 1 × ship 1), not the header row. */
export function MainHeatmapStage({ board, overlay }: Props) {
  const stageRef = useRef<HTMLElement>(null)
  const [anchorStyle, setAnchorStyle] = useState<CSSProperties>({})

  useLayoutEffect(() => {
    const stage = stageRef.current
    if (!stage) return

    const mq = window.matchMedia('(min-width: 1024px)')

    const measure = () => {
      if (!mq.matches) {
        setAnchorStyle({})
        return
      }
      const anchor = stage.querySelector<HTMLElement>('.alpha-matrix-first-cell-anchor')
      if (!anchor) {
        setAnchorStyle({})
        return
      }
      const sRect = stage.getBoundingClientRect()
      const aRect = anchor.getBoundingClientRect()
      setAnchorStyle({
        '--alpha-overlay-top-offset': `${aRect.top - sRect.top}px`,
        '--alpha-overlay-left-offset': `${aRect.left - sRect.left}px`,
      } as CSSProperties)
    }

    measure()

    const ro = new ResizeObserver(measure)
    ro.observe(stage)

    const scrollEl = stage.querySelector('.alpha-comparison-matrix-scroll')
    scrollEl?.addEventListener('scroll', measure, { passive: true })

    window.addEventListener('resize', measure)
    mq.addEventListener('change', measure)

    return () => {
      ro.disconnect()
      scrollEl?.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
      mq.removeEventListener('change', measure)
    }
  }, [board, overlay])

  return (
    <section
      ref={stageRef}
      className="alpha-main-heatmap-stage"
      style={anchorStyle}
      aria-label="Armor interaction analysis stage"
    >
      <div className="alpha-main-heatmap-board">{board}</div>
      {overlay}
    </section>
  )
}
