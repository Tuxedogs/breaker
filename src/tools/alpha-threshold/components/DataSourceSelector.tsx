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

  return (
    <section className="data-source-card relative z-20 w-fit overflow-visible">
      <div
        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 p-1"
        role="group"
        aria-label="Erkul data source"
      >
        {hasLive ? (
          <button
            type="button"
            onClick={() => onSourceChange(LIVE_SOURCE)}
            className={[
              'alpha-chip inline-flex cursor-pointer items-center gap-2',
              activeSource === LIVE_SOURCE ? 'alpha-chip-pass' : '',
            ].join(' ')}
            aria-pressed={activeSource === LIVE_SOURCE}
          >
            Live
          </button>
        ) : null}
        {hasPtu ? (
          <button
            type="button"
            onClick={() => onSourceChange(PTU_SOURCE)}
            className={[
              'alpha-chip inline-flex cursor-pointer items-center gap-2',
              activeSource === PTU_SOURCE ? 'alpha-chip-pass' : '',
            ].join(' ')}
            aria-pressed={activeSource === PTU_SOURCE}
          >
            PTU
          </button>
        ) : null}
      </div>
    </section>
  )
}
