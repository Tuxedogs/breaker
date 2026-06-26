import type { NamedGroup, PortBreakdownRow } from "../../../lib/fitting/fittingPortGrouping";
import type { FittingIconMode } from "../../../lib/fitting/fittingIconMode";
import FittingSystemGroup from "./FittingSystemGroup";

type FittingSystemsPanelProps = {
  title: string;
  groups: NamedGroup[];
  portLookup: Map<string, PortBreakdownRow>;
  selectedPortId: string | null;
  activeCraftPortId: string | null;
  craftOverridePortIds: Set<string>;
  craftablePortIds: Set<string>;
  iconMode: FittingIconMode;
  onSelectPort: (portId: string, componentId: string | null) => void;
  onCraftPort: (portId: string) => void;
  compact?: boolean;
};

export default function FittingSystemsPanel({
  title,
  groups,
  portLookup,
  selectedPortId,
  activeCraftPortId,
  craftOverridePortIds,
  craftablePortIds,
  iconMode,
  onSelectPort,
  onCraftPort,
  compact = false,
}: FittingSystemsPanelProps) {
  const visibleGroups = groups.filter((group) => group.rows.length > 0);
  if (visibleGroups.length === 0) return null;

  return (
    <section
      className={["fit-term-systems", compact ? "fit-term-systems--compact" : ""].filter(Boolean).join(" ")}
      aria-label={title}
    >
      <header className="fit-term-systems-head">
        <h2>{title}</h2>
      </header>
      <div className="fit-term-systems-scroll">
        {visibleGroups.map((group) => (
          <FittingSystemGroup
            key={group.key}
            group={group}
            portLookup={portLookup}
            selectedPortId={selectedPortId}
            activeCraftPortId={activeCraftPortId}
            craftOverridePortIds={craftOverridePortIds}
            craftablePortIds={craftablePortIds}
            iconMode={iconMode}
            onSelectPort={onSelectPort}
            onCraftPort={onCraftPort}
          />
        ))}
      </div>
    </section>
  );
}
