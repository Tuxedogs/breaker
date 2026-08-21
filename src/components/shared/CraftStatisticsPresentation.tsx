import type { ReactNode } from "react";

type CraftStatSectionProps = {
  title: string;
  ariaLabel: string;
  variant: "compact" | "comparison";
  icon?: ReactNode;
  children: ReactNode;
};

export function CraftStatSection({
  title,
  ariaLabel,
  variant,
  icon,
  children,
}: CraftStatSectionProps) {
  const isComparison = variant === "comparison";
  const Heading = isComparison ? "h5" : "h4";

  return (
    <section
      className={`craft-stat-section craft-stat-section--${variant} ${isComparison ? "bq-stat-modified-group" : "bq-stat-unmodified-group"}`}
      aria-label={ariaLabel}
    >
      <div
        className={`craft-stat-section-surface craft-stat-section-surface--${variant} ${isComparison ? "bq-stat-compare bq-stat-modified-list" : "bq-stat-unmodified-card"}`}
      >
        <Heading className="craft-stat-section-title bq-stat-compare-group-title">
          {icon ? <span className="craft-stat-section-icon" aria-hidden="true">{icon}</span> : null}
          <span>{title}</span>
        </Heading>
        <div className="craft-stat-section-list" role="list">
          {children}
        </div>
      </div>
    </section>
  );
}

type CompactCraftStatRowProps = {
  label: string;
  labelMetadata?: string;
  value: string;
  baseValue?: string;
  delta?: string;
  unit?: string;
  valueClassName?: string;
};

export function CompactCraftStatRow({
  label,
  labelMetadata,
  value,
  baseValue,
  delta,
  unit,
  valueClassName,
}: CompactCraftStatRowProps) {
  const visibleUnit = unit && unit !== "-" ? unit : null;
  const isModified = baseValue !== undefined;

  return (
    <div
      className="craft-stat-compact-row bq-stat-compact-row"
      role="listitem"
      aria-label={`${label}${labelMetadata ? ` ${labelMetadata}` : ""}: ${isModified ? `${baseValue} changed to ` : ""}${value}${visibleUnit ? ` ${visibleUnit}` : ""}${delta ? `, ${delta}` : ""}`}
    >
      <span className="craft-stat-compact-label bq-stat-compact-label">
        {label}
        {labelMetadata ? (
          <span className="craft-stat-label-metadata"> {labelMetadata}</span>
        ) : null}
      </span>
      <span className="craft-stat-compact-reading">
        {isModified ? (
          <>
            <span className="craft-stat-compact-reading-part craft-stat-compact-reading-part--base">
              <strong className="craft-stat-compact-base-value">{baseValue}</strong>
            </span>
            <span className="craft-stat-compact-arrow" aria-hidden="true">→</span>
          </>
        ) : null}
        <span className="craft-stat-compact-reading-part craft-stat-compact-reading-part--current">
          <strong className={`craft-stat-compact-value bq-stat-compact-value ${valueClassName ?? ""}`.trim()}>
            {value}
          </strong>
          {visibleUnit ? <span className="craft-stat-compact-unit bq-stat-compact-unit">{visibleUnit}</span> : null}
        </span>
        {isModified && delta ? (
          <span className={`craft-stat-compact-delta ${valueClassName ?? ""}`.trim()}>{delta}</span>
        ) : null}
      </span>
    </div>
  );
}

type CraftStatComparisonRowProps = {
  label: string;
  unit?: string;
  base: ReactNode;
  target: ReactNode;
  allocation: ReactNode;
  direction: ReactNode;
  benefitDirection: string;
};

export function CraftStatComparisonRow({
  label,
  unit,
  base,
  target,
  allocation,
  direction,
  benefitDirection,
}: CraftStatComparisonRowProps) {
  const visibleUnit = unit && unit !== "-" ? unit : null;

  return (
    <article
      className="craft-stat-comparison-row bq-stat-compare-row"
      data-bq-benefit-direction={benefitDirection}
      aria-label={`${label} comparison`}
      role="listitem"
    >
      <div className="craft-stat-comparison-heading bq-stat-compare-heading">
        <strong className="craft-stat-comparison-label bq-stat-compare-label">{label}</strong>
        {visibleUnit ? (
          <span className="craft-stat-comparison-unit bq-stat-compare-unit">{visibleUnit}</span>
        ) : null}
      </div>
      <div className="craft-stat-comparison-values bq-stat-compare-values">
        <span className="craft-stat-comparison-slot craft-stat-comparison-slot--base bq-stat-compare-slot bq-stat-compare-base">
          <span className="craft-stat-comparison-slot-label bq-stat-compare-slot-label">Base</span>
          <span className="craft-stat-comparison-slot-content bq-stat-compare-slot-content">{base}</span>
        </span>
        <span className="craft-stat-comparison-slot craft-stat-comparison-slot--target bq-stat-compare-slot bq-stat-compare-target">
          <span className="craft-stat-comparison-slot-label bq-stat-compare-slot-label">Target</span>
          <span className="craft-stat-comparison-slot-content bq-stat-compare-slot-content">{target}</span>
        </span>
        <span className="craft-stat-comparison-slot craft-stat-comparison-slot--allocation bq-stat-compare-slot bq-stat-compare-allocation">
          <span className="craft-stat-comparison-slot-label bq-stat-compare-slot-label">Allocation</span>
          <span className="craft-stat-comparison-slot-content bq-stat-compare-slot-content">{allocation}</span>
        </span>
      </div>
      <div className="craft-stat-comparison-direction bq-stat-compare-direction">{direction}</div>
    </article>
  );
}
