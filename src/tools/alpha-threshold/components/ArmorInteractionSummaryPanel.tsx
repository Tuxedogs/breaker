import { useState } from 'react'
import type { FocusEvent, PointerEvent } from 'react'

import { estimateArmorInteraction, formatMetric } from '../lib/calculations'
import type { ArmorInteractionEstimate, SelectedWeaponComparison, Ship } from '../types'
import { HeatmapTooltip } from './HeatmapTooltip'

type Props = {
  ship: Ship
  selectedWeapon: SelectedWeaponComparison
  compact?: boolean
}

type TooltipState = {
  open: boolean
  x: number
  y: number
  title: string
  sectionTitle?: string
  lines: Array<{ label: string; value: string; tone?: 'immediate' | 'cyan' | 'danger' | 'amber' }>
}

function formatSourceLabel(source: ArmorInteractionEstimate['armorDamageStartsAtPercentSource']) {
  switch (source) {
    case 'observed':
      return 'Observed'
    case 'estimated':
      return 'Estimated'
    case 'threshold':
      return 'Threshold'
    default:
      return 'Unknown'
  }
}

function formatStateLabel(state: 'up' | 'down') {
  return state === 'up' ? 'Online' : 'Offline'
}

function getThresholdRatioLabel(ratio: number) {
  if (!Number.isFinite(ratio)) return 'Overkill'
  if (ratio >= 2) return 'Overkill'
  if (ratio >= 1.15) return 'Above'
  if (ratio >= 0.9) return 'Near'
  if (ratio >= 0.5) return 'Below'
  return 'Far Below'
}

function formatPassThroughLabel(value: { min: number; max: number } | undefined) {
  if (!value) return '100% / 100%'
  return `${Math.round(value.min * 100)}% / ${Math.round(value.max * 100)}%`
}

function formatArmorOnsetValue(estimate: ArmorInteractionEstimate) {
  if (estimate.armorDamageStartsAtPercent != null) {
    return `${Math.round(estimate.armorDamageStartsAtPercent)}%`
  }

  return estimate.damagesFreshArmor ? '100%' : 'Not Yet Calibrated'
}

function getArmorEffectivenessRating(estimate: ArmorInteractionEstimate) {
  if (estimate.damagesFreshArmor) {
    return estimate.thresholdRatio >= 2 ? 'High' : 'Medium'
  }

  if (estimate.armorDamageStartsAtPercent != null) {
    return estimate.armorDamageStartsAtPercent >= 70 ? 'Low' : 'Medium'
  }

  if (estimate.thresholdRatio >= 0.9) return 'Medium'
  return 'Low'
}

function formatResultSummary(estimate: ArmorInteractionEstimate) {
  if (estimate.damagesFreshArmor) {
    return 'Armor damage effective immediately.'
  }

  if (estimate.armorDamageStartsAtPercent != null) {
    return `Projectile defeated. Effective from ${Math.round(estimate.armorDamageStartsAtPercent)}%.`
  }

  return 'Onset not yet calibrated.'
}

function formatSourceBadgeLabel(source: ArmorInteractionEstimate['armorDamageStartsAtPercentSource']) {
  return formatSourceLabel(source)
}

function formatTooltipArmorInteraction(estimate: ArmorInteractionEstimate) {
  return [
    `Starts At: ${formatArmorOnsetValue(estimate)}`,
    `Source: ${formatSourceLabel(estimate.armorDamageStartsAtPercentSource)}`,
    `Confidence: ${estimate.confidence[0].toUpperCase()}${estimate.confidence.slice(1)}`,
  ].join('\n')
}

function formatTooltipCalculation(estimate: ArmorInteractionEstimate) {
  return [
    `Effective Armor Alpha: ${formatMetric(estimate.effectiveArmorAlpha)}`,
    `Threshold: ${formatMetric(estimate.deflectionThreshold)}`,
    `Ratio: ${Number.isFinite(estimate.thresholdRatio) ? estimate.thresholdRatio.toFixed(2) : 'Immediate'} (${getThresholdRatioLabel(estimate.thresholdRatio)})`,
  ].join('\n')
}

