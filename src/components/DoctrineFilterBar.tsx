import type { ModuleFilters } from "../lib/moduleFilters";

type FilterOptionSet = {
  ships: string[];
  roles: string[];
  enemies: string[];
  maps: string[];
  statuses: string[];
  types: string[];
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
    <label className="flex min-w-0 flex-col gap-1 text-xs uppercase tracking-[0.16em] text-slate-300">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-lg border border-white/20 bg-slate-950/60 px-3 text-sm normal-case tracking-normal text-slate-100 outline-none"
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
  description = "Ship, role, enemy, map, status, and module type.",
}: DoctrineFilterBarProps) {
  return (
    <section className="framework-modern-card framework-modern-card-systems framework-modern-card-compact rounded-[1.5rem] p-4 sm:p-5">
      <div className="framework-modern-card-head rounded-xl p-4">
        <h2 className="title-font text-lg text-cyan-200">{title}</h2>
        <p className="mt-2 text-sm text-slate-300">{description}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SelectField label="Ship" value={filters.ship} values={options.ships} onChange={(value) => onChange("ship", value)} />
        <SelectField label="Role" value={filters.role} values={options.roles} onChange={(value) => onChange("role", value)} />
        <SelectField label="Enemy" value={filters.enemy} values={options.enemies} onChange={(value) => onChange("enemy", value)} />
        <SelectField label="Map" value={filters.map} values={options.maps} onChange={(value) => onChange("map", value)} />
        <SelectField label="Status" value={filters.status} values={options.statuses} onChange={(value) => onChange("status", value)} />
        <SelectField label="Type" value={filters.type} values={options.types} onChange={(value) => onChange("type", value)} />
      </div>

      {onClear ? (
        <button
          type="button"
          onClick={onClear}
          className="mt-1 inline-flex h-11 items-center justify-center rounded-lg border border-white/30 bg-white/5 px-4 text-xs uppercase tracking-[0.18em] text-slate-200"
        >
          Clear Filters
        </button>
      ) : null}
    </section>
  );
}

