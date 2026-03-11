import { WeaponSelector } from './WeaponSelector'
import type { ComparisonSlot, Weapon } from '../types'

type Props = {
  slots: ComparisonSlot[]
  weapons: Weapon[]
  onChange: (slotId: string, weaponKey: string | null) => void
}

export function WeaponComparisonSlots({
  slots,
  weapons,
  onChange,
}: Props) {
  return (
    <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-4">
      {slots.map((slot, index) => (
        <section key={slot.id} className="alpha-slot-panel">
          <WeaponSelector
            label={`Weapon ${index + 1}`}
            value={slot.weaponKey}
            weapons={weapons}
            onChange={(weaponKey) => onChange(slot.id, weaponKey)}
          />
        </section>
      ))}
    </div>
  )
}
