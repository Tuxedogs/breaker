/**
 * Primitive types shared across multiple models.
 * Nothing here should import from other model files.
 */

/** How a material's quantity is measured. */
export type UnitType = 'SCU' | 'count' | 'units';

/** Broad category for craftable items — used by BuildQueueItem and CraftingRecipe. */
export type ItemCategory =
  | 'component'
  | 'weapon'
  | 'armor'
  | 'consumable'
  | 'ship_part'
  | 'other';
