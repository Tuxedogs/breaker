import { Link } from "react-router-dom";
import type { ComponentRecipe } from "../utils/craftingTypes";
import { buildComponentCardSchema, buildComponentCardSchemaFromIndex } from "../utils/componentCardSchema";
import type { ComponentCardSchema } from "../utils/componentCardSchema";
import type { ComponentCardIndexRecord } from "@/lib/componentCardIndex";

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
}: {
  recipe?: ComponentRecipe;
  record?: ComponentCardIndexRecord;
  queued: boolean;
  saved: boolean;
  familyVariantCounts?: Map<string, number>;
}) {
  const schema = record
    ? buildComponentCardSchemaFromIndex(record)
    : buildComponentCardSchema(recipe as ComponentRecipe, familyVariantCounts);
  const visibleStats = [...schema.familyStats, ...schema.genericStats].slice(0, 5);

  return (
    <article className="component-result-card">
      <Link className="component-result-card__hit" to={`/industry/crafting/${schema.id}`}>
        <span className="component-result-card__topline">
          <span className="component-result-card__kind">{schema.typeLabel}</span>
          <span className="component-result-card__id">{schema.id.slice(0, 8)}</span>
        </span>

        <h3 className="component-result-card__title">{schema.displayName}</h3>

        <div className="component-result-card__subline">
          <span>{schema.kindLabel}</span>
          {record?.type && <span>{record.type}</span>}
          {recipe?.component_type && <span>{recipe.component_type}</span>}
          {schema.categoryLabel && schema.categoryLabel !== (record?.type ?? recipe?.component_type) && <span>{schema.categoryLabel}</span>}
        </div>

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

        {schema.modifierLabels.length > 0 && (
          <div className="component-card-modifiers" aria-label="Quality modifier labels">
            {schema.modifierLabels.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
        )}

        <MaterialsPreview schema={schema} />

        <span className="component-result-card__footer">
          <span className="component-card-state">
            {queued && <span className="craft-mini-chip craft-mini-chip--queue">Queued</span>}
            {saved && <span className="craft-mini-chip craft-mini-chip--saved">Saved</span>}
            {!queued && !saved && <span className="component-card-state__empty" aria-hidden="true" />}
          </span>
          <span className="component-card-action">Craft</span>
        </span>
      </Link>
    </article>
  );
}
