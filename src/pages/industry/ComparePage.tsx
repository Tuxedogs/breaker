import { useEffect, useMemo } from "react";
import { Link, useLocation, useSearchParams, useNavigate } from "react-router-dom";
import { useCompareStore } from "@/stores/compareStore";
import { getComponentCardIndex } from "@/lib/componentCardIndex";
import type { ComponentCardIndexRecord } from "@/lib/componentCardIndex";
import { formatCraftTime } from "@/components/industry/crafting/utils/componentCardSchema";
import {
  CATEGORY_REGISTRY,
  getRegistryKey,
  getStatsBlock,
  resolveStatValue,
  computeAtAGlance,
  type StatDirection,
  type CompareSection,
} from "@/components/industry/crafting/utils/compareRegistry";
import "@/components/industry/crafting/compare.css";

// ── Helpers ───────────────────────────────────────────────────────────────────

function isSameCategory(a: ComponentCardIndexRecord, b: ComponentCardIndexRecord): boolean {
  return a.type === b.type;
}

function titleCase(s: string): string {
  return s
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SlotCard({
  slot,
  record,
  onClear,
}: {
  slot: 0 | 1;
  record: ComponentCardIndexRecord | null;
  onClear: () => void;
}) {
  return (
    <div className={`cmp-slot-card${record ? " cmp-slot-card--filled" : " cmp-slot-card--empty"}`}>
      {record ? (
        <>
          <span className="cmp-slot-badge">Slot {slot + 1}</span>
          <div className="cmp-slot-name">{record.name}</div>
          <div className="cmp-slot-chips">
            <span className="cmp-slot-chip">{record.typeLabel}</span>
            {record.size !== null && <span className="cmp-slot-chip">S{record.size}</span>}
            {record.grade && <span className="cmp-slot-chip">{record.grade}</span>}
            {record.class && <span className="cmp-slot-chip">{titleCase(record.class)}</span>}
          </div>
          <button type="button" className="cmp-slot-clear" onClick={onClear} aria-label={`Remove ${record.name}`}>
            ×
          </button>
        </>
      ) : (
        <>
          <span className="cmp-slot-badge" style={{ opacity: 0.45 }}>Slot {slot + 1}</span>
          <div className="cmp-slot-empty-hint">No item selected</div>
        </>
      )}
    </div>
  );
}

function StatRow({
  label,
  valA,
  valB,
  direction,
}: {
  label: string;
  valA: string | null;
  valB: string | null;
  direction: StatDirection;
}) {
  const aNum = valA ? parseFloat(valA.replace(/[^0-9.-]/g, "")) : NaN;
  const bNum = valB ? parseFloat(valB.replace(/[^0-9.-]/g, "")) : NaN;

  let winA = false;
  let winB = false;

  if (direction !== "neutral" && Number.isFinite(aNum) && Number.isFinite(bNum) && aNum !== bNum) {
    winA = direction === "higher" ? aNum > bNum : aNum < bNum;
    winB = !winA;
  }

  if (!valA && !valB) return null;

  return (
    <div className="cmp-stat-row">
      <span className="cmp-stat-label">{label}</span>
      <span className={`cmp-stat-val${winA ? " cmp-stat-val--win" : ""}${!valA ? " cmp-stat-val--empty" : ""}`}>
        {valA ?? "—"}
      </span>
      <span className="cmp-stat-divider" aria-hidden="true" />
      <span className={`cmp-stat-val${winB ? " cmp-stat-val--win" : ""}${!valB ? " cmp-stat-val--empty" : ""}`}>
        {valB ?? "—"}
      </span>
    </div>
  );
}

function SectionBlock({
  section,
  blockA,
  blockB,
}: {
  section: CompareSection;
  blockA: Record<string, unknown> | null;
  blockB: Record<string, unknown> | null;
}) {
  const rows = section.stats.map((stat) => {
    const valA = blockA ? resolveStatValue(stat, blockA) : null;
    const valB = blockB ? resolveStatValue(stat, blockB) : null;
    if (!valA && !valB) return null;
    return (
      <StatRow
        key={stat.field}
        label={stat.label}
        valA={valA}
        valB={valB}
        direction={stat.direction}
      />
    );
  });

  const hasRows = rows.some(Boolean);
  if (!hasRows) return null;

  return (
    <div className="cmp-section">
      <div className="cmp-section-title">{section.title}</div>
      {rows}
    </div>
  );
}

function MaterialsSection({
  a,
  b,
}: {
  a: ComponentCardIndexRecord;
  b: ComponentCardIndexRecord;
}) {
  const allMaterialNames = useMemo(() => {
    const names = new Set<string>();
    for (const m of [...a.materials, ...b.materials]) names.add(m.name);
    return [...names].sort();
  }, [a, b]);

  if (allMaterialNames.length === 0) return null;

  return (
    <div className="cmp-section">
      <div className="cmp-section-title">Crafting &amp; Materials</div>
      <div className="cmp-stat-row cmp-stat-row--sub">
        <span className="cmp-stat-label">Craft Time</span>
        <span className="cmp-stat-val">{formatCraftTime(a.craftTimeSeconds) || "—"}</span>
        <span className="cmp-stat-divider" aria-hidden="true" />
        <span className="cmp-stat-val">{formatCraftTime(b.craftTimeSeconds) || "—"}</span>
      </div>
      {allMaterialNames.map((name) => {
        const mA = a.materials.find((m) => m.name === name);
        const mB = b.materials.find((m) => m.name === name);
        const strA = mA ? `${mA.quantity}${mA.unit ? ` ${mA.unit}` : ""}` : null;
        const strB = mB ? `${mB.quantity}${mB.unit ? ` ${mB.unit}` : ""}` : null;
        return (
          <div key={name} className="cmp-stat-row cmp-stat-row--material">
            <span className="cmp-stat-label">{name}</span>
            <span className={`cmp-stat-val${!strA ? " cmp-stat-val--empty" : ""}`}>{strA ?? "—"}</span>
            <span className="cmp-stat-divider" aria-hidden="true" />
            <span className={`cmp-stat-val${!strB ? " cmp-stat-val--empty" : ""}`}>{strB ?? "—"}</span>
          </div>
        );
      })}
    </div>
  );
}

function IdentitySection({ a, b }: { a: ComponentCardIndexRecord; b: ComponentCardIndexRecord }) {
  const rows: Array<{ label: string; valA: string | null; valB: string | null }> = [
    { label: "Type", valA: a.typeLabel, valB: b.typeLabel },
    { label: "Kind", valA: a.kind === "fps" ? "FPS" : "Vehicle", valB: b.kind === "fps" ? "FPS" : "Vehicle" },
    { label: "Size", valA: a.size !== null ? `S${a.size}` : null, valB: b.size !== null ? `S${b.size}` : null },
    { label: "Grade", valA: a.grade, valB: b.grade },
    { label: "Class", valA: a.class ? titleCase(a.class) : null, valB: b.class ? titleCase(b.class) : null },
    { label: "Manufacturer", valA: a.manufacturer, valB: b.manufacturer },
  ];
  return (
    <div className="cmp-section">
      <div className="cmp-section-title">Identity</div>
      {rows.map(({ label, valA, valB }) => {
        if (!valA && !valB) return null;
        return (
          <StatRow key={label} label={label} valA={valA} valB={valB} direction="neutral" />
        );
      })}
    </div>
  );
}

function GenericSection({ a, b }: { a: ComponentCardIndexRecord; b: ComponentCardIndexRecord }) {
  const generic = (rec: ComponentCardIndexRecord) => {
    const s = (rec.stats as Record<string, unknown> | null)?.generic;
    return (typeof s === "object" && s !== null && !Array.isArray(s))
      ? s as Record<string, unknown>
      : null;
  };
  const gA = generic(a);
  const gB = generic(b);

  const hp = {
    valA: gA?.health != null && Number(gA.health) !== 0 ? String(Number(gA.health)) : null,
    valB: gB?.health != null && Number(gB.health) !== 0 ? String(Number(gB.health)) : null,
  };
  const mass = {
    valA: gA?.mass != null && Number(gA.mass) !== 0 ? String(Number(gA.mass)) : null,
    valB: gB?.mass != null && Number(gB.mass) !== 0 ? String(Number(gB.mass)) : null,
  };

  if (!hp.valA && !hp.valB && !mass.valA && !mass.valB) return null;

  return (
    <div className="cmp-section">
      <div className="cmp-section-title">Component</div>
      {(hp.valA || hp.valB) && (
        <StatRow label="Component HP" valA={hp.valA} valB={hp.valB} direction="higher" />
      )}
      {(mass.valA || mass.valB) && (
        <StatRow label="Mass" valA={mass.valA} valB={mass.valB} direction="neutral" />
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ComparePage() {
  const { slots, setSlot, clearSlot, swap, clearAll } = useCompareStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const backTo = (location.state as { from?: string } | null)?.from ?? "/industry/crafting";

  // Hydrate slots from URL params ?a=id&b=id
  useEffect(() => {
    const aId = searchParams.get("a");
    const bId = searchParams.get("b");
    if (!aId && !bId) return;

    getComponentCardIndex().then((index) => {
      if (aId) {
        const rec = index.records.find((r) => r.id === aId || r.id.startsWith(aId));
        if (rec && !slots[0]) setSlot(0, rec);
      }
      if (bId) {
        const rec = index.records.find((r) => r.id === bId || r.id.startsWith(bId));
        if (rec && !slots[1]) setSlot(1, rec);
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync URL when slots change
  useEffect(() => {
    const params = new URLSearchParams();
    if (slots[0]) params.set("a", slots[0].id);
    if (slots[1]) params.set("b", slots[1].id);
    setSearchParams(params, { replace: true });
  }, [slots, setSearchParams]);

  const [a, b] = slots;

  const registryKeyA = a ? getRegistryKey(a) : null;
  const sameCategory = a && b ? isSameCategory(a, b) : false;
  const sharedKey = sameCategory && registryKeyA ? registryKeyA : null;
  const registry = sharedKey ? CATEGORY_REGISTRY[sharedKey] : null;

  const blockA = a && sharedKey ? getStatsBlock(a, sharedKey) : null;
  const blockB = b && sharedKey ? getStatsBlock(b, sharedKey) : null;

  const glance = useMemo(() => {
    if (!a || !b || !sharedKey) return null;
    return computeAtAGlance(a, b, sharedKey);
  }, [a, b, sharedKey]);

  const handleSwap = () => swap();
  const handleClearAll = () => {
    clearAll();
    navigate(backTo, { replace: true });
  };

  return (
    <div className="cmp-page">
      <header className="cmp-header">
        <Link className="cmp-back-link" to={backTo}>
          ← Back to Results
        </Link>
        <div className="cmp-header-title">
          <h1>Compare Components</h1>
          <span className="cmp-header-sub">
            {[a, b].filter(Boolean).length} component{[a, b].filter(Boolean).length !== 1 ? "s" : ""} selected
          </span>
        </div>
        <div className="cmp-header-actions">
          <button type="button" className="cmp-action-btn" onClick={handleClearAll}>
            Clear All
          </button>
          <button type="button" className="cmp-action-btn" onClick={handleSwap} disabled={!a || !b}>
            ⇄ Swap
          </button>
        </div>
      </header>

      <div className="cmp-body">
        {/* ── Left rail ── */}
        <aside className="cmp-rail">
          <div className="cmp-rail-section-label">Select Components</div>
          <p className="cmp-rail-hint">Select up to 2 components to compare</p>
          <SlotCard slot={0} record={a} onClear={() => clearSlot(0)} />
          <SlotCard slot={1} record={b} onClear={() => clearSlot(1)} />

          {registry && (
            <nav className="cmp-section-nav" aria-label="Jump to section">
              <div className="cmp-rail-section-label">Sections</div>
              {registry.sections.map((s) => (
                <a key={s.title} className="cmp-nav-link" href={`#cmp-${s.title.replace(/\s+/g, "-").toLowerCase()}`}>
                  {s.title}
                </a>
              ))}
              <a className="cmp-nav-link" href="#cmp-materials">Crafting &amp; Materials</a>
            </nav>
          )}
        </aside>

        {/* ── Center table ── */}
        <main className="cmp-table">
          {(!a || !b) && (
            <div className="cmp-empty-state">
              <span className="cmp-empty-title">No items to compare</span>
              <p>Add components from the <Link to="/industry/crafting">crafting browser</Link> or component detail pages.</p>
            </div>
          )}

          {a && b && (
            <>
              {/* Column headers */}
              <div className="cmp-col-headers">
                <span className="cmp-col-spacer" />
                <div className="cmp-col-header">
                  <span className="cmp-col-slot">Slot 1</span>
                  <span className="cmp-col-name">{a.name}</span>
                  <div className="cmp-col-chips">
                    <span className="cmp-col-chip">{a.typeLabel}</span>
                    {a.size !== null && <span className="cmp-col-chip">S{a.size}</span>}
                    {a.grade && <span className="cmp-col-chip">{a.grade}</span>}
                    {a.class && <span className="cmp-col-chip">{titleCase(a.class)}</span>}
                    {a.manufacturer && <span className="cmp-col-chip">{a.manufacturer}</span>}
                  </div>
                </div>
                <div className="cmp-vs-marker" aria-hidden="true">VS</div>
                <div className="cmp-col-header">
                  <span className="cmp-col-slot">Slot 2</span>
                  <span className="cmp-col-name">{b.name}</span>
                  <div className="cmp-col-chips">
                    <span className="cmp-col-chip">{b.typeLabel}</span>
                    {b.size !== null && <span className="cmp-col-chip">S{b.size}</span>}
                    {b.grade && <span className="cmp-col-chip">{b.grade}</span>}
                    {b.class && <span className="cmp-col-chip">{titleCase(b.class)}</span>}
                    {b.manufacturer && <span className="cmp-col-chip">{b.manufacturer}</span>}
                  </div>
                </div>
              </div>

              {/* Mixed-category warning */}
              {!sameCategory && (
                <div className="cmp-mixed-warning">
                  These items use different stat models. Only shared crafting/material fields are being compared.
                </div>
              )}

              {/* Identity always shown */}
              <IdentitySection a={a} b={b} />

              {/* Same-category stat sections */}
              {registry && blockA !== undefined && blockB !== undefined && (
                <>
                  {registry.sections.map((section) => (
                    <div key={section.title} id={`cmp-${section.title.replace(/\s+/g, "-").toLowerCase()}`}>
                      <SectionBlock section={section} blockA={blockA} blockB={blockB} />
                    </div>
                  ))}
                </>
              )}

              {/* Generic HP/Mass for mixed or fallback */}
              {(!sameCategory || !registry) && <GenericSection a={a} b={b} />}

              {/* Materials always shown */}
              <div id="cmp-materials">
                <MaterialsSection a={a} b={b} />
              </div>
            </>
          )}
        </main>

        {/* ── Right sidebar ── */}
        {a && b && (
          <aside className="cmp-glance">
            <div className="cmp-glance-section-label">At a Glance</div>
            <p className="cmp-glance-sub">Differences summary</p>

            {glance ? (
              <>
                <div className="cmp-glance-scores">
                  <div className="cmp-glance-score cmp-glance-score--a">
                    <span className="cmp-glance-score-num">{glance.aWins}</span>
                    <span className="cmp-glance-score-label">Better on<br />{a.name.split('"')[0].trim().split(" ").slice(-2).join(" ")}</span>
                  </div>
                  <div className="cmp-glance-score cmp-glance-score--b">
                    <span className="cmp-glance-score-num">{glance.bWins}</span>
                    <span className="cmp-glance-score-label">Better on<br />{b.name.split('"')[0].trim().split(" ").slice(-2).join(" ")}</span>
                  </div>
                  <div className="cmp-glance-score cmp-glance-score--tied">
                    <span className="cmp-glance-score-num">{glance.tied}</span>
                    <span className="cmp-glance-score-label">No Difference</span>
                  </div>
                </div>

                {glance.highlights.length > 0 && (
                  <>
                    <hr className="cmp-glance-divider" />
                    <div className="cmp-glance-section-label">Highlights</div>
                    <div className="cmp-glance-highlights">
                      {glance.highlights.map((h) => (
                        <div key={h.label} className={`cmp-highlight cmp-highlight--${h.direction}`}>
                          <div className="cmp-highlight-stat">{h.label}</div>
                          <span className="cmp-highlight-desc">
                            {h.direction === "tied"
                              ? "Identical"
                              : `+${Math.round(h.delta * 100)}% advantage`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="cmp-glance-mixed-note">
                {!sameCategory
                  ? "Stat scoring requires items of the same type."
                  : "No scoreable stats available for this category."}
              </div>
            )}

            <p className="cmp-glance-footer">Base stats only. Quality/crafted setup comparison coming in a future update.</p>
          </aside>
        )}
      </div>
    </div>
  );
}
