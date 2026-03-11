import { useState } from 'react'
import type { Ship, ShipOverride } from '../types'

type Props = {
  ship: Ship
  override?: ShipOverride
  onSave: (patch: ShipOverride) => void
  onReset: () => void
}

export function ShipOverrideEditor({
  ship,
  override,
  onSave,
  onReset,
}: Props) {
  const [health, setHealth] = useState(String(override?.health ?? ship.health))
  const [ballisticThreshold, setBallisticThreshold] = useState(
    String(override?.ballisticThreshold ?? ship.ballisticThreshold)
  )
  const [energyThreshold, setEnergyThreshold] = useState(
    String(override?.energyThreshold ?? ship.energyThreshold)
  )

  function handleSave() {
    const nextHealth = Number(health)
    const nextBallistic = Number(ballisticThreshold)
    const nextEnergy = Number(energyThreshold)

    if (
      Number.isNaN(nextHealth) ||
      Number.isNaN(nextBallistic) ||
      Number.isNaN(nextEnergy)
    ) {
      return
    }

    onSave({
      health: nextHealth,
      ballisticThreshold: nextBallistic,
      energyThreshold: nextEnergy,
    })
  }

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-white/10 bg-black/30 p-3">
      <div className="grid gap-2 md:grid-cols-3">
        <input
          value={health}
          onChange={(event) => setHealth(event.target.value)}
          className="alpha-input"
          placeholder="Health"
          inputMode="decimal"
        />

        <input
          value={ballisticThreshold}
          onChange={(event) => setBallisticThreshold(event.target.value)}
          className="alpha-input"
          placeholder="Ballistic threshold"
          inputMode="decimal"
        />

        <input
          value={energyThreshold}
          onChange={(event) => setEnergyThreshold(event.target.value)}
          className="alpha-input"
          placeholder="Energy threshold"
          inputMode="decimal"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleSave}
          className="alpha-action-button alpha-action-button-primary"
        >
          Apply
        </button>

        <button
          type="button"
          onClick={onReset}
          className="alpha-action-button"
        >
          Reset
        </button>
      </div>
    </div>
  )
}
