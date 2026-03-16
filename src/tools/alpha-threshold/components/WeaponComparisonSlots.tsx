import { useMemo, useRef, useState } from 'react'
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

function getSlotLabel(slot: ComparisonSlot, index: number): string {
  if (slot.label) return slot.label
  if (slot.hardpointSize > 0) return `Weapon ${index + 1} · S${slot.hardpointSize}`
  return `Weapon ${index + 1}`
}

export function WeaponComparisonSlots({
  slots,
  weapons,
  onChange,
}: Props) {
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const slotElementRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const slotEntries = useMemo(
    () =>
      slots.map((slot, index) => {
        const selectedWeapon =
          weapons.find(
            (weapon) =>
              getWeaponKey(weapon) === slot.weaponKey &&
              (slot.hardpointSize <= 0 || weapon.size <= slot.hardpointSize)
          ) ?? null

        return {
          slot,
          index,
          slotLabel: getSlotLabel(slot, index),
          tone: SLOT_TONES[index] ?? 'cyan',
          selectedWeapon,
        }
      }),
    [slots, weapons]
  )

  const activeSlot = useMemo(
    () => slotEntries.find(({ slot }) => slot.id === activeSlotId) ?? null,
    [activeSlotId, slotEntries]
  )

  const compatibleWeapons = useMemo(() => {
    const maxSize = activeSlot?.slot.hardpointSize
    if (!maxSize || maxSize <= 0) return weapons
    return weapons.filter((weapon) => weapon.size <= maxSize)
  }, [activeSlot?.slot.hardpointSize, weapons])

  function openModal(slotId: string) {
    setActiveSlotId(slotId)
    setModalOpen(true)
  }

  function handleSlotSelect(slotId: string) {
    if (modalOpen) {
      setActiveSlotId(slotId)
      return
    }

    openModal(slotId)
  }

  if (slotEntries.length === 0) {
    return (
      <section className="alpha-slot-panel p-4 text-sm text-slate-300">
        No weapon slots configured.
      </section>
    )
  }

  return (
    <>
      <div className="grid gap-3">
        {slotEntries.map(({ slot, slotLabel, tone, selectedWeapon }) => {
          const isActive = modalOpen && slot.id === activeSlotId
          const wrapperClassName = [
            'alpha-weapon-slot-bridge',
            isActive ? 'alpha-weapon-slot-bridge-active' : '',
            isActive ? `alpha-weapon-slot-bridge-active-${tone}` : '',
          ]
            .filter(Boolean)
            .join(' ')

          if (selectedWeapon) {
            return (
              <div
                key={slot.id}
                ref={(element) => {
                  slotElementRefs.current[slot.id] = element
                }}
                className={wrapperClassName}
                data-alpha-weapon-slot="true"
              >
                <WeaponCard
                  label={slotLabel}
                  tone={tone}
                  weapon={selectedWeapon}
                  onSelect={() => handleSlotSelect(slot.id)}
                  onClear={() => onChange(slot.id, null)}
                />
              </div>
            )
          }

          return (
            <div
              key={slot.id}
              ref={(element) => {
                slotElementRefs.current[slot.id] = element
              }}
              className={wrapperClassName}
              data-alpha-weapon-slot="true"
            >
              <section className="alpha-slot-panel">
                <button
                  type="button"
                  onClick={() => handleSlotSelect(slot.id)}
                  className="alpha-slot-launch"
                >
                  <span className="alpha-control-label">{slotLabel}</span>
                  <span className="alpha-slot-launch-title">Select weapon</span>
                  <span className="alpha-slot-launch-copy">
                    Open the selector to assign a weapon to {slotLabel}.
                  </span>
                </button>
              </section>
            </div>
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
            damageType: selectedWeapon?.damageType ?? null,
            hardpointSize: slot.hardpointSize,
          }))}
          activeSlotId={activeSlotId}
          getSourceSlotElement={(slotId) =>
            slotElementRefs.current[slotId] ?? null
          }
          weapons={compatibleWeapons}
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
