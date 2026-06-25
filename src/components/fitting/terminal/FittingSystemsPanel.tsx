import type { NamedGroup } from "../../../lib/fitting/fittingPortGrouping";
import type { FittingIconMode } from "../../../lib/fitting/fittingIconMode";
import FittingSystemGroup from "./FittingSystemGroup";

type FittingSystemsPanelProps = {
  title: string;
  groups: NamedGroup[];
  selectedPortId: string | null;
  craftOverridePortIds: Set<string>;
  craftablePortIds: Set<string>;
  iconMode: FittingIconMode;
  onSelectPort: (portId: string, componentId: string | null) => void;
  onCraftPort: (portId: string) => void;
};

export default function FittingSystemsPanel({
  title,
  groups,
  selectedPortId,
  craftOverridePortIds,
  craftablePortIds,
  iconMode,
  onSelectPort,
  onCraftPort,
}: FittingSystemsPanelProps) {
  const visibleGroups = groups.filter((group) => group.rows.length > 0);

  return (
    <aside className="fit-term-systems" aria-label={title}>
      <header className="fit-term-systems-head">
        <h2>{title}</h2>
      </header>
      <div className="fit-term-systems-scroll">
        {visibleGroups.length === 0 && (
          <p className="fit-term-empty">No installed systems in this category for the current loadout.</p>
        )}
        {visibleGroups.map((group) => (
          <FittingSystemGroup
            key={group.key}
            group={group}
            selectedPortId={selectedPortId}
            craftOverridePortIds={craftOverridePortIds}
            craftablePortIds={craftablePortIds}
            iconMode={iconMode}
            onSelectPort={onSelectPort}
            onCraftPort={onCraftPort}
          />
        ))}
      </div>
    </aside>
  );
}
