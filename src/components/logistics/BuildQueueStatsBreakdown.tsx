import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ComponentCardIndexRecord } from "@/lib/componentCardIndex";
import { fetchComponentCardById } from "@/lib/componentCardIndexApi";
import type { ComponentRecipe } from "@/components/industry/crafting/utils/craftingTypes";
import { getCraftingItemByBlueprintGuid } from "@/lib/craftingData";
import { resolveEntityClassForCraftingItem } from "@/lib/crafting/resolveEntityClass";
import { buildFittingDetailFromFpsComponentCard } from "@/lib/crafting/fpsComponentCardDetail";
import { buildCraftStatViewModel, type CraftStatViewModel } from "@/lib/crafting/craftStatViewModel";
import { useFittingComponentStats } from "@/lib/fitting/useFittingComponentStats";
import { computeTotalModifiersFromQualities } from "@/components/industry/crafting/utils/recipeQuality";
import {
  buildAllocatedMaterialQualities,
  buildTargetMaterialQualities,
  hasConfiguredTargetQualities,
  hasMaterialAllocations,
} from "@/lib/logistics/buildQueueCraftStats";
import {
  BuildQueueCraftOverviewPanel,
  BuildQueueCraftStatisticsPanel,
} from "./BuildQueueCraftStatsPanel";
import type { BuildQueueItem } from "@/types/logistics";
import type { RecipeInputTemplate } from "@/data/logistics/seed";

interface Props {
  blueprintId?: string;
  item: BuildQueueItem;
  inputs: RecipeInputTemplate[];
}

type RecipeBridge = Pick<ComponentRecipe, "blueprint_id" | "output_entityClass" | "item_kind">;

const BuildQueueStatsContext = createContext<CraftStatViewModel | null>(null);

function useBuildQueueStatModel({ blueprintId, item, inputs }: Props): CraftStatViewModel {
  const [componentCard, setComponentCard] = useState<ComponentCardIndexRecord | null>(null);
  const [recipe, setRecipe] = useState<ComponentRecipe | null>(null);
  const [bridgeLoading, setBridgeLoading] = useState(Boolean(blueprintId?.trim()));

  useEffect(() => {
    const normalizedBlueprintId = blueprintId?.trim();
    if (!normalizedBlueprintId) {
      queueMicrotask(() => {
        setComponentCard(null);
        setRecipe(null);
        setBridgeLoading(false);
      });
      return;
    }

    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setBridgeLoading(true);
    });

    Promise.all([
      fetchComponentCardById(normalizedBlueprintId).catch(() => null),
      getCraftingItemByBlueprintGuid(normalizedBlueprintId),
    ])
      .then(([card, loadedRecipe]) => {
        if (cancelled) return;
        setComponentCard(card);
        setRecipe(loadedRecipe);
      })
      .finally(() => {
        if (!cancelled) setBridgeLoading(false);
      });

    return () => { cancelled = true; };
  }, [blueprintId]);

  const recipeBridge = useMemo<RecipeBridge | null>(() => (
    recipe
      ? {
        blueprint_id: recipe.blueprint_id,
        output_entityClass: recipe.output_entityClass,
        item_kind: recipe.item_kind,
      }
      : null
  ), [recipe]);

  const isFpsItem = recipeBridge?.item_kind === "fps" || componentCard?.kind === "fps";

  const cardBridge = useMemo(() => (
    componentCard
      ? { id: componentCard.id, entityClass: componentCard.entityClass, kind: componentCard.kind }
      : null
  ), [componentCard]);

  const entityClass = useMemo(() => {
    if (isFpsItem || !blueprintId?.trim()) return null;
    return resolveEntityClassForCraftingItem({
      recipe: recipeBridge ?? { blueprint_id: blueprintId, output_entityClass: "" },
      cardBridge,
    }).entityClass;
  }, [blueprintId, cardBridge, isFpsItem, recipeBridge]);

  const {
    detail: fittingApiDetail,
    loading: fittingStatsLoading,
    missing: fittingStatsMissing,
    error: fittingStatsError,
  } = useFittingComponentStats(isFpsItem ? null : entityClass);

  const fpsCardDetail = useMemo(
    () => (isFpsItem ? buildFittingDetailFromFpsComponentCard(componentCard) : null),
    [componentCard, isFpsItem],
  );

  const fittingDetail = isFpsItem ? fpsCardDetail : fittingApiDetail;

  const targetQualities = useMemo(
    () => (recipe ? buildTargetMaterialQualities(item, recipe, inputs) : {}),
    [item, recipe, inputs],
  );

  const allocatedQualities = useMemo(
    () => (recipe ? buildAllocatedMaterialQualities(item, recipe, inputs) : {}),
    [item, recipe, inputs],
  );

  const targetModifiers = useMemo(
    () => (recipe ? computeTotalModifiersFromQualities(recipe, targetQualities) : []),
    [recipe, targetQualities],
  );

  const allocationModifiers = useMemo(
    () => (recipe ? computeTotalModifiersFromQualities(recipe, allocatedQualities) : []),
    [recipe, allocatedQualities],
  );

  const targetConfigured = useMemo(
    () => (recipe ? hasConfiguredTargetQualities(recipe, inputs) : false),
    [recipe, inputs],
  );

  const allocationConfigured = useMemo(
    () => (recipe ? hasMaterialAllocations(item, recipe, inputs) : false),
    [item, recipe, inputs],
  );

  return useMemo(() => buildCraftStatViewModel({
    detail: fittingDetail,
    recipe,
    targetModifiers,
    allocationModifiers,
    targetConfigured,
    allocationConfigured,
    loading: bridgeLoading || (!isFpsItem && fittingStatsLoading),
    missing: isFpsItem ? !fpsCardDetail && !bridgeLoading : fittingStatsMissing,
    error: isFpsItem ? null : fittingStatsError,
  }), [
    allocationConfigured,
    allocationModifiers,
    bridgeLoading,
    fittingDetail,
    fittingStatsError,
    fittingStatsLoading,
    fittingStatsMissing,
    fpsCardDetail,
    isFpsItem,
    recipe,
    targetConfigured,
    targetModifiers,
  ]);
}

export function BuildQueueStatsProvider({ blueprintId, item, inputs, children }: Props & { children: ReactNode }) {
  const model = useBuildQueueStatModel({ blueprintId, item, inputs });
  return (
    <BuildQueueStatsContext.Provider value={model}>
      {children}
    </BuildQueueStatsContext.Provider>
  );
}

function useBuildQueueStatsContext(): CraftStatViewModel {
  const model = useContext(BuildQueueStatsContext);
  if (!model) {
    throw new Error("BuildQueue stats components must be used within BuildQueueStatsProvider");
  }
  return model;
}

export function BuildQueueCraftOverview() {
  const model = useBuildQueueStatsContext();
  return <BuildQueueCraftOverviewPanel model={model} />;
}

export function BuildQueueCraftStatistics() {
  const model = useBuildQueueStatsContext();
  return <BuildQueueCraftStatisticsPanel model={model} />;
}

/** @deprecated Use BuildQueueStatsProvider + BuildQueueCraftOverview/Statistics */
export default function BuildQueueStatsBreakdown(props: Props) {
  const model = useBuildQueueStatModel(props);
  return <BuildQueueCraftOverviewPanel model={model} />;
}
