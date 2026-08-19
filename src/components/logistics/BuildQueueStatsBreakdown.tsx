import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ComponentCardIndexRecord } from "@/lib/componentCardIndex";
import { fetchComponentCardById } from "@/lib/componentCardIndexApi";
import type { ComponentRecipe } from "@/components/industry/crafting/utils/craftingTypes";
import { getCraftingItemByBlueprintGuid } from "@/lib/craftingData";
import { resolveEntityClassForCraftingItem } from "@/lib/crafting/resolveEntityClass";
import { buildCraftStatViewModel, type CraftStatViewModel } from "@/lib/crafting/craftStatViewModel";
import { useFittingComponentStats, useFpsFittingComponentFromCard } from "@/lib/fitting/useFittingComponentStats";
import { computeTotalModifiersFromQualities } from "@/components/industry/crafting/utils/recipeQuality";
import {
  buildBuildQueueProductQualitySummary,
  buildAllocatedMaterialQualities,
  buildTargetMaterialQualities,
  hasConfiguredTargetQualities,
  hasMaterialAllocations,
  type BuildQueueProductQualitySummary,
} from "@/lib/logistics/buildQueueCraftStats";
import {
  BuildQueueCraftHeaderSummaryPanel,
  BuildQueueCraftIdentityPanel,
  BuildQueueCraftOutcomePanel,
  BuildQueueCraftOverviewPanel,
  BuildQueueCraftStatisticsPanel,
  BuildQueueCraftTargetQualityPanel,
} from "./BuildQueueCraftStatsPanel";
import type { BuildQueueItem } from "@/types/logistics";
import type { RecipeInputTemplate } from "@/data/logistics/seed";

interface Props {
  blueprintId?: string;
  item: BuildQueueItem;
  inputs: RecipeInputTemplate[];
}

type RecipeBridge = Pick<ComponentRecipe, "blueprint_id" | "output_entityClass" | "item_kind">;

type BuildQueueStatsContextValue = {
  model: CraftStatViewModel;
  productQuality: BuildQueueProductQualitySummary;
};

const BuildQueueStatsContext = createContext<BuildQueueStatsContextValue | null>(null);

function useBuildQueueStatModel({ blueprintId, item, inputs }: Props): BuildQueueStatsContextValue {
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

  const {
    detail: fpsCardDetail,
    loading: fpsCardLoading,
    missing: fpsCardMissing,
  } = useFpsFittingComponentFromCard(isFpsItem ? componentCard : null, bridgeLoading);

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

  const model = useMemo(() => buildCraftStatViewModel({
      detail: fittingDetail,
      recipe,
      targetModifiers,
      allocationModifiers,
      targetConfigured,
      allocationConfigured,
      loading: bridgeLoading || (isFpsItem ? fpsCardLoading : fittingStatsLoading),
      missing: isFpsItem ? fpsCardMissing : fittingStatsMissing,
      error: isFpsItem ? null : fittingStatsError,
    }), [
    allocationConfigured,
    allocationModifiers,
    bridgeLoading,
    fittingDetail,
    fittingStatsError,
    fittingStatsLoading,
    fittingStatsMissing,
    fpsCardLoading,
    fpsCardMissing,
    isFpsItem,
    recipe,
    targetConfigured,
    targetModifiers,
  ]);

  const productQuality = useMemo(
    () => buildBuildQueueProductQualitySummary(item, recipe, inputs),
    [inputs, item, recipe],
  );

  return useMemo(() => ({ model, productQuality }), [model, productQuality]);
}

export function BuildQueueStatsProvider({ blueprintId, item, inputs, children }: Props & { children: ReactNode }) {
  const value = useBuildQueueStatModel({ blueprintId, item, inputs });
  return (
    <BuildQueueStatsContext.Provider value={value}>
      {children}
    </BuildQueueStatsContext.Provider>
  );
}

function useBuildQueueStatsContext(): BuildQueueStatsContextValue {
  const value = useContext(BuildQueueStatsContext);
  if (!value) {
    throw new Error("BuildQueue stats components must be used within BuildQueueStatsProvider");
  }
  return value;
}

export function BuildQueueCraftOverview() {
  const { model } = useBuildQueueStatsContext();
  return <BuildQueueCraftOverviewPanel model={model} />;
}

export function BuildQueueCraftIdentity() {
  const { model } = useBuildQueueStatsContext();
  return <BuildQueueCraftIdentityPanel model={model} />;
}

export function BuildQueueCraftStatistics() {
  const { model } = useBuildQueueStatsContext();
  return <BuildQueueCraftStatisticsPanel model={model} />;
}

export function BuildQueueCraftTargetQuality() {
  const { productQuality } = useBuildQueueStatsContext();
  return <BuildQueueCraftTargetQualityPanel productQuality={productQuality} />;
}

export function BuildQueueCraftHeaderSummary({
  materialsLabel,
  allocationPercentage,
}: {
  materialsLabel: string;
  allocationPercentage: number;
}) {
  const { model, productQuality } = useBuildQueueStatsContext();
  return (
    <BuildQueueCraftHeaderSummaryPanel
      model={model}
      productQuality={productQuality}
      materialsLabel={materialsLabel}
      allocationPercentage={allocationPercentage}
    />
  );
}

export function BuildQueueCraftOutcome() {
  const { model, productQuality } = useBuildQueueStatsContext();
  return <BuildQueueCraftOutcomePanel model={model} productQuality={productQuality} />;
}

/** @deprecated Use BuildQueueStatsProvider + BuildQueueCraftOverview/Statistics */
export default function BuildQueueStatsBreakdown(props: Props) {
  const { model } = useBuildQueueStatModel(props);
  return <BuildQueueCraftOverviewPanel model={model} />;
}
