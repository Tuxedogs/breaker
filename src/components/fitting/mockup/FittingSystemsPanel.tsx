import type { SystemsGroupView } from "../../../lib/fitting/mockup/fittingMockupViewTypes";
import FittingEquipmentRow from "./FittingEquipmentRow";

type FittingSystemsPanelProps = {
  title: string;
  groups: SystemsGroupView[];
  emptyMessage?: string;
  className?: string;
  onSelectRow: (id: string) => void;
};

export default function FittingSystemsPanel({
  title,
  groups,
  emptyMessage,
  className,
  onSelectRow,
}: FittingSystemsPanelProps) {
  return (
    <aside className={["fm-panel", className].filter(Boolean).join(" ")}>
      <header className="fm-panel-head">
        <h2>{title}</h2>
      </header>
      <div className="fm-panel-scroll">
        {groups.map((group) => (
          <section key={group.key} className="fm-panel-group">
            <div className="fm-panel-group-head">
              <h3>{group.label}</h3>
              <span className="fm-panel-group-count">{group.count}</span>
            </div>
            {group.rows.map((row) => (
              <FittingEquipmentRow key={row.id} row={row} onSelect={onSelectRow} />
            ))}
          </section>
        ))}
        {groups.length === 0 && emptyMessage ? (
          <p className="fm-panel-empty">{emptyMessage}</p>
        ) : null}
      </div>
    </aside>
  );
}
