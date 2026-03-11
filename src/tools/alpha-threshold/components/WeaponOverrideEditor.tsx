import { useState } from 'react'
import type { WeaponOverride, WeaponRecord } from '../types'

type Props = {
  weapon: WeaponRecord
  override?: WeaponOverride
  onSave: (patch: WeaponOverride) => void
  onReset: () => void
}

export function WeaponOverrideEditor({
  weapon,
  override,
  onSave,
  onReset,
}: Props) {
  const [alpha, setAlpha] = useState(String(override?.alpha ?? weapon.alpha))
  const [burstDps, setBurstDps] = useState(
    String(override?.burstDps ?? weapon.burstDps)
  )
  const [speed, setSpeed] = useState(
    String(override?.speed ?? weapon.projectileSpeed)
  )

  function handleSave() {
    const nextAlpha = Number(alpha)
    const nextBurstDps = Number(burstDps)
    const nextSpeed = Number(speed)

    if (
      Number.isNaN(nextAlpha) ||
      Number.isNaN(nextBurstDps) ||
      Number.isNaN(nextSpeed)
    ) {
      return
    }

    onSave({
      alpha: nextAlpha,
      burstDps: nextBurstDps,
      speed: nextSpeed,
    })
  }

  return (
    <div className="alpha-inline-editor space-y-3">
      <div className="grid gap-2 md:grid-cols-3">
        <input
          value={alpha}
          onChange={(event) => setAlpha(event.target.value)}
          className="alpha-input"
          placeholder="Alpha"
          inputMode="decimal"
        />

        <input
          value={burstDps}
          onChange={(event) => setBurstDps(event.target.value)}
          className="alpha-input"
          placeholder="Burst DPS"
          inputMode="decimal"
        />

        <input
          value={speed}
          onChange={(event) => setSpeed(event.target.value)}
          className="alpha-input"
          placeholder="Projectile speed"
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
