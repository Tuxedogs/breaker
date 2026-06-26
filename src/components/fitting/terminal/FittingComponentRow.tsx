import { FittingComponentIcon } from "../FittingComponentIcon";
import type { FittingIconMode } from "../../../lib/fitting/fittingIconMode";
import type { SummarizedRow } from "../../../lib/fitting/fittingPortGrouping";

type FittingComponentRowProps = {
  summary: SummarizedRow;
  active: boolean;
  craftOpen: boolean;
  hasCustomQuality: boolean;
  craftable: boolean;
  iconMode: FittingIconMode;
  onSelect: () => void;
  onCraftClick: () => void;
};

function quantityLabel(summary: SummarizedRow): string {
  const sizePart = summary.size != null ? `S${summary.size}` : null;
  if (summary.quantity > 1 && sizePart) return `${summary.quantity}x ${sizePart}`;
  if (summary.quantity > 1) return `${summary.quantity}x`;
  if (sizePart) return sizePart;
  return "1x";
}

function turretWeaponLine(summary: SummarizedRow): string {
  const sizePart = summary.size != null ? `S${summary.size} ` : "";
  return `x${summary.quantity} ${sizePart}${summary.name}`.replace(/\s+/g, " ").trim();
}

export default function FittingComponentRow({
  summary,
  active,
  craftOpen,
  hasCustomQuality,
  craftable,
  iconMode,
  onSelect,
  onCraftClick,
}: FittingComponentRowProps) {
  const firstRow = summary.rows[0];
  const isTurretRow = Boolean(summary.turretLabel);
  const sublabel = isTurretRow
    ? summary.manufacturer ?? summary.type
    : summary.manufacturer ?? summary.type;

  return (
    <div
      role="button"
      tabIndex={0}
      className={["fit-term-row", isTurretRow ? "fit-term-row--turret" : "", active ? "is-active" : "", craftOpen ? "is-craft-open" : ""].filter(Boolean).join(" ")}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <span className="fit-term-row-icon" aria-hidden>
        <FittingComponentIcon
          componentType={firstRow.componentCategory}
          componentName={summary.name}
          size={summary.size}
          preferredMode={iconMode}
          alt=""
          iconSize="sm"
        />
      </span>
      <span className="fit-term-row-main">
        {isTurretRow ? (
          <>
            <strong className="fit-term-row-turret">{summary.turretLabel}</strong>
            <span className="fit-term-row-weapon-line">{turretWeaponLine(summary)}</span>
            {sublabel && <span className="fit-term-row-meta">{sublabel}</span>}
          </>
        ) : (
          <>
            <span className="fit-term-row-title-line">
              <span className="fit-term-row-qty">{quantityLabel(summary)}</span>
              <strong className="fit-term-row-name">{summary.name}</strong>
              {hasCustomQuality && <i className="fit-term-custom-dot" title="Custom quality active" />}
              {craftable && (
                <button
                  type="button"
                  className={["fit-term-craft-btn", craftOpen ? "is-active" : ""].filter(Boolean).join(" ")}
                  title="Tune crafted quality"
                  aria-label={`Tune crafted quality for ${summary.name}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onCraftClick();
                  }}
                >
                  ⚙
                </button>
              )}
            </span>
            {sublabel && <span className="fit-term-row-meta">{sublabel}</span>}
          </>
        )}
        {isTurretRow && (hasCustomQuality || craftable) && (
          <span className="fit-term-row-title-line">
            {hasCustomQuality && <i className="fit-term-custom-dot" title="Custom quality active" />}
            {craftable && (
              <button
                type="button"
                className={["fit-term-craft-btn", craftOpen ? "is-active" : ""].filter(Boolean).join(" ")}
                title="Tune crafted quality"
                aria-label={`Tune crafted quality for ${summary.name}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onCraftClick();
                }}
              >
                ⚙
              </button>
            )}
          </span>
        )}
      </span>
    </div>
  );
}
