/**
 * Public surface of the data models layer.
 * Import everything through this barrel — do not import from sub-files directly
 * in application code, so internal reorganisation never breaks consumers.
 */

export type { UnitType, ItemCategory } from './shared';

export type { MaterialCategory, MaterialQuality, Material } from './material';

export type { InventoryEntry } from './inventory';

export type { LocationType, Location } from './location';

export type { BuildStatus, BuildQueueItem } from './buildQueue';

export type { RecipeInput, CraftingRecipe } from './recipe';

export type { YieldType, MineableSpawnLocation, Mineable } from './mineable';
