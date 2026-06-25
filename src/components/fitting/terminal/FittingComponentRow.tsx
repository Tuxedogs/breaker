import { FittingComponentIcon } from "../FittingComponentIcon";
import type { FittingIconMode } from "../../../lib/fitting/fittingIconMode";
import type { SummarizedRow } from "../../../lib/fitting/fittingPortGrouping";

type FittingComponentRowProps = {
  item: SummarizedRow;
  active: boolean;
  hasCustomQuality: boolean;
  craftable: boolean;
  iconMode: FittingIconMode;
  onSelect: () => void;
  onCraftClick: () => void;
};

export default function FittingComponentRow({
  item,
  active,
  hasCustomQuality,
  craftable,
  iconMode,
  onSelect,
  onCraftClick,
}: FittingComponentRowProps) {
  const firstRow = item.rows[0];
  const sizeLabel = item.size != null ? `S${item.size}` : "—";

  return (
    <div
      role="button"
      tabIndex={0}
      className={["fit-term-row", active ? "is-active" : ""].filter(Boolean).join(" ")}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <span className="fit-term-row-qty">{item.quantity}x</span>
      <span className="fit-term-row-size">{sizeLabel}</span>
      <FittingComponentIcon
        componentType={firstRow.componentCategory}
        componentName={item.name}
        size={item.size}
        preferredMode={iconMode}
        alt={item.name}
        iconSize="sm"
      />
      <span className="fit-term-row-main">
        <strong>
          {item.name}
          {hasCustomQuality && <i className="fit-term-custom-dot" title="Custom quality active" />}
          {craftable && (
            <button
              type="button"
              className="fit-term-craft-btn"
              title="Tune crafted quality"
              aria-label={`Tune crafted quality for ${item.name}`}
              onClick={(event) => {
                event.stopPropagation();
                onCraftClick();
              }}
            >
              ⚙
            </button>
          )}
        </strong>
        <span>{[item.type, item.manufacturer].filter(Boolean).join(" · ") || "Type unavailable"}</span>
      </span>
      {item.controlMode && <span className="fit-term-row-badge">{item.controlMode}</span>}
      <span className="fit-term-row-detail" title="Component replacement — future">›</span>
    </div>
  );
}
