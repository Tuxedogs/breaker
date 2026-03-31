import { useState } from 'react'

import { estimateArmorInteraction, formatEntityLabel } from '../../lib/calculations'
import { getShipThumbnailCandidates } from '../../lib/ships/thumbnail'
import type {
  ArmorInteractionEstimate,
  DefenseShieldState,
  SelectedWeaponComparison,
  Ship,
} from '../../types'

type Props = {
  ships: Ship[]
  selectedWeapons: SelectedWeaponComparison[]
  shieldMode: DefenseShieldState
  onClearShipAt?: (slotIndex: number) => void
}

function isPlaceholderShip(ship: Ship) {
  return ship.name === '' && ship.manufacturer === ''
}

function isPlaceholderWeapon(selection: SelectedWeaponComparison) {
  return selection.weapon.name === '' && selection.weapon.weaponClass === ''
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function getEffectivePenetrationSummaryColor(pct: number): string {
  const p = Math.max(0, Math.min(100, Math.round(pct)))

  if (p >= 100) return 'rgb(74 222 128)'
  if (p >= 75) {
    const t = (p - 75) / 24
    return `hsl(${lerp(43, 52, t)} ${lerp(86, 92, t)}% ${lerp(46, 56, t)}%)`
  }
  if (p >= 50) {
    const t = (p - 50) / 25
    return `hsl(${lerp(26, 45, t)} ${lerp(90, 86, t)}% ${lerp(48, 46, t)}%)`
  }
  if (p >= 1) {
    const t = (p - 1) / 48
    return `hsl(${lerp(0, 22, t)} ${lerp(62, 88, t)}% ${lerp(28, 48, t)}%)`
  }
  return 'hsl(0 58% 28%)'
}

type MobileTooltipLine = {
  label: string
  value: string
  tone?: 'cyan'
  labelStyle?: 'shieldGated'
}

function getEstimateEffectivePct(estimate: ArmorInteractionEstimate): number {
  return Math.round(
    estimate.damagesFreshArmor || estimate.armorDamageStartsAtPercent === 100
      ? 100
      : estimate.armorDamageStartsAtPercent ?? 0
  )
}

function getMobileComparisonPct(
  damageType: SelectedWeaponComparison['weapon']['damageType'],
  shieldMode: DefenseShieldState,
  effectivePct: number,
  shieldsDownEffectivePct: number
): number {
  if (shieldMode === 'up' && damageType === 'energy') return shieldsDownEffectivePct
  return effectivePct
}

function capitalizeConfidence(confidence: ArmorInteractionEstimate['confidence']): string {
  return `${confidence.charAt(0).toUpperCase()}${confidence.slice(1)}`
}

function buildMobileTooltipLines(
  estimate: ArmorInteractionEstimate,
  damageType?: SelectedWeaponComparison['weapon']['damageType'],
  options?: {
    shieldMode?: DefenseShieldState
    shieldsDownEffectivePct?: number
    showBlueLegend?: boolean
    blueLegendLabel?: string
  }
): MobileTooltipLine[] {
  const notes = estimate.notes ?? []
  const lines: MobileTooltipLine[] = []

  if (
    options?.shieldMode === 'up' &&
    damageType === 'energy' &&
    options.shieldsDownEffectivePct != null
  ) {
    lines.push({
      label: options.blueLegendLabel ?? 'Blue',
      value: 'Blue means a shield face must be downed before that E rating applies to armor.',
      tone: 'cyan',
      labelStyle: 'shieldGated',
    })
  } else if (options?.showBlueLegend) {
    lines.push({
      label: options.blueLegendLabel ?? 'Blue',
      value: 'A shield face must be down before this E rating is applied to armor values.',
      tone: 'cyan',
      labelStyle: 'shieldGated',
    })
  }

  lines.push({
    label: 'Confidence',
    value: capitalizeConfidence(estimate.confidence),
  })

  lines.push({
    label: 'Notes',
    value: notes.length > 0 ? notes.join('\n') : '—',
  })

  return lines
}

export function AlphaMobileResultsOnly({
  ships,
  selectedWeapons,
  shieldMode,
  onClearShipAt,
}: Props) {
  const [expandedShipKeys, setExpandedShipKeys] = useState<Record<string, boolean>>({})

  return (
    <section className="alpha-mobile-results" aria-label="Mobile comparison results">
      <div className="alpha-mobile-result-list">
        {ships.map((ship, shipIndex) => {
          if (isPlaceholderShip(ship)) return null

          const shipThumb = getShipThumbnailCandidates(ship)[0]
          const shipKey = `${ship.id}-${shipIndex}`
          const detailsOpen = expandedShipKeys[shipKey] ?? false
          const mobileWeaponEvaluations = selectedWeapons
            .filter((selection) => !isPlaceholderWeapon(selection))
            .map((selection) => {
              const estimate = estimateArmorInteraction(selection.weapon, ship, shieldMode)
              const shieldsDownEstimate = estimateArmorInteraction(selection.weapon, ship, 'down')
              const effectivePct = getEstimateEffectivePct(estimate)
              const shieldsDownEffectivePct = getEstimateEffectivePct(shieldsDownEstimate)
              const comparisonPct = getMobileComparisonPct(
                selection.weapon.damageType,
                shieldMode,
                effectivePct,
                shieldsDownEffectivePct
              )

              return {
                selection,
                estimate,
                effectivePct,
                shieldsDownEffectivePct,
                comparisonPct,
              }
            })
          const lowestBlueShieldSelection =
            shieldMode === 'up'
              ? mobileWeaponEvaluations
                  .filter((entry) => entry.selection.weapon.damageType === 'energy')
                  .sort((a, b) => a.shieldsDownEffectivePct - b.shieldsDownEffectivePct)[0]
              : undefined
          const hasBlueShieldWeapon = Boolean(lowestBlueShieldSelection)
          const blueLegendLabel = lowestBlueShieldSelection
            ? `E${lowestBlueShieldSelection.shieldsDownEffectivePct}`
            : undefined
          const mobileTooltipSelection = mobileWeaponEvaluations.sort(
            (a, b) => a.comparisonPct - b.comparisonPct
          )[0]

          return (
            <article key={`mobile-result-${ship.id}-${shipIndex}`} className="alpha-mobile-result-card">
              <div className="alpha-mobile-result-media">
                <img src={shipThumb.src} alt="" loading="lazy" />
                <div className="alpha-mobile-result-media-header">
                  <div className="alpha-mobile-result-media-title">
                    <h3>{formatEntityLabel(ship.name)}</h3>
                    <p>
                      {formatEntityLabel(ship.manufacturer)} · {formatEntityLabel(ship.role ?? 'Utility')}
                    </p>
                  </div>
                </div>
                <div className="alpha-mobile-result-media-copy">
                  <div className="alpha-mobile-result-overlay-list">
                    {selectedWeapons.map((selection) => {
                      if (isPlaceholderWeapon(selection)) return null
                      const estimate = estimateArmorInteraction(selection.weapon, ship, shieldMode)
                      const shieldsDownEstimate = estimateArmorInteraction(selection.weapon, ship, 'down')
                      const effectivePct = getEstimateEffectivePct(estimate)
                      const usesBlueShieldRating =
                        shieldMode === 'up' && selection.weapon.damageType === 'energy'
                      const comparisonPct = getMobileComparisonPct(
                        selection.weapon.damageType,
                        shieldMode,
                        effectivePct,
                        getEstimateEffectivePct(shieldsDownEstimate)
                      )

                      return (
                        <div key={`${ship.id}-${selection.slotId}`} className="alpha-mobile-result-overlay-row">
                          <p className="alpha-mobile-result-weapon">{formatEntityLabel(selection.weapon.name)}</p>
                          <p
                            className={[
                              'alpha-mobile-result-stats',
                              usesBlueShieldRating ? 'alpha-mobile-result-stats--shield-gated' : '',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                            style={{
                              color: usesBlueShieldRating
                                ? undefined
                                : getEffectivePenetrationSummaryColor(comparisonPct),
                            }}
                          >
                            <span>E{comparisonPct}</span>
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </div>
                <div className="alpha-mobile-result-actions">
                  <button
                    type="button"
                    className="alpha-mobile-result-action alpha-mobile-result-action--details"
                    onClick={() =>
                      setExpandedShipKeys((current) => ({
                        ...current,
                        [shipKey]: !detailsOpen,
                      }))
                    }
                    aria-expanded={detailsOpen}
                    aria-controls={`alpha-mobile-result-details-${shipKey}`}
                  >
                    {detailsOpen ? 'Back' : 'Details'}
                  </button>
                  <button
                    type="button"
                    className="alpha-mobile-result-action alpha-mobile-result-action--clear"
                    onClick={() => onClearShipAt?.(shipIndex)}
                    aria-label={`Clear ${formatEntityLabel(ship.name)} from this ship slot`}
                  >
                    Clear
                  </button>
                </div>
              </div>
              {detailsOpen ? (
                <div
                  id={`alpha-mobile-result-details-${shipKey}`}
                  className="alpha-mobile-result-details"
                  aria-label={`${formatEntityLabel(ship.name)} details`}
                >
                  {mobileTooltipSelection ? (
                    <div className="alpha-mobile-result-tooltip-list">
                      <article
                        key={`mobile-tooltip-${ship.id}-${mobileTooltipSelection.selection.slotId}`}
                        className="alpha-mobile-result-tooltip-card"
                      >
                        <p className="alpha-mobile-result-tooltip-title">
                          {formatEntityLabel(mobileTooltipSelection.selection.weapon.name)}
                        </p>
                        <div className="alpha-mobile-result-tooltip-hero">
                          <div className="alpha-mobile-result-tooltip-hero-head">
                            <div className="alpha-mobile-result-tooltip-hero-metric">
                              <span className="alpha-mobile-result-tooltip-hero-label">Rating</span>
                              <span
                                className="alpha-mobile-result-tooltip-hero-value"
                                style={{
                                  color: getEffectivePenetrationSummaryColor(
                                    mobileTooltipSelection.comparisonPct
                                  ),
                                }}
                              >
                                E{mobileTooltipSelection.comparisonPct}
                              </span>
                            </div>
                            <div className="alpha-mobile-result-tooltip-hero-metric alpha-mobile-result-tooltip-hero-metric-right">
                              <span className="alpha-mobile-result-tooltip-hero-label">Effective</span>
                              <span
                                className="alpha-mobile-result-tooltip-hero-value"
                                style={{
                                  color: getEffectivePenetrationSummaryColor(
                                    mobileTooltipSelection.comparisonPct
                                  ),
                                }}
                              >
                                {mobileTooltipSelection.comparisonPct}%
                              </span>
                            </div>
                          </div>
                          <p className="alpha-mobile-result-tooltip-hero-copy">
                            You only apply damage when the enemy ship armor is below this number in %.
                          </p>
                        </div>
                        <dl className="alpha-mobile-result-tooltip-rows">
                          {buildMobileTooltipLines(
                            mobileTooltipSelection.estimate,
                            mobileTooltipSelection.selection.weapon.damageType,
                            {
                              shieldMode,
                              shieldsDownEffectivePct: mobileTooltipSelection.shieldsDownEffectivePct,
                              showBlueLegend: hasBlueShieldWeapon,
                              blueLegendLabel,
                            }
                          ).map((line) => (
                            <div
                              key={`${mobileTooltipSelection.selection.slotId}-${line.label}`}
                              className="alpha-mobile-result-tooltip-row"
                            >
                              <dt
                                className={[
                                  line.labelStyle === 'shieldGated'
                                    ? 'alpha-mobile-result-stats alpha-mobile-result-stats--shield-gated'
                                    : '',
                                ]
                                  .filter(Boolean)
                                  .join(' ')}
                              >
                                {line.label}
                              </dt>
                              <dd>
                                <span
                                  className={[
                                    'alpha-mobile-result-tooltip-row-copy',
                                    line.tone ? `alpha-mobile-result-tooltip-row-copy--${line.tone}` : '',
                                  ]
                                    .filter(Boolean)
                                    .join(' ')}
                                >
                                  {line.value}
                                </span>
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </article>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </article>
          )
        })}
      </div>
    </section>
  )
}
