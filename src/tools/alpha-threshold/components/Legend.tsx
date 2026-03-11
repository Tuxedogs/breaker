import type { SelectedWeaponComparison, ThresholdMode } from '../types'

type Props = {
  mode: ThresholdMode
  selectedWeapons: SelectedWeaponComparison[]
}

const toneClassName: Record<SelectedWeaponComparison['tone'], string> = {
  cyan: 'border-cyan-300/25 bg-cyan-400/10 text-cyan-100',
  violet: 'border-violet-300/25 bg-violet-400/10 text-violet-100',
  amber: 'border-amber-300/25 bg-amber-400/10 text-amber-100',
}

export function Legend({ mode, selectedWeapons }: Props) {
  return (
    <section
      aria-label="Comparison legend"
      className="flex flex-wrap gap-2 text-xs text-white/70"
    >
      <span className="alpha-chip alpha-chip-pass">
        Pass = alpha meets or exceeds threshold
      </span>
      <span className="alpha-chip alpha-chip-block">
        Block = alpha is below threshold
      </span>
      <span className="alpha-chip alpha-chip-muted">
        Active lane: {mode === 'ballistic' ? 'Ballistic' : 'Energy'}
      </span>
      {selectedWeapons.map((selectedWeapon) => (
        <span
          key={selectedWeapon.slotId}
          className={[
            'alpha-chip',
            toneClassName[selectedWeapon.tone],
          ].join(' ')}
        >
          {selectedWeapon.slotLabel}
        </span>
      ))}
    </section>
  )
}
