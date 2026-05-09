import type { ReactNode } from "react";

export type FilterChip = {
  id: string;
  label: string;
  active?: boolean;
  group?: "ship" | "vehicle" | "hand";
};

export type ResourceGroups = {
  shipAndHarvestable: FilterChip[];
  vehicle: FilterChip[];
  hand: FilterChip[];
};

type MsbSidebarProps = {
  title?: string;
  onClear?: () => void;
  children: ReactNode;
};

export function MsbSidebar({ children }: MsbSidebarProps) {
  return (
    <aside className="msb-sidebar msb-sidebar--compact">
      {children}
    </aside>
  );
}

export function MsbSection({
  label,
  children,
  onClear,
  raw,
}: {
  label: string;
  children: ReactNode;
  onClear?: () => void;
  raw?: boolean;
}) {
  return (
    <section className="msb-section">
      <div className="msb-section-label-row">
        <div className="msb-section-label">{label}</div>
        {onClear && (
          <button type="button" className="mine-clear-btn" onClick={onClear}>
            Clear All
          </button>
        )}
      </div>
      {raw ? children : <div className="msb-chip-grid">{children}</div>}
    </section>
  );
}

export function MsbChip({
  label,
  active,
  onClick,
  className = "",
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`msb-chip${active ? " msb-chip--active" : ""}${className ? ` ${className}` : ""}`}
      title={label}
      onClick={onClick}
    >
      <span className="msb-chip-text">{label}</span>
    </button>
  );
}

export function ResourcesSection({
  groups,
  selectedIds,
  onToggle,
}: {
  groups: ResourceGroups;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  const renderGroup = (items: FilterChip[]) => {
    if (items.length === 0) return null;

    return (
      <div className="msb-chip-grid">
        {items.map((item) => (
          <MsbChip
            key={item.id}
            label={item.label}
            active={selectedIds.has(item.id)}
            onClick={() => onToggle(item.id)}
          />
        ))}
      </div>
    );
  };

  const hasShip = groups.shipAndHarvestable.length > 0;
  const hasVehicle = groups.vehicle.length > 0;
  const hasHand = groups.hand.length > 0;

  return (
    <section className="msb-section">
      <div className="msb-section-label">Materials</div>

      {hasShip && <div className="msb-group-divider"><span className="msb-group-divider-label">Ship</span></div>}

      {hasShip && renderGroup(groups.shipAndHarvestable)}

      {hasShip && hasVehicle && <div className="msb-group-divider"><span className="msb-group-divider-label">Vehicle</span></div>}

      {hasVehicle && renderGroup(groups.vehicle)}

      {(hasShip || hasVehicle) && hasHand && <div className="msb-group-divider"><span className="msb-group-divider-label">FPS</span></div>}

      {hasHand && renderGroup(groups.hand)}
    </section>
  );

}
