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
import { useFittingComponentStats, useFpsFittingComponentFromCard } from "@/lib/fitting/useFittingComponentStats";
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
    detail: vehicleFittingDetail,
    loading: fittingStatsLoading,
  } = useFittingComponentStats(isFpsItem ? null : entityClass);

  const {
    detail: fpsFittingDetail,
    loading: fpsFittingLoading,
  } = useFpsFittingComponentFromCard(isFpsItem ? record : null);

  const fittingDetail = isFpsItem ? fpsFittingDetail : vehicleFittingDetail;
  const fittingLoading = isFpsItem ? fpsFittingLoading : fittingStatsLoading;

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
  const catalogStats = [
    ...(Array.isArray(schema.familyStats) ? schema.familyStats : []),
    ...(Array.isArray(schema.genericStats) ? schema.genericStats : []),
  ];
  const modifierLabels = Array.isArray(schema.modifierLabels) ? schema.modifierLabels : [];
  const classificationBadges = weaponPresentation?.badges ?? [];

  const fittingStats = useMemo(() => {
    if (isFpsItem || !fittingDetail) return [];
    return buildBrowseStatPreviewFromFitting(fittingDetail);
  }, [isFpsItem, fittingDetail]);

  const visibleStats = [...catalogStats, ...fittingStats].filter((metric, index, metrics) => (
    metrics.findIndex((candidate) => candidate.label === metric.label) === index
  ));
  const coreMetrics = (visibleStats.length > 0 ? visibleStats : meta).slice(0, 3);
  const coreMetricKeys = new Set(coreMetrics.map((metric) => `${metric.label}:${metric.value}`));
  const secondaryMetrics = [
    ...(visibleStats.length > 0 ? visibleStats.slice(3) : meta.slice(3)),
    ...(visibleStats.length > 0 ? meta : []),
  ].filter((metric, index, metrics) => {
    const key = `${metric.label}:${metric.value}`;
    return !coreMetricKeys.has(key)
      && metrics.findIndex((candidate) => `${candidate.label}:${candidate.value}` === key) === index;
  }).slice(0, 5);

  const showStatUnavailable = Boolean(record && !fittingLoading && visibleStats.length === 0);

  const statUnavailableMessage = "Base stats unavailable";

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
        <header className="component-result-card__identity">
          <span className="component-result-card__eyebrow">
            <span className="component-result-card__kind">{schema.kindLabel}</span>
            <span className="component-result-card__category">{schema.categoryLabel ?? schema.typeLabel}</span>
          </span>
          <h3 className="component-result-card__title">{weaponPresentation?.displayName ?? resolvedCardTitle}</h3>
        </header>

        <div className="component-result-card__product">
          <div className="component-result-card__image-stage">
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

          {coreMetrics.length > 0 ? (
            <div className="component-card-metrics component-card-metrics--core">
              {coreMetrics.map((metric) => (
                <MetricRow
                  key={`${metric.label}:${metric.value}`}
                  metric={metric}
                  primary={isShipWeapon && metric.label === "Alpha Damage"}
                />
              ))}
            </div>
          ) : null}
        </div>

        {secondaryMetrics.length > 0 ? (
          <div className="component-card-secondary-metrics" aria-label="Additional component information">
            {secondaryMetrics.map((metric) => (
              <span key={`${metric.label}:${metric.value}`}>
                <small>{metric.label}</small>
                <strong>{metric.value}</strong>
              </span>
            ))}
          </div>
        ) : null}

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
