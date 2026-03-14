import { useMemo, useState } from 'react'
import { getWeaponKey } from '../lib/calculations'
import { WeaponCard } from './WeaponCard'
import { WeaponSelector } from './WeaponSelector'
import type {
  ComparisonSlot,
  SlotTone,
  WeaponRecord,
} from '../types'

type Props = {
  slots: ComparisonSlot[]
  weapons: WeaponRecord[]
  onChange: (slotId: string, weaponKey: string | null) => void
}

const SLOT_TONES: SlotTone[] = ['cyan', 'violet', 'amber', 'emerald']

export function WeaponComparisonSlots({
  slots,
  weapons,
  onChange,
}: Props) {
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const slotEntries = useMemo(
    () =>
      slots.map((slot, index) => {
        const selectedWeapon =
          weapons.find(
            (weapon) =>
              getWeaponKey(weapon) === slot.weaponKey &&
              weapon.size === slot.hardpointSize
          ) ?? null

        return {
          slot,
          index,
          slotLabel: `${slot.operator === 'pilot' ? 'Pilot' : 'Turret'} S${slot.hardpointSize}`,
          tone: SLOT_TONES[index] ?? 'cyan',
          selectedWeapon,
        }
      }),
    [slots, weapons]
  )

  function openModal(slotId: string) {
    setActiveSlotId(slotId)
    setModalOpen(true)
  }

  if (slotEntries.length === 0) {
    return (
      <section className="alpha-slot-panel p-4 text-sm text-slate-300">
        No pilot or turret hardpoints detected for this attacker profile.
      </section>
    )
  }

  return (
    <>
      <div className="grid gap-3">
        {slotEntries.map(({ slot, slotLabel, tone, selectedWeapon }) => {
          if (selectedWeapon) {
            return (
              <WeaponCard
                key={slot.id}
                label={slotLabel}
                tone={tone}
                weapon={selectedWeapon}
                onSelect={() => openModal(slot.id)}
                onClear={() => onChange(slot.id, null)}
              />
            )
          }

          return (
            <section key={slot.id} className="alpha-slot-panel">
              <button
                type="button"
                onClick={() => openModal(slot.id)}
                className="alpha-slot-launch"
              >
                <span className="alpha-control-label">{slotLabel}</span>
                <span className="alpha-slot-launch-title">Select weapon</span>
                <span className="alpha-slot-launch-copy">
                  Open the selector to assign a weapon to {slotLabel}.
                </span>
              </button>
            </section>
          )
        })}
      </div>

      {modalOpen && slotEntries.length > 0 ? (
        <WeaponSelector
          open={modalOpen}
          slots={slotEntries.map(({ slot, slotLabel, tone, selectedWeapon }) => ({
            id: slot.id,
            label: slotLabel,
            tone,
            weaponKey: slot.weaponKey,
            weaponName: selectedWeapon?.name ?? null,
            weaponClass: selectedWeapon?.weaponClass ?? null,
            hardpointSize: slot.hardpointSize,
          }))}
          activeSlotId={activeSlotId}
          weapons={weapons}
          onActiveSlotChange={setActiveSlotId}
          onAssignWeapon={(slotId, weaponKey) => onChange(slotId, weaponKey)}
          onClearSlot={(slotId) => onChange(slotId, null)}
          onClearAllSlots={() => {
            slotEntries.forEach(({ slot }) => onChange(slot.id, null))
            setActiveSlotId(slotEntries[0]?.slot.id ?? null)
          }}
          onClose={() => setModalOpen(false)}
        />
      ) : null}
    </>
  )
}
