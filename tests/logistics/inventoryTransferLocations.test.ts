import { describe, expect, it } from 'vitest';
import {
  buildTransferLocationGroups,
  inferTransferLocationSystem,
} from '../../src/lib/logistics/inventoryTransferLocations';
import type { InventoryLocation } from '../../src/types/logistics';

describe('inventoryTransferLocations', () => {
  it('groups canonical locations by system field', () => {
    expect(inferTransferLocationSystem({ id: 'levski', name: 'Levski', system: 'Nyx' })).toBe('Nyx');
    expect(inferTransferLocationSystem({ id: 'checkmate', name: 'Checkmate', system: 'Pyro' })).toBe('Pyro');
    expect(inferTransferLocationSystem({ id: 'arc-l1', name: 'ARC-L1', system: 'Stanton' })).toBe('Stanton');
  });

  it('infers system from location names when system is missing', () => {
    expect(inferTransferLocationSystem({ id: 'gw', name: 'Pyro Gateway (Stanton)' })).toBe('Stanton');
    expect(inferTransferLocationSystem({ id: 'hur-l1', name: 'HUR-L1' })).toBe('Stanton');
    expect(inferTransferLocationSystem({ id: 'custom', name: 'My Hangar' })).toBe('Other / Unknown');
  });

  it('excludes the source location and filters by query', () => {
    const locations: InventoryLocation[] = [
      { id: 'levski', name: 'Levski', system: 'Nyx' },
      { id: 'lorville', name: 'Lorville', system: 'Stanton' },
      { id: 'checkmate', name: 'Checkmate', system: 'Pyro' },
    ];

    const groups = buildTransferLocationGroups(locations, {
      excludeLocationId: 'levski',
      query: 'lor',
    });

    expect(groups).toHaveLength(1);
    expect(groups[0]?.system).toBe('Stanton');
    expect(groups[0]?.locations.map((location) => location.id)).toEqual(['lorville']);
  });
});
