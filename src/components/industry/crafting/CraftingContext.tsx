import { createContext, useContext } from "react";
import type { ComponentCardIndexRecord } from "@/lib/componentCardIndex";

export type CraftingContextValue = {
  componentCards: ComponentCardIndexRecord[];
  loading: boolean;
  error: string | null;
};

export const CraftingContext = createContext<CraftingContextValue>({
  componentCards: [],
  loading: true,
  error: null,
});

export function useCraftingContext() {
  return useContext(CraftingContext);
}
