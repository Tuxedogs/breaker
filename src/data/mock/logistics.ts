import type { Material, InventoryEntry, Location, BuildQueueItem, CraftingRecipe } from '../models';

export const mockMaterials: Material[] = [
  { id: 'stileron',    name: 'Stileron',    unitType: 'SCU',   category: 'refined' },
  { id: 'borase',      name: 'Borase',      unitType: 'SCU',   category: 'raw' },
  { id: 'feynmaline',  name: 'Feynmaline',  unitType: 'count', category: 'component' },
  { id: 'tungsten',    name: 'Tungsten',    unitType: 'SCU',   category: 'raw' },
  { id: 'savrilium',   name: 'Savrilium',   unitType: 'SCU',   category: 'refined' },
  { id: 'laranite',    name: 'Laranite',    unitType: 'SCU',   category: 'raw' },
  { id: 'copper-ore',  name: 'Copper Ore',  unitType: 'SCU',   category: 'raw' },
  { id: 'titanium',    name: 'Titanium',    unitType: 'SCU',   category: 'raw' },
];

export const mockLocations: Location[] = [
  { id: 'everus-harbor',     name: 'Everus Harbor',     system: 'Stanton', type: 'station' },
  { id: 'orison',            name: 'Orison',            system: 'Stanton', type: 'city' },
  { id: 'area18',            name: 'Area18',            system: 'Stanton', type: 'city' },
  { id: 'seraphim-station',  name: 'Seraphim Station',  system: 'Pyro',    type: 'station' },
];

export const mockInventory: InventoryEntry[] = [
  { id: 'inv-1',  materialId: 'stileron',   quantity: 3.5,  locationId: 'everus-harbor',    updatedAt: '2026-04-18T10:22:00Z' },
  { id: 'inv-2',  materialId: 'stileron',   quantity: 1.2,  locationId: 'orison',           updatedAt: '2026-04-17T14:05:00Z' },
  { id: 'inv-3',  materialId: 'stileron',   quantity: 0.8,  locationId: 'seraphim-station', updatedAt: '2026-04-15T08:00:00Z' },
  { id: 'inv-4',  materialId: 'borase',     quantity: 2.0,  locationId: 'everus-harbor',    containerName: 'Box A',   updatedAt: '2026-04-19T09:15:00Z' },
  { id: 'inv-5',  materialId: 'borase',     quantity: 0.5,  locationId: 'orison',           updatedAt: '2026-04-16T11:30:00Z' },
  { id: 'inv-6',  materialId: 'feynmaline', quantity: 85,   locationId: 'area18',           updatedAt: '2026-04-20T07:00:00Z' },
  { id: 'inv-7',  materialId: 'feynmaline', quantity: 30,   locationId: 'seraphim-station', updatedAt: '2026-04-14T16:45:00Z' },
  { id: 'inv-8',  materialId: 'tungsten',   quantity: 1.5,  locationId: 'everus-harbor',    updatedAt: '2026-04-21T12:00:00Z' },
  { id: 'inv-9',  materialId: 'savrilium',  quantity: 0.86, locationId: 'seraphim-station', updatedAt: '2026-04-13T09:30:00Z' },
  { id: 'inv-10', materialId: 'laranite',   quantity: 0.8,  locationId: 'area18',           updatedAt: '2026-04-22T08:20:00Z' },
  { id: 'inv-11', materialId: 'copper-ore', quantity: 0.5,  locationId: 'area18',           updatedAt: '2026-04-22T08:25:00Z' },
  { id: 'inv-12', materialId: 'titanium',   quantity: 3.0,  locationId: 'everus-harbor',    containerName: 'Vault 1', updatedAt: '2026-04-20T15:00:00Z' },
];

// Active statuses: in_progress, paused, queued all count toward shortages.
// SnowBlind Cooler and Demeco LMG have no recipe — they're skipped in shortage calc.
export const mockBuildQueue: BuildQueueItem[] = [
  { id: 'bq-1', itemName: 'Avalanche Cooler',   category: 'ship_part', quantity: 1, status: 'in_progress', priority: 1 },
  { id: 'bq-2', itemName: 'TS-2 Quantum Drive', category: 'ship_part', quantity: 1, status: 'in_progress', priority: 2 },
  { id: 'bq-3', itemName: 'VK-00 Quantum Drive', category: 'ship_part', quantity: 1, status: 'paused',      priority: 3 },
  { id: 'bq-4', itemName: 'SnowBlind Cooler',    category: 'ship_part', quantity: 1, status: 'queued',      priority: 4 },
  { id: 'bq-5', itemName: 'Arbor Mining Laser',  category: 'weapon',    quantity: 1, status: 'queued',      priority: 5 },
  { id: 'bq-6', itemName: 'Demeco LMG',          category: 'weapon',    quantity: 1, status: 'queued',      priority: 6 },
];

// Shortage calc result for this data:
//   stileron:  have 5.5, need 5.5 → none
//   tungsten:  have 1.5, need 1.5 → none
//   borase:    have 2.5, need 5.0 → –2.5 SCU
//   feynmaline: have 115, need 100 → none
//   savrilium: have 0.86, need 1.0 → –0.14 SCU
//   laranite:  have 0.8, need 2.0 → –1.2 SCU
//   copper-ore: have 0.5, need 0.8 → –0.3 SCU
export const mockRecipes: CraftingRecipe[] = [
  {
    id: 'recipe-1',
    itemName: 'Avalanche Cooler',
    category: 'ship_part',
    inputs: [
      { materialId: 'stileron', quantity: 4.0, unitType: 'SCU' },
      { materialId: 'tungsten', quantity: 1.5, unitType: 'SCU' },
    ],
    outputQty: 1,
    craftTime: 3600,
  },
  {
    id: 'recipe-2',
    itemName: 'TS-2 Quantum Drive',
    category: 'ship_part',
    inputs: [
      { materialId: 'borase',     quantity: 3.0, unitType: 'SCU' },
      { materialId: 'feynmaline', quantity: 100, unitType: 'count' },
      { materialId: 'savrilium',  quantity: 1.0, unitType: 'SCU' },
    ],
    outputQty: 1,
    craftTime: 7200,
  },
  {
    id: 'recipe-3',
    itemName: 'VK-00 Quantum Drive',
    category: 'ship_part',
    inputs: [
      { materialId: 'borase',   quantity: 2.0, unitType: 'SCU' },
      { materialId: 'stileron', quantity: 1.5, unitType: 'SCU' },
    ],
    outputQty: 1,
    craftTime: 5400,
  },
  {
    id: 'recipe-4',
    itemName: 'Arbor Mining Laser',
    category: 'weapon',
    inputs: [
      { materialId: 'laranite',   quantity: 2.0, unitType: 'SCU' },
      { materialId: 'copper-ore', quantity: 0.8, unitType: 'SCU' },
    ],
    outputQty: 1,
    craftTime: 1800,
  },
];
