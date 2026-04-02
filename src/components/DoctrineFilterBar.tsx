import type { ModuleFilters } from "../lib/moduleFilters";

type FilterOptionSet = {
  ships: string[];
  roles: string[];
  enemies: string[];
  statuses: string[];
};

type DoctrineFilterBarProps = {
  filters: ModuleFilters;
  options: FilterOptionSet;
  onChange: (key: keyof ModuleFilters, value: string) => void;
  onClear?: () => void;
  title?: string;
  description?: string;
};

function labelize(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function SelectField({
  label,
  value,
  values,
  onChange,
}: {
  label: string;
  value: string;
  values: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="filter-field">
      <span className="filter-field-label">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="filter-field-select"
      >
        <option value="">All</option>
        {values.map((item) => (
          <option key={item} value={item}>
            {labelize(item)}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function DoctrineFilterBar({
  filters,
  options,
  onChange,
  onClear,
  title = "Global Module Filters",
  description = "Ship, role, enemy, and status.",
}: DoctrineFilterBarProps) {
  return (
    <section className="filter-doctrine">
      <div className="filter-head">
        <div className="filter-head-copy">
          <h2 className="filter-head-title">{title}</h2>
          <p className="filter-head-description">{description}</p>
        </div>
        {onClear ? (
          <button
            type="button"
            onClick={onClear}
            className="filter-clear"
          >
            Clear Filters
          </button>
        ) : null}
      </div>

      <div className="filter-grid">
        <SelectField label="Ship" value={filters.ship} values={options.ships} onChange={(value) => onChange("ship", value)} />
        <SelectField label="Role" value={filters.role} values={options.roles} onChange={(value) => onChange("role", value)} />
        <SelectField label="Enemy" value={filters.enemy} values={options.enemies} onChange={(value) => onChange("enemy", value)} />
        <SelectField label="Status" value={filters.status} values={options.statuses} onChange={(value) => onChange("status", value)} />
      </div>
    </section>
  );
}

