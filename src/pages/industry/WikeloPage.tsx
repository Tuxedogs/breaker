import { useMemo, useState } from 'react';
import { filterWikeloTrades, fulfilledCount, hasVerifiedLoadout, orderWikeloTrades, overflowLabel, publishedWikeloCatalog, visibleRequirements, wikeloArtwork, type WikeloTrade } from './wikeloCatalog';
import { wikeloFixtureTrades } from './wikeloFixture';
import { readWikeloProgress, withOwnedEntry, writeWikeloProgress } from './wikeloProgress';
import './wikelo.css';

const categories = ['All', 'Ships', 'Vehicles', 'Armor', 'Weapons', 'Currency'];
const reputations = ['All', 'No minimum listed', 'Very Good', 'Very Best'];
const sorts = ['Catalog', 'Name', 'Most requirements', 'Closest ready'];

export default function WikeloPage({ fixture = false }: { fixture?: boolean }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [reputation, setReputation] = useState('All');
  const [sort, setSort] = useState('Catalog');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [progress, setProgress] = useState(readWikeloProgress);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});
  const isFixture = fixture && import.meta.env.DEV;
  const trades = isFixture ? wikeloFixtureTrades : publishedWikeloCatalog;
  const shown = useMemo(() => orderWikeloTrades(
    filterWikeloTrades(trades, search, category, reputation), sort, progress.owned, progress.pins
  ), [trades, search, category, reputation, sort, progress.owned, progress.pins]);
  const filterCount = Number(category !== 'All') + Number(reputation !== 'All') + Number(sort !== 'Catalog');
  const save = (next: typeof progress) => { setProgress(next); writeWikeloProgress(next); };
  const updateOwned = (trade: WikeloTrade, lineId: string, raw: string) => {
    const next = withOwnedEntry(progress, `${trade.id}:${lineId}`, raw);
    if (next) save(next);
  };

  return <main className="wikelo-page">
    {isFixture && <p className="wikelo-fixture-note">Preview data only. Requirements and rewards shown here are synthetic.</p>}
    <div className="wikelo-toolbar">
      <label className="wikelo-search"><span className="sr-only">Search trades</span><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.4"/><path d="m16 16 4.2 4.2"/></svg><input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search trades or materials" /></label>
      <button className="wikelo-filter-trigger" type="button" aria-expanded={filtersOpen} aria-controls="wikelo-filter-options" onClick={() => setFiltersOpen(x => !x)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M7 12h10M10 17h4"/></svg>
        Filters{filterCount ? ` (${filterCount})` : ''}
      </button>
      <div className={`wikelo-filter-options ${filtersOpen ? 'wikelo-filter-options--open' : ''}`} id="wikelo-filter-options">
        <label>Category<select value={category} onChange={e => setCategory(e.target.value)}>{categories.map(x => <option key={x}>{x}</option>)}</select></label>
        <label>Reputation<select value={reputation} onChange={e => setReputation(e.target.value)}>{reputations.map(x => <option key={x}>{x}</option>)}</select></label>
        <label>Sort by<select value={sort} onChange={e => setSort(e.target.value)}>{sorts.map(x => <option key={x}>{x}</option>)}</select></label>
      </div>
      <span className="wikelo-count" role="status">{shown.length} {shown.length === 1 ? 'trade' : 'trades'}</span>
    </div>
    {!isFixture && <section className="wikelo-unverified" role="status"><strong>Trade catalog pending verification</strong><p>Turn-in requirements have not been verified. No incomplete or invented trades are displayed.</p></section>}
    {shown.length === 0 ? <p className="wikelo-empty">{trades.length ? 'No trades match your filters.' : 'No verified trades available.'}</p> :
      <div className="wikelo-grid">{shown.map(trade => {
        const complete = fulfilledCount(trade, progress.owned);
        const isFlipped = !!flipped[trade.id];
        const isExpanded = !!expanded[trade.id];
        const pinned = progress.pins.includes(trade.id);
        const art = wikeloArtwork.find(item => item.tradeId === trade.id && item.rights === 'permission-verified' && item.localPath);
        const loadoutAllowed = hasVerifiedLoadout(trade, isFixture);
        const total = trade.requirements.length;
        return <article className={`wikelo-card ${art ? 'wikelo-card--art' : 'wikelo-card--no-art'}`} key={trade.id}>
          <div className="wikelo-card-header" style={art?.localPath ? { backgroundImage: `url(${art.localPath})` } : undefined}>
            <div className="wikelo-header-actions">
              <button className={`wikelo-pin ${pinned ? 'wikelo-pin--active' : ''}`} type="button" aria-pressed={pinned} aria-label={`${pinned ? 'Unpin' : 'Pin'} ${trade.missionTitle}`} onClick={() => save({ ...progress, pins: pinned ? progress.pins.filter(id => id !== trade.id) : [...progress.pins, trade.id] })}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 3 9 3 9.7 8 6 11v2h5v8l2-2v-6h5v-2l-3.7-3z"/></svg>
              </button>
              {loadoutAllowed && <button className="wikelo-flip" type="button" aria-pressed={isFlipped} onClick={() => setFlipped({ ...flipped, [trade.id]: !isFlipped })}>{isFlipped ? 'View trade' : 'View loadout'} <span aria-hidden="true">›</span></button>}
            </div>
            <div className="wikelo-card-title">
              <h2>{trade.missionTitle}</h2>
              <div className="wikelo-reward">{trade.rewardName}</div>
              {trade.extraRewards.length > 0 && <div className="wikelo-extra">{trade.extraRewards.join(' · ')}</div>}
              <div className="wikelo-reputation">{trade.minimumReputation}</div>
            </div>
          </div>
          <div className="wikelo-card-body">
            {isFlipped && loadoutAllowed ? trade.loadout.map(line => <div className="wikelo-row" key={line.id}><span>{line.name}</span><span className="wikelo-row-count">×{line.required}</span></div>) : <>
              {visibleRequirements(trade, isExpanded).map(line => {
                const owned = progress.owned[`${trade.id}:${line.id}`];
                const met = typeof owned === 'number' && Number.isFinite(owned) && owned >= line.required;
                return <div className={`wikelo-row ${met ? 'wikelo-row--met' : ''}`} key={line.id}>
                  <span className="wikelo-material">{line.name}</span>
                  <span className="wikelo-row-count"><span>×{line.required}</span><span className="wikelo-slash">/</span><input aria-label={`${trade.missionTitle}: ${line.name} owned`} type="number" min="0" step="1" inputMode="numeric" placeholder="0" value={owned ?? ''} onChange={e => updateOwned(trade, line.id, e.target.value)} /></span>
                </div>;
              })}
              {overflowLabel(trade, isExpanded) && <button className="wikelo-expand" type="button" aria-expanded={isExpanded} onClick={() => setExpanded({ ...expanded, [trade.id]: !isExpanded })}><span>{isExpanded ? '' : '···'}</span><span>{overflowLabel(trade, isExpanded)}</span></button>}
            </>}
          </div>
          <footer className={`wikelo-card-footer ${complete === total && total > 0 ? 'wikelo-complete' : ''}`}>
            <span>{complete} <span className="wikelo-progress-divider">/</span> {total} fulfilled</span>
            <span className="wikelo-progress-track" aria-hidden="true"><span style={{ width: `${total ? (complete / total) * 100 : 0}%` }} /></span>
          </footer>
        </article>;
      })}</div>}
    <p className="wikelo-storage-note">Manually entered quantities are stored in this browser only. They do not affect Inventory.</p>
  </main>;
}
