import { useState, type CSSProperties } from 'react'
import { formatEntityLabel } from '../lib/calculations'
import { ShipCascadeDropdown } from './ShipCascadeDropdown'
import type { Ship } from '../types'

type Props = {
  allShips: Ship[]
  victimSlotShipNames: Array<string | null>
  onVictimShipChange: (slotIndex: number, shipName: string | null) => void
  onClearAllShips: () => void
}

type CompareCard = {
  key: string
  manufacturer: string | null
  name: string | null
  imageSrc?: string
  imageAlt?: string
  armorHp?: number | null
  ballisticThreshold?: number | null
  energyThreshold?: number | null
  vitalHp?: number | null
  noiseCount?: number | null
  decoyCount?: number | null
  scmSpeed?: number | null
  navSpeed?: number | null
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
  allShips,
  victimSlotShipNames,
  onVictimShipChange,
  onClearAllShips,
}: Props) {
  const [openPicker, setOpenPicker] = useState<{ index: number; x: number; y: number } | null>(null)

  const cards: CompareCard[] = Array.from({ length: 3 }, (_, index) => {
    const selectedShipKey = victimSlotShipNames[index]
    const ship = selectedShipKey
      ? allShips.find((candidate) => `${candidate.manufacturer}::${candidate.name}` === selectedShipKey) ?? null
      : null

    return {
      key: `slot-${index + 1}`,
      manufacturer: ship?.manufacturer ?? null,
      name: ship?.name ?? null,
      imageSrc: ship?.imageSrc,
      imageAlt: ship?.imageAlt,
      armorHp: ship?.armorHp ?? null,
      ballisticThreshold: ship?.ballisticThreshold ?? null,
      energyThreshold: ship?.energyThreshold ?? null,
      vitalHp: ship?.vitalHp ?? null,
      noiseCount: ship?.noiseCount ?? null,
      decoyCount: ship?.decoyCount ?? null,
      scmSpeed: ship?.scmSpeed ?? null,
      navSpeed: ship?.navSpeed ?? null,
    }
  })

  return (
    <section className="alpha-compare-strip" aria-label="Selected ships">
      <header className="alpha-compare-strip-head">
        <p className="page-kicker">Selected Ships</p>
        <h2 className="surface-title mt-3">Victim Ship</h2>
        <p className="mt-3">
          <button
            type="button"
            onClick={onClearAllShips}
            className="alpha-action-button"
          >
            Clear All
          </button>
        </p>
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
                  card.imageSrc ? 'alpha-compare-ship-card-has-image' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={
                  card.imageSrc
                    ? ({
                        '--alpha-compare-ship-bg': `url("${card.imageSrc}")`,
                      } as CSSProperties)
                    : undefined
                }
              >
                <ShipCascadeDropdown
                  ships={allShips}
                  onChange={(shipKey) => onVictimShipChange(index, shipKey)}
                  open={openPicker?.index === index}
                  menuPosition={openPicker?.index === index ? { x: openPicker.x, y: openPicker.y } : null}
                  onOpenChange={(nextOpen) => {
                    setOpenPicker(nextOpen ? openPicker : null)
                  }}
                  ariaLabel={`Victim slot ${slotLabel} ship selector`}
                />
                <p className="alpha-compare-ship-slot">{slotLabel}</p>
                <ShipArt imageSrc={card.imageSrc} imageAlt={card.imageAlt} />
                <div className="alpha-compare-ship-copy">
                  {card.name ? (
                    <>
                      <p className="alpha-compare-ship-make">
                        {card.manufacturer ?? 'Awaiting selection'}
                      </p>
                      <h3 className="alpha-compare-ship-name">
                        {formatEntityLabel(card.name)}
                      </h3>
                      <dl className="alpha-compare-ship-stats">
                        <div className="alpha-compare-ship-stat">
                          <dt>Armor HP</dt>
                          <dd>{formatValue(card.armorHp)}</dd>
                        </div>
                        <div className="alpha-compare-ship-stat">
                          <dt>Deflection</dt>
                          <dd>
                            <span className="alpha-compare-ship-stat-energy">E {formatValue(card.energyThreshold)}</span>{' '}
                            <span className="alpha-compare-ship-stat-ballistic">B {formatValue(card.ballisticThreshold)}</span>
                          </dd>
                        </div>
                        <div className="alpha-compare-ship-stat">
                          <dt>Vital HP</dt>
                          <dd>{formatValue(card.vitalHp)}</dd>
                        </div>
                        <div className="alpha-compare-ship-stat">
                          <dt>Noise/Decoy</dt>
                          <dd>{formatRatio(card.noiseCount, card.decoyCount)}</dd>
                        </div>
                        <div className="alpha-compare-ship-stat">
                          <dt>SCM Speed</dt>
                          <dd>{formatValue(card.scmSpeed)}</dd>
                        </div>
                        <div className="alpha-compare-ship-stat">
                          <dt>Nav Speed</dt>
                          <dd>{formatValue(card.navSpeed)}</dd>
                        </div>
                      </dl>
                    </>
                  ) : (
                    <>
                      <p className="alpha-compare-ship-make">
                        {card.manufacturer ?? 'Awaiting selection'}
                      </p>
                      <p className="mt-3">
                        <button
                          type="button"
                          className="alpha-action-button"
                          onClick={(event) => {
                            event.stopPropagation()
                            const articleElement = event.currentTarget.closest('.alpha-compare-ship-card')
                            const articleRect = articleElement?.getBoundingClientRect()
                            const triggerRect = event.currentTarget.getBoundingClientRect()

                            if (!articleRect) return

                            setOpenPicker({
                              index,
                              x: triggerRect.left - articleRect.left,
                              y: triggerRect.bottom - articleRect.top + 6,
                            })
                          }}
                          data-ship-picker-ignore="true"
                        >
                          Select ship
                        </button>
                      </p>
                    </>
                  )}
                  {card.name ? (
                    <p className="mt-3">
                      <button
                        type="button"
                        onClick={() => onVictimShipChange(index, null)}
                        className="alpha-action-button"
                        data-ship-picker-ignore="true"
                      >
                        Clear
                      </button>
                    </p>
                  ) : null}
                </div>
              </article>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function ShipArt({ imageSrc, imageAlt }: { imageSrc?: string; imageAlt?: string }) {
  if (!imageSrc) {
    return <ShipPlaceholderIcon />
  }

  return <span className="sr-only">{imageAlt ?? ''}</span>
}

function formatValue(value: number | null | undefined): string {
  return typeof value === 'number' ? `${Math.round(value)}` : '--'
}

function formatRatio(left: number | null | undefined, right: number | null | undefined): string {
  if (typeof left !== 'number' || typeof right !== 'number') {
    return '--/--'
  }

  return `${left}/${right}`
}
