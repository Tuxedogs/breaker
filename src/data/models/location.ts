/** Physical category of a storage location. */
export type LocationType = 'station' | 'city' | 'outpost' | 'ship';

export interface Location {
  id: string;
  name: string;
  /** Star system name, e.g. "Stanton", "Pyro". */
  system: string;
  type: LocationType;
  notes?: string;
}
