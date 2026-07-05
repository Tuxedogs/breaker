import type { ReactNode } from "react";

type FittingStatCardProps = {
  title: string;
  action?: ReactNode;
  children: ReactNode;
};

export function FittingStatCard({ title, action, children }: FittingStatCardProps) {
  return (
    <article className="fit-stat-card">
      <header className="fit-stat-card-head">
        <h3>{title}</h3>
        {action}
      </header>
      <div className="fit-stat-card-body">{children}</div>
    </article>
  );
}

type FittingStatSectionProps = {
  title: string;
  children: ReactNode;
};

export function FittingStatSection({ title, children }: FittingStatSectionProps) {
  return (
    <section className="fit-stat-section">
      <h4 className="fit-stat-section-title">{title}</h4>
      <div className="fit-stat-section-body">{children}</div>
    </section>
  );
}

type FittingStatRowProps = {
  label: string;
  value: string;
  unit?: string;
  nested?: boolean;
  unavailable?: boolean;
  highlight?: "accent" | "good" | "bad";
};

export function FittingStatRow({
  label,
  value,
  unit,
  nested = false,
  unavailable = false,
  highlight,
}: FittingStatRowProps) {
  const valueClass = [
    "fit-stat-value",
    unavailable ? "fit-stat-value--unavail" : undefined,
    highlight === "accent" ? "fit-stat-value--accent" : undefined,
    highlight === "good" ? "fit-stat-value--good" : undefined,
    highlight === "bad" ? "fit-stat-value--bad" : undefined,
  ].filter(Boolean).join(" ");

  return (
    <div className={["fit-stat-row", nested ? "fit-stat-row--nested" : undefined].filter(Boolean).join(" ")}>
      <span className="fit-stat-label">{nested ? ` ${label}` : label}</span>
      <span className={valueClass}>
        {value}
        {unit && !unavailable ? <em className="fit-stat-unit">{unit}</em> : null}
      </span>
    </div>
  );
}

type FittingStatGridProps = {
  columns: Array<{ label: string; value: string; unavailable?: boolean; highlight?: "good" | "bad" }>;
};

export function FittingStatGrid({ columns }: FittingStatGridProps) {
  return (
    <div className="fit-stat-grid" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
      {columns.map((column) => (
        <div key={column.label} className="fit-stat-grid-col">
          <span className="fit-stat-grid-label">{column.label}</span>
          <span className={[
            "fit-stat-grid-value",
            column.unavailable ? "fit-stat-value--unavail" : undefined,
            column.highlight === "good" ? "fit-stat-value--good" : undefined,
            column.highlight === "bad" ? "fit-stat-value--bad" : undefined,
          ].filter(Boolean).join(" ")}>
            {column.value}
          </span>
        </div>
      ))}
    </div>
  );
}
