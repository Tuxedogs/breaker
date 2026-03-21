import { useState } from 'react'
import type { FocusEvent, PointerEvent } from 'react'

import { estimateArmorInteraction, formatMetric } from '../lib/calculations'
import type { ArmorInteractionEstimate, SelectedWeaponComparison, Ship } from '../types'
import { HeatmapTooltip } from './HeatmapTooltip'

type Props = {
  ship: Ship
  selectedWeapon: SelectedWeaponComparison
  compact?: boolean
  hideWeaponHeader?: boolean
  highlighted?: boolean
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

function getThresholdRatioToneClass(ratio: number) {
  return getThresholdRatioLabel(ratio) === 'Overkill'
    ? 'alpha-armor-interaction-ratio-label-overkill'
    : ''
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
    return 'Immediate armor damage.'
  }

  if (estimate.armorDamageStartsAtPercent != null) {
    return `Effective from ${Math.round(estimate.armorDamageStartsAtPercent)}%.`
  }

  return 'Uncalibrated.'
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

function formatTooltipCalculation(estimate: ArmorInteractionEstimate, weaponAlpha: number | null) {
  const alpha = formatMetric(weaponAlpha ?? 0)
  const armorMultiplier = formatMetric(estimate.armorDamageMultiplier)
  const shieldPassThrough = formatMetric(estimate.shieldPassThrough)
  const effectiveAlpha = formatMetric(estimate.effectiveArmorAlpha)
  const threshold = formatMetric(estimate.deflectionThreshold)
  const ratio = Number.isFinite(estimate.thresholdRatio)
    ? estimate.thresholdRatio.toFixed(2)
    : 'Immediate'

  return [
    estimate.shieldState === 'up'
      ? `Effective Alpha = ${alpha} × ${armorMultiplier} × ${shieldPassThrough} = ${effectiveAlpha}`
      : `Effective Alpha = ${alpha} × ${armorMultiplier} = ${effectiveAlpha}`,
    `Threshold Ratio = ${effectiveAlpha} ÷ ${threshold} = ${ratio} (${getThresholdRatioLabel(estimate.thresholdRatio)})`,
  ].join('\n')
}

export function ArmorInteractionSummaryPanel({
  ship,
  selectedWeapon,
  compact = false,
  hideWeaponHeader = false,
  highlighted = false,
}: Props) {
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
  const headerClass = hideWeaponHeader
    ? 'alpha-armor-interaction-panel-headless'
    : 'alpha-armor-interaction-panel-headed'
  const velocityLabel =
    selectedWeapon.weapon.projectileSpeed != null
      ? `${formatMetric(selectedWeapon.weapon.projectileSpeed)} m/s`
      : null

  function openTooltip(
    event: PointerEvent<HTMLButtonElement> | FocusEvent<HTMLButtonElement>,
    title: string,
    sectionTitle: string | undefined,
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
      const noteLines: TooltipState['lines'] = estimate.notes?.length
        ? [{
          label: 'Note',
          value: `\n${estimate.notes[0] ?? ''}`,
          tone: estimate.armorDamageStartsAtPercentSource === 'estimated' ? 'amber' : undefined,
        }]
        : []
    const tooltipLines: TooltipState['lines'] =
      state === 'down'
        ? [
            ...noteLines,
            {
              label: 'Shield State',
              value: 'Offline',
            },
            {
              label: 'Pass Through',
              value: '100%',
              tone: 'cyan',
            },
            {
              label: 'Armor Interaction',
              value: formatTooltipArmorInteraction(estimate),
              tone: estimate.damagesFreshArmor ? 'cyan' : 'amber',
            },
            {
              label: 'Calculation',
              value: `\n${formatTooltipCalculation(estimate, selectedWeapon.weapon.alpha)}`,
            },
          ]
        : [
            ...noteLines,
            {
              label: 'Shield State',
              value: 'Online',
            },
            {
              label: 'Pass Through',
              value: formatPassThroughLabel(activePassThrough ?? undefined),
              tone: 'cyan',
            },
            {
              label: 'Armor Interaction',
              value: formatTooltipArmorInteraction(estimate),
              tone: estimate.damagesFreshArmor ? 'cyan' : 'amber',
            },
            {
              label: 'Calculation',
              value: `\n${formatTooltipCalculation(estimate, selectedWeapon.weapon.alpha)}`,
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
        className={`alpha-armor-interaction-state ${toneClass} ${isPrimaryState ? 'alpha-armor-interaction-state-primary' : 'alpha-armor-interaction-state-secondary'} ${highlighted ? 'alpha-armor-interaction-state-highlighted' : ''}`}
      >
        <header className="alpha-armor-interaction-state-head">
          <div className="alpha-armor-interaction-state-badges">
            <span className="alpha-armor-badge alpha-armor-badge-state">
              <span
                className={`alpha-armor-badge-state-value ${state === 'up' ? 'alpha-armor-badge-state-online' : 'alpha-armor-badge-state-offline'}`}
              >
                Shield State: {state === 'up' ? 'Online' : 'Offline'}
              </span>
            </span>
            <span className="alpha-armor-badge alpha-armor-badge-source">
              {formatSourceBadgeLabel(estimate.armorDamageStartsAtPercentSource)}
            </span>
            {selectedWeapon.weapon.damageType === 'ballistic' && effectivenessRating !== 'Medium' ? (
              <span className="alpha-armor-badge alpha-armor-badge-rating">
                {effectivenessRating}
              </span>
            ) : null}
            {estimate.damagesFreshArmor ? (
              <span className="alpha-armor-badge alpha-armor-badge-priority">
                Intact Armor: Yes
              </span>
            ) : null}
              {effectivenessRating === 'High' ? (
                <span className="alpha-armor-badge alpha-armor-badge-priority">
                  Effective Damage: High
                </span>
              ) : null}
              {hideWeaponHeader && velocityLabel ? (
                <span className="alpha-armor-badge alpha-armor-badge-meta">
                  Velocity {velocityLabel}
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
                undefined,
                tooltipLines
              )
            }
            onPointerLeave={closeTooltip}
            onFocus={(event) =>
              openTooltip(
                event,
                `${selectedWeapon.weapon.name} vs ${ship.name.replaceAll('_', ' ')}`,
                undefined,
                tooltipLines
              )
            }
            onBlur={closeTooltip}
          >
            <span aria-hidden="true">i</span>
          </button>
        </header>

        <div className="alpha-armor-interaction-body">
          <section className="alpha-armor-interaction-result">
            <div className="alpha-armor-interaction-result-head">
              <div>
                <p className="alpha-armor-interaction-result-label">Intact Armor</p>
                <p className="alpha-armor-interaction-result-value">
                  {estimate.damagesFreshArmor ? 'Yes' : 'No'}
                </p>
              </div>
              <div className="alpha-armor-interaction-result-secondary">
                <p className="alpha-armor-interaction-result-label">Effective Damage</p>
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
              <dt>Effective Alpha</dt>
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
                  <span className={getThresholdRatioToneClass(estimate.thresholdRatio)}>
                    ({getThresholdRatioLabel(estimate.thresholdRatio)})
                  </span>
                </span>
              </dd>
            </div>
            <div>
              <dt>Confidence</dt>
              <dd>{estimate.confidence[0].toUpperCase()}{estimate.confidence.slice(1)}</dd>
            </div>
          </dl>
        </div>

      </article>
    )
  }

  return (
    <section className={`alpha-armor-interaction-panel ${familyClass} ${layoutClass} ${headerClass}`}>
      {!hideWeaponHeader ? (
        <header className="alpha-armor-interaction-panel-head">
          <div>
            <p className="alpha-armor-interaction-eyebrow">{selectedWeapon.weapon.name}</p>
            {selectedWeapon.weapon.projectileSpeed != null ? (
              <p className="alpha-armor-interaction-kicker">
                {formatMetric(selectedWeapon.weapon.projectileSpeed)} m/s
              </p>
            ) : null}
          </div>
        </header>
      ) : null}

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
