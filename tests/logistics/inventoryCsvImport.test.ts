import assert from 'node:assert/strict';
import test from 'node:test';

import { materialTemplates } from '../../src/data/logistics/seed';
import {
  inventoryCsvUnitMismatchMessage,
  isRawIceInventoryInput,
  resolveInventoryCsvUnit,
} from '../../src/lib/logistics/inventoryCsvImport';

const material = (id: string) => {
  const match = materialTemplates.find((entry) => entry.id === id);
  assert.ok(match, `missing material fixture ${id}`);
  return match;
};

test('normalizes count spellings to the unit inventory contract', () => {
  for (const token of ['COUNT', 'count', 'COUNTS', 'UNIT', 'units']) {
    assert.deepEqual(resolveInventoryCsvUnit(token), {
      unitType: 'unit',
      label: 'unit',
      multiplier: 1,
    });
  }
});

test('retains SCU and cSCU quantity semantics', () => {
  assert.deepEqual(resolveInventoryCsvUnit('SCU'), { unitType: 'scu', label: 'SCU', multiplier: 1 });
  assert.deepEqual(resolveInventoryCsvUnit('cSCU'), {
    unitType: 'scu',
    label: 'SCU',
    multiplier: 0.01,
    warning: 'cSCU converted to SCU.',
  });
});

test('validates explicit units against known material metadata', () => {
  assert.equal(inventoryCsvUnitMismatchMessage(material('hadanite'), 'unit'), null);
  assert.equal(inventoryCsvUnitMismatchMessage(material('hadanite'), 'scu'), 'Hadanite uses unit count, not SCU.');
  assert.equal(inventoryCsvUnitMismatchMessage(material('rawice'), 'scu'), null);
  assert.equal(inventoryCsvUnitMismatchMessage(material('rawice'), 'unit'), 'Pressurized Ice uses SCU, not unit count.');
});

test('recognizes Raw Ice as an explicit unrefined request', () => {
  assert.equal(isRawIceInventoryInput('Raw Ice'), true);
  assert.equal(isRawIceInventoryInput('raw_ice'), true);
  assert.equal(isRawIceInventoryInput('Pressurized Ice'), false);
});
