import { useMemo, useState } from 'react'
import { formatEntityLabel, formatMetric } from '../lib/calculations'
import type { ShipBalanceChangeEntry } from '../types'

type Props = {
  entries: ShipBalanceChangeEntry[]
}

function formatDelta(value: number) {
  const prefix = value > 0 ? '+' : ''
  return `${prefix}${formatMetric(value)}`
}

export function ShipBalanceChangelogPanel({ entries }: Props) {
  const [query, setQuery] = useState('')

  const visibleEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return entries

    return entries.filter((entry) => {
      const haystack =
        `${entry.ship.manufacturer} ${entry.ship.name} ${entry.current.patch} ${entry.previous.patch}`.toLowerCase()
      return haystack.includes(normalizedQuery)
    })
  }, [entries, query])

  return (
    <section className="alpha-balance-changelog" aria-labelledby="ship-balance-changelog">
      <header className="alpha-balance-changelog-head">
        <div>
          <p className="page-kicker">Game Data Changelog</p>
          <h2 id="ship-balance-changelog" className="surface-title mt-3">
            Ship Balance Changes
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Track armor, thresholds, armor HP, and vital HP updates across ships.
          </p>
        </div>
        <label className="alpha-balance-search-wrap">
          <span className="alpha-control-label">Search ship or patch</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Scorpius, ANVL, 4.7..."
            className="alpha-input"
          />
        </label>
      </header>

      <div className="alpha-balance-changelog-list">
        {visibleEntries.length > 0 ? (
          visibleEntries.map((entry) => (
            <article key={entry.ship.name} className="alpha-balance-change-card">
              <header className="alpha-balance-change-head">
                <div>
                  <p className="alpha-ship-option-meta">
                    {formatEntityLabel(entry.ship.manufacturer)}
                  </p>
                  <h3 className="alpha-compare-ship-name">
                    {formatEntityLabel(entry.ship.name)}
                  </h3>
                </div>
                <div className="alpha-balance-change-patches">
                  <span className="alpha-chip alpha-chip-muted">
                    {entry.previous.patch}
                  </span>
                  <span className="alpha-chip alpha-chip-pass">
                    {entry.current.patch}
                  </span>
                </div>
              </header>

              <dl className="alpha-balance-delta-grid">
                <div className="alpha-metric-card">
                  <dt className="alpha-stat-label">Armor</dt>
                  <dd className="alpha-stat-value">{formatDelta(entry.delta.armor)}</dd>
                </div>
                <div className="alpha-metric-card">
                  <dt className="alpha-stat-label">Ballistic</dt>
                  <dd className="alpha-stat-value">
                    {formatDelta(entry.delta.ballisticThreshold)}
                  </dd>
                </div>
                <div className="alpha-metric-card">
                  <dt className="alpha-stat-label">Energy</dt>
                  <dd className="alpha-stat-value">
                    {formatDelta(entry.delta.energyThreshold)}
                  </dd>
                </div>
                <div className="alpha-metric-card">
                  <dt className="alpha-stat-label">Armor HP</dt>
                  <dd className="alpha-stat-value">{formatDelta(entry.delta.armorHp)}</dd>
                </div>
                <div className="alpha-metric-card">
                  <dt className="alpha-stat-label">Vital HP</dt>
                  <dd className="alpha-stat-value">{formatDelta(entry.delta.vitalHp)}</dd>
                </div>
              </dl>
            </article>
          ))
        ) : (
          <section className="alpha-empty-state" aria-live="polite">
            <h3 className="title-font text-base text-slate-50">
              No changelog entries match your search.
            </h3>
          </section>
        )}
      </div>
    </section>
  )
}
