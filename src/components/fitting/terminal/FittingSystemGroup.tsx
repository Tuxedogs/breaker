import type { NamedGroup } from "../../../lib/fitting/fittingPortGrouping";
import { summarizeGroupRows } from "../../../lib/fitting/fittingPortGrouping";
import type { FittingIconMode } from "../../../lib/fitting/fittingIconMode";
import FittingComponentRow from "./FittingComponentRow";

type FittingSystemGroupProps = {
  group: NamedGroup;
  selectedPortId: string | null;
  craftOverridePortIds: Set<string>;
  craftablePortIds: Set<string>;
  iconMode: FittingIconMode;
  onSelectPort: (portId: string, componentId: string | null) => void;
  onCraftPort: (portId: string) => void;
};

export default function FittingSystemGroup({
  group,
  selectedPortId,
  craftOverridePortIds,
  craftablePortIds,
  iconMode,
  onSelectPort,
  onCraftPort,
}: FittingSystemGroupProps) {
  const items = summarizeGroupRows(group.rows, group.key);
  if (items.length === 0) return null;

  return (
    <section className="fit-term-group">
      <header className="fit-term-group-head">
        <h2>{group.label}</h2>
        <span>{items.reduce((sum, item) => sum + item.quantity, 0)}</span>
      </header>
      <div className="fit-term-group-rows">
        {items.map((item) => {
          const portId = item.portIds[0];
          const componentId = item.rows[0]?.equippedComponentKey ?? null;
          return (
            <FittingComponentRow
              key={item.key}
              item={item}
              active={item.portIds.includes(selectedPortId ?? "")}
              hasCustomQuality={item.portIds.some((id) => craftOverridePortIds.has(id))}
              craftable={item.portIds.some((id) => craftablePortIds.has(id))}
              iconMode={iconMode}
              onSelect={() => onSelectPort(portId, componentId)}
              onCraftClick={() => onCraftPort(portId)}
            />
          );
        })}
      </div>
    </section>
  );
}
