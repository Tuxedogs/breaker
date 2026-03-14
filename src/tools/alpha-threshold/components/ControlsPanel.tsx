import { WeaponComparisonSlots } from './WeaponComparisonSlots'
import type {
  ComparisonSlot,
  WeaponRecord,
} from '../types'

type Props = {
  slots: ComparisonSlot[]
  weapons: WeaponRecord[]
  onSlotChange: (slotId: string, weaponKey: string | null) => void
}

export function ControlsPanel({
  slots,
  weapons,
  onSlotChange,
}: Props) {
  return (
    <section aria-label="Alpha threshold controls">
      <WeaponComparisonSlots
        slots={slots}
        weapons={weapons}
        onChange={onSlotChange}
      />
    </section>
  )
}
