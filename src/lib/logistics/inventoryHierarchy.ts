import { formatInventoryLocationLabel, type InventoryStack } from "./inventory";

export type ReservableLocationFolder = {
  key: string;
  label: string;
  locationMeta?: string;
  stacks: InventoryStack[];
  qualities: Array<{
    key: string;
    quality: number | null;
    stacks: InventoryStack[];
  }>;
};

/**
 * Build Queue reservation picker projection. Inventory page hierarchy ownership
 * was retired when its location-first workspace replaced the accordion view.
 */
export function groupReservableStacksByLocation(stacks: InventoryStack[]): ReservableLocationFolder[] {
  const folders = new Map<string, ReservableLocationFolder>();
  const order: string[] = [];

  for (const stack of stacks) {
    const key = stack.locationId ?? "__unassigned__";
    let folder = folders.get(key);
    if (!folder) {
      folder = {
        key,
        label: formatInventoryLocationLabel(stack),
        locationMeta: stack.location?.system ? `${stack.location.system} System` : undefined,
        stacks: [],
        qualities: [],
      };
      folders.set(key, folder);
      order.push(key);
    }
    folder.stacks.push(stack);
  }

  return order.map((key) => {
    const folder = folders.get(key)!;
    const qualities = new Map<string, { key: string; quality: number | null; stacks: InventoryStack[] }>();
    const qualityOrder: string[] = [];
    for (const stack of folder.stacks) {
      const qualityKey = String(stack.quality ?? "unknown");
      const current = qualities.get(qualityKey);
      if (current) current.stacks.push(stack);
      else {
        qualities.set(qualityKey, { key: qualityKey, quality: stack.quality ?? null, stacks: [stack] });
        qualityOrder.push(qualityKey);
      }
    }
    return {
      ...folder,
      qualities: qualityOrder.map((qualityKey) => qualities.get(qualityKey)!),
    };
  });
}
