import { formatEntityLabel } from '../lib/calculations'
import { ShipCascadeDropdown } from './ShipCascadeDropdown'
import type { SelectedShipResult, Ship } from '../types'

type Props = {
  shipResults: SelectedShipResult[]
  allShips: Ship[]
  victimSlotShipNames: Array<string | null>
  onVictimShipChange: (slotIndex: number, shipName: string | null) => void
}

type CompareCard = {
  key: string
  manufacturer: string | null
  name: string | null
}

function ShipPlaceholderIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 64 64"
      className="alpha-compare-ship-art"
    >
      <path
        d="M32 6l10 14v15l-10 23-10-23V20L32 6z"
        fill="currentColor"
        opacity="0.9"
      />
      <path
        d="M22 24L10 34v6l12-4M42 24l12 10v6l-12-4"
        fill="currentColor"
        opacity="0.55"
      />
      <path d="M29 18h6v12h-6z" fill="currentColor" opacity="0.45" />
    </svg>
  )
}

export function CompareShipStrip({
  shipResults,
  allShips,
  victimSlotShipNames,
  onVictimShipChange,
}: Props) {
  const cards: CompareCard[] = Array.from({ length: 3 }, (_, index) => {
    const selectedName = victimSlotShipNames[index]
    const ship =
      (selectedName
        ? allShips.find((candidate) => candidate.name === selectedName)
        : null) ?? shipResults[index]?.ship

    return {
      key: ship?.name ?? `placeholder-${index + 1}`,
      manufacturer: ship?.manufacturer ?? null,
      name: ship?.name ?? null,
    }
  })

  return (
    <section className="alpha-compare-strip" aria-label="Selected ships">
      <header className="alpha-compare-strip-head">
        <p className="page-kicker">Selected Ships</p>
        <h2 className="surface-title mt-3">Victim Ship</h2>
      </header>

      <ul className="alpha-compare-strip-grid" aria-label="Victim ship slots">
        {cards.map((card, index) => {
          const slotLabel = `${index + 1}`
          const hasShip = Boolean(card.name)

          return (
            <li key={card.key}>
              <article
                className={[
                  'alpha-compare-ship-card',
                  hasShip ? 'alpha-compare-ship-card-active' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <p className="alpha-compare-ship-slot">{slotLabel}</p>
                <ShipPlaceholderIcon />
                <div className="alpha-compare-ship-copy">
                  <p className="alpha-compare-ship-make">
                    {card.manufacturer ?? 'Awaiting selection'}
                  </p>
                  <h3 className="alpha-compare-ship-name">
                    {card.name ? formatEntityLabel(card.name) : 'Select ship'}
                  </h3>
                  <section className="alpha-compare-ship-picker" aria-label={`Victim slot ${slotLabel}`}>
                    <ShipCascadeDropdown
                      ships={allShips}
                      selectedShipName={card.name}
                      onChange={(shipName) => onVictimShipChange(index, shipName)}
                      placeholder="Select Ship"
                    />
                  </section>
                </div>
              </article>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
