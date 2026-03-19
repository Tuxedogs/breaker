import { useMemo, useState } from 'react'
import { formatEntityLabel, formatMetric } from '../lib/calculations'
import {
  buildWeaponRecommendations,
  matchesRecommendationFilter,
  type RecommendationFilter,
  type WeaponRecommendation,
} from '../lib/recommendations'
import { formatWeaponSizeLabel, formatWeaponTypeLabel } from '../lib/weapons/normalize'
import type { Ship, WeaponRecord, WeaponThresholdType } from '../types'

type Props = {
  ships: Ship[]
  weapons: WeaponRecord[]
  selectedShips: Ship[]
}

const DEFAULT_RESULT_LIMIT = 8
const SINGLE_TYPE_RESULT_LIMIT = 16
function getShipSelectionKey(ship: Pick<Ship, 'manufacturer' | 'name'>) {
  return `${ship.manufacturer}::${ship.name}`
}

function getTypeColumnLabel(type: WeaponThresholdType) {
  return type === 'energy' ? 'Energy' : 'Ballistic'
}

function buildGroupFilterOptions(weapons: WeaponRecord[]) {
  const classes = Array.from(
    new Set(
      weapons
        .filter((weapon) => weapon.damageType === 'ballistic' || weapon.damageType === 'energy')
        .map((weapon) => weapon.weaponClass)
    )
  ).sort((left, right) => left.localeCompare(right))

  return [
    { value: 'all' as RecommendationFilter, label: 'All Types / Groups' },
    { value: 'type:ballistic' as RecommendationFilter, label: 'Ballistic' },
    { value: 'type:energy' as RecommendationFilter, label: 'Energy' },
    ...classes.map((weaponClass) => ({
      value: `class:${weaponClass}` as RecommendationFilter,
      label: formatEntityLabel(weaponClass),
    })),
  ]
}

function getVisibleRecommendations(recommendations: WeaponRecommendation[], limit: number) {
  const viableRecommendations = recommendations.filter(
    (recommendation) => recommendation.viableCoveragePercent >= 40
  )

  if (viableRecommendations.length > 0) {
    return viableRecommendations.slice(0, limit)
  }

  return recommendations.slice(0, limit)
}

function getRecommendationState(recommendation: WeaponRecommendation) {
  const firstPen = recommendation.firstPenetrationArmorPercent

  if (firstPen === 100) {
    return {
      label: 'Passes',
      rowClassName: 'alpha-threshold-summary-row-pass',
    }
  }

  if (firstPen != null && firstPen >= 75) {
    return {
      label: 'Pen Early',
      rowClassName: 'alpha-recommendation-row-early',
    }
  }

  if (firstPen != null && firstPen >= 50) {
    return {
      label: 'Pen Late',
      rowClassName: 'alpha-recommendation-row-late',
    }
  }

  return {
    label: 'Fails',
    rowClassName: 'alpha-threshold-summary-row-blocked',
  }
}

