/** What a mineable resource produces after extraction. */
export type YieldType = 'gem' | 'metal' | 'gas' | 'mineral';

/** A specific place where a mineable resource can be found. */
export interface MineableSpawnLocation {
  /** References Location.id */
  locationId: string;
  notes?: string;
}

export interface Mineable {
  id: string;
  name: string;
  /** All known locations where this resource spawns. */
  locations: MineableSpawnLocation[];
  yieldType: YieldType;
  notes?: string;
}
