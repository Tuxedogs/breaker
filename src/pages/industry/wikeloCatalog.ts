export type WikeloCategory = 'Ships' | 'Vehicles' | 'Armor' | 'Weapons' | 'Currency';
export type WikeloReputation = 'No minimum listed' | 'Very Good' | 'Very Best';
export type WikeloSource = { url: string; checkedOn: string; evidence: string; status: 'verified' | 'fixture-only' };
export type WikeloLine = { id: string; name: string; required: number };
export type WikeloTrade = {
  id: string;
  missionTitle: string;
  rewardName: string;
  extraRewards: string[];
  category: WikeloCategory;
  minimumReputation: WikeloReputation;
  requirements: WikeloLine[];
  loadout: WikeloLine[];
  source: WikeloSource;
};
export type WikeloArtwork = { tradeId: string; localPath: string | null; rights: 'permission-verified' | 'unresolved'; attribution: string | null };

// Publication requires the missing trade-requirements CSV and per-field verification.
export const publishedWikeloCatalog: readonly WikeloTrade[] = [];
export const wikeloArtwork: readonly WikeloArtwork[] = [];

export function filterWikeloTrades(trades: readonly WikeloTrade[], search: string, category: string, reputation: string) {
  const query = search.trim().toLocaleLowerCase();
  return trades.filter(trade =>
    (category === 'All' || trade.category === category) &&
    (reputation === 'All' || trade.minimumReputation === reputation) &&
    (!query || [trade.missionTitle, trade.rewardName, ...trade.extraRewards, ...trade.requirements.map(line => line.name)]
      .some(value => value.toLocaleLowerCase().includes(query)))
  );
}

export function fulfilledCount(trade: WikeloTrade, owned: Record<string, number>) {
  return trade.requirements.filter(line => {
    const amount = owned[`${trade.id}:${line.id}`];
    return typeof amount === 'number' && Number.isFinite(amount) && amount >= line.required;
  }).length;
}

export function orderWikeloTrades(trades: readonly WikeloTrade[], sort: string, owned: Record<string, number>, pins: readonly string[]) {
  const ordered = [...trades];
  if (sort === 'Name') ordered.sort((a, b) => a.missionTitle.localeCompare(b.missionTitle));
  if (sort === 'Most requirements') ordered.sort((a, b) => b.requirements.length - a.requirements.length);
  if (sort === 'Closest ready') ordered.sort((a, b) =>
    (b.requirements.length ? fulfilledCount(b, owned) / b.requirements.length : 0) -
    (a.requirements.length ? fulfilledCount(a, owned) / a.requirements.length : 0));
  const pinned = new Set(pins);
  return [...ordered.filter(trade => pinned.has(trade.id)), ...ordered.filter(trade => !pinned.has(trade.id))];
}

export const hasVerifiedLoadout = (trade: WikeloTrade, fixture: boolean) =>
  trade.loadout.length > 0 && (trade.source.status === 'verified' || (fixture && trade.source.status === 'fixture-only'));

export const visibleRequirements = (trade: WikeloTrade, expanded: boolean) =>
  expanded ? trade.requirements : trade.requirements.slice(0, 10);

export const overflowLabel = (trade: WikeloTrade, expanded: boolean) =>
  trade.requirements.length > 10 ? (expanded ? 'Show less' : `View all (${trade.requirements.length})`) : null;
