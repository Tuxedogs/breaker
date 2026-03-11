import { WeaponSelector } from './WeaponSelector'
import type { ComparisonSlot, SlotTone, Weapon } from '../types'

type Props = {
  slots: ComparisonSlot[]
  tones: SlotTone[]
  weapons: Weapon[]
  onChange: (slotId: string, weaponName: string | null) => void
}

export function WeaponComparisonSlots({
  slots,
  tones,
  weapons,
  onChange,
}: Props) {
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {slots.map((slot, index) => (
        <section
          key={`${slot.id}-${slot.weaponName ?? 'empty'}-${weapons[0]?.type ?? 'none'}`}
          className="rounded-xl border border-white/10 bg-slate-950/30 p-3"
        >
          <WeaponSelector
            label={`Weapon ${index + 1}`}
            tone={tones[index] ?? 'cyan'}
            value={slot.weaponName}
            weapons={weapons}
            onChange={(weaponName) => onChange(slot.id, weaponName)}
          />
        </section>
      ))}
    </div>
  )
}