export function ArmorInteractionSummaryPanel({ ship, selectedWeapon, compact = false }: Props) {
  const [tooltipState, setTooltipState] = useState<TooltipState>({
    open: false,
    x: 0,
    y: 0,
    title: '',
    lines: [],
  })

  const shieldUpEstimate = estimateArmorInteraction(selectedWeapon.weapon, ship, 'up')
  const shieldDownEstimate = estimateArmorInteraction(selectedWeapon.weapon, ship, 'down')
  const activeChannel = shieldUpEstimate.damageChannel
  const activeShield = ship.defenseProfile?.shields
  const visibleStates: Array<'up' | 'down'> =
    selectedWeapon.weapon.damageType === 'ballistic' ? ['up', 'down'] : ['down']
  const familyClass =
    selectedWeapon.weapon.damageType === 'ballistic'
      ? 'alpha-armor-interaction-panel-ballistic'
      : 'alpha-armor-interaction-panel-energy'
  const layoutClass = compact
    ? 'alpha-armor-interaction-panel-compact'
    : 'alpha-armor-interaction-panel-full'

  function openTooltip(
    event: PointerEvent<HTMLButtonElement> | FocusEvent<HTMLButtonElement>,
    title: string,
    sectionTitle: string,
    lines: TooltipState['lines']
  ) {
    const rect = event.currentTarget.getBoundingClientRect()
    setTooltipState({
      open: true,
      x: Math.min(rect.left, window.innerWidth - 320),
      y: Math.max(16, rect.bottom + 12),
      title,
      sectionTitle,
      lines,
    })
  }

  function closeTooltip() {
    setTooltipState((current) => ({ ...current, open: false }))
  }

  function renderStateCard(estimate: ArmorInteractionEstimate, state: 'up' | 'down') {
    const isPrimaryState =
      selectedWeapon.weapon.damageType === 'ballistic' ? state === 'up' : state === 'down'
    const gradedForArmorOnly =
      state === 'up' &&
      !estimate.damagesFreshArmor &&
      shieldDownEstimate.damagesFreshArmor
    const toneClass = estimate.damagesFreshArmor
      ? 'alpha-armor-interaction-state-pass'
      : gradedForArmorOnly
        ? 'alpha-armor-interaction-state-neutral'
        : 'alpha-armor-interaction-state-hold'
    const effectivenessRating = getArmorEffectivenessRating(estimate)
    const activePassThrough =
      state === 'up'
        ? activeChannel === 'physical'
          ? activeShield?.passThrough.physical
          : activeShield?.passThrough.energy
        : null
    const armorOnsetBand = estimate.estimatedArmorOnsetBand
    const tooltipLines: TooltipState['lines'] =
      state === 'down'
        ? [
            {
              label: 'Armor Interaction',
              value: formatTooltipArmorInteraction(estimate),
              tone: estimate.damagesFreshArmor ? 'cyan' : 'amber',
            },
            {
              label: 'Calculation',
              value: formatTooltipCalculation(estimate),
            },
            {
              label: 'Shield State',
              value: 'Offline',
            },
          ]
        : [
            {
              label: 'Armor Interaction',
              value: formatTooltipArmorInteraction(estimate),
              tone: estimate.damagesFreshArmor ? 'cyan' : 'amber',
            },
            {
              label: 'Calculation',
              value: formatTooltipCalculation(estimate),
            },
            {
              label: 'Shield State',
              value: 'Online',
            },
            {
              label: 'Pass Through',
              value: formatPassThroughLabel(activePassThrough ?? undefined),
              tone: 'cyan',
            },
            ...(armorOnsetBand
              ? [{
                  label: 'Estimated Band',
                  value: `${armorOnsetBand[0]}-${armorOnsetBand[1]}%`,
                  tone: 'amber' as const,
                }]
              : []),
          ]

    return (
      <article
        key={state}
        className={`alpha-armor-interaction-state ${toneClass} ${isPrimaryState ? 'alpha-armor-interaction-state-primary' : 'alpha-armor-interaction-state-secondary'}`}
      >
        <header className="alpha-armor-interaction-state-head">
          <div className="alpha-armor-interaction-state-badges">
            <span className="alpha-armor-badge alpha-armor-badge-state">
              Shield State: {state === 'up' ? 'Up' : 'Down'}
            </span>
            <span className="alpha-armor-badge alpha-armor-badge-source">
              {formatSourceBadgeLabel(estimate.armorDamageStartsAtPercentSource)}
            </span>
            {selectedWeapon.weapon.damageType === 'ballistic' ? (
              <span className="alpha-armor-badge alpha-armor-badge-rating">
                {effectivenessRating}
              </span>
            ) : null}
          </div>

          <button
            type="button"
            className="alpha-armor-tooltip-trigger"
            aria-label={`Open ${formatStateLabel(state)} armor interaction details`}
            onPointerEnter={(event) =>
              openTooltip(
                event,
                `${selectedWeapon.weapon.name} vs ${ship.name.replaceAll('_', ' ')}`,
                `Shield ${formatStateLabel(state)}`,
                tooltipLines
              )
            }
            onPointerLeave={closeTooltip}
            onFocus={(event) =>
              openTooltip(
                event,
                `${selectedWeapon.weapon.name} vs ${ship.name.replaceAll('_', ' ')}`,
                `Shield ${formatStateLabel(state)}`,
                tooltipLines
              )
            }
            onBlur={closeTooltip}
          >
            Details
          </button>
        </header>

        <section className="alpha-armor-interaction-result">
          <div className="alpha-armor-interaction-result-head">
            <div>
              <p className="alpha-armor-interaction-result-label">Fresh Armor</p>
              <p className="alpha-armor-interaction-result-value">
                {estimate.damagesFreshArmor ? 'Yes' : 'No'}
              </p>
            </div>
            <div>
              <p className="alpha-armor-interaction-result-label">Effectiveness</p>
              <p className="alpha-armor-interaction-result-value">
                {effectivenessRating}
              </p>
            </div>
          </div>

          <p className="alpha-armor-interaction-summary-copy">
            {formatResultSummary(estimate)}
          </p>
        </section>

        <dl className="alpha-armor-interaction-grid">
          <div>
            <dt>Effective Armor Alpha</dt>
            <dd>{formatMetric(estimate.effectiveArmorAlpha)}</dd>
          </div>
          <div>
            <dt>Deflection Threshold</dt>
            <dd>{formatMetric(estimate.deflectionThreshold)}</dd>
          </div>
          <div>
            <dt>Threshold Ratio</dt>
            <dd>
              {Number.isFinite(estimate.thresholdRatio) ? estimate.thresholdRatio.toFixed(2) : 'Immediate'}{' '}
              <span className="alpha-armor-interaction-ratio-label">
                ({getThresholdRatioLabel(estimate.thresholdRatio)})
              </span>
            </dd>
          </div>
          <div>
            <dt>Confidence</dt>
            <dd>{estimate.confidence[0].toUpperCase()}{estimate.confidence.slice(1)}</dd>
          </div>
        </dl>

        {estimate.notes?.length ? (
          <p className="alpha-armor-interaction-note">
            {estimate.notes[0]}
          </p>
        ) : null}
      </article>
    )
  }

  return (
    <section className={`alpha-armor-interaction-panel ${familyClass} ${layoutClass}`}>
      <header className="alpha-armor-interaction-panel-head">
        <div>
          <p className="alpha-armor-interaction-eyebrow">{selectedWeapon.weapon.name}</p>
        </div>
      </header>

      <div className="alpha-armor-interaction-state-grid">
        {visibleStates.map((state) =>
          renderStateCard(state === 'up' ? shieldUpEstimate : shieldDownEstimate, state)
        )}
      </div>

      <HeatmapTooltip
        open={tooltipState.open}
        x={tooltipState.x}
        y={tooltipState.y}
        title={tooltipState.title}
        sectionTitle={tooltipState.sectionTitle}
        lines={tooltipState.lines}
      />
    </section>
  )
}
