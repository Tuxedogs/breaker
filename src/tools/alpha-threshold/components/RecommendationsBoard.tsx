import { useMemo, useState } from 'react'
import { formatEntityLabel, formatMetric } from '../lib/calculations'
import {
  buildWeaponRecommendations,
  matchesRecommendationFilter,
  type RecommendationBand,
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
const DEFAULT_RECOMMENDATION_FLOOR = 75

function getShipSelectionKey(ship: Pick<Ship, 'manufacturer' | 'name'>) {
  return `${ship.manufacturer}::${ship.name}`
}

function getBandLabel(band: RecommendationBand) {
  switch (band) {
    case 'guaranteed':
      return 'Guaranteed'
    case 'strong':
      return 'Strong'
    case 'viable':
      return 'Viable'
    case 'weak':
      return 'Weak / Situational'
  }
}

function getBandClassName(band: RecommendationBand) {
  switch (band) {
    case 'guaranteed':
      return 'alpha-recommendation-band-guaranteed'
    case 'strong':
      return 'alpha-recommendation-band-strong'
    case 'viable':
      return 'alpha-recommendation-band-viable'
    case 'weak':
      return 'alpha-recommendation-band-weak'
  }
}

function getTypeColumnLabel(type: WeaponThresholdType) {
  return type === 'ballistic' ? 'Ballistic' : 'Energy'
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
    (recommendation) => recommendation.viabilityPercent >= DEFAULT_RECOMMENDATION_FLOOR
  )

  if (viableRecommendations.length > 0) {
    return viableRecommendations.slice(0, limit)
  }

  return recommendations.slice(0, limit)
}

function RecommendationCard({ recommendation }: { recommendation: WeaponRecommendation }) {
  const needsArmorDamage =
    recommendation.firstPenetrationArmorPercent != null &&
    recommendation.firstPenetrationArmorPercent < 100
  const isGuaranteed = recommendation.viabilityPercent === 100

  return (
    <article className="alpha-recommendation-card">
      <header className="alpha-recommendation-card-head">
        <div>
          {!isGuaranteed ? (
            <div
              className={[
                'alpha-recommendation-band',
                getBandClassName(recommendation.viabilityBand),
              ].join(' ')}
            >
              {getBandLabel(recommendation.viabilityBand)}
            </div>
          ) : null}
          <h3 className="alpha-recommendation-name">{recommendation.weapon.name}</h3>
          <p className="alpha-recommendation-meta">
            {formatWeaponSizeLabel(recommendation.weapon.size)} /{' '}
            {formatWeaponTypeLabel({
              damageType: recommendation.weapon.damageType,
              weaponClass: recommendation.weapon.weaponClass,
            })}
          </p>
        </div>
        <div className="alpha-recommendation-score">
          <strong
            className={isGuaranteed ? 'alpha-recommendation-viability-guaranteed' : undefined}
          >
            {recommendation.viabilityPercent}%
          </strong>
          <span>Viability</span>
        </div>
      </header>

      <dl className="alpha-recommendation-stats">
        <div className="alpha-metric-card">
          <dt className="alpha-stat-label">Speed</dt>
          <dd className="alpha-stat-value">
            {formatMetric(recommendation.weapon.projectileSpeed ?? 0)} m/s
          </dd>
        </div>
        <div className="alpha-metric-card">
          <dt className="alpha-stat-label">First Pen</dt>
          <dd className="alpha-stat-value">
            {recommendation.firstPenetrationArmorPercent == null
              ? 'Never'
              : `${recommendation.firstPenetrationArmorPercent}%`}
          </dd>
        </div>
        <div className="alpha-metric-card">
          <dt className="alpha-stat-label">Alpha</dt>
          <dd className="alpha-stat-value">
            {formatMetric(recommendation.weapon.alpha ?? 0)}
          </dd>
        </div>
        <div className="alpha-metric-card">
          <dt className="alpha-stat-label">Coverage</dt>
          <dd className="alpha-stat-value">{recommendation.viableCoveragePercent}%</dd>
        </div>
      </dl>

      {needsArmorDamage ? (
        <div className="alpha-recommendation-bar-block" aria-hidden="true">
          <div className="alpha-recommendation-bar-axis">
            <span>100% armor</span>
            <span>0% armor</span>
          </div>
          <div className="alpha-recommendation-bar">
            <div
              className="alpha-recommendation-bar-region"
              style={{
                left: `${recommendation.firstPenetrationX * 100}%`,
                width: `${100 - recommendation.firstPenetrationX * 100}%`,
              }}
            />
            <span
              className="alpha-recommendation-bar-marker"
              style={{ left: `${recommendation.firstPenetrationX * 100}%` }}
            />
          </div>
        </div>
      ) : null}

      {recommendation.firstPenetrationArmorPercent != null &&
      recommendation.firstPenetrationArmorPercent < 100 ? (
        <p className="alpha-recommendation-copy">{recommendation.firstPenetrationStepLabel}</p>
      ) : recommendation.firstPenetrationArmorPercent == null ? (
        <p className="alpha-recommendation-copy">{recommendation.firstPenetrationStepLabel}</p>
      ) : null}
    </article>
  )
}

export function RecommendationsBoard({ ships, weapons, selectedShips }: Props) {
  const shipOptions = useMemo(
    () =>
      ships.map((ship) => ({
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
  const [selectedSize, setSelectedSize] = useState<string>('all')
  const [selectedGroupFilter, setSelectedGroupFilter] =
    useState<RecommendationFilter>('all')

  const resolvedShipKey = useMemo(() => {
    if (selectedShipKey && ships.some((ship) => getShipSelectionKey(ship) === selectedShipKey)) {
      return selectedShipKey
    }

    const preferredShip = selectedShips[0] ?? ships[0]
    return preferredShip ? getShipSelectionKey(preferredShip) : ''
  }, [selectedShipKey, selectedShips, ships])

  const targetShip = useMemo(
    () => ships.find((ship) => getShipSelectionKey(ship) === resolvedShipKey) ?? null,
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

  const recommendationColumns = useMemo(() => {
    if (selectedGroupFilter === 'type:ballistic' || selectedGroupFilter === 'type:energy') {
      const selectedType = selectedGroupFilter.slice(5) as WeaponThresholdType
      return [
        {
          key: selectedType,
          label: getTypeColumnLabel(selectedType),
          recommendations: getVisibleRecommendations(recommendations, SINGLE_TYPE_RESULT_LIMIT),
        },
      ]
    }

    return (['ballistic', 'energy'] as const).map((type) => ({
      key: type,
      label: getTypeColumnLabel(type),
      recommendations: getVisibleRecommendations(
        recommendations.filter((recommendation) => recommendation.thresholdType === type),
        DEFAULT_RESULT_LIMIT
      ),
    }))
  }, [recommendations, selectedGroupFilter])

  const hasAnyRecommendations = recommendationColumns.some(
    (column) => column.recommendations.length > 0
  )

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
          {recommendationColumns.map((column) => (
            <section key={column.key} className="alpha-recommendation-section">
              <header className="alpha-recommendation-section-head">
                <div>
                  <p className="page-kicker">Recommendations</p>
                  <h3 className="surface-title mt-2">{column.label}</h3>
                </div>
              </header>

              <div className="alpha-recommendation-grid">
                {column.recommendations.map((recommendation) => (
                  <RecommendationCard
                    key={`${column.key}-${recommendation.weapon.id}`}
                    recommendation={recommendation}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  )
}
