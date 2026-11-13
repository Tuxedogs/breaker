import type { WikeloTrade } from './wikeloCatalog';

const sampleSource = { url: '', checkedOn: '2026-10-26', evidence: 'Synthetic layout fixture; no published trade claim', status: 'fixture-only' as const };
const makeTrade = (count: number): WikeloTrade => ({
  id: `fixture-${count}`, missionTitle: `Fixture mission ${count}`, rewardName: `Fixture reward ${count}`,
  extraRewards: [], category: 'Ships', minimumReputation: 'No minimum listed',
  requirements: Array.from({ length: count }, (_, index) => ({ id: `line-${index + 1}`, name: `Sample material ${index + 1}`, required: index + 1 })),
  loadout: [], source: sampleSource,
});

export const wikeloFixtureTrades: readonly WikeloTrade[] = [makeTrade(10), makeTrade(11), { ...makeTrade(20), loadout: [{ id: 'fixture-loadout', name: 'Synthetic loadout item', required: 1 }] }];