function RecommendationCard({ recommendation }: { recommendation: WeaponRecommendation }) {
  const state = getRecommendationState(recommendation)

  return (
    <article
      className={[
        'alpha-threshold-summary-row',
        'alpha-recommendation-card',
        state.rowClassName,
      ].join(' ')}
    >
      <div className="alpha-threshold-summary-row-copy">
        <h4 className="alpha-threshold-summary-weapon">{recommendation.weapon.name}</h4>
        <p className="alpha-threshold-summary-meta alpha-recommendation-meta">
          {formatWeaponSizeLabel(recommendation.weapon.size)} /{' '}
          {formatWeaponTypeLabel({
            damageType: recommendation.weapon.damageType,
            weaponClass: recommendation.weapon.weaponClass,
          })}
        </p>
      </div>

      <dl className="alpha-threshold-summary-stats alpha-recommendation-stats">
        <div>
          <dt className="alpha-stat-label">Alpha</dt>
          <dd className="alpha-stat-value">{formatMetric(recommendation.weapon.alpha ?? 0)}</dd>
        </div>
        <div>
          <dt className="alpha-stat-label">State</dt>
          <dd className="alpha-stat-value">{state.label}</dd>
        </div>
        <div>
          <dt className="alpha-stat-label">Speed</dt>
          <dd className="alpha-stat-value">
            {formatMetric(recommendation.weapon.projectileSpeed ?? 0)} m/s
          </dd>
        </div>
        <div>
          <dt className="alpha-stat-label">Coverage</dt>
          <dd className="alpha-stat-value">
            {state.label === 'Passes' ? '100%' : `${recommendation.viableCoveragePercent}%`}
          </dd>
        </div>
      </dl>

      {recommendation.firstPenetrationArmorPercent != null &&
      recommendation.firstPenetrationArmorPercent < 100 ? (
        <p className="alpha-recommendation-copy">
          First Pen {recommendation.firstPenetrationArmorPercent}% / Coverage{' '}
          {recommendation.viableCoveragePercent}%
        </p>
      ) : null}
    </article>
  )
}

function RecommendationSection({
  title,
  note,
  recommendations,
}: {
  title: string
  note: string
  recommendations: WeaponRecommendation[]
}) {
  return (
    <section className="alpha-recommendation-section" aria-label={`${title} recommendations`}>
      <div className="alpha-recommendation-section-head">
        <h3 className="surface-title alpha-recommendation-section-title">{title}</h3>
        <p className="alpha-recommendation-section-note">{note}</p>
      </div>
      <div className="alpha-recommendation-grid">
        {recommendations.map((recommendation) => (
          <RecommendationCard
            key={`${title}-${recommendation.weapon.id}`}
            recommendation={recommendation}
          />
        ))}
      </div>
    </section>
  )
}

