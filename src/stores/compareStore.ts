import { create } from "zustand";
import type { ComponentCardIndexRecord } from "@/lib/componentCardIndex";

export type CompareSlot = 0 | 1;

interface CompareState {
  slots: [ComponentCardIndexRecord | null, ComponentCardIndexRecord | null];
  setSlot: (slot: CompareSlot, record: ComponentCardIndexRecord) => void;
  clearSlot: (slot: CompareSlot) => void;
  swap: () => void;
  clearAll: () => void;
}

export const useCompareStore = create<CompareState>((set) => ({
  slots: [null, null],
  setSlot: (slot, record) =>
    set((state) => {
      const next: [ComponentCardIndexRecord | null, ComponentCardIndexRecord | null] = [...state.slots] as [ComponentCardIndexRecord | null, ComponentCardIndexRecord | null];
      next[slot] = record;
      return { slots: next };
    }),
  clearSlot: (slot) =>
    set((state) => {
      const next: [ComponentCardIndexRecord | null, ComponentCardIndexRecord | null] = [...state.slots] as [ComponentCardIndexRecord | null, ComponentCardIndexRecord | null];
      next[slot] = null;
      return { slots: next };
    }),
  swap: () =>
    set((state) => ({ slots: [state.slots[1], state.slots[0]] })),
  clearAll: () => set({ slots: [null, null] }),
}));
