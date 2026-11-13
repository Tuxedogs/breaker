import assert from 'node:assert/strict';
import { test } from 'node:test';
import { filterWikeloTrades, fulfilledCount, hasVerifiedLoadout, orderWikeloTrades, overflowLabel, publishedWikeloCatalog, visibleRequirements } from './wikeloCatalog';
import { wikeloFixtureTrades } from './wikeloFixture';
import { emptyWikeloProgress, withOwnedEntry } from './wikeloProgress';

test('unverified catalog is empty and synthetic cases remain separate', () => {
  assert.equal(publishedWikeloCatalog.length, 0);
  assert.deepEqual(wikeloFixtureTrades.map(trade => trade.requirements.length), [10, 11, 20]);
  assert.ok(wikeloFixtureTrades.every(trade => trade.source.status === 'fixture-only'));
});

test('pins group first after selected sort and keep that sort within both groups', () => {
  const [ten, eleven, twenty] = wikeloFixtureTrades;
  assert.deepEqual(orderWikeloTrades(wikeloFixtureTrades, 'Most requirements', {}, [ten.id, twenty.id]).map(trade => trade.id), [twenty.id, ten.id, eleven.id]);
  assert.deepEqual(orderWikeloTrades(wikeloFixtureTrades, 'Catalog', {}, [twenty.id, ten.id]).map(trade => trade.id), [ten.id, twenty.id, eleven.id]);
});

test('blank deletes owned entry, explicit zero remains zero, and threshold completes', () => {
  const trade = wikeloFixtureTrades[0];
  const key = `${trade.id}:line-5`;
  let progress = emptyWikeloProgress();
  for (let index = 1; index <= 4; index++) {
    const next = withOwnedEntry(progress, `${trade.id}:line-${index}`, String(index));
    assert.ok(next);
    progress = next;
  }
  const firstFive = { ...trade, requirements: trade.requirements.slice(0, 5) };
  assert.equal(fulfilledCount(firstFive, progress.owned), 4);
  const four = withOwnedEntry(progress, key, '4');
  assert.ok(four);
  progress = four;
  assert.equal(fulfilledCount(firstFive, progress.owned), 4);
  const five = withOwnedEntry(progress, key, '5');
  assert.ok(five);
  progress = five;
  assert.equal(fulfilledCount(firstFive, progress.owned), 5);
  const blank = withOwnedEntry(progress, key, '');
  assert.ok(blank);
  progress = blank;
  assert.equal(progress.owned[key], undefined);
  assert.equal(fulfilledCount(firstFive, progress.owned), 4);
  const zero = withOwnedEntry(progress, key, '0');
  assert.ok(zero);
  assert.equal(zero.owned[key], 0);
  assert.equal(withOwnedEntry(progress, key, 'NaN'), null);
  assert.equal(fulfilledCount(firstFive, { [key]: Number.NaN }), 0);
});

test('completion includes hidden lines and overflow is independent per card', () => {
  const [ten, eleven, twenty] = wikeloFixtureTrades;
  assert.equal(visibleRequirements(ten, false).length, 10);
  assert.equal(overflowLabel(ten, false), null);
  assert.equal(overflowLabel(eleven, false), 'View all (11)');
  assert.equal(overflowLabel(eleven, true), 'Show less');
  assert.equal(visibleRequirements(twenty, false).length, 10);
  assert.equal(visibleRequirements(twenty, true).length, 20);
  assert.equal(fulfilledCount(twenty, { [`${twenty.id}:line-20`]: 20 }), 1);
});

test('search and loadout gating respect fixture and verified source', () => {
  const trade = wikeloFixtureTrades[2];
  assert.deepEqual(filterWikeloTrades(wikeloFixtureTrades, 'Sample material 20', 'Ships', 'All').map(item => item.id), [trade.id]);
  assert.equal(hasVerifiedLoadout(trade, false), false);
  assert.equal(hasVerifiedLoadout(trade, true), true);
  assert.equal(hasVerifiedLoadout({ ...trade, source: { ...trade.source, status: 'verified' } }, false), true);
  assert.equal(hasVerifiedLoadout(wikeloFixtureTrades[0], true), false);
});

test('search finds material and completion counts all collapsed lines', () => {
  const trade = wikeloFixtureTrades[2];
  assert.deepEqual(filterWikeloTrades(wikeloFixtureTrades, 'Sample material 20', 'All', 'All').map(item => item.id), [trade.id]);
  assert.equal(fulfilledCount(trade, { [`${trade.id}:line-20`]: 20 }), 1);
  assert.equal(fulfilledCount(trade, { [`${trade.id}:line-20`]: 19 }), 0);
});
