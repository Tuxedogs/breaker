import { createContext, useContext } from "react";
import type { ComponentCardIndex, ComponentCardIndexRecord } from "@/lib/componentCardIndex";
import type { ComponentCardBrowserPage } from "@/lib/componentCardIndexApi";

export type CraftingContextValue = {
  componentCards: ComponentCardIndexRecord[];
  componentCardFacets: ComponentCardIndex["facets"] | null;
  loading: boolean;
  error: string | null;
  browserPage: ComponentCardBrowserPage | null;
};

export const CraftingContext = createContext<CraftingContextValue>({
  componentCards: [],
  componentCardFacets: null,
  loading: true,
  error: null,
  browserPage: null,
});

export function useCraftingContext() {
  return useContext(CraftingContext);
}
