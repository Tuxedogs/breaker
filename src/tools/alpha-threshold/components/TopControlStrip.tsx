type Props = {
  selectedWeaponCount: number
  selectedShipCount: number
  onOpenWeapons: () => void
  onOpenShips: () => void
  onClearAllWeapons: () => void
  onClearAllShips: () => void
}

export function TopControlStrip({
  selectedWeaponCount,
  selectedShipCount,
  onOpenWeapons,
  onOpenShips,
  onClearAllWeapons,
  onClearAllShips,
}: Props) {
  return (
    <section className="alpha-top-control-strip-shell" aria-label="Threshold controls">
      <div className="alpha-top-control-strip">
        <div className="alpha-top-control-strip-primary">
          <div className="alpha-top-control-strip-source">
            <span className="alpha-top-strip-pill alpha-top-strip-pill-locked">
              PTU Validation
            </span>
          </div>

          <div className="alpha-top-control-strip-status">
            <span className="alpha-top-strip-pill">
              {selectedWeaponCount} {selectedWeaponCount === 1 ? 'weapon' : 'weapons'}
            </span>
            <span className="alpha-top-strip-pill">
              {selectedShipCount} {selectedShipCount === 1 ? 'ship' : 'ships'}
            </span>
          </div>
        </div>

        <div className="alpha-top-control-strip-actions">
          <button type="button" className="alpha-top-strip-button alpha-top-strip-button-primary" onClick={onOpenShips}>
            Edit Ships
          </button>
          <button type="button" className="alpha-top-strip-button alpha-top-strip-button-primary" onClick={onOpenWeapons}>
            Edit Weapons
          </button>
          <button type="button" className="alpha-top-strip-button" onClick={onClearAllShips}>
            Clear Ships
          </button>
          <button type="button" className="alpha-top-strip-button" onClick={onClearAllWeapons}>
            Clear Weapons
          </button>
        </div>
      </div>
    </section>
  )
}
