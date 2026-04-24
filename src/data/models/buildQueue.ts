import type { ItemCategory } from './shared';

export type BuildStatus =
  | 'queued'      // waiting to start
  | 'in_progress' // actively being crafted
  | 'paused'      // halted mid-craft
  | 'complete'    // finished
  | 'cancelled';  // abandoned

export interface BuildQueueItem {
  id: string;
  itemName: string;
  category: ItemCategory;
  quantity: number;
  status: BuildStatus;
  /** Ordering value — lower number means higher priority. */
  priority: number;
}
