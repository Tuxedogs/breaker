import type { SelectedWeaponComparison } from '../types'

type Props = {
  selectedWeapons: SelectedWeaponComparison[]
}

const toneClassName: Record<SelectedWeaponComparison['tone'], string> = {
  cyan: 'border-cyan-300/25 bg-cyan-400/10 text-cyan-100',
  violet: 'border-violet-300/25 bg-violet-400/10 text-violet-100',
  amber: 'border-amber-300/25 bg-amber-400/10 text-amber-100',
  emerald: 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100',
}

export function Legend({ selectedWeapons }: Props) {
  return (
    <section
      aria-label="Comparison legend"
      className="alpha-legend-panel flex flex-wrap gap-2 text-xs text-white/70"
    >
      <span className="alpha-chip alpha-chip-pass">
        Green = victim takes hull damage (alpha meets threshold once)
      </span>
      <span className="alpha-chip alpha-chip-block">
        Red = victim deflects the hit (alpha below threshold)
      </span>
      <span className="alpha-chip alpha-chip-muted">
        Ballistic and energy lanes are scaled independently
      </span>
      {selectedWeapons.map((selectedWeapon) => (
        <span
          key={selectedWeapon.slotId}
          className={[
            'alpha-chip',
            toneClassName[selectedWeapon.tone],
          ].join(' ')}
        >
          {selectedWeapon.slotLabel} {selectedWeapon.weapon.damageType}
        </span>
      ))}
    </section>
  )
}
