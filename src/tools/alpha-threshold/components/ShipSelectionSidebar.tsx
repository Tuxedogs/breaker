import { formatEntityLabel, formatMetric } from '../lib/calculations'
import { ShipCascadeDropdown } from './ShipCascadeDropdown'
import type {
  Ship,
  ShipHardpointGroup,
} from '../types'
import type { ReactNode } from 'react'

type Props = {
  attackerShip: Ship | null
  attackerOptions: Ship[]
  attackerHardpointGroups: ShipHardpointGroup[]
  mobileOpen: boolean
  onAttackerShipChange: (shipName: string | null) => void
  children?: ReactNode
}

export function ShipSelectionSidebar({
  attackerShip,
  attackerOptions,
  attackerHardpointGroups,
  mobileOpen,
  onAttackerShipChange,
  children,
}: Props) {
  return (
    <aside
      className={[
        'alpha-sidebar',
        mobileOpen ? 'block' : 'hidden',
        'lg:block',
      ].join(' ')}
    >
      <div className="alpha-sidebar-inner">
        <section className="alpha-sidebar-attacker-section">
          <header>
            <p className="page-kicker">Attacker</p>
            <h2 className="surface-title mt-3">Attacking Ship</h2>
          </header>

          <article className="alpha-attacker-panel">
            <figure className="alpha-attacker-image" aria-hidden="true">
              {attackerShip ? formatEntityLabel(attackerShip.name).slice(0, 2) : '??'}
            </figure>
            <div className="alpha-attacker-copy">
              <p className="alpha-ship-option-meta">
                {attackerShip ? formatEntityLabel(attackerShip.manufacturer) : 'No ship selected'}
              </p>
              <h3 className="alpha-compare-ship-name">
                {attackerShip ? formatEntityLabel(attackerShip.name) : 'Awaiting attacker'}
              </h3>
              <ul className="alpha-attacker-stats" aria-label="Attacker thresholds and hull">
                <li>HP {formatMetric(attackerShip?.health ?? 0)}</li>
                <li>B {formatMetric(attackerShip?.ballisticThreshold ?? 0)}</li>
                <li>E {formatMetric(attackerShip?.energyThreshold ?? 0)}</li>
              </ul>
            </div>
          </article>

          <label className="space-y-2">
            <span className="alpha-control-label">Select attacker</span>
            <ShipCascadeDropdown
              ships={attackerOptions}
              selectedShipName={attackerShip?.name ?? null}
              onChange={onAttackerShipChange}
              placeholder="Select Ship"
            />
          </label>

          <section>
            <p className="alpha-control-label">Hardpoint groups</p>
            <ul className="alpha-attacker-hardpoints" aria-label="Attacker hardpoint groups">
              {attackerHardpointGroups.map((group) => (
                <li key={group.id} className="alpha-chip alpha-chip-muted">
                  {group.label}
                </li>
              ))}
            </ul>
          </section>
        </section>

        {children ? (
          <section className="alpha-sidebar-merged-section">
            {children}
          </section>
        ) : null}
      </div>
    </aside>
  )
}
