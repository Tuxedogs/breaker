import { createContext, useContext } from "react";
import type { ComponentCardIndex, ComponentCardIndexRecord } from "@/lib/componentCardIndex";

export type CraftingContextValue = {
  componentCards: ComponentCardIndexRecord[];
  componentCardFacets: ComponentCardIndex["facets"] | null;
  loading: boolean;
  error: string | null;
};

export const CraftingContext = createContext<CraftingContextValue>({
  componentCards: [],
  componentCardFacets: null,
  loading: true,
  error: null,
});

export function useCraftingContext() {
  return useContext(CraftingContext);
}
