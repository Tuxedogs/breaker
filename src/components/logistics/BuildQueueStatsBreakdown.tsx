import { useEffect, useMemo, useState } from "react";
import type { ComponentCardIndexRecord } from "@/lib/componentCardIndex";
import { fetchComponentCardById } from "@/lib/componentCardIndexApi";
import type { ComponentRecipe } from "@/components/industry/crafting/utils/craftingTypes";
import { getCraftingItemByBlueprintGuid } from "@/lib/craftingData";
import { resolveEntityClassForCraftingItem } from "@/lib/crafting/resolveEntityClass";
import { useFittingComponentStats } from "@/lib/fitting/useFittingComponentStats";
import { buildItemSummaryDetailStatRows } from "@/lib/fitting/fittingStatProjection";
import type { FittingComponentDetail } from "@/lib/fitting/fittingApi";
import {
  buildModifiedDetailStatRows,
  type DetailStatRow,
} from "@/lib/crafting/craftingDetailStats";
import {
  buildDetailStatGroups,
  type DetailStatGroup,
} from "@/lib/crafting/detailStatGroups";
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

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildIdentityBadges(detail: FittingComponentDetail): { label: string; value: string }[] {
  return [
    detail.size !== null ? { label: "Size", value: `S${detail.size}` } : null,
    detail.grade ? { label: "Grade", value: detail.grade } : null,
    detail.class ? { label: "Class", value: titleCase(detail.class) } : null,
    detail.manufacturer ? { label: "Maker", value: detail.manufacturer } : null,
  ].filter((badge): badge is { label: string; value: string } => Boolean(badge));
}

function DetailStatRowItem({ stat }: { stat: DetailStatRow }) {
  return (
    <span className="bq-detail-stat-row">
      <span className="bq-detail-stat-label">{stat.label}</span>
      <strong className="bq-detail-stat-value">
        <span className={stat.valueImpactClass ?? ""}>{stat.value}</span>
        {stat.modifier ? (
          <span className={`bq-detail-stat-delta ${stat.modifier.impactClass}`}>
            ({stat.modifier.value})
          </span>
        ) : null}
      </strong>
      {stat.modifier?.base ? (
        <span className="bq-detail-stat-base">Base {stat.modifier.base}</span>
      ) : null}
    </span>
  );
}

function StatMatrix({ group }: { group: Extract<DetailStatGroup, { kind: "matrix" }> }) {
  return (
    <div className="bq-stat-matrix" role="table" aria-label={group.title}>
      <div className="bq-stat-matrix-head" role="row">
        <span role="columnheader">Type</span>
        {group.columns.map((column) => (
          <span key={column} role="columnheader">{column}</span>
        ))}
      </div>
      {group.rows.map((row) => (
        <div key={row.label} className="bq-stat-matrix-row" role="row">
          <span role="rowheader">{row.label}</span>
          {row.values.map((value, index) => (
            <strong key={`${row.label}:${group.columns[index] ?? index}`} role="cell">{value}</strong>
          ))}
        </div>
      ))}
    </div>
  );
}

function StatGroup({ group }: { group: DetailStatGroup }) {
  return (
    <section className={`bq-stat-group bq-stat-group--${group.kind}`} aria-label={group.title}>
      <div className="bq-stat-group-title">{group.title}</div>
      {group.kind === "nested" ? (
        <div className="bq-stat-group-body">
          {group.subclusters.map((subcluster) => (
            <div key={subcluster.title} className="bq-stat-subcluster">
              <div className="bq-stat-subcluster-title">{subcluster.title}</div>
              <div className="bq-stat-row-grid">
                {subcluster.stats.map((stat) => (
                  <DetailStatRowItem key={`${group.title}:${subcluster.title}:${stat.label}`} stat={stat} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : group.kind === "matrix" ? (
        <StatMatrix group={group} />
      ) : (
        <div className="bq-stat-row-grid">
          {group.stats.map((stat) => (
            <DetailStatRowItem key={`${group.title}:${stat.label}`} stat={stat} />
          ))}
        </div>
      )}
    </section>
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

  const displayStatRows = useMemo<DetailStatRow[]>(() => {
    if (!fittingDetail) return [];
    const baseStatRows = buildItemSummaryDetailStatRows(fittingDetail);
    return buildModifiedDetailStatRows(fittingDetail, baseStatRows, totalModifiers);
  }, [fittingDetail, totalModifiers]);

  const statGroups = useMemo(
    () => (fittingDetail ? buildDetailStatGroups(fittingDetail, displayStatRows) : []),
    [displayStatRows, fittingDetail],
  );

  const identityBadges = useMemo(
    () => (fittingDetail ? buildIdentityBadges(fittingDetail) : []),
    [fittingDetail],
  );

  const statsLoading = bridgeLoading || fittingStatsLoading;
  const hasStats = !statsLoading
    && !isFpsItem
    && Boolean(entityClass)
    && !fittingStatsMissing
    && !fittingStatsError
    && statGroups.length > 0;

  if (hasStats) {
    return (
      <div className="bq-stats-panel" aria-label="Component stats">
        {identityBadges.length > 0 ? (
          <div className="bq-stats-meta" aria-label="Component identity">
            {identityBadges.map((badge) => (
              <span key={`${badge.label}:${badge.value}`} className="bq-stats-meta-badge">
                <span>{badge.label}</span>
                <strong>{badge.value}</strong>
              </span>
            ))}
          </div>
        ) : null}
        <div className="bq-stat-groups">
          {statGroups.map((group) => (
            <StatGroup key={group.title} group={group} />
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