export function RecommendationsBoard({ ships, weapons, selectedShips }: Props) {
  const shipOptions = useMemo(
    () =>
      ships
        .filter((ship) => ship.name.trim().toLowerCase() !== 'mule')
        .map((ship) => ({
          value: getShipSelectionKey(ship),
          label: `${formatEntityLabel(ship.name)} / ${formatEntityLabel(ship.manufacturer)}`,
        })),
    [ships]
  )
  const sizeOptions = useMemo(
    () =>
      Array.from(new Set(weapons.map((weapon) => weapon.size))).sort(
        (left, right) => left - right
      ),
    [weapons]
  )
  const groupFilterOptions = useMemo(() => buildGroupFilterOptions(weapons), [weapons])

  const [selectedShipKey, setSelectedShipKey] = useState<string>('')
  const [selectedSize, setSelectedSize] = useState<string>(() =>
    sizeOptions.includes(3) ? '3' : 'all'
  )
  const [selectedGroupFilter, setSelectedGroupFilter] =
    useState<RecommendationFilter>('all')

  const resolvedShipKey = useMemo(() => {
    const availableShips = ships.filter((ship) => ship.name.trim().toLowerCase() !== 'mule')

    if (
      selectedShipKey &&
      availableShips.some((ship) => getShipSelectionKey(ship) === selectedShipKey)
    ) {
      return selectedShipKey
    }

    const preferredShip =
      selectedShips.find((ship) => ship.name.trim().toLowerCase() !== 'mule') ??
      availableShips[0]
    return preferredShip ? getShipSelectionKey(preferredShip) : ''
  }, [selectedShipKey, selectedShips, ships])

  const targetShip = useMemo(
    () =>
      ships.find(
        (ship) =>
          ship.name.trim().toLowerCase() !== 'mule' &&
          getShipSelectionKey(ship) === resolvedShipKey
      ) ?? null,
    [resolvedShipKey, ships]
  )

  const filteredWeapons = useMemo(() => {
    return weapons.filter((weapon) => {
      if (weapon.damageType !== 'ballistic' && weapon.damageType !== 'energy') {
        return false
      }
      if (selectedSize !== 'all' && weapon.size !== Number(selectedSize)) {
        return false
      }
      return matchesRecommendationFilter(weapon, selectedGroupFilter)
    })
  }, [selectedGroupFilter, selectedSize, weapons])

  const recommendations = useMemo(() => {
    if (!targetShip) return []
    return buildWeaponRecommendations(targetShip, filteredWeapons)
  }, [filteredWeapons, targetShip])

  const energyRecommendations = useMemo(() => {
    const source =
      selectedGroupFilter === 'type:ballistic'
        ? []
        : recommendations.filter((recommendation) => recommendation.thresholdType === 'energy')

    return getVisibleRecommendations(
      source,
      selectedGroupFilter === 'type:energy' ? SINGLE_TYPE_RESULT_LIMIT : DEFAULT_RESULT_LIMIT
    )
  }, [recommendations, selectedGroupFilter])

  const ballisticRecommendations = useMemo(() => {
    const source =
      selectedGroupFilter === 'type:energy'
        ? []
        : recommendations.filter((recommendation) => recommendation.thresholdType === 'ballistic')

    return getVisibleRecommendations(
      source,
      selectedGroupFilter === 'type:ballistic' ? SINGLE_TYPE_RESULT_LIMIT : DEFAULT_RESULT_LIMIT
    )
  }, [recommendations, selectedGroupFilter])

  const hasAnyRecommendations =
    energyRecommendations.length > 0 || ballisticRecommendations.length > 0

  return (
    <section className="alpha-threshold-tab-panel" aria-label="Weapon recommendations">
      <div className="alpha-recommendation-controls">
        <label className="alpha-recommendation-field">
          <span className="alpha-control-label">Target Ship</span>
          <select
            className="alpha-input"
            value={resolvedShipKey}
            onChange={(event) => setSelectedShipKey(event.target.value)}
          >
            {shipOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="alpha-recommendation-field">
          <span className="alpha-control-label">Weapon Size</span>
          <select
            className="alpha-input"
            value={selectedSize}
            onChange={(event) => setSelectedSize(event.target.value)}
          >
            <option value="all">All Sizes</option>
            {sizeOptions.map((size) => (
              <option key={size} value={size}>
                {formatWeaponSizeLabel(size)}
              </option>
            ))}
          </select>
        </label>

        <label className="alpha-recommendation-field">
          <span className="alpha-control-label">Type / Group</span>
          <select
            className="alpha-input"
            value={selectedGroupFilter}
            onChange={(event) =>
              setSelectedGroupFilter(event.target.value as RecommendationFilter)
            }
          >
            {groupFilterOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!targetShip ? (
        <section className="alpha-threshold-board-empty" aria-live="polite">
          <div className="alpha-empty-state">
            <h3 className="surface-title">Recommendations</h3>
            <p className="mt-3 text-sm text-slate-400">
              Select a target ship to evaluate weapon viability.
            </p>
          </div>
        </section>
      ) : !hasAnyRecommendations ? (
        <section className="alpha-threshold-board-empty" aria-live="polite">
          <div className="alpha-empty-state">
            <h3 className="surface-title">No matching weapons</h3>
            <p className="mt-3 text-sm text-slate-400">
              Adjust the size or type/group filters to expand the recommendation pool.
            </p>
          </div>
        </section>
      ) : (
        <div className="alpha-recommendation-sections">
          {selectedGroupFilter !== 'type:ballistic' ? (
            <RecommendationSection
              title={getTypeColumnLabel('energy')}
              note="Omni, MXA, Attrition always penetrate all armors."
              recommendations={energyRecommendations}
            />
          ) : null}

          {selectedGroupFilter !== 'type:energy' ? (
            <RecommendationSection
              title={getTypeColumnLabel('ballistic')}
              note="Deadbolt, Mass Drivers, Railguns ect always penetrate all armors."
              recommendations={ballisticRecommendations}
            />
          ) : null}
        </div>
      )}
    </section>
  )
}
