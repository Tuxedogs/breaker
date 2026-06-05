import { useEffect, useMemo, useState } from "react";
import { getCraftingItems } from "../../../../lib/craftingData";
import { getDirectionLabel, getModifierImpact } from "../../../../lib/gameplay/propertyUtils";
import { formatProperty } from "../utils/qualityModifiers";
import type { QualityModifier } from "../utils/craftingTypes";

interface PropertyGroup {
  property: string;
  display_name: string;
  direction_label: string;
  component_types: string[];
  slots: string[];
  component_count: number;
  effect_range_min: string;
  effect_range_max: string;
  range_class_min: string;
  range_class_max: string;
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string") {
    const parsed = Number(value.replace("%", ""));
    if (Number.isFinite(parsed)) return parsed;
  }

  return fallback;
}

function formatSigned(value: number, decimals = 1): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(decimals)}`;
}

function formatPercent(value: number): string {
  return `${formatSigned(value, 1)}%`;
}

function formatPowerPips(value: number): string {
  const abs = Math.abs(value);
  const label = abs === 1 ? "power pip" : "power pips";
  return `${formatSigned(value, 0)} ${label}`;
}

function valueClass(property: string, value: number): string {
  const impact = getModifierImpact(property, value);

  if (impact === "good") return "craft-ok";
  if (impact === "bad") return "craft-shortage";

  return "craft-muted";
}

function uniqueSorted(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));
}

function isIntegerAdditive(modifier: QualityModifier): boolean {
  return String(modifier.modifier_mode ?? "").toLowerCase() === "integeradditive";
}

function getModifierStartValue(modifier: QualityModifier): number {
  if (isIntegerAdditive(modifier)) return toNumber(modifier.modifier_start, 0);
  return toNumber(modifier.modifier_start_percent, 0);
}

function getModifierEndValue(modifier: QualityModifier): number {
  if (isIntegerAdditive(modifier)) return toNumber(modifier.modifier_end, 0);
  return toNumber(modifier.modifier_end_percent, 0);
}

function formatModifierRangeValue(modifier: QualityModifier, value: number): string {
  if (isIntegerAdditive(modifier)) {
    if (modifier.gameplay_property === "GPP_ItemResource_PowerGeneration") {
      return formatPowerPips(value);
    }

    return formatSigned(value, 0);
  }

  return formatPercent(value);
}

function buildEffectRange(
  property: string,
  modifiers: QualityModifier[]
): Pick<
  PropertyGroup,
  "effect_range_min" | "effect_range_max" | "range_class_min" | "range_class_max"
> {
  if (modifiers.length === 0) {
    return {
      effect_range_min: "—",
      effect_range_max: "—",
      range_class_min: "craft-muted",
      range_class_max: "craft-muted",
    };
  }

  const values = modifiers.flatMap((modifier) => [
    {
      value: getModifierStartValue(modifier),
      modifier,
    },
    {
      value: getModifierEndValue(modifier),
      modifier,
    },
  ]);

  const minEntry = values.reduce((min, current) =>
    current.value < min.value ? current : min
  );

  const maxEntry = values.reduce((max, current) =>
    current.value > max.value ? current : max
  );

  return {
    effect_range_min: formatModifierRangeValue(minEntry.modifier, minEntry.value),
    effect_range_max: formatModifierRangeValue(maxEntry.modifier, maxEntry.value),
    range_class_min: valueClass(property, minEntry.value),
    range_class_max: valueClass(property, maxEntry.value),
  };
}

function buildPropertyGroups(modifiers: QualityModifier[]): PropertyGroup[] {
  const map = new Map<string, QualityModifier[]>();

  for (const modifier of modifiers) {
    const property = modifier.gameplay_property;
    const existing = map.get(property) ?? [];
    existing.push(modifier);
    map.set(property, existing);
  }

  return Array.from(map.entries())
    .map(([property, propertyModifiers]) => {
      const effectRange = buildEffectRange(property, propertyModifiers);

      return {
        property,
        display_name: formatProperty(property),
        direction_label: getDirectionLabel(property) || "Higher is better",
        component_types: uniqueSorted(propertyModifiers.map((modifier) => modifier.component_type)),
        slots: uniqueSorted(propertyModifiers.map((modifier) => modifier.slot)),
        component_count: new Set(
          propertyModifiers.map(
            (modifier) =>
              `${modifier.component_type}||${modifier.size}||${modifier.component_name}`
          )
        ).size,
        ...effectRange,
      };
    })
    .sort((a, b) => a.display_name.localeCompare(b.display_name));
}

function TypeList({ values }: { values: string[] }) {
  if (values.length === 0) return <span className="craft-dash">—</span>;

  return (
    <div className="craft-badge-row">
      {values.slice(0, 4).map((value) => (
        <span key={value} className="craft-badge craft-badge--type">
          {value}
        </span>
      ))}

      {values.length > 4 && (
        <span className="craft-badge craft-badge--sm">+{values.length - 4}</span>
      )}
    </div>
  );
}

function SlotList({ values }: { values: string[] }) {
  if (values.length === 0) return <span className="craft-dash">—</span>;

  return (
    <div className="craft-badge-row">
      {values.slice(0, 5).map((value) => (
        <span key={value} className="craft-badge craft-badge--slot craft-badge--sm">
          {value}
        </span>
      ))}

      {values.length > 5 && (
        <span className="craft-badge craft-badge--sm">+{values.length - 5}</span>
      )}
    </div>
  );
}

function EffectRange({ group }: { group: PropertyGroup }) {
  return (
    <>
      <span className={group.range_class_min}>{group.effect_range_min}</span>
      {" to "}
      <span className={group.range_class_max}>{group.effect_range_max}</span>
    </>
  );
}

export default function QualityModifierViewer() {
  const [modifiers, setModifiers] = useState<QualityModifier[]>([]);
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    getCraftingItems()
      .then((items) => {
        if (cancelled) return;

        const allModifiers = items.flatMap((item) => [
          ...(item.qualityModifiers ?? []),
          ...(item.overallQualityModifiers ?? []),
        ]);

        setModifiers(allModifiers);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load quality modifiers");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const componentTypes = useMemo(() => {
    return uniqueSorted(modifiers.map((modifier) => modifier.component_type));
  }, [modifiers]);

  const groups = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = modifiers.filter((modifier) => {
      if (typeFilter && modifier.component_type !== typeFilter) return false;

      if (query) {
        const displayProperty = formatProperty(modifier.gameplay_property).toLowerCase();
        const property = modifier.gameplay_property.toLowerCase();
        const slot = modifier.slot.toLowerCase();
        const componentType = modifier.component_type.toLowerCase();
        const componentName = modifier.component_name.toLowerCase();

        if (
          !displayProperty.includes(query) &&
          !property.includes(query) &&
          !slot.includes(query) &&
          !componentType.includes(query) &&
          !componentName.includes(query)
        ) {
          return false;
        }
      }

      return true;
    });

    return buildPropertyGroups(filtered);
  }, [modifiers, typeFilter, search]);

  const totalProperties = useMemo(() => {
    return new Set(modifiers.map((modifier) => modifier.gameplay_property)).size;
  }, [modifiers]);

  if (loading) {
    return (
      <div className="craft-section">
        <div className="craft-section-header">
          <span className="craft-section-title">Quality Modifiers</span>
          <span className="craft-count">Loading</span>
        </div>

        <div className="craft-empty">Loading quality modifier data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="craft-section">
        <div className="craft-section-header">
          <span className="craft-section-title">Quality Modifiers</span>
          <span className="craft-count craft-shortage">Error</span>
        </div>

        <div className="craft-empty">{error}</div>
      </div>
    );
  }

  return (
    <div className="craft-section">
      <div className="craft-section-header">
        <span className="craft-section-title">Quality Modifiers</span>
        <span className="craft-count">
          {groups.length} shown · {totalProperties} total properties
        </span>
      </div>

      <div className="craft-filter-bar">
        <div className="craft-search-wrap">
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="craft-search-icon"
            width="14"
            height="14"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>

          <input
            type="search"
            className="craft-search-input"
            placeholder="Search property, type, component, or slot..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <select
          className="craft-select"
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value)}
        >
          <option value="">All Component Types</option>
          {componentTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      <div className="craft-table-wrap">
        <table className="craft-table">
          <thead>
            <tr>
              <th>Modifier Type</th>
              <th>Direction</th>
              <th>Component Types</th>
              <th>Slots</th>
              <th>Components</th>
              <th>Effect Range</th>
            </tr>
          </thead>

          <tbody>
            {groups.map((group) => (
              <tr key={group.property} className="craft-table-row">
                <td className="craft-cell-name" title={group.property}>
                  {group.display_name}
                </td>

                <td className="craft-muted">{group.direction_label}</td>

                <td>
                  <TypeList values={group.component_types} />
                </td>

                <td>
                  <SlotList values={group.slots} />
                </td>

                <td className="craft-cell-mono">{group.component_count}</td>

                <td className="craft-cell-mono">
                  <EffectRange group={group} />
                </td>
              </tr>
            ))}

            {groups.length === 0 && (
              <tr>
                <td colSpan={6} className="craft-empty">
                  No modifiers match filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
