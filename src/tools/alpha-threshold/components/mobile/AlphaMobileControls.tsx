type Props = {
  shieldMode: 'up' | 'down'
  onShieldModeChange: (mode: 'up' | 'down') => void
  onOpenShips: () => void
  onOpenWeapons: () => void
}

export function AlphaMobileControls({
  shieldMode,
  onShieldModeChange,
  onOpenShips,
  onOpenWeapons,
}: Props) {
  return (
    <section className="alpha-mobile-controls">
      <button type="button" className="alpha-mobile-action" onClick={onOpenShips}>
        Ships
      </button>
      <button type="button" className="alpha-mobile-action" onClick={onOpenWeapons}>
        Weapons
      </button>
      <div className="alpha-mobile-segment" role="radiogroup" aria-label="Shield state">
        {(['up', 'down'] as const).map((state) => (
          <button
            key={state}
            type="button"
            className={[
              'alpha-mobile-segment-button',
              shieldMode === state ? 'alpha-mobile-segment-button-active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            role="radio"
            aria-checked={shieldMode === state}
            onClick={() => onShieldModeChange(state)}
          >
            {state === 'up' ? 'Shield Up' : 'Shield Down'}
          </button>
        ))}
      </div>
    </section>
  )
}
