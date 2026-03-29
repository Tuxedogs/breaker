type Props = {
  shipCount: number
  weaponCount: number
  shieldMode: 'up' | 'down'
  onOpenShips: () => void
  onOpenWeapons: () => void
  onShieldModeChange: (mode: 'up' | 'down') => void
}

export function AlphaMobileControlStrip({
  shipCount,
  weaponCount,
  shieldMode,
  onOpenShips,
  onOpenWeapons,
  onShieldModeChange,
}: Props) {
  return (
    <section className="alpha-mobile-control-strip" aria-label="Comparison controls">
      <button type="button" className="acm-corner-seg alpha-mobile-control-strip-button" onClick={onOpenShips}>
        Ships ({shipCount})
      </button>
      <button type="button" className="acm-corner-seg alpha-mobile-control-strip-button" onClick={onOpenWeapons}>
        Weapons ({weaponCount})
      </button>
      <button
        type="button"
        className="acm-corner-seg alpha-mobile-control-strip-button"
        aria-pressed={shieldMode === 'up'}
        onClick={() => onShieldModeChange(shieldMode === 'up' ? 'down' : 'up')}
      >
        Shield: {shieldMode === 'up' ? 'ON' : 'DOWN'}
      </button>
    </section>
  )
}
