import type { ThresholdDataSourceOption } from '../data/sourceOptions'
import type { ThresholdDataSourceKey } from '../types'

type Props = {
  activeSource: ThresholdDataSourceKey
  sourceOptions: ThresholdDataSourceOption[]
  onSourceChange: (source: ThresholdDataSourceKey) => void
}

const LIVE_SOURCE: ThresholdDataSourceKey = 'erkul-live'
const PTU_SOURCE: ThresholdDataSourceKey = 'erkul-ptu'

export function DataSourceSelector({
  activeSource,
  sourceOptions,
  onSourceChange,
}: Props) {
  const hasLive = sourceOptions.some((option) => option.value === LIVE_SOURCE)
  const hasPtu = sourceOptions.some((option) => option.value === PTU_SOURCE)
  const normalizedSource =
    activeSource === PTU_SOURCE && hasPtu ? PTU_SOURCE : LIVE_SOURCE

  function handleToggle() {
    if (normalizedSource === LIVE_SOURCE && hasPtu) {
      onSourceChange(PTU_SOURCE)
      return
    }

    if (normalizedSource === PTU_SOURCE && hasLive) {
      onSourceChange(LIVE_SOURCE)
    }
  }

  return (
    <section className="data-source-card relative z-20 ml-auto w-fit overflow-visible">
      <button
        type="button"
        onClick={handleToggle}
        className="alpha-chip alpha-chip-pass inline-flex cursor-pointer items-center gap-2"
        aria-label={`Toggle data source. Current source: ${
          normalizedSource === PTU_SOURCE ? 'PTU' : 'LIVE'
        }`}
      >
        <span
          className={
            normalizedSource === PTU_SOURCE ? 'text-current' : 'text-slate-400'
          }
        >
          PTU
        </span>
        <span className="text-slate-500">/</span>
        <span
          className={
            normalizedSource === LIVE_SOURCE ? 'text-current' : 'text-slate-400'
          }
        >
          LIVE
        </span>
      </button>
    </section>
  )
}
