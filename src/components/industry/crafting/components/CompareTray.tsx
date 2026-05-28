import { Link, useLocation } from "react-router-dom";
import { useCompareStore } from "@/stores/compareStore";
import type { ComponentCardIndexRecord } from "@/lib/componentCardIndex";

export default function CompareTray() {
  const { slots, clearSlot, clearAll } = useCompareStore();
  const location = useLocation();
  const [a, b] = slots;

  if (!a && !b) return null;

  const filledCount = [a, b].filter(Boolean).length;
  const compareUrl = `/industry/crafting/compare${a || b ? `?${a ? `a=${a.id}` : ""}${a && b ? "&" : ""}${b ? `b=${b.id}` : ""}` : ""}`;

  return (
    <div className="cmp-tray" role="region" aria-label="Compare tray">
      <span className="cmp-tray-label">Compare</span>
      <div className="cmp-tray-slots">
        <TraySlot record={a} slotNum={1} onClear={() => clearSlot(0)} />
        <TraySlot record={b} slotNum={2} onClear={() => clearSlot(1)} />
      </div>
      {filledCount < 2 && (
        <span className="cmp-tray-hint">Select one more to compare</span>
      )}
      <button type="button" className="cmp-tray-clear" onClick={clearAll}>
        Clear
      </button>
      <Link
        className="cmp-tray-cta"
        to={compareUrl}
        state={{ from: location.pathname + location.search }}
        aria-disabled={!a || !b}
      >
        Compare ({filledCount})
      </Link>
    </div>
  );
}

function TraySlot({
  record,
  slotNum,
  onClear,
}: {
  record: ComponentCardIndexRecord | null;
  slotNum: number;
  onClear: () => void;
}) {
  return (
    <div className={`cmp-tray-slot${record ? " cmp-tray-slot--filled" : ""}`}>
      {record ? (
        <>
          <span className="cmp-tray-slot-badge">S{slotNum}</span>
          <div className="cmp-tray-slot-info">
            <span className="cmp-tray-slot-name" title={record.name}>{record.name}</span>
            <span className="cmp-tray-slot-type">{record.typeLabel}</span>
          </div>
          <button type="button" className="cmp-tray-slot-x" onClick={onClear} aria-label={`Remove ${record.name}`}>
            ×
          </button>
        </>
      ) : (
        <span className="cmp-tray-slot-empty">Slot {slotNum} empty</span>
      )}
    </div>
  );
}
