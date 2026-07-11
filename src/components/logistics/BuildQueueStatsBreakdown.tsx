import { useEffect, useMemo, useState } from "react";
import type { ComponentCardIndexRecord } from "@/lib/componentCardIndex";
import { fetchComponentCardById } from "@/lib/componentCardIndexApi";
import type { ComponentRecipe } from "@/components/industry/crafting/utils/craftingTypes";
import { getCraftingItemByBlueprintGuid } from "@/lib/craftingData";
import { resolveEntityClassForCraftingItem } from "@/lib/crafting/resolveEntityClass";
import { useFittingComponentStats } from "@/lib/fitting/useFittingComponentStats";
import { buildItemSummaryDetailStatRows } from "@/lib/fitting/fittingStatProjection";
import {
  buildModifiedDetailStatRows,
  type DetailStatRow,
} from "@/lib/crafting/craftingDetailStats";
import { computeTotalModifiersFromQualities } from "@/components/industry/crafting/utils/recipeQuality";
import { buildAllocatedMaterialQualities } from "@/lib/logistics/buildQueueCraftStats";
import type { BuildQueueItem } from "@/types/logistics";
import type { RecipeInputTemplate } from "@/data/logistics/seed";

interface Props {
  blueprintId?: string;
  item: BuildQueueItem;
  inputs: RecipeInputTemplate[];
}

type CardBridge = Pick<ComponentCardIndexRecord, "id" | "entityClass" | "kind">;
type RecipeBridge = Pick<ComponentRecipe, "blueprint_id" | "output_entityClass" | "item_kind">;

function StatTile({ stat }: { stat: DetailStatRow }) {
  return (
    <div className="bq-stat-tile">
      <span className="bq-stat-tile-label">{stat.label}</span>
      <span className="bq-stat-tile-value">
        <span className={stat.valueImpactClass ?? ""}>{stat.value}</span>
        {stat.modifier ? (
          <span className={`bq-stat-tile-delta ${stat.modifier.impactClass}`}>
            ({stat.modifier.value})
          </span>
        ) : null}
      </span>
    </div>
  );
}

export default function BuildQueueStatsBreakdown({ blueprintId, item, inputs }: Props) {
  const [cardBridge, setCardBridge] = useState<CardBridge | null>(null);
  const [recipe, setRecipe] = useState<ComponentRecipe | null>(null);
  const [bridgeLoading, setBridgeLoading] = useState(Boolean(blueprintId?.trim()));

  useEffect(() => {
    const normalizedBlueprintId = blueprintId?.trim();
    if (!normalizedBlueprintId) {
      queueMicrotask(() => {
        setCardBridge(null);
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
        setCardBridge(card ? { id: card.id, entityClass: card.entityClass, kind: card.kind } : null);
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

  const isFpsItem = recipeBridge?.item_kind === "fps" || cardBridge?.kind === "fps";

  const entityClass = useMemo(() => {
    if (isFpsItem || !blueprintId?.trim()) return null;
    return resolveEntityClassForCraftingItem({
      recipe: recipeBridge ?? { blueprint_id: blueprintId, output_entityClass: "" },
      cardBridge,
    }).entityClass;
  }, [blueprintId, cardBridge, isFpsItem, recipeBridge]);

  const {
    detail: fittingDetail,
    loading: fittingStatsLoading,
    missing: fittingStatsMissing,
    error: fittingStatsError,
  } = useFittingComponentStats(isFpsItem ? null : entityClass);

  const allocatedQualities = useMemo(
    () => (recipe ? buildAllocatedMaterialQualities(item, recipe, inputs) : {}),
    [item, recipe, inputs],
  );

  const totalModifiers = useMemo(
    () => (recipe ? computeTotalModifiersFromQualities(recipe, allocatedQualities) : []),
    [recipe, allocatedQualities],
  );

  const displayStatRows = useMemo(() => {
    if (!fittingDetail) return [];
    const baseStatRows = buildItemSummaryDetailStatRows(fittingDetail);
    return buildModifiedDetailStatRows(fittingDetail, baseStatRows, totalModifiers);
  }, [fittingDetail, totalModifiers]);

  const statsLoading = bridgeLoading || fittingStatsLoading;
  const hasStats = !statsLoading
    && !isFpsItem
    && Boolean(entityClass)
    && !fittingStatsMissing
    && !fittingStatsError
    && displayStatRows.length > 0;

  if (hasStats) {
    return (
      <div className="bq-stats-panel" aria-label="Component stats">
        <div className="bq-stats-strip">
          {displayStatRows.map((stat) => (
            <StatTile key={`${stat.label}:${stat.value}`} stat={stat} />
          ))}
        </div>
      </div>
    );
  }

  if (statsLoading) {
    return (
      <div className="bq-stats-panel bq-stats-panel--empty">
        <p className="bq-stats-breakdown-empty">Loading stats...</p>
      </div>
    );
  }

  return (
    <div className="bq-stats-panel bq-stats-panel--empty">
      <p className="bq-stats-breakdown-empty">Stats unavailable</p>
    </div>
  );
}
