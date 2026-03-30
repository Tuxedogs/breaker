import { useMemo, useState, type ReactNode } from 'react'

import { buildShipFlipCardModel } from '../lib/ships/shipFlipCardModel'
import type { Ship } from '../types'

type ShipFlipCardProps = {
  ship: Ship
  thumbnail: ReactNode
  eyebrow: string
  name: string
  roleLabel: string
}

export function ShipFlipCard({
  ship,
  thumbnail,
  eyebrow,
  name,
  roleLabel,
}: ShipFlipCardProps) {
  const [flipped, setFlipped] = useState(false)
  const model = useMemo(() => buildShipFlipCardModel(ship), [ship])

  const toggleFlip = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    setFlipped((value) => !value)
  }

  return (
    <>
      <div className="acm-ship-flip-bg" aria-hidden="true">
        {thumbnail}
        <div className="acm-ship-fill-scrim" />
      </div>

      <div className="acm-ship-flip-scene">
        <div
          className={[
            'acm-ship-flip-track',
            flipped ? 'acm-ship-flip-track--flipped' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <div className="acm-ship-flip-face acm-ship-flip-face--front">
            <div className="acm-ship-foreground acm-ship-flip-foreground">
              <button
                type="button"
                className="acm-ship-flip-toggle"
                onClick={toggleFlip}
                aria-expanded={flipped}
                aria-label="Show ship movement and rotation details"
              >
                Details
              </button>

              <header className="acm-ship-header acm-ship-flip-header">
                <div className="acm-ship-copy">
                  <p className="acm-ship-eyebrow">{eyebrow}</p>
                  <h3 className="acm-ship-name acm-ship-flip-title">{name}</h3>
                  <span className="acm-ship-name-role">{roleLabel}</span>
                </div>
              </header>

              <div className="acm-ship-flip-thresholds-wrap">
                <p className="acm-ship-flip-thresholds-heading">Thresholds</p>
                <div className="acm-ship-flip-thresholds" aria-label="Ship thresholds">
                  <div className="acm-ship-flip-threshold acm-ship-flip-threshold--energy">
                    <span className="acm-ship-flip-threshold-label">Energy</span>
                    <span className="acm-ship-flip-threshold-value">{model.energyThreshold}</span>
                  </div>
                  <div className="acm-ship-flip-threshold-gap" aria-hidden="true" />
                  <div className="acm-ship-flip-threshold acm-ship-flip-threshold--ballistic">
                    <span className="acm-ship-flip-threshold-label">Ballistic</span>
                    <span className="acm-ship-flip-threshold-value">{model.ballisticThreshold}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="acm-ship-flip-face acm-ship-flip-face--back">
            <div className="acm-ship-foreground acm-ship-flip-foreground acm-ship-flip-foreground--back">
              <button
                type="button"
                className="acm-ship-flip-toggle"
                onClick={toggleFlip}
                aria-expanded={flipped}
                aria-label="Return to ship summary"
              >
                Back
              </button>

              <div className="acm-ship-flip-back-body">
                <dl className="acm-ship-flip-durability" aria-label="Durability">
                  <div className="acm-ship-flip-durability-row">
                    <div className="acm-ship-flip-durability-item">
                      <dt className="acm-ship-flip-durability-label">Armor</dt>
                      <dd className="acm-ship-flip-durability-value">{model.armor}</dd>
                    </div>
                    <div className="acm-ship-flip-durability-gap" aria-hidden="true" />
                    <div className="acm-ship-flip-durability-item">
                      <dt className="acm-ship-flip-durability-label">Hull</dt>
                      <dd className="acm-ship-flip-durability-value">{model.hull}</dd>
                    </div>
                  </div>
                </dl>

                <section className="acm-ship-flip-section acm-ship-flip-section--movement" aria-label="Movement">
                  <div className="acm-ship-flip-move-grid" role="group">
                    <div className="acm-ship-flip-move-speeds">
                      <div className="acm-ship-flip-stat-row">
                        <span className="acm-ship-flip-stat-k">SCM fwd</span>
                        <span className="acm-ship-flip-stat-v">{model.scmForward}</span>
                      </div>
                      <div className="acm-ship-flip-stat-row">
                        <span className="acm-ship-flip-rot-boosted-label">Boosted</span>
                        <span className="acm-ship-flip-stat-v">{model.boostForward}</span>
                      </div>
                      <div className="acm-ship-flip-stat-row">
                        <span className="acm-ship-flip-stat-k">NAV</span>
                        <span className="acm-ship-flip-stat-v">{model.navSpeed}</span>
                      </div>
                    </div>
                    <div
                      className="acm-ship-flip-move-rot"
                      aria-label="Pitch, yaw, roll; boosted pitch, yaw, roll"
                    >
                      <div className="acm-ship-flip-rot-line">
                        <span className="acm-ship-flip-rot-pair">
                          <span className="acm-ship-flip-rot-k">P</span>
                          <span className="acm-ship-flip-rot-v">{model.pitch}</span>
                        </span>
                        <span className="acm-ship-flip-rot-pair">
                          <span className="acm-ship-flip-rot-k">Y</span>
                          <span className="acm-ship-flip-rot-v">{model.yaw}</span>
                        </span>
                        <span className="acm-ship-flip-rot-pair">
                          <span className="acm-ship-flip-rot-k">R</span>
                          <span className="acm-ship-flip-rot-v">{model.roll}</span>
                        </span>
                      </div>
                      <p className="acm-ship-flip-rot-boosted-label">Boosted</p>
                      <div className="acm-ship-flip-rot-line">
                        <span className="acm-ship-flip-rot-pair">
                          <span className="acm-ship-flip-rot-k">P</span>
                          <span className="acm-ship-flip-rot-v">{model.boostPitch}</span>
                        </span>
                        <span className="acm-ship-flip-rot-pair">
                          <span className="acm-ship-flip-rot-k">Y</span>
                          <span className="acm-ship-flip-rot-v">{model.boostYaw}</span>
                        </span>
                        <span className="acm-ship-flip-rot-pair">
                          <span className="acm-ship-flip-rot-k">R</span>
                          <span className="acm-ship-flip-rot-v">{model.boostRoll}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
