/** V31b's shared three-view mobile workspace navigation.
 * This only changes visibility. Page component state remains mounted.
 */
export type WorkspaceView = {
  value: string;
  title: string;
  subtitle: string;
};
export type WorkspaceMobileConfig = {
  module: string;
  defaultView: string;
  views: readonly WorkspaceView[];
};
// Crafting is intentionally absent: on phones it uses a list → detail flow
// (CraftingBrowserWorkspace + craft-v31-layout.css) with filters in a sheet.
const MOBILE_VIEWS: Record<string, WorkspaceMobileConfig> = {
  "Build Queue": {
    module: "build", defaultView: "queue",
    views: [
      { value: "queue", title: "Queue", subtitle: "BUILDS" },
      { value: "detail", title: "Detail", subtitle: "PLANNING" },
      { value: "sourcing", title: "Sourcing", subtitle: "LOTS" },
    ],
  },
  Inventory: {
    module: "inventory", defaultView: "lots",
    views: [
      { value: "locations", title: "Locations", subtitle: "WAREHOUSE" },
      { value: "lots", title: "Lots", subtitle: "GRID" },
      { value: "inspector", title: "Inspector", subtitle: "SELECTED" },
    ],
  },
  Fitting: {
    module: "fitting", defaultView: "ship",
    views: [
      { value: "ship", title: "Ship", subtitle: "AIRFRAME" },
      { value: "loadout", title: "Loadout", subtitle: "HARDPOINTS" },
      { value: "details", title: "Details", subtitle: "READOUT" },
    ],
  },
};
export function getWorkspaceMobileViews(title: string): WorkspaceMobileConfig | null {
  return MOBILE_VIEWS[title] ?? null;
}
export default function WorkspaceMobileNavigator({
  config, value, onChange,
}: {
  config: WorkspaceMobileConfig;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <nav className="workspace-mobile-nav" aria-label={config.module + " mobile workspace"}>
      <div className="workspace-mobile-nav__tabs" role="tablist" aria-label="Workspace sections">
        {config.views.map((item) => (
          <button
            type="button"
            role="tab"
            key={item.value}
            aria-selected={item.value === value}
            className={item.value === value ? "is-active" : ""}
            onClick={() => onChange(item.value)}
          >
            <span>{item.title}</span>
            <small>{item.subtitle}</small>
          </button>
        ))}
      </div>
    </nav>
  );
}
