import type { ThresholdMode } from '../types'

type Props = {
  mode: ThresholdMode
  onChange: (mode: ThresholdMode) => void
}

export function ThresholdModeToggle({ mode, onChange }: Props) {
  return (
    <div
      className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1"
      role="group"
      aria-label="Threshold mode"
    >
      <button
        type="button"
        onClick={() => onChange('ballistic')}
        aria-pressed={mode === 'ballistic'}
        className={[
          'min-h-11 rounded-lg px-4 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70',
          mode === 'ballistic'
            ? 'bg-cyan-500/20 text-cyan-200'
            : 'text-white/70 hover:text-white',
        ].join(' ')}
      >
        Ballistic
      </button>

      <button
        type="button"
        onClick={() => onChange('energy')}
        aria-pressed={mode === 'energy'}
        className={[
          'min-h-11 rounded-lg px-4 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70',
          mode === 'energy'
            ? 'bg-amber-500/20 text-amber-200'
            : 'text-white/70 hover:text-white',
        ].join(' ')}
      >
        Energy
      </button>
    </div>
  )
}
