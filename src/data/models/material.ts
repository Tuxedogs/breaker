import type { UnitType } from './shared';

/** Source or processing state of a material. */
export type MaterialCategory =
  | 'raw'         // mined directly (Stileron, Borase, etc.)
  | 'refined'     // output of a refinery run
  | 'component'   // manufactured part
  | 'consumable'  // single-use item
  | 'byproduct';  // waste or secondary output

/** Grade/purity of a material, where applicable. */
export type MaterialQuality = 'low' | 'medium' | 'high' | 'prime';

export interface Material {
  id: string;
  name: string;
  unitType: UnitType;
  category: MaterialCategory;
  /** Optional purity or grade, relevant to mined/refined materials. */
  quality?: MaterialQuality;
  notes?: string;
}
