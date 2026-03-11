import { useState } from 'react'
import { formatMetric } from '../lib/calculations'
import { WeaponOverrideEditor } from './WeaponOverrideEditor'
import type { SlotTone, Weapon, WeaponOverride } from '../types'

type Props = {
  label: string
  tone: SlotTone
  weapon: Weapon
  override?: WeaponOverride
  onSaveOverride: (patch: WeaponOverride) => void
  onResetOverride: () => void
}

const toneClassName: Record<SlotTone, string> = {
  cyan: 'border-cyan-300/25 bg-cyan-400/5 text-cyan-100',
  violet: 'border-violet-300/25 bg-violet-400/5 text-violet-100',
  amber: 'border-amber-300/25 bg-amber-400/5 text-amber-100',
  emerald: 'border-emerald-300/25 bg-emerald-400/5 text-emerald-100',
}

const toneDotClassName: Record<SlotTone, string> = {
  cyan: 'bg-cyan-300',
  violet: 'bg-violet-300',
  amber: 'bg-amber-300',
  emerald: 'bg-emerald-300',
}

export function WeaponCard({
  label,
  tone,
  weapon,
  override,
  onSaveOverride,
  onResetOverride,
}: Props) {
  const [editing, setEditing] = useState(false)

  return (
    <article className="alpha-weapon-card">
      <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
        <div className="space-y-2">
          <div
            className={[
              'alpha-chip items-center gap-2 py-1',
              toneClassName[tone],
            ].join(' ')}
          >
            <span
              aria-hidden
              className={[
                'h-2.5 w-2.5 rounded-full',
                toneDotClassName[tone],
              ].join(' ')}
            />
            {label}
          </div>
          <div>
            <h3 className="title-font text-lg leading-tight text-slate-50">
              {weapon.name}
            </h3>
            <p className="mt-1 text-xs uppercase tracking-[0.12em] text-slate-400">
              {weapon.size} / {weapon.type}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setEditing((prev) => !prev)}
          className="alpha-action-button"
        >
          {editing ? 'Close' : 'Edit'}
        </button>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2">
        <div className="alpha-metric-card">
          <dt className="alpha-stat-label">Alpha</dt>
          <dd className="alpha-stat-value">{formatMetric(weapon.alpha)}</dd>
        </div>
        <div className="alpha-metric-card">
          <dt className="alpha-stat-label">Burst DPS</dt>
          <dd className="alpha-stat-value">{formatMetric(weapon.burstDps)}</dd>
        </div>
        <div className="alpha-metric-card">
          <dt className="alpha-stat-label">Speed</dt>
          <dd className="alpha-stat-value">{formatMetric(weapon.speed)} m/s</dd>
        </div>
        <div className="alpha-metric-card">
          <dt className="alpha-stat-label">Color</dt>
          <dd className="alpha-stat-value">{label}</dd>
        </div>
      </dl>

      {editing ? (
        <WeaponOverrideEditor
          weapon={weapon}
          override={override}
          onSave={(patch) => {
            onSaveOverride(patch)
            setEditing(false)
          }}
          onReset={() => {
            onResetOverride()
            setEditing(false)
          }}
        />
      ) : null}
    </article>
  )
}
