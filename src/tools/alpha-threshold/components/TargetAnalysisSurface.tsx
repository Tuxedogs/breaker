import { useState, useMemo } from 'react'

import { formatMetric } from '../lib/calculations'
import {
  buildWeaponRecommendations,
  sortWeaponRecommendations,
  type WeaponRecommendation,
} from '../lib/recommendations'
import { buildShipFlipCardModel } from '../lib/ships/shipFlipCardModel'
import { getShipThumbnailCandidates } from '../lib/ships/thumbnail'
import type { ArmorInteractionFilterChip } from './ArmorInteractionSummaryPanel'
import type { DefenseShieldState, Ship, WeaponRecord } from '../types'

const WEAPON_SIZE_OPTIONS = [1, 2, 3, 4, 5] as const

const EXCLUSION_EXPLANATION =
  'Certain weapon families always resolve as E100 regardless of armor state, or use non-standard damage mechanics that cannot produce fair per-ship comparisons. Excluded: Sledge, Singe, Deadbolt series and specific named variants (Warlord, Quarreler, Omnisky, Attrition-6, and others).'

type WeaponBadgeTone = 'pass' | 'mid' | 'late' | 'none'

type TargetAnalysisSurfaceProps = {
  ship: Ship | null
  allWeapons: WeaponRecord[]
  shieldMode: DefenseShieldState
  onShieldModeChange: (mode: DefenseShieldState) => void
  matrixMode: 'analysis' | 'target'
  onMatrixModeChange: (mode: 'analysis' | 'target') => void
  targetWeaponFilterPreset?: ArmorInteractionFilterChip | null
  onTargetWeaponFilterPresetChange?: (chip: ArmorInteractionFilterChip | null) => void
  targetWeaponSizeFilter?: number | null
  onTargetWeaponSizeFilterChange?: (size: number | null) => void
  sourceMode?: 'live' | 'ptu'
  onboardingHighlight?: 'ship-weapon' | 'shield' | null
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

// Mirrors the E-rating color scale used in ThresholdComparisonMatrix
function getERatingColor(pct: number): string {
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

function getWeaponBadge(rec: WeaponRecommendation): { label: string; tone: WeaponBadgeTone } {
  const p = rec.firstPenetrationArmorPercent
  if (p === null) return { label: 'NO PEN', tone: 'none' }
  if (rec.viabilityBand === 'guaranteed') return { label: 'PASS', tone: 'pass' }
  if (p >= 50) return { label: 'PEN MIDWAY', tone: 'mid' }
  return { label: 'PEN LATE', tone: 'late' }
}

function getDamageTypeLabel(value: string): string {
  return value === 'energy' ? 'Energy' : 'Ballistic'
}

export function TargetAnalysisSurface({
  ship,
  allWeapons,
  shieldMode,
  onShieldModeChange,
  matrixMode,
  onMatrixModeChange,
  targetWeaponFilterPreset,
  onTargetWeaponFilterPresetChange,
  targetWeaponSizeFilter,
  onTargetWeaponSizeFilterChange,
  sourceMode = 'live',
  onboardingHighlight,
}: TargetAnalysisSurfaceProps) {
  const [exclusionOpen, setExclusionOpen] = useState(false)
  const [statGroupsOpen, setStatGroupsOpen] = useState(true)

  const recommendations = useMemo(() => {
    if (!ship) return []
    return buildWeaponRecommendations(ship, allWeapons)
      .filter((rec) => {
        if (
          targetWeaponFilterPreset?.kind === 'damageType' &&
          rec.thresholdType !== targetWeaponFilterPreset.value
        ) {
          return false
        }
        if (targetWeaponSizeFilter != null && rec.weapon.size !== targetWeaponSizeFilter) {
          return false
        }
        return true
      })
      .sort(sortWeaponRecommendations)
  }, [allWeapons, ship, targetWeaponFilterPreset, targetWeaponSizeFilter])

  const model = useMemo(() => (ship ? buildShipFlipCardModel(ship) : null), [ship])
  const thumbnailSrc = useMemo(
    () => (ship ? (getShipThumbnailCandidates(ship)[0]?.src ?? ship.imageSrc) : null),
    [ship]
  )
  const shieldProfiles = ship?.defenseProfile?.shields

  // The corner control panel — same visual language as the matrix corner, trimmed for target-mode relevance
  const cornerPanel = (
    <div
      className={[
        'acm-corner',
        'acm-corner-spacer',
        onboardingHighlight === 'shield' ? 'alpha-onboarding-target-highlight' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="acm-corner-body">
        <div className="acm-corner-row">
          <span className="acm-corner-label">Data</span>
          <div className="acm-corner-segments" role="radiogroup" aria-label="Source">
            {(['live', 'ptu'] as const).map((id, index) => (
              <span key={id} className="acm-corner-seg-wrap">
                {index > 0 ? (
                  <span className="acm-corner-seg-sep" aria-hidden>
                    |
                  </span>
                ) : null}
                <button
                  type="button"
                  className={[
                    'acm-corner-seg',
                    sourceMode === id ? 'acm-corner-seg--active' : '',
                    id === 'ptu' ? 'acm-corner-seg--disabled' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  role="radio"
                  aria-checked={sourceMode === id}
                  disabled={id === 'ptu'}
                >
                  {id.toUpperCase()}
                </button>
              </span>
            ))}
          </div>
        </div>
        <div className="acm-corner-row">
          <span className="acm-corner-label">Mode</span>
          <div className="acm-corner-segments" role="radiogroup" aria-label="Mode">
            {(['analysis', 'target'] as const).map((id, index) => (
              <span key={id} className="acm-corner-seg-wrap">
                {index > 0 ? (
                  <span className="acm-corner-seg-sep" aria-hidden>
                    |
                  </span>
                ) : null}
                <button
                  type="button"
                  className={[
                    'acm-corner-seg',
                    matrixMode === id ? 'acm-corner-seg--active' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  role="radio"
                  aria-checked={matrixMode === id}
                  onClick={() => onMatrixModeChange(id)}
                >
                  {id === 'analysis' ? 'Analysis' : 'Target'}
                </button>
              </span>
            ))}
          </div>
        </div>
        <div className="acm-corner-row">
          <span className="acm-corner-label">Type</span>
          <div className="acm-corner-segments" role="radiogroup" aria-label="Weapon type filter">
            {(['ballistic', 'energy'] as const).map((value, index) => (
              <span key={value} className="acm-corner-seg-wrap">
                {index > 0 ? (
                  <span className="acm-corner-seg-sep" aria-hidden>
                    |
                  </span>
                ) : null}
                <button
                  type="button"
                  className={[
                    'acm-corner-seg',
                    targetWeaponFilterPreset?.kind === 'damageType' &&
                    targetWeaponFilterPreset.value === value
                      ? 'acm-corner-seg--active'
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  role="radio"
                  aria-checked={
                    targetWeaponFilterPreset?.kind === 'damageType'
                      ? targetWeaponFilterPreset.value === value
                      : false
                  }
                  onClick={() =>
                    onTargetWeaponFilterPresetChange?.({
                      kind: 'damageType',
                      slotId: 'target',
                      label: getDamageTypeLabel(value),
                      value,
                    })
                  }
                >
                  {getDamageTypeLabel(value)}
                </button>
              </span>
            ))}
          </div>
        </div>
        <div className="acm-corner-row">
          <span className="acm-corner-label">Shields</span>
          <div className="acm-corner-segments" role="group" aria-label="Shields">
            <button
              type="button"
              className={[
                'acm-corner-seg',
                shieldMode === 'up' ? 'acm-corner-seg--active-shield-on' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-pressed={shieldMode === 'up'}
              onClick={() => onShieldModeChange('up')}
            >
              ON
            </button>
            <span className="acm-corner-seg-sep" aria-hidden>
              /
            </span>
            <button
              type="button"
              className={[
                'acm-corner-seg',
                shieldMode === 'down' ? 'acm-corner-seg--active-shield-off' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-pressed={shieldMode === 'down'}
              onClick={() => onShieldModeChange('down')}
            >
              OFF
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <section className="acm-tas-root">
      <header className="acm-tas-header">
        <div className="acm-tas-control">{cornerPanel}</div>

        <div className="acm-tas-identity">
          {thumbnailSrc && ship ? (
            <img
              className="acm-tas-thumb"
              src={thumbnailSrc}
              alt={ship.imageAlt ?? ship.name}
              loading="lazy"
            />
          ) : null}
          <div className="acm-tas-identity-copy">
            <span className="acm-tas-mode-label">Target Mode</span>
            {ship ? (
              <>
                <h2 className="acm-tas-ship-name">{ship.name}</h2>
                <span className="acm-tas-manufacturer">{ship.manufacturer}</span>
              </>
            ) : (
              <p className="acm-tas-empty-hint">Select a target ship to begin analysis.</p>
            )}
            <div className="acm-tas-size-filter">
              <span className="acm-tas-size-filter-label">Vs. Size</span>
              <div className="acm-corner-seg-wrap acm-tas-size-filter-segs">
                {([null, ...WEAPON_SIZE_OPTIONS] as const).map((size) => (
                  <button
                    key={size ?? 'all'}
                    type="button"
                    className={[
                      'acm-corner-seg',
                      targetWeaponSizeFilter === size ? 'acm-corner-seg--active' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => onTargetWeaponSizeFilterChange?.(size)}
                  >
                    {size == null ? 'All' : `S${size}`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="acm-tas-thresholds">
          <div className="acm-tas-threshold acm-tas-threshold--energy">
            <span className="acm-tas-threshold-label">Energy</span>
            <span className="acm-tas-threshold-value">{model?.energyThreshold ?? '—'}</span>
          </div>
          <div className="acm-tas-threshold acm-tas-threshold--ballistic">
            <span className="acm-tas-threshold-label">Ballistic</span>
            <span className="acm-tas-threshold-value">{model?.ballisticThreshold ?? '—'}</span>
          </div>
        </div>
      </header>

      {ship ? (
        <div className="acm-tas-body">
          <div className="acm-tas-stat-groups">
            <section className="acm-tas-stat-group">
              <button
                type="button"
                className="acm-tas-stat-group-label"
                aria-expanded={statGroupsOpen}
                onClick={() => setStatGroupsOpen((v) => !v)}
              >
                <span className="acm-tas-stat-group-caret" aria-hidden>
                  {statGroupsOpen ? '▲' : '▼'}
                </span>
                Combat Core
              </button>
              {statGroupsOpen ? (
                <dl className="acm-tas-stat-list">
                  <div className="acm-tas-stat">
                    <dt>Armor HP</dt>
                    <dd>{model?.armor ?? '—'}</dd>
                  </div>
                  <div className="acm-tas-stat">
                    <dt>Hull HP</dt>
                    <dd>{model?.hull ?? '—'}</dd>
                  </div>
                  <div className="acm-tas-stat">
                    <dt>Shield Slots</dt>
                    <dd>
                      {shieldProfiles?.count != null ? formatMetric(shieldProfiles.count) : '—'}
                    </dd>
                  </div>
                  <div className="acm-tas-stat">
                    <dt>Shield Size</dt>
                    <dd>
                      {Array.isArray(shieldProfiles?.size)
                        ? shieldProfiles?.size.join(', ')
                        : (shieldProfiles?.size ?? '—')}
                    </dd>
                  </div>
                </dl>
              ) : null}
            </section>

            <section className="acm-tas-stat-group">
              <button
                type="button"
                className="acm-tas-stat-group-label"
                aria-expanded={statGroupsOpen}
                onClick={() => setStatGroupsOpen((v) => !v)}
              >
                <span className="acm-tas-stat-group-caret" aria-hidden>
                  {statGroupsOpen ? '▲' : '▼'}
                </span>
                Mobility
              </button>
              {statGroupsOpen ? (
                <dl className="acm-tas-stat-list">
                  <div className="acm-tas-stat">
                    <dt>SCM Fwd</dt>
                    <dd>{model?.scmForward ?? '—'}</dd>
                  </div>
                  <div className="acm-tas-stat">
                    <dt>SCM Rev</dt>
                    <dd>
                      {ship.shipDetails?.flight?.scmSpeedReverse != null
                        ? `${formatMetric(ship.shipDetails.flight.scmSpeedReverse)} m/s`
                        : '—'}
                    </dd>
                  </div>
                  <div className="acm-tas-stat">
                    <dt>Boost Fwd</dt>
                    <dd>{model?.boostForward ?? '—'}</dd>
                  </div>
                  <div className="acm-tas-stat">
                    <dt>Boost Rev</dt>
                    <dd>
                      {ship.shipDetails?.flight?.boostSpeedBackward != null
                        ? `${formatMetric(ship.shipDetails.flight.boostSpeedBackward)} m/s`
                        : '—'}
                    </dd>
                  </div>
                </dl>
              ) : null}
            </section>

            <section className="acm-tas-stat-group">
              <button
                type="button"
                className="acm-tas-stat-group-label"
                aria-expanded={statGroupsOpen}
                onClick={() => setStatGroupsOpen((v) => !v)}
              >
                <span className="acm-tas-stat-group-caret" aria-hidden>
                  {statGroupsOpen ? '▲' : '▼'}
                </span>
                Handling
              </button>
              {statGroupsOpen ? (
                <dl className="acm-tas-stat-list">
                  <div className="acm-tas-stat">
                    <dt>Pitch</dt>
                    <dd>{model?.pitch ?? '—'}</dd>
                  </div>
                  <div className="acm-tas-stat">
                    <dt>Yaw</dt>
                    <dd>{model?.yaw ?? '—'}</dd>
                  </div>
                  <div className="acm-tas-stat">
                    <dt>Roll</dt>
                    <dd>{model?.roll ?? '—'}</dd>
                  </div>
                  <div className="acm-tas-stat">
                    <dt>Boost P/Y/R</dt>
                    <dd>
                      {model
                        ? `${model.boostPitch} / ${model.boostYaw} / ${model.boostRoll}`
                        : '—'}
                    </dd>
                  </div>
                </dl>
              ) : null}
            </section>
          </div>

          <div className="acm-tas-exclusion">
            <button
              type="button"
              className="acm-tas-exclusion-toggle"
              aria-expanded={exclusionOpen}
              onClick={() => setExclusionOpen((v) => !v)}
            >
              <span className="acm-tas-exclusion-caret" aria-hidden>
                {exclusionOpen ? '▲' : '▼'}
              </span>
              Excluded Weapon Classes
            </button>
            {exclusionOpen ? (
              <p className="acm-tas-exclusion-body">{EXCLUSION_EXPLANATION}</p>
            ) : null}
          </div>

          <div className="acm-tas-weapon-section">
            <h3 className="acm-tas-weapon-section-head">Weapon Results</h3>
            {recommendations.length === 0 ? (
              <p className="acm-tas-weapon-empty">No weapons match the current filters.</p>
            ) : (
              <div className="acm-tas-weapon-grid">
                {recommendations.map((rec) => {
                  const badge = getWeaponBadge(rec)
                  const ePercent = rec.firstPenetrationArmorPercent ?? 0
                  const eLabel = `E${Math.max(0, Math.round(ePercent))}`
                  const eColor = getERatingColor(ePercent)
                  return (
                    <article
                      key={rec.weapon.id}
                      className={`acm-tas-weapon-card acm-tas-weapon-card--${badge.tone}`}
                    >
                      <div className="acm-tas-weapon-head">
                        <span className="acm-tas-weapon-name">{rec.weapon.name}</span>
                        <span className="acm-tas-weapon-meta">
                          S{rec.weapon.size} · {getDamageTypeLabel(rec.weapon.damageType)}
                        </span>
                      </div>
                      <div className="acm-tas-weapon-rating">
                        <span className="acm-tas-weapon-e" style={{ color: eColor }}>
                          {eLabel}
                        </span>
                        <span
                          className={`acm-tas-weapon-badge acm-tas-weapon-badge--${badge.tone}`}
                        >
                          {badge.label}
                        </span>
                      </div>
                      <dl className="acm-tas-weapon-stats">
                        {rec.weapon.projectileSpeed != null ? (
                          <div className="acm-tas-weapon-stat">
                            <dt>Velocity</dt>
                            <dd>{formatMetric(rec.weapon.projectileSpeed)} m/s</dd>
                          </div>
                        ) : null}
                        {rec.weapon.burstDps != null ? (
                          <div className="acm-tas-weapon-stat">
                            <dt>Burst DPS</dt>
                            <dd>{formatMetric(rec.weapon.burstDps)}</dd>
                          </div>
                        ) : null}
                        <div className="acm-tas-weapon-stat">
                          <dt>Coverage</dt>
                          <dd>{rec.viabilityPercent}%</dd>
                        </div>
                      </dl>
                    </article>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  )
}
