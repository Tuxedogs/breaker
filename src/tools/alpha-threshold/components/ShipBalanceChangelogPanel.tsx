import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatEntityLabel } from '../lib/calculations'
import type { ShipBalanceChangeEntry } from '../types'

type Props = {
  entries: ShipBalanceChangeEntry[]
  compact?: boolean
}

export function ShipBalanceChangelogPanel({ entries, compact = false }: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const visibleEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return entries

    return entries.filter((entry) => {
      const haystack =
        `${entry.ship.manufacturer} ${entry.ship.name} ${entry.current.patch} ${entry.previous.patch}`.toLowerCase()
      return haystack.includes(normalizedQuery)
    })
  }, [entries, query])

  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        className={[
          'alpha-balance-trigger',
          compact ? 'alpha-balance-trigger-compact' : '',
        ].filter(Boolean).join(' ')}
        onClick={() => setOpen(true)}
        aria-label="Open ship balance changelog"
        title="Ship Balance Changelog"
      >
        <span className="alpha-balance-trigger-badge">{entries.length}</span>
        <svg aria-hidden viewBox="0 0 20 20" className="alpha-balance-trigger-icon">
          <path
            d="M10 3a7 7 0 0 1 6.52 4.45V4.75H18v5h-5V8.25h2.45A5.5 5.5 0 1 0 15.5 10h1.5A7 7 0 1 1 10 3Z"
            fill="currentColor"
          />
        </svg>
      </button>

      {open
        ? createPortal(
            <div className="alpha-tool-route">
              <div className="alpha-modal-backdrop" onMouseDown={() => setOpen(false)}>
                <section
                  className="alpha-modal-shell alpha-balance-modal"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="ship-balance-changelog"
                  onMouseDown={(event) => event.stopPropagation()}
                >
                  <header className="alpha-balance-changelog-head">
                    <div>
                      <p className="page-kicker">Erkul Source Delta</p>
                      <h2 id="ship-balance-changelog" className="surface-title mt-3">
                        Live vs PTU Ship Changes
                      </h2>
                      <p className="mt-2 text-sm text-slate-400">
                        Compare armor, thresholds, armor HP, and hull HP changes between the current Erkul Live and Erkul PTU ship datasets.
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-[0.12em] text-slate-500">
                        Source: Erkul Live {'>'} Erkul PTU
                      </p>
                    </div>
                    <div className="alpha-balance-changelog-actions">
                      <label className="alpha-balance-search-wrap">
                        <span className="alpha-control-label">Search ship or patch</span>
                        <input
                          value={query}
                          onChange={(event) => setQuery(event.target.value)}
                          placeholder="Perseus, RSI, PTU..."
                          className="alpha-input"
                        />
                      </label>
                      <button
                        type="button"
                        className="alpha-action-button"
                        onClick={() => setOpen(false)}
                      >
                        Close
                      </button>
                    </div>
                  </header>

                  <div className="alpha-balance-changelog-list" aria-live="polite">
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
                                {entry.previous.patch} {'>'} {entry.current.patch}
                              </span>
                            </div>
                          </header>

                          <dl className="alpha-balance-diff-list">
                            {entry.fields.map((field) => (
                              <div key={field.key} className="alpha-balance-diff-row">
                                <dt className="alpha-stat-label">{field.label}</dt>
                                <dd className="alpha-balance-diff-values">
                                  <span
                                    className={[
                                      'alpha-balance-diff-old',
                                      field.direction === 'up'
                                        ? 'alpha-balance-diff-old-down'
                                        : 'alpha-balance-diff-old-up',
                                    ].join(' ')}
                                  >
                                    {field.before}
                                  </span>
                                  <span className="alpha-balance-diff-arrow">{'>'}</span>
                                  <span
                                    className={[
                                      'alpha-balance-diff-new',
                                      field.direction === 'up'
                                        ? 'alpha-balance-diff-new-up'
                                        : 'alpha-balance-diff-new-down',
                                    ].join(' ')}
                                  >
                                    {field.after}
                                  </span>
                                </dd>
                              </div>
                            ))}
                          </dl>
                        </article>
                      ))
                    ) : (
                      <section className="alpha-empty-state" aria-live="polite">
                        <h3 className="title-font text-base text-slate-50">
                          No Live vs PTU ship deltas match your search.
                        </h3>
                      </section>
                    )}
                  </div>
                </section>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  )
}
