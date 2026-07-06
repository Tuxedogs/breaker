import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { ComponentCardIndexRecord } from "@/lib/componentCardIndex";
import { fetchComponentCardById } from "@/lib/componentCardIndexApi";
import type { ComponentRecipe } from "@/components/industry/crafting/utils/craftingTypes";
import { getCraftingItemByBlueprintGuid } from "@/lib/craftingData";
import { resolveEntityClassForCraftingItem } from "@/lib/crafting/resolveEntityClass";
import { useFittingComponentStats } from "@/lib/fitting/useFittingComponentStats";
import { buildBuildQueueFittingStatGroups } from "./buildQueueStatsGroups";

interface Props {
  blueprintId?: string;
  recipeId: string;
}

type CardBridge = Pick<ComponentCardIndexRecord, "id" | "entityClass" | "kind">;
type RecipeBridge = Pick<ComponentRecipe, "blueprint_id" | "output_entityClass" | "item_kind">;

export default function BuildQueueStatsBreakdown({ blueprintId, recipeId }: Props) {
  const [cardBridge, setCardBridge] = useState<CardBridge | null>(null);
  const [recipeBridge, setRecipeBridge] = useState<RecipeBridge | null>(null);
  const [bridgeLoading, setBridgeLoading] = useState(Boolean(blueprintId?.trim()));

  useEffect(() => {
    const normalizedBlueprintId = blueprintId?.trim();
    if (!normalizedBlueprintId) {
      queueMicrotask(() => {
        setCardBridge(null);
        setRecipeBridge(null);
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
      .then(([card, recipe]) => {
        if (cancelled) return;
        setCardBridge(card ? { id: card.id, entityClass: card.entityClass, kind: card.kind } : null);
        setRecipeBridge(recipe
          ? {
            blueprint_id: recipe.blueprint_id,
            output_entityClass: recipe.output_entityClass,
            item_kind: recipe.item_kind,
          }
          : null);
      })
      .finally(() => {
        if (!cancelled) setBridgeLoading(false);
      });

    return () => { cancelled = true; };
  }, [blueprintId]);

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

  const groups = useMemo(
    () => buildBuildQueueFittingStatGroups(fittingDetail),
    [fittingDetail],
  );

  const statsLoading = bridgeLoading || fittingStatsLoading;

  const unavailableMessage = useMemo(() => {
    if (statsLoading) return null;
    if (isFpsItem) return "Fitting stats unsupported";
    if (!entityClass || fittingStatsMissing || fittingStatsError) return "Fitting stats unavailable";
    if (fittingDetail && groups.length === 0) return "Fitting stats unavailable";
    return null;
  }, [
    statsLoading,
    isFpsItem,
    entityClass,
    fittingStatsMissing,
    fittingStatsError,
    fittingDetail,
    groups.length,
  ]);

  return (
    <section className="bq-stats-breakdown" aria-label="Fitting base stats">
      <header className="bq-stats-breakdown-head">
        <h3>Fitting Base Stats</h3>
        <Link className="bq-stats-breakdown-link" to={`/industry/crafting?recipe=${encodeURIComponent(recipeId)}`}>
          View in Planner
        </Link>
      </header>
      {statsLoading ? (
        <p className="bq-stats-breakdown-empty">Loading fitting stats…</p>
      ) : unavailableMessage ? (
        <p className="bq-stats-breakdown-empty">{unavailableMessage}</p>
      ) : (
        <div className="bq-stats-breakdown-grid">
          {groups.map((group) => (
            <div className="bq-stats-breakdown-group" key={group.id}>
              <h4>{group.label}</h4>
              <dl className="bq-stats-breakdown-rows">
                {group.rows.map((row) => (
                  <div className="bq-stats-breakdown-row" key={`${group.id}:${row.label}`}>
                    <dt>{row.label}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
