import { getWeaponKey } from '../lib/calculations'
import { WeaponCard } from './WeaponCard'
import { WeaponSelector } from './WeaponSelector'
import type {
  ComparisonSlot,
  SlotTone,
  Weapon,
} from '../types'

type Props = {
  slots: ComparisonSlot[]
  weapons: Weapon[]
  onChange: (slotId: string, weaponKey: string | null) => void
}

const SLOT_TONES: SlotTone[] = ['cyan', 'violet', 'amber', 'emerald']

export function WeaponComparisonSlots({
  slots,
  weapons,
  onChange,
}: Props) {
  return (
    <div className="grid gap-3">
      {slots.map((slot, index) => {
        const selectedWeapon =
          weapons.find((weapon) => getWeaponKey(weapon) === slot.weaponKey) ??
          null
        const slotLabel = `W${index + 1}`
        const tone = SLOT_TONES[index] ?? 'cyan'

        if (selectedWeapon) {
          return (
            <WeaponCard
              key={slot.id}
              label={slotLabel}
              tone={tone}
              weapon={selectedWeapon}
              onClear={() => onChange(slot.id, null)}
            />
          )
        }

        return (
          <section key={slot.id} className="alpha-slot-panel">
            <WeaponSelector
              label={slotLabel}
              value={slot.weaponKey}
              weapons={weapons}
              onChange={(weaponKey) => onChange(slot.id, weaponKey)}
            />
          </section>
        )
      })}
    </div>
  )
}
