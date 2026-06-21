import { Link, useLocation } from "react-router-dom";
import type { ComponentRecipe } from "../utils/craftingTypes";
import { buildComponentCardSchema, buildComponentCardSchemaFromIndex } from "../utils/componentCardSchema";
import type { ComponentCardSchema } from "../utils/componentCardSchema";
import type { ComponentCardIndexRecord } from "@/lib/componentCardIndex";
import { getComponentCategoryIconUrl } from "@/lib/componentCategoryIcon";
import { getShipWeaponBadgeClassName } from "../utils/shipWeaponCardDisplay";

function MetricRow({ metric }: { metric: ComponentCardSchema["meta"][number] }) {
  return (
    <span className="component-card-metric">
      <span>{metric.label}</span>
      <strong>{metric.value}</strong>
    </span>
  );
}

function MaterialsPreview({ schema }: { schema: ComponentCardSchema }) {
  const remaining = schema.materialsPreview.length;
  if (remaining === 0) return null;

  return (
    <div className="component-card-materials" aria-label="Materials preview">
      {schema.materialsPreview.map((material) => (
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
  const schema = record
    ? buildComponentCardSchemaFromIndex(record)
    : buildComponentCardSchema(recipe as ComponentRecipe, familyVariantCounts);
  const visibleStats = [...schema.familyStats, ...schema.genericStats].slice(0, 5);
  const iconUrl = record ? getComponentCategoryIconUrl(record) : null;
  const isShipWeapon = record?.type === "weaponGun" || recipe?.component_type === "weaponGun";
  const location = useLocation();

  return (
    <article className={`component-result-card${isShipWeapon ? " component-result-card--weapon" : ""}`}>
      <Link
        className="component-result-card__hit"
        to={`/industry/crafting/${schema.id}`}
        state={{ from: location.pathname + location.search }}
      >
        {isShipWeapon ? (
          <div className="component-result-card__title-row">
            <h3 className="component-result-card__title">{schema.displayName}</h3>
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

            <h3 className="component-result-card__title">{schema.displayName}</h3>
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

        {schema.meta.length > 0 && (
          <div className="component-card-metrics component-card-metrics--meta">
            {schema.meta.slice(0, 5).map((metric) => (
              <MetricRow key={`${metric.label}:${metric.value}`} metric={metric} />
            ))}
          </div>
        )}

        {visibleStats.length > 0 && (
          <div className="component-card-metrics">
            {visibleStats.map((metric) => (
              <MetricRow key={`${metric.label}:${metric.value}`} metric={metric} />
            ))}
          </div>
        )}

        {(schema.classificationBadges?.length ?? 0) > 0 && (
          <div className="component-card-modifiers" aria-label="Weapon classification">
            {schema.classificationBadges?.map((badge) => (
              <span key={badge.label} className={getShipWeaponBadgeClassName(badge.variant)}>
                {badge.label}
              </span>
            ))}
          </div>
        )}

        {!isShipWeapon && schema.modifierLabels.length > 0 && (
          <div className="component-card-craft-modifiers" aria-label="Crafting modifier labels">
            {schema.modifierLabels.map((label) => (
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
