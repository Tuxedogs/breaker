import { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import type { ComponentRecipe } from "../utils/craftingTypes";
import {
  buildComponentCardBrowseMetadataFromIndex,
  buildComponentCardSchema,
} from "../utils/componentCardSchema";
import type { ComponentCardSchema } from "../utils/componentCardSchema";
import type { ComponentCardIndexRecord } from "@/lib/componentCardIndex";
import { getComponentCategoryIconUrl } from "@/lib/componentCategoryIcon";
import { resolveEntityClassForCraftingItem } from "@/lib/crafting/resolveEntityClass";
import { resolveCraftingDisplayName, resolveCraftingCardTitle, resolveCraftingVariantLabel } from "@/lib/crafting/resolveCraftingDisplayName";
import {
  buildBrowseStatPreviewFromFitting,
  inferPrimaryShipWeaponDamageType,
} from "@/lib/fitting/fittingStatProjection";
import { useFittingComponentStats } from "@/lib/fitting/useFittingComponentStats";
import {
  buildShipWeaponBrowsePresentation,
  getShipWeaponBadgeClassName,
} from "../utils/shipWeaponCardDisplay";

function MetricRow({ metric, primary = false }: { metric: ComponentCardSchema["meta"][number]; primary?: boolean }) {
  return (
    <span className={`component-card-metric${primary ? " component-card-metric--primary" : ""}`}>
      <span>{metric.label}</span>
      <strong>{metric.value}</strong>
    </span>
  );
}

function MaterialsPreview({ schema }: { schema: ComponentCardSchema }) {
  const materialsPreview = Array.isArray(schema.materialsPreview) ? schema.materialsPreview : [];
  const remaining = materialsPreview.length;
  if (remaining === 0) return null;

  return (
    <div className="component-card-materials" aria-label="Materials preview">
      {materialsPreview.map((material) => (
        <span key={`${schema.id}:${material.slot}:${material.cost_id}`} className="component-card-material">
          <strong>{material.material_name}</strong>
          <span>{material.quantity}</span>
        </span>
      ))}
    </div>
  );
}

export default function ComponentResultCard({
  recipe,
  record,
  queued,
  saved,
  familyVariantCounts,
  variantCount,
}: {
  recipe?: ComponentRecipe;
  record?: ComponentCardIndexRecord;
  queued: boolean;
  saved: boolean;
  familyVariantCounts?: Map<string, number>;
  variantCount?: number;
}) {
  const isFpsItem = record?.kind === "fps";
  const entityClass = useMemo(() => {
    if (!record || isFpsItem) return null;
    return resolveEntityClassForCraftingItem({
      recipe: recipe
        ? { blueprint_id: recipe.blueprint_id, output_entityClass: recipe.output_entityClass }
        : undefined,
      cardBridge: record,
    }).entityClass;
  }, [record, recipe, isFpsItem]);

  const {
    detail: fittingDetail,
    loading: fittingStatsLoading,
    missing: fittingStatsMissing,
    error: fittingStatsError,
  } = useFittingComponentStats(isFpsItem ? null : entityClass);

  const resolvedDisplayName = useMemo(
    () => resolveCraftingDisplayName({
      fittingDetail,
      recipe,
      card: record,
    }),
    [fittingDetail, recipe, record],
  );

  const resolvedCardTitle = useMemo(
    () => resolveCraftingCardTitle({
      fittingDetail,
      recipe,
      card: record,
    }),
    [fittingDetail, recipe, record],
  );

  const resolvedVariantLabel = useMemo(
    () => resolveCraftingVariantLabel({
      fittingDetail,
      recipe,
      card: record,
    }),
    [fittingDetail, recipe, record],
  );

  const weaponPresentation = record?.type === "weaponGun"
    ? buildShipWeaponBrowsePresentation(
      record,
      inferPrimaryShipWeaponDamageType(fittingDetail),
    )
    : null;

  const schema = record
    ? buildComponentCardBrowseMetadataFromIndex(record, {
      displayName: weaponPresentation?.displayName ?? resolvedDisplayName,
      variantLabel: resolvedVariantLabel,
    })
    : buildComponentCardSchema(recipe as ComponentRecipe, familyVariantCounts, {
      displayName: resolvedDisplayName,
      variantLabel: resolvedVariantLabel,
    });

  const meta = Array.isArray(schema.meta) ? schema.meta : [];
  const modifierLabels = Array.isArray(schema.modifierLabels) ? schema.modifierLabels : [];
  const classificationBadges = weaponPresentation?.badges ?? [];

  const visibleStats = useMemo(() => {
    if (isFpsItem || !fittingDetail) return [];
    return buildBrowseStatPreviewFromFitting(fittingDetail);
  }, [isFpsItem, fittingDetail]);

  const showStatUnavailable = useMemo(() => {
    if (!record || fittingStatsLoading) return false;
    if (isFpsItem) return true;
    if (!entityClass || fittingStatsMissing || fittingStatsError) return true;
    if (fittingDetail && visibleStats.length === 0) return true;
    return false;
  }, [
    record,
    fittingStatsLoading,
    isFpsItem,
    entityClass,
    fittingStatsMissing,
    fittingStatsError,
    fittingDetail,
    visibleStats.length,
  ]);

  const statUnavailableMessage = isFpsItem
    ? "Fitting stats unsupported"
    : "Fitting stats unavailable";

  const iconUrl = record ? getComponentCategoryIconUrl(record) : null;
  const isShipWeapon = record?.type === "weaponGun" || recipe?.component_type === "weaponGun";
  const location = useLocation();

  return (
    <article className={`component-result-card ops-primary-card${isShipWeapon ? " component-result-card--weapon" : ""}`}>
      <Link
        className="component-result-card__hit"
        to={{
          pathname: `/industry/crafting/${schema.id}`,
          search: location.search,
        }}
        state={{ from: location.pathname + location.search }}
      >
        {isShipWeapon ? (
          <div className="component-result-card__title-row">
            <h3 className="component-result-card__title">{weaponPresentation?.displayName ?? resolvedCardTitle}</h3>
            {iconUrl ? (
              <img
                src={iconUrl}
                alt=""
                aria-hidden="true"
                className="component-result-card__cat-icon"
              />
            ) : (
              <span className="component-result-card__id">{schema.id.slice(0, 8)}</span>
            )}
          </div>
        ) : (
          <>
            <span className="component-result-card__topline">
              <span className="component-result-card__kind">{schema.typeLabel}</span>
              {iconUrl ? (
                <img
                  src={iconUrl}
                  alt=""
                  aria-hidden="true"
                  className="component-result-card__cat-icon"
                />
              ) : (
                <span className="component-result-card__id">{schema.id.slice(0, 8)}</span>
              )}
            </span>

            <h3 className="component-result-card__title">{resolvedCardTitle}</h3>
          </>
        )}

        {record?.type !== "weaponGun" && (
          <div className="component-result-card__subline">
            <span>{schema.kindLabel}</span>
            {record?.type && <span>{record.type}</span>}
            {recipe?.component_type && <span>{recipe.component_type}</span>}
            {schema.categoryLabel && schema.categoryLabel !== (record?.type ?? recipe?.component_type) && <span>{schema.categoryLabel}</span>}
          </div>
        )}

        {meta.length > 0 && (
          <div className="component-card-metrics component-card-metrics--meta">
            {meta.slice(0, 5).map((metric) => (
              <MetricRow key={`${metric.label}:${metric.value}`} metric={metric} />
            ))}
          </div>
        )}

        {visibleStats.length > 0 && (
          <div className="component-card-metrics">
            {visibleStats.map((metric) => (
              <MetricRow
                key={`${metric.label}:${metric.value}`}
                metric={metric}
                primary={isShipWeapon && metric.label === "Alpha Damage"}
              />
            ))}
          </div>
        )}

        {showStatUnavailable && (
          <p className="component-card-stat-unavailable craft-muted" aria-label="Stat preview unavailable">
            {statUnavailableMessage}
          </p>
        )}

        {classificationBadges.length > 0 && (
          <div className="component-card-modifiers" aria-label="Weapon classification">
            {classificationBadges.map((badge) => (
              <span key={badge.label} className={getShipWeaponBadgeClassName(badge.variant)}>
                {badge.label}
              </span>
            ))}
          </div>
        )}

        {!isShipWeapon && modifierLabels.length > 0 && (
          <div className="component-card-craft-modifiers" aria-label="Crafting modifier labels">
            {modifierLabels.map((label) => (
              <span key={label} className="component-card-craft-modifier">{label}</span>
            ))}
          </div>
        )}

        <MaterialsPreview schema={schema} />

        <span className="component-result-card__footer">
          <span className="component-card-state">
            {queued && <span className="craft-mini-chip craft-mini-chip--queue">Queued</span>}
            {saved && <span className="craft-mini-chip craft-mini-chip--saved">Saved</span>}
            {variantCount && variantCount > 1 && (
              <span className="craft-mini-chip craft-mini-chip--variants">{variantCount} variants</span>
            )}
            {!queued && !saved && !(variantCount && variantCount > 1) && (
              <span className="component-card-state__empty" aria-hidden="true" />
            )}
          </span>
          <span className="component-card-action">Craft</span>
        </span>
      </Link>
    </article>
  );
}
