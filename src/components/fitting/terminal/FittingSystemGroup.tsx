import {
  summarizeGroupRows,
  type NamedGroup,
  type PortBreakdownRow,
} from "../../../lib/fitting/fittingPortGrouping";
import type { FittingIconMode } from "../../../lib/fitting/fittingIconMode";
import FittingComponentRow from "./FittingComponentRow";

type FittingSystemGroupProps = {
  group: NamedGroup;
  portLookup: Map<string, PortBreakdownRow>;
  selectedPortId: string | null;
  craftOverridePortIds: Set<string>;
  craftablePortIds: Set<string>;
  iconMode: FittingIconMode;
  onSelectPort: (portId: string, componentId: string | null) => void;
  onCraftPort: (portId: string) => void;
};

export default function FittingSystemGroup({
  group,
  portLookup,
  selectedPortId,
  craftOverridePortIds,
  craftablePortIds,
  iconMode,
  onSelectPort,
  onCraftPort,
}: FittingSystemGroupProps) {
  if (group.rows.length === 0) return null;

  const summaries = summarizeGroupRows(group.rows, group.key, portLookup);

  return (
    <section className="fit-term-group">
      <header className="fit-term-group-head">
        <h3>{group.label}</h3>
        <span>{summaries.reduce((total, entry) => total + entry.quantity, 0)}</span>
      </header>
      <div className="fit-term-group-rows">
        {summaries.map((summary) => {
          const primaryPortId = summary.portIds[0];
          const primaryRow = summary.rows[0];
          const isActive = summary.portIds.includes(selectedPortId ?? "");
          const hasCustom = summary.portIds.some((portId) => craftOverridePortIds.has(portId));
          const craftable = summary.portIds.some((portId) => craftablePortIds.has(portId));

          return (
            <FittingComponentRow
              key={summary.key}
              summary={summary}
              active={isActive}
              hasCustomQuality={hasCustom}
              craftable={craftable}
              iconMode={iconMode}
              onSelect={() => onSelectPort(primaryPortId, primaryRow.equippedComponentKey)}
              onCraftClick={() => onCraftPort(primaryPortId)}
            />
          );
        })}
      </div>
    </section>
  );
}
