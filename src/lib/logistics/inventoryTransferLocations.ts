import type { InventoryLocation } from '../../types/logistics';

export const TRANSFER_LOCATION_SYSTEM_ORDER = [
  'Stanton',
  'Pyro',
  'Nyx',
  'Other / Unknown',
] as const;

export type TransferLocationSystemGroup = typeof TRANSFER_LOCATION_SYSTEM_ORDER[number];

export type TransferLocationOption = InventoryLocation & {
  systemGroup: TransferLocationSystemGroup;
  searchText: string;
};

export type TransferLocationGroup = {
  system: TransferLocationSystemGroup;
  locations: TransferLocationOption[];
};

const STANTON_L_POINT_RE = /^(arc|hur|mic|cru)-l\d+$/i;

function isStantonLagrangePoint(location: InventoryLocation): boolean {
  const candidates = [location.name.trim(), location.id.trim()];
  return candidates.some((value) => STANTON_L_POINT_RE.test(value));
}

export function inferTransferLocationSystem(location: InventoryLocation): TransferLocationSystemGroup {
  const system = location.system?.trim();
  if (system) {
    const normalized = system.toLowerCase();
    if (normalized === 'stanton') return 'Stanton';
    if (normalized === 'pyro') return 'Pyro';
    if (normalized === 'nyx') return 'Nyx';
  }

  const nameLower = location.name.toLowerCase();
  if (nameLower.includes('(stanton)')) return 'Stanton';
  if (nameLower.includes('(pyro)')) return 'Pyro';
  if (nameLower.includes('(nyx)')) return 'Nyx';
  if (isStantonLagrangePoint(location)) return 'Stanton';

  return 'Other / Unknown';
}

function buildSearchText(location: InventoryLocation, systemGroup: TransferLocationSystemGroup): string {
  return [
    location.name,
    location.id,
    systemGroup,
    location.system,
    location.category,
    location.type,
  ].filter(Boolean).join(' ').toLowerCase();
}

export function buildTransferLocationGroups(
  locations: InventoryLocation[],
  options: { excludeLocationId?: string; query?: string } = {},
): TransferLocationGroup[] {
  const query = options.query?.trim().toLowerCase() ?? '';
  const bySystem = new Map<TransferLocationSystemGroup, TransferLocationOption[]>();

  for (const location of locations) {
    if (options.excludeLocationId && location.id === options.excludeLocationId) continue;

    const systemGroup = inferTransferLocationSystem(location);
    const searchText = buildSearchText(location, systemGroup);
    if (query && !searchText.includes(query)) continue;

    const group = bySystem.get(systemGroup) ?? [];
    group.push({ ...location, systemGroup, searchText });
    bySystem.set(systemGroup, group);
  }

  return TRANSFER_LOCATION_SYSTEM_ORDER
    .map((system) => ({
      system,
      locations: (bySystem.get(system) ?? []).sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .filter((group) => group.locations.length > 0);
}

export function flattenTransferLocationGroups(groups: TransferLocationGroup[]): TransferLocationOption[] {
  return groups.flatMap((group) => group.locations);
}
