const RAIL_ITEMS = [
  { key: "home", label: "Home", active: false },
  { key: "ship", label: "Ships", active: true },
  { key: "cargo", label: "Cargo", active: false },
  { key: "tools", label: "Tools", active: false },
  { key: "wrench", label: "Industry", active: false },
  { key: "crosshair", label: "Combat", active: false },
  { key: "shield", label: "Defense", active: false },
  { key: "hex", label: "Systems", active: false },
] as const;

function RailIcon({ kind }: { kind: (typeof RAIL_ITEMS)[number]["key"] }) {
  switch (kind) {
    case "home":
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 10.5L12 4l8 6.5V20a1 1 0 01-1 1h-5v-6H10v6H5a1 1 0 01-1-1z" /></svg>;
    case "ship":
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 18l3-8 5 2 5-2 3 8H4z" /><path d="M7 10l5-4 5 4" /></svg>;
    case "cargo":
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="4" y="7" width="16" height="12" rx="1" /><path d="M8 7V5h8v2" /></svg>;
    case "tools":
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M14.7 6.3a4 4 0 105.7 5.7L8 19l-3 1 1-3 8.7-10.7z" /></svg>;
    case "wrench":
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M14.7 6.3a4 4 0 015.7 5.7l-2.2 2.2-3.5-3.5 2.2-2.2z" /><path d="M3 21l6-6" /></svg>;
    case "crosshair":
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="7" /><path d="M12 5v14M5 12h14" /></svg>;
    case "shield":
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 3l8 3v6c0 4.4-3.2 7.8-8 9-4.8-1.2-8-4.6-8-9V6z" /></svg>;
    default:
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7-6.3-4.6L5.7 21l2.3-7-6-4.6h7.6z" /></svg>;
  }
}

export default function FittingRail() {
  return (
    <nav className="fm-rail" aria-label="Primary navigation">
      {RAIL_ITEMS.map((item) => (
        <button
          key={item.key}
          type="button"
          className={["fm-rail-btn", item.active ? "is-active" : ""].filter(Boolean).join(" ")}
          aria-label={item.label}
          aria-current={item.active ? "page" : undefined}
        >
          <RailIcon kind={item.key} />
        </button>
      ))}
    </nav>
  );
}
