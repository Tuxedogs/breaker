import { formatEntityLabel } from '../lib/calculations'
import { WeaponComparisonSlots } from './WeaponComparisonSlots'
import type {
  AttackerHardpointProfile,
  ComparisonSlot,
  Ship,
  WeaponRecord,
} from '../types'

type Props = {
  attackerShipName: string
  attackerProfile: AttackerHardpointProfile
  ships: Ship[]
  slots: ComparisonSlot[]
  weapons: WeaponRecord[]
  onAttackerShipChange: (shipName: string) => void
  onSlotChange: (slotId: string, weaponKey: string | null) => void
}

export function ControlsPanel({
  attackerShipName,
  attackerProfile,
  ships,
  slots,
  weapons,
  onAttackerShipChange,
  onSlotChange,
}: Props) {
  return (
    <div aria-label="Alpha threshold controls" className="space-y-3">
      <section className="alpha-slot-panel p-4">
        <label htmlFor="alpha-attacker-ship" className="alpha-control-label block">
          Attacker ship
        </label>
        <select
          id="alpha-attacker-ship"
          value={attackerShipName}
          onChange={(event) => onAttackerShipChange(event.target.value)}
          className="alpha-input mt-2"
        >
          {ships.map((ship) => (
            <option key={ship.name} value={ship.name}>
              {ship.manufacturer} {formatEntityLabel(ship.name)}
            </option>
          ))}
        </select>
        <p className="mt-2 text-xs text-slate-400">
          Pilot: {attackerProfile.pilotHardpointSize ? `S${attackerProfile.pilotHardpointSize}` : 'N/A'} ·
          Turret: {attackerProfile.turretHardpointSize ? ` S${attackerProfile.turretHardpointSize}` : ' N/A'}
        </p>
      </section>

      <WeaponComparisonSlots
        slots={slots}
        weapons={weapons}
        onChange={onSlotChange}
      />
    </div>
  )
}
