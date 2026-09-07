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
type BridgeState = {
  blueprintId: string | null;
  card: ComponentCardIndexRecord | null;
  recipe: ComponentRecipe | null;
  status: "loading" | "ready" | "error";
};

type BuildQueueStatsContextValue = {
  model: CraftStatViewModel;
  productQuality: BuildQueueProductQualitySummary;
  selectionId: string;
  hasError: boolean;
};

const BuildQueueStatsContext = createContext<BuildQueueStatsContextValue | null>(null);

function useBuildQueueStatModel({ blueprintId, item, inputs }: Props): BuildQueueStatsContextValue {
  const normalizedBlueprintId = blueprintId?.trim() || null;
  const [bridge, setBridge] = useState<BridgeState>(() => ({
    blueprintId: normalizedBlueprintId,
    card: null,
    recipe: null,
    status: normalizedBlueprintId ? "loading" : "ready",
  }));

  useEffect(() => {
    if (!normalizedBlueprintId) {
      setBridge({ blueprintId: null, card: null, recipe: null, status: "ready" });
      return;
    }

    let cancelled = false;
    setBridge({ blueprintId: normalizedBlueprintId, card: null, recipe: null, status: "loading" });

    Promise.all([
      fetchComponentCardById(normalizedBlueprintId).catch(() => null),
      getCraftingItemByBlueprintGuid(normalizedBlueprintId),
    ])
      .then(([card, loadedRecipe]) => {
        if (cancelled) return;
        setBridge({ blueprintId: normalizedBlueprintId, card, recipe: loadedRecipe, status: "ready" });
      })
      .catch(() => {
        if (!cancelled) setBridge({ blueprintId: normalizedBlueprintId, card: null, recipe: null, status: "error" });
      });

    return () => { cancelled = true; };
  }, [normalizedBlueprintId]);

  const bridgeMatchesSelection = bridge.blueprintId === normalizedBlueprintId;
  const componentCard = bridgeMatchesSelection ? bridge.card : null;
  const recipe = bridgeMatchesSelection ? bridge.recipe : null;
  const bridgeLoading = Boolean(normalizedBlueprintId) && (!bridgeMatchesSelection || bridge.status === "loading");

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
      error: bridge.status === "error" ? "Component statistics could not be prepared." : (isFpsItem ? null : fittingStatsError),
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

  return useMemo(() => ({
    model,
    productQuality,
    selectionId: item.id,
    hasError: bridge.status === "error" || Boolean(fittingStatsError),
  }), [bridge.status, fittingStatsError, item.id, model, productQuality]);
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
  const { model, selectionId, hasError } = useBuildQueueStatsContext();
  return <BuildQueueCraftStatisticsPanel model={model} selectionId={selectionId} hasError={hasError} />;
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
