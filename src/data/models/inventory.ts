/**
 * A single inventory record: one material stored in one container
 * at one location. Multiple entries can exist for the same material
 * across different locations or containers.
 */
export interface InventoryEntry {
  id: string;
  /** Physical boxes retain identity; omitted legacy records remain aggregates. */
  recordKind?: "box" | "aggregate";
  /** References Material.id */
  materialId: string;
  quantity: number;
  /**Materials quality */
  quality: number;
  /** References Location.id */
  locationId: string;
  /** Optional label for the specific box, rack, or ship hold. */
  containerName?: string;
  /** ISO 8601 date string — when this entry was last manually verified. */
  updatedAt: string;
}
