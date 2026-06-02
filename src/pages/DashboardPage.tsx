import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import MaterialIcon from "../components/logistics/MaterialIcon";
import { useLogisticsStore } from "../stores/logisticsStore";
import { deriveUserDashStats } from "../lib/dashboardStats";
import type { LogisticsMaterialTemplate } from "../data/logistics/seed";
import { MINEABLE_SIGNATURES } from "../data/mineableSignatures";
import { buildRecommendationRequest, getMiningRecommendations } from "../features/mining/recommenderAdapter";
import type { PublicLocationEntry, RequiredMaterial } from "../features/mining/types";
import {
  formatInventoryQuantity,
  getBuildQueueItemInputs,
  resolveInventoryItemName,
  resolveInventoryUnitType,
} from "../lib/logistics/inventory";
import { getQueueLedgerModel, type QueueLedgerLine } from "../lib/logistics/queueLedger";
import type { BuildQueueItem, InventoryEntry, InventoryLocation, MaterialTemplate } from "../types/logistics";

function ArrowRight({ size = 12 }: { size?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width={size} height={size} className="dash-card-footer-arrow">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

type StatIconType = "materials" | "owned" | "needed" | "shortage" | "queue" | "volume" | "high" | "low";
function StatIcon({ type }: { type: StatIconType }) {
  const configs: Record<StatIconType, { bg: string; color: string; d: string }> = {
    materials: { bg: "rgba(167,139,250,0.12)", color: "#a78bfa", d: "M12 2L2 7v10l10 5 10-5V7L12 2zm0 5l5 2.5v5L12 17l-5-2.5v-5L12 7z" },
    owned: { bg: "rgba(56,189,248,0.12)", color: "#38bdf8", d: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" },
    needed: { bg: "rgba(167,139,250,0.12)", color: "#a78bfa", d: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01m-.01 4h.01" },
    shortage: { bg: "rgba(248,113,113,0.12)", color: "#f87171", d: "M12 2L2 19h20L12 2zm0 6v5m0 4h.01" },
    queue: { bg: "rgba(251,146,60,0.12)", color: "#fb923c", d: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
    volume: { bg: "rgba(255,154,32,0.12)", color: "#ff9d00", d: "M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" },
    high: { bg: "rgba(74,222,128,0.12)", color: "#4ade80", d: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" },
    low: { bg: "rgba(248,113,113,0.12)", color: "#f87171", d: "M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" },
  };
  const c = configs[type];
  return (
    <div className="dash-stat-icon-wrap" style={{ background: c.bg }}>
      <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke={c.color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
        <path d={c.d} />
      </svg>
    </div>
  );
}

function StatTooltip({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="dash-stat-tooltip-wrap">
      <button
        type="button"
        className="dash-stat-info-btn"
        aria-label="More info"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        <svg viewBox="0 0 14 14" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <circle cx="7" cy="7" r="6" />
          <path d="M7 6v4M7 4.5v.5" />
        </svg>
      </button>
      {open && <div className="dash-stat-tooltip" role="tooltip">{children}</div>}
    </span>
  );
}

function BqThumb({ color }: { color: string }) {
  return (
    <div className="dash-bq-thumb">
      <svg viewBox="0 0 20 20" width="14" height="14" fill="none">
        <rect x="3" y="7" width="14" height="10" rx="1.5" stroke={color} strokeWidth="1.4" />
        <path d="M7 7V5a3 3 0 016 0v2" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function LocationIcon({ type }: { type: string }) {
  const d = type === "station"
    ? "M12 2L2 7v10l10 5 10-5V7L12 2z"
    : "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z";
  return (
    <div className="dash-location-icon">
      <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="12" height="12">
        <path d={d} />
      </svg>
    </div>
  );
}

const SIGNATURE_DOCK_STORAGE_KEY = "sdock_state";

type SignatureDockStateSnapshot = {
  activeMaterialKeys?: string[];
  pinnedMaterialKeys?: string[];
  activeIds?: number[];
};

function formatDashNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/\.?0+$/, "");
}

function normalizeSignatureMaterialKey(value: string) {
  const compact = value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (compact === "aluminum") return "aluminium";
  if (compact === "quantainium") return "quantanium";
  if (compact === "savrillium") return "savrilium";
  if (compact === "pressurizedice") return "ice";
  return compact;
}

function readSignatureDockState(): SignatureDockStateSnapshot {
  try {
    const raw = localStorage.getItem(SIGNATURE_DOCK_STORAGE_KEY);
    return raw ? JSON.parse(raw) as SignatureDockStateSnapshot : {};
  } catch {
    return {};
  }
}

function signatureRowsFromState(state: SignatureDockStateSnapshot) {
  const materialKeys = new Set(
    (state.pinnedMaterialKeys?.length ? state.pinnedMaterialKeys : state.activeMaterialKeys ?? [])
      .map(normalizeSignatureMaterialKey)
  );
  if (materialKeys.size === 0 && state.activeIds?.length) {
    for (const id of state.activeIds) {
      const name = MINEABLE_SIGNATURES[id]?.name;
      if (name) materialKeys.add(normalizeSignatureMaterialKey(name));
    }
  }
  return MINEABLE_SIGNATURES.filter((signature) => materialKeys.has(normalizeSignatureMaterialKey(signature.name)));
}

function getQueueItemName(item: BuildQueueItem, recipesById: Map<string, { name: string }>) {
  return item.itemName ?? recipesById.get(item.recipeId)?.name ?? item.recipeId;
}

function getOwnedQuantityForRequirement(materialId: string, inventoryEntries: InventoryEntry[]) {
  return inventoryEntries
    .filter((entry) => (entry.materialId ?? entry.catalogItemId) === materialId && entry.quantity > 0)
    .reduce((sum, entry) => sum + entry.quantity, 0);
}

function getQueueItemProgress(
  item: BuildQueueItem,
  inventoryEntries: InventoryEntry[],
  recipeInputsByRecipeId: Parameters<typeof getBuildQueueItemInputs>[1],
) {
  const inputs = getBuildQueueItemInputs(item, recipeInputsByRecipeId);
  const required = inputs.reduce((sum, input) => sum + input.quantity * item.quantity, 0);
  if (required <= 0) return null;
  const covered = inputs.reduce((sum, input) => {
    const materialId = input.materialId ?? input.materialKey;
    if (!materialId) return sum;
    const lineRequired = input.quantity * item.quantity;
    return sum + Math.min(lineRequired, getOwnedQuantityForRequirement(materialId, inventoryEntries));
  }, 0);
  return Math.max(0, Math.min(100, Math.round((covered / required) * 100)));
}

function buildPrimaryLocations(
  inventoryEntries: InventoryEntry[],
  locations: InventoryLocation[],
  materials: MaterialTemplate[],
) {
  const locationById = new Map(locations.map((location) => [location.id, location]));
  const groups = new Map<string, { id: string; name: string; type: string; scu: number; units: number; entries: number }>();
  for (const entry of inventoryEntries) {
    const id = entry.locationId ?? "unassigned";
    const location = locationById.get(id);
    const material = entry.materialId ? materials.find((candidate) => candidate.id === entry.materialId) : undefined;
    const current = groups.get(id) ?? {
      id,
      name: location?.name ?? "Unassigned",
      type: location?.type ?? "station",
      scu: 0,
      units: 0,
      entries: 0,
    };
    if (resolveInventoryUnitType(entry, material) === "scu") current.scu += entry.quantity;
    else current.units += entry.quantity;
    current.entries += 1;
    groups.set(id, current);
  }
  return [...groups.values()]
    .sort((a, b) => b.scu - a.scu || b.units - a.units || b.entries - a.entries || a.name.localeCompare(b.name))
    .slice(0, 5);
}

function formatLocationQuantity(location: ReturnType<typeof buildPrimaryLocations>[number]) {
  const parts: string[] = [];
  if (location.scu > 0) parts.push(`${formatDashNumber(location.scu)} SCU`);
  if (location.units > 0) parts.push(`x${formatDashNumber(location.units)}`);
  return parts.join(" / ") || "0";
}

function toRequiredMaterials(lines: QueueLedgerLine[]): RequiredMaterial[] {
  return lines.map((line) => ({
    materialId: line.materialId,
    materialKey: line.materialKey,
    materialName: line.displayName,
    displayName: line.displayName,
    requiredQuantity: line.rawOreNeeded > 0 ? line.rawOreNeeded : line.netMissingRefined,
    unitType: line.rawOreNeeded > 0 ? "SCU" : line.unitType,
    usedBy: [],
    slots: [],
  }));
}

export default function DashboardPage() {
  const { inventoryEntries, materialTemplates, buildQueue, recipeTemplates, recipeInputTemplates, locations } = useLogisticsStore();
  const userStats = deriveUserDashStats(inventoryEntries, materialTemplates as LogisticsMaterialTemplate[]);
  const [signatureState, setSignatureState] = useState<SignatureDockStateSnapshot>(() => readSignatureDockState());
  const [miningState, setMiningState] = useState<{ status: "idle" | "loading" | "loaded" | "error"; data: PublicLocationEntry[] }>({
    status: "idle",
    data: [],
  });

  const queueLedger = useMemo(
    () => getQueueLedgerModel({ buildQueue, inventoryEntries, materials: materialTemplates, recipeInputsByRecipeId: recipeInputTemplates }),
    [buildQueue, inventoryEntries, materialTemplates, recipeInputTemplates]
  );
  const activeQueueItems = useMemo(() => buildQueue.filter((item) => item.status !== "complete"), [buildQueue]);
  const recipesById = useMemo(() => new Map(recipeTemplates.map((recipe) => [recipe.id, recipe])), [recipeTemplates]);
  const signatureRows = useMemo(() => signatureRowsFromState(signatureState), [signatureState]);
  const primaryLocations = useMemo(
    () => buildPrimaryLocations(inventoryEntries, locations, materialTemplates),
    [inventoryEntries, locations, materialTemplates]
  );
  const shortageRows = queueLedger.refinedShortfallLines.slice(0, 5);
  const totalShortage = formatDashNumber(queueLedger.summary.refinedShortfall);

  useEffect(() => {
    function refreshSignatureState() {
      setSignatureState(readSignatureDockState());
    }
    window.addEventListener("storage", refreshSignatureState);
    window.addEventListener("focus", refreshSignatureState);
    return () => {
      window.removeEventListener("storage", refreshSignatureState);
      window.removeEventListener("focus", refreshSignatureState);
    };
  }, []);

  useEffect(() => {
    const requiredMaterials = toRequiredMaterials(
      queueLedger.rawOreRequirementLines.length > 0 ? queueLedger.rawOreRequirementLines : queueLedger.refinedShortfallLines
    );
    if (requiredMaterials.length === 0) {
      setMiningState({ status: "idle", data: [] });
      return;
    }
    const controller = new AbortController();
    setMiningState((current) => ({ status: "loading", data: current.data }));
    getMiningRecommendations(
      buildRecommendationRequest({
        priorityStack: [],
        manualDemand: [],
        favoriteLocationIds: [],
        filters: { showOnlyStarred: false },
      }, null, requiredMaterials, "quality"),
      controller.signal
    )
      .then((response) => {
        if (!controller.signal.aborted) setMiningState({ status: "loaded", data: response.recommendations.slice(0, 3) });
      })
      .catch(() => {
        if (!controller.signal.aborted) setMiningState((current) => ({ status: "error", data: current.data }));
      });
    return () => controller.abort();
  }, [queueLedger.rawOreRequirementLines, queueLedger.refinedShortfallLines]);

  return (
    <div className="dash-content-grid">
      <div className="dash-main-col">
        <section className="dash-hero" aria-label="Welcome">
          <div className="dash-hero-content">
            <p className="dash-hero-kicker">Welcome to Scintel</p>
            <h1 className="dash-hero-title">Parse screenshots<br />keep track of your loot.</h1>
            <p className="dash-hero-subtitle">Track inventory, queue builds, and prioritize<br />the materials that matter next.</p>
            <Link to="/dashboard/doctrine/armor-threshold" className="dash-hero-cta">
              Explore Tools
              <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="dash-hero-cta-arrow">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
          <div className="dash-hero-controls" aria-hidden>
            <div className="dash-hero-dot active" />
            <div className="dash-hero-dot" />
            <div className="dash-hero-dot" />
          </div>
          <div className="dash-hero-nav" aria-hidden>
            <button type="button" className="dash-hero-nav-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="12" height="12">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <button type="button" className="dash-hero-nav-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="12" height="12">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>
        </section>

        <section className="dash-stats-row" aria-label="Summary statistics">
          <div className="dash-stat-card">
            <div className="dash-stat-main">
              <div className="dash-stat-label">
                Total Recorded
                <StatTooltip>
                  <div className="dash-stat-tooltip-title">Your top volumes</div>
                  {userStats.top3Volume.length > 0 ? userStats.top3Volume.map((v) => (
                    <div key={v.name} className="dash-stat-tooltip-row">
                      <span>{v.name}</span>
                      <span>{v.unit === "x" ? `x${v.quantity}` : `${v.quantity} SCU`}</span>
                    </div>
                  )) : <div className="dash-stat-tooltip-empty">No inventory recorded</div>}
                </StatTooltip>
              </div>
              <div className="dash-stat-value">
                {userStats.totalVolume > 0
                  ? (userStats.totalVolumeUnit === "x"
                    ? <><span>x</span>{userStats.totalVolume}</>
                    : <>{userStats.totalVolume}<span className="dash-stat-unit"> SCU</span></>)
                  : "-"}
              </div>
              <div className="dash-stat-sublabel">Across all inventory</div>
            </div>
            <StatIcon type="volume" />
          </div>

          <div className="dash-stat-card">
            <div className="dash-stat-main">
              <div className="dash-stat-label">
                Highest Recorded
                <StatTooltip>
                  <div className="dash-stat-tooltip-title">Top 3 qualities</div>
                  {userStats.top3Highest.length > 0 ? userStats.top3Highest.map((q) => (
                    <div key={q.name + q.quality} className="dash-stat-tooltip-row">
                      <span>{q.name}</span>
                      <span className="dash-stat-tooltip-val">{q.quality}</span>
                    </div>
                  )) : <div className="dash-stat-tooltip-empty">No quality data recorded</div>}
                </StatTooltip>
              </div>
              <div className="dash-stat-value" style={{ color: "#4ade80" }}>{userStats.highestQuality ?? "-"}</div>
              <div className="dash-stat-sublabel">{userStats.highestQualityMaterial ?? "Material quality"}</div>
            </div>
            <StatIcon type="high" />
          </div>

          <div className="dash-stat-card">
            <div className="dash-stat-main">
              <div className="dash-stat-label">
                Lowest Ever
                <StatTooltip>
                  <div className="dash-stat-tooltip-title">Bottom 3 qualities</div>
                  {userStats.bottom3Lowest.length > 0 ? userStats.bottom3Lowest.map((q) => (
                    <div key={q.name + q.quality} className="dash-stat-tooltip-row">
                      <span>{q.name}</span>
                      <span className="dash-stat-tooltip-val">{q.quality}</span>
                    </div>
                  )) : <div className="dash-stat-tooltip-empty">No quality data recorded</div>}
                </StatTooltip>
              </div>
              <div className="dash-stat-value" style={{ color: "#f87171" }}>{userStats.lowestQuality ?? "-"}</div>
              <div className="dash-stat-sublabel">{userStats.lowestQualityMaterial ?? "Material quality"}</div>
            </div>
            <StatIcon type="low" />
          </div>

          <div className="dash-stat-card">
            <div className="dash-stat-main">
              <div className="dash-stat-label">Shortage</div>
              <div className="dash-stat-value dash-stat-value--shortage">
                {queueLedger.summary.refinedShortfall > 0 ? totalShortage : "-"}
                <span className="dash-stat-unit" style={{ color: "rgba(248,113,113,0.6)" }}>
                  {queueLedger.summary.refinedShortfall > 0 ? " SCU" : ""}
                </span>
              </div>
              <div className="dash-stat-sublabel">{queueLedger.refinedShortfallLines.length} shortage materials</div>
            </div>
            <StatIcon type="shortage" />
          </div>

          <div className="dash-stat-card">
            <div className="dash-stat-main">
              <div className="dash-stat-label">Build Queue</div>
              <div className="dash-stat-value">{buildQueue.length}</div>
              <div className="dash-stat-sublabel">{activeQueueItems.length} active builds</div>
            </div>
            <StatIcon type="queue" />
          </div>
        </section>

        <div className="dash-cards-row">
          <article className="dash-card" aria-label="Inventory overview">
            <div className="dash-card-header"><span className="dash-card-title">Inventory Overview</span></div>
            <div className="dash-card-body dash-inventory-body">
              {signatureRows.length > 0 ? (
                <table className="sdock-table dash-signature-table">
                  <thead>
                    <tr>
                      <th>Material</th>
                      <th className="sdock-th-values">Signature Values</th>
                    </tr>
                  </thead>
                  <tbody>
                    {signatureRows.slice(0, 6).map((row) => (
                      <tr key={row.name} className="sdock-row-active">
                        <td className="sdock-td-name"><span className="sdock-active-dot" />{row.name}</td>
                        <td className="sdock-td-values">
                          <div className="sdock-values-wrap">
                            {row.values.map((value, index) => <span key={index} className="sdock-val-chip">{value.toLocaleString("en-US")}</span>)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="dash-empty-state">No signature selections yet</div>
              )}
            </div>
            <div className="dash-card-footer">
              <Link to="/logistics/inventory" className="dash-card-footer-link">Go to Inventory <ArrowRight /></Link>
            </div>
          </article>

          <article className="dash-card" aria-label="Material shortages">
            <div className="dash-card-header"><span className="dash-card-title">Material Shortages</span></div>
            <div className="dash-card-body">
              <table className="dash-shortages-table">
                <thead>
                  <tr>
                    <th>Material</th>
                    <th>Owned</th>
                    <th>Needed</th>
                    <th>Shortage</th>
                  </tr>
                </thead>
                <tbody>
                  {shortageRows.map((row) => (
                    <tr key={row.materialKey}>
                      <td><div className="dash-mat-cell"><MaterialIcon materialName={row.displayName} size={18} />{row.displayName}</div></td>
                      <td>{formatInventoryQuantity(row.totalAvailableEquivalent, row.unitType === "unit" ? "unit" : "scu")}</td>
                      <td>{formatInventoryQuantity(row.grossRequired, row.unitType === "unit" ? "unit" : "scu")}</td>
                      <td><span className="dash-shortage-badge">{formatInventoryQuantity(row.netMissingRefined, row.unitType === "unit" ? "unit" : "scu")}</span></td>
                    </tr>
                  ))}
                  {shortageRows.length === 0 && (
                    <tr>
                      <td colSpan={4}><div className="dash-empty-state">No material shortages</div></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="dash-card-footer">
              <Link to="/logistics/build-queue" className="dash-card-footer-link">View All Shortages <ArrowRight /></Link>
            </div>
          </article>

          <article className="dash-card" aria-label="Build queue">
            <div className="dash-card-header">
              <span className="dash-card-title">Build Queue</span>
              <div className="dash-card-meta">
                <span>{buildQueue.length} Items Queued</span>
                <span className="dash-card-meta-sep">/</span>
                <span>{activeQueueItems.length} Active</span>
              </div>
            </div>
            <div className="dash-card-body">
              <ul className="dash-bq-list" role="list">
                {buildQueue.slice(0, 5).map((item) => {
                  const progress = getQueueItemProgress(item, inventoryEntries, recipeInputTemplates);
                  const queued = progress === null;
                  return (
                    <li key={item.id} className="dash-bq-item">
                      <BqThumb color={item.status === "complete" ? "#4ade80" : "#ff9d00"} />
                      <div className="dash-bq-info">
                        <div className="dash-bq-name">{getQueueItemName(item, recipesById)}</div>
                        <div className="dash-bq-bar-wrap" aria-hidden><div className="dash-bq-bar-fill" style={{ width: queued ? "0%" : `${progress}%` }} /></div>
                      </div>
                      <div className="dash-bq-right">
                        <div className="dash-bq-qty">{item.quantity}x</div>
                        {queued ? <div className="dash-bq-queued">{item.status ?? "queued"}</div> : <div className="dash-bq-pct">{progress}%</div>}
                      </div>
                    </li>
                  );
                })}
                {buildQueue.length === 0 && <li className="dash-empty-state">No builds queued yet</li>}
              </ul>
            </div>
            <div className="dash-card-footer">
              <Link to="/logistics/build-queue" className="dash-card-footer-link">View Build Queue <ArrowRight /></Link>
            </div>
          </article>
        </div>
      </div>

      <aside className="dash-right-col" aria-label="System panels">
        <QuickInventoryPanel />

        <div className="dash-panel">
          <div className="dash-panel-header"><span className="dash-panel-title">Primary Locations</span></div>
          <div className="dash-panel-body">
            <ul className="dash-locations-list" role="list">
              {primaryLocations.map((loc) => (
                <li key={loc.id} className="dash-location-row">
                  <LocationIcon type={loc.type} />
                  <span className="dash-location-name">{loc.name}</span>
                  <span className="dash-location-scu">{formatLocationQuantity(loc)}</span>
                </li>
              ))}
              {primaryLocations.length === 0 && <li className="dash-empty-state">No records yet</li>}
            </ul>
          </div>
        </div>

        <div className="dash-panel">
          <div className="dash-panel-header"><span className="dash-panel-title">Mining Recommendations</span></div>
          <div className="dash-panel-body">
            <ul className="dash-updates-list" role="list">
              {miningState.data.map((rec) => (
                <li key={rec.locationKey} className="dash-update-item">
                  <div className="dash-update-thumb" aria-hidden>
                    <svg viewBox="0 0 20 14" width="24" height="17" fill="none">
                      <rect width="20" height="14" rx="2" fill="rgba(255,154,32,0.12)" />
                      <path d="M10 7l-3 4h6zM10 3v1M6 5l.7.7M14 5l-.7.7" stroke="#ff9d00" strokeWidth="1.3" strokeLinecap="round" strokeOpacity="0.85" />
                    </svg>
                  </div>
                  <div className="dash-update-info">
                    <div className="dash-update-title">{rec.requiredMaterials?.[0]?.displayName ?? rec.materials[0] ?? "Mining route"}</div>
                    <div className="dash-update-desc">{rec.systemName} / {rec.locationName}</div>
                    <div className="dash-update-date dash-rec-reason">{rec.routeTargetabilityLabel ?? `${Math.round(rec.score)} route score`}</div>
                  </div>
                </li>
              ))}
              {miningState.data.length === 0 && (
                <li className="dash-empty-state">{miningState.status === "loading" ? "Loading recommendations" : "No queue shortages to route"}</li>
              )}
            </ul>
          </div>
          <div className="dash-panel-footer">
            <Link to="/industry/mining" className="dash-panel-link">View Mining <ArrowRight size={10} /></Link>
          </div>
        </div>
      </aside>
    </div>
  );
}

function QuickInventoryPanel() {
  const inventoryEntries = useLogisticsStore((store) => store.inventoryEntries);
  const materialTemplates = useLogisticsStore((store) => store.materialTemplates);
  const uniqueItems = new Set(inventoryEntries.map((entry) => entry.materialId ?? entry.catalogItemId ?? entry.itemName ?? entry.id)).size;
  const topEntry = inventoryEntries.slice().sort((a, b) => b.quantity - a.quantity)[0];
  const topMaterial = topEntry ? materialTemplates.find((material) => material.id === topEntry.materialId) : undefined;

  return (
    <div className="dash-panel">
      <div className="dash-panel-header"><span className="dash-panel-title">Quick Inventory</span></div>
      <div className="dash-panel-body">
        <p className="dash-panel-desc">
          {inventoryEntries.length > 0
            ? `${inventoryEntries.length} records across ${uniqueItems} inventory items${topEntry ? `, led by ${resolveInventoryItemName(topEntry, topMaterial)}` : ""}.`
            : "No inventory records yet."}
        </p>
        <div className="dash-qinv-actions">
          <Link to="/logistics/inventory" className="dash-qinv-btn">
            <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
              <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
            </svg>
            View Inventory
          </Link>
        </div>
      </div>
    </div>
  );
}
