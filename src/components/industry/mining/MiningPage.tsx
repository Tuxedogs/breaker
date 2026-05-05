import { useEffect, useMemo, useRef, useState } from "react";
import CraftTabBar from "../crafting/CraftTabBar";
import {
  getMiningRecommendations,
  buildRecommendationRequest,
  downloadRecommendationRequest,
  projectToPublicLocations,
  buildExplorerRequest,
  downloadExplorerRequest,
} from "../../../features/mining/recommenderAdapter";
import { useMiningPlannerState } from "../../../features/mining/useMiningPlannerState";
import type {
  BuildQueueRecommendationFixture,
  BestSourcesByMaterial,
  BestRoute,
  PublicLocationEntry,
  RequiredMaterial,
  MiningPriorityItem,
  ManualMiningDemandItem,
  MiningPlannerIntentPayload,
} from "../../../features/mining/types";
import "./mining.css";

// ── Helpers ──────────────────────────────────────────────────────────────────

function getRouteFavoriteKey(route: Pick<BestRoute, "system" | "location" | "spawnType">): string {
  return `${route.system}|${route.location}|${route.spawnType}`;
}

// ── Sub-components ──────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string | number | null }) {
  const isEmpty = value === null;
  return (
    <div className="mine-stat-card">
      <div className={`mine-stat-value${isEmpty ? " mine-stat-value--pending" : ""}`}>
        {isEmpty ? "—" : value}
      </div>
      <div className="mine-stat-label">{label}</div>
    </div>
  );
}

function SummaryStrip({ data }: { data: BuildQueueRecommendationFixture }) {
  const s = data.summary;
  return (
    <div className="mine-stat-strip">
      <StatCard label="Queue Items" value={s.queueItems} />
      <StatCard label="Materials Needed" value={s.requiredMaterials} />
      <StatCard label="Matched" value={s.matchedMaterials} />
      <StatCard label="Unmatched" value={s.unmatchedMaterials} />
      <StatCard label="Missing Blueprints" value={s.missingBlueprints} />
      <StatCard label="Routes Found" value={s.recommendedRoutes} />
    </div>
  );
}

function MaterialDemandTable({
  materials,
  priorityStack,
  onAddPriority,
}: {
  materials: RequiredMaterial[];
  priorityStack: MiningPriorityItem[];
  onAddPriority: (m: RequiredMaterial) => void;
}) {
  const sorted = [...materials].sort((a, b) => b.requiredQuantity - a.requiredQuantity);
  return (
    <div className="mine-panel">
      <div className="mine-panel-header">
        <span className="mine-panel-title">Material Demand</span>
        <span className="mine-panel-count">{sorted.length} materials</span>
      </div>
      <div className="mine-demand-compact-list">
        {sorted.map((m, i) => {
          const inStack = priorityStack.some((p) => p.materialId === m.materialId);
          return (
            <div key={m.materialId} className="mine-demand-compact-row">
              <span className="mine-demand-compact-rank">{i + 1}</span>
              <span className="mine-demand-compact-name">{m.materialName}</span>
              <span className="mine-demand-compact-qty">{m.requiredQuantity.toFixed(2)}</span>
              <span className="mine-demand-compact-slots">{m.slots.join(", ")}</span>
              <span className="mine-demand-compact-used">×{m.usedBy.length}</span>
              <button
                className={`mine-add-priority-btn${inStack ? " mine-add-priority-btn--active" : ""}`}
                onClick={() => !inStack && onAddPriority(m)}
                disabled={inStack}
                title={inStack ? "In priority stack" : "Add to priority stack"}
              >
                {inStack ? "★" : "☆"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function spawnBadge(spawnType: string) {
  const label = spawnType.replace(/_/g, " ");
  const cls = spawnType.includes("ship") ? "mine-badge--ship" : "mine-badge--surface";
  return <span className={`mine-badge ${cls}`}>{label}</span>;
}

type AccessMode = "planner" | "explorer" | "public";

function RoutesPanel({
  routes,
  isFavorite,
  onToggleFavorite,
  showOnlyStarred,
  onToggleShowOnlyStarred,
  accessMode,
}: {
  routes: BestRoute[];
  isFavorite: (r: Pick<BestRoute, "system" | "location" | "spawnType">) => boolean;
  onToggleFavorite: (r: Pick<BestRoute, "system" | "location" | "spawnType">) => void;
  showOnlyStarred: boolean;
  onToggleShowOnlyStarred: () => void;
  accessMode: AccessMode;
}) {
  const isAdvanced = accessMode === "planner";

  // REMOVE FROM PROD: public mode shows 3 shuffled routes, stable for the session.
  // Delete the ref + the ternary below and replace visibleRoutes with `routes` to restore full list.
  const publicRoutesRef = useRef<BestRoute[] | null>(null);
  if (accessMode === "public" && publicRoutesRef.current === null) {
    const shuffled = [...routes].sort(() => Math.random() - 0.5);
    publicRoutesRef.current = shuffled.slice(0, 3);
  }

  const visibleRoutes = accessMode === "public" ? (publicRoutesRef.current ?? []) : routes;

  const displayed = showOnlyStarred ? visibleRoutes.filter((r) => isFavorite(r)) : visibleRoutes;

  return (
    <div className="mine-panel">
      <div className="mine-panel-header mine-panel-header--row">
        <div className="mine-panel-header-left">
          <span className="mine-panel-title">Recommended Routes</span>
          <span className="mine-panel-count">{visibleRoutes.length} routes</span>
        </div>
        <button
          className={`mine-filter-btn${showOnlyStarred ? " mine-filter-btn--active" : ""}`}
          onClick={onToggleShowOnlyStarred}
          title="Show only starred routes"
        >
          ★ Starred
        </button>
      </div>
      {displayed.length === 0 && (
        <div className="mine-empty-state">
          <p className="mine-empty-text">No starred routes yet. Click ☆ on a route to star it.</p>
        </div>
      )}
      <div className="mine-routes-list">
        {displayed.map((route, i) => {
          const starred = isFavorite(route);
          return (
            <div
              key={getRouteFavoriteKey(route)}
              className={`mine-route-card${starred ? " mine-route-card--starred" : ""}`}
            >
              <div className="mine-route-card-top">
                <span className="mine-route-rank">#{i + 1}</span>
                <button
                  className={`mine-star-btn${starred ? " mine-star-btn--on" : ""}`}
                  onClick={() => onToggleFavorite(route)}
                  title={starred ? "Unstar route" : "Star route"}
                  aria-label={starred ? "Unstar" : "Star"}
                >
                  {starred ? "★" : "☆"}
                </button>
                <div className="mine-route-id">
                  <span className="mine-route-location">{route.location}</span>
                  <span className="mine-route-system">{route.system}</span>
                </div>
                {spawnBadge(route.spawnType)}
                <div className="mine-route-coverage-inline">
                  <span className="mine-route-coverage-pct">
                    {(route.queuedCoverageRatio * 100).toFixed(0)}%
                  </span>
                  <span className="mine-route-coverage-label">coverage</span>
                </div>
                <span className="mine-route-sources-count">
                  {route.sourceCount} src
                </span>
              </div>

              {isAdvanced && (
                <div className="mine-route-scores">
                  <span className="mine-score-pill">
                    <span className="mine-score-label">Queue</span>
                    <span className="mine-score-val">{route.queueRouteScore.toFixed(3)}</span>
                  </span>
                  <span className="mine-score-pill">
                    <span className="mine-score-label">Route</span>
                    <span className="mine-score-val">{route.routeScore.toFixed(3)}</span>
                  </span>
                  <span className="mine-score-pill">
                    <span className="mine-score-label">Best Src</span>
                    <span className="mine-score-val">{route.bestSourceScore.toFixed(3)}</span>
                  </span>
                  <span className="mine-score-pill">
                    <span className="mine-score-label">Avg Src</span>
                    <span className="mine-score-val">{route.averageSourceScore.toFixed(3)}</span>
                  </span>
                </div>
              )}

              {route.queuedMaterialsCovered.length > 0 && (
                <div className="mine-route-covered">
                  {route.queuedMaterialsCovered.map((m) => (
                    <span key={m} className="mine-mat-chip">{m}</span>
                  ))}
                </div>
              )}

              <div className="mine-route-reason">{route.reason}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SourcesByMaterialPanel({
  items,
  accessMode,
}: {
  items: BestSourcesByMaterial[];
  accessMode: AccessMode;
}) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const isAdvanced = accessMode === "planner";

  function toggle(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="mine-panel">
      <div className="mine-panel-header">
        <span className="mine-panel-title">Sources by Material</span>
        <span className="mine-panel-count">{items.length} materials</span>
      </div>
      <div className="mine-sources-list">
        {items.map((item) => {
          const open = openIds.has(item.materialId);
          return (
            <div key={item.materialId} className="mine-source-block">
              <button
                className="mine-source-block-header mine-source-block-header--btn"
                onClick={() => toggle(item.materialId)}
                aria-expanded={open}
              >
                <span className="mine-source-mat-name">{item.materialName}</span>
                <span className="mine-source-meta">
                  {item.requiredQuantity.toFixed(2)} qty · {item.sourceCount} locations
                </span>
                <span className="mine-source-toggle">{open ? "▲" : "▼"}</span>
              </button>
              {open && item.bestSources.length > 0 && (
                <div className="mine-source-locations">
                  {item.bestSources.map((src, si) => (
                    <div key={`${src.location}-${si}`} className="mine-source-loc-row">
                      <div className="mine-source-loc-main">
                        <span className="mine-source-loc-name">{src.location}</span>
                        <span className="mine-source-loc-sys">{src.system}</span>
                        {spawnBadge(src.spawnType)}
                      </div>
                      {isAdvanced && (
                        <div className="mine-source-loc-meta">
                          <span className="mine-score-pill">
                            <span className="mine-score-label">Score</span>
                            <span className="mine-score-val">{src.overallScore.toFixed(3)}</span>
                          </span>
                          <span className="mine-source-loc-reason">{src.reason}</span>
                        </div>
                      )}
                      {!isAdvanced && src.reason && (
                        <span className="mine-source-loc-reason mine-source-loc-reason--pub">{src.reason}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DataGapPanel({ title, message }: { title: string; message: string }) {
  return (
    <div className="mine-panel mine-panel--warning">
      <div className="mine-panel-header">
        <span className="mine-panel-title">{title}</span>
      </div>
      <div className="mine-empty-state">
        <p className="mine-empty-text mine-empty-text--warn">{message}</p>
      </div>
    </div>
  );
}

// ── Priority Stack panel ─────────────────────────────────────────────────────

function PriorityStackPanel({
  items,
  onMoveUp,
  onMoveDown,
  onRemove,
  onTogglePin,
  onClear,
}: {
  items: MiningPriorityItem[];
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onRemove: (id: string) => void;
  onTogglePin: (id: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="mine-panel mine-panel--intent">
      <div className="mine-panel-header mine-panel-header--row">
        <span className="mine-panel-title">Priority Stack</span>
        {items.length > 0 && (
          <button className="mine-clear-btn" onClick={onClear} title="Clear all priorities">
            Clear
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <div className="mine-empty-state mine-empty-state--sm">
          <p className="mine-empty-text">
            Star a material to add it here.
          </p>
        </div>
      ) : (
        <div className="mine-priority-list">
          {items.map((item, i) => (
            <div key={item.id} className={`mine-priority-row${item.pinned ? " mine-priority-row--pinned" : ""}`}>
              <div className="mine-priority-rank">{item.priorityRank}</div>
              <div className="mine-priority-body">
                <span className="mine-priority-name">{item.materialName}</span>
                <span className={`mine-priority-source mine-priority-source--${item.source}`}>
                  {item.source === "requiredMaterial" ? "queue" : "manual"}
                </span>
              </div>
              <div className="mine-priority-actions">
                <button
                  className={`mine-pin-btn${item.pinned ? " mine-pin-btn--on" : ""}`}
                  onClick={() => onTogglePin(item.id)}
                  title={item.pinned ? "Unpin" : "Pin"}
                >
                  📌
                </button>
                <button
                  className="mine-move-btn"
                  onClick={() => onMoveUp(item.id)}
                  disabled={i === 0}
                  title="Move up"
                >
                  ▲
                </button>
                <button
                  className="mine-move-btn"
                  onClick={() => onMoveDown(item.id)}
                  disabled={i === items.length - 1}
                  title="Move down"
                >
                  ▼
                </button>
                <button
                  className="mine-remove-btn"
                  onClick={() => onRemove(item.id)}
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="mine-intent-note">
        Priority stack is saved locally and sent to the recommender in a later phase.
      </div>
    </div>
  );
}

// ── Manual Demand panel ──────────────────────────────────────────────────────

const SOURCE_TYPES = ["ore", "raw", "refined", "unknown"] as const;

function ManualDemandPanel({
  items,
  onAdd,
  onRemove,
  onClear,
}: {
  items: ManualMiningDemandItem[];
  onAdd: (opts: Omit<ManualMiningDemandItem, "id" | "createdAt">) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [sourceType, setSourceType] = useState<ManualMiningDemandItem["sourceType"]>("ore");
  const [notes, setNotes] = useState("");
  const [addToPriority, setAddToPriority] = useState(false);
  const [error, setError] = useState("");

  function handleAdd() {
    const trimName = name.trim();
    const parsedQty = parseFloat(qty);
    if (!trimName) { setError("Material name required."); return; }
    if (isNaN(parsedQty) || parsedQty <= 0) { setError("Quantity must be a positive number."); return; }
    setError("");
    onAdd({ materialName: trimName, desiredQuantity: parsedQty, sourceType, notes: notes.trim(), addToPriority });
    setName("");
    setQty("");
    setNotes("");
    setAddToPriority(false);
  }

  return (
    <div className="mine-panel mine-panel--intent">
      <div className="mine-panel-header mine-panel-header--row">
        <span className="mine-panel-title">Manual Demand</span>
        {items.length > 0 && (
          <button className="mine-clear-btn" onClick={onClear} title="Clear all manual demand">
            Clear
          </button>
        )}
      </div>

      <div className="mine-demand-form">
        <div className="mine-demand-form-row">
          <input
            className="mine-input"
            placeholder="Material name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="mine-input mine-input--short"
            placeholder="Qty"
            type="number"
            min="0"
            step="any"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
        </div>
        <div className="mine-demand-form-row">
          <select
            className="mine-select"
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value as ManualMiningDemandItem["sourceType"])}
          >
            {SOURCE_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <input
            className="mine-input mine-input--notes"
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <div className="mine-demand-form-footer">
          <label className="mine-checkbox-label">
            <input
              type="checkbox"
              checked={addToPriority}
              onChange={(e) => setAddToPriority(e.target.checked)}
            />
            <span>Add to priority</span>
          </label>
          <button className="mine-add-btn" onClick={handleAdd}>
            Add
          </button>
        </div>
      </div>
      {error && <div className="mine-form-error">{error}</div>}

      {items.length > 0 && (
        <div className="mine-demand-list">
          {items.map((item) => (
            <div key={item.id} className="mine-demand-row">
              <div className="mine-demand-body">
                <span className="mine-demand-name">{item.materialName}</span>
                <span className="mine-demand-qty">{item.desiredQuantity}</span>
                <span className="mine-demand-type">{item.sourceType}</span>
                {item.notes && <span className="mine-demand-notes">{item.notes}</span>}
              </div>
              <button
                className="mine-remove-btn"
                onClick={() => onRemove(item.id)}
                title="Remove"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {items.length === 0 && (
        <div className="mine-empty-state mine-empty-state--sm">
          <p className="mine-empty-text">No manual demand entries yet.</p>
        </div>
      )}

      <div className="mine-intent-note">
        Manual demand is saved locally. Recommender integration comes in a later phase.
      </div>
    </div>
  );
}

// ── Request Preview panel ────────────────────────────────────────────────────

function RequestPreviewPanel({
  payload,
  fixture,
}: {
  payload: MiningPlannerIntentPayload;
  fixture: BuildQueueRecommendationFixture | null;
}) {
  const [open, setOpen] = useState(false);

  function handleExport() {
    const request = buildRecommendationRequest(payload, fixture);
    downloadRecommendationRequest(request);
  }

  return (
    <div className="mine-panel mine-panel--debug">
      <div className="mine-panel-header--split">
        <button className="mine-collapsible-header" onClick={() => setOpen((p) => !p)}>
          <span className="mine-panel-title">Recommender Request Preview</span>
          <span className="mine-collapse-arrow">{open ? "▲" : "▼"}</span>
        </button>
        <button className="mine-btn-export" onClick={handleExport} title="Download request payload as JSON">
          Export JSON
        </button>
      </div>
      {open && (
        <pre className="mine-json-preview">
          {JSON.stringify(buildRecommendationRequest(payload, fixture), null, 2)}
        </pre>
      )}
    </div>
  );
}

// ── Material Explorer (public-safe) ──────────────────────────────────────────

const KIND_LABEL: Record<string, string> = {
  provider_preset: "Provider Preset",
  planet: "Planet",
  moon: "Moon",
  asteroid_belt: "Asteroid Belt",
  ring: "Ring",
  lagrange: "Lagrange Point",
};

function kindLabel(kind: string): string {
  return KIND_LABEL[kind] ?? kind.replace(/_/g, " ");
}

function spawnTypeLabel(spawnType: string): string {
  return spawnType.replace(/_/g, " ");
}

function spawnBadgeCls(spawnType: string): string {
  if (spawnType.includes("ship") || spawnType === "mineable") return "mine-badge--ship";
  return "mine-badge--surface";
}

function LocationCard({
  entry,
  expanded,
  onToggle,
}: {
  entry: PublicLocationEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`mex-location-card${expanded ? " mex-location-card--expanded" : ""}`}
      onClick={onToggle}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onToggle()}
    >
      <div className="mex-card-image-placeholder">
        <span className="mex-card-image-label">{entry.systemName}</span>
      </div>
      <div className="mex-card-body">
        <div className="mex-card-name">{entry.locationName}</div>
        <div className="mex-card-system">{entry.systemName}</div>
        <div className="mex-card-meta">
          <span className="mex-card-kind">{kindLabel(entry.locationKind)}</span>
          <span className={`mine-badge ${spawnBadgeCls(entry.spawnType)}`}>
            {spawnTypeLabel(entry.spawnType)}
          </span>
        </div>
        {entry.nearbyStations.length > 0 && (
          <div className="mex-card-stations">
            <span className="mex-card-stations-label">Nearby:</span>
            {entry.nearbyStations.map((s) => (
              <span key={s} className="mex-station-chip">{s}</span>
            ))}
          </div>
        )}
        {expanded && (
          <div className="mex-card-materials">
            <div className="mex-card-materials-label">Materials at this location</div>
            <div className="mex-card-material-list">
              {entry.materials.map((m) => (
                <span key={m} className="mex-mat-badge">{m}</span>
              ))}
            </div>
          </div>
        )}
        {!expanded && (
          <div className="mex-card-mat-count">
            {entry.materials.length} material{entry.materials.length !== 1 ? "s" : ""} · tap to expand
          </div>
        )}
      </div>
    </div>
  );
}

function MaterialExplorer({ fixture }: { fixture: BuildQueueRecommendationFixture }) {
  const locations = useMemo(() => projectToPublicLocations(fixture), [fixture]);
  const allMaterials = useMemo(
    () => Array.from(new Set(locations.flatMap((l) => l.materials))).sort(),
    [locations]
  );

  const [selectedMaterial, setSelectedMaterial] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!selectedMaterial) return locations;
    return locations.filter((l) => l.materials.includes(selectedMaterial));
  }, [locations, selectedMaterial]);

  function handleExport() {
    const req = buildExplorerRequest(filtered, selectedMaterial, allMaterials.length);
    downloadExplorerRequest(req);
  }

  return (
    <div className="mex-root">
      <div className="mex-access-notice">
        <span className="mex-access-badge">PUBLIC</span>
        <span className="mex-access-text">
          Location presence only — advanced quality and route intelligence requires authentication.
        </span>
      </div>

      {allMaterials.length === 0 && (
        <div className="mine-panel">
          <div className="mine-empty-state">
            <p className="mine-empty-text">
              No location data in the current fixture.
            </p>
          </div>
        </div>
      )}

      {allMaterials.length > 0 && (
        <>
          <div className="mine-panel">
            <div className="mine-panel-header mine-panel-header--row">
              <div className="mine-panel-header-left">
                <span className="mine-panel-title">Filter by Material</span>
                <span className="mine-panel-count">{allMaterials.length} materials</span>
              </div>
              {selectedMaterial && (
                <button
                  className="mine-filter-btn mine-filter-btn--active"
                  onClick={() => setSelectedMaterial(null)}
                >
                  ✕ Clear
                </button>
              )}
            </div>
            <div className="mex-badge-rail">
              {allMaterials.map((mat) => (
                <button
                  key={mat}
                  className={`mex-mat-btn${selectedMaterial === mat ? " mex-mat-btn--active" : ""}`}
                  onClick={() => setSelectedMaterial(selectedMaterial === mat ? null : mat)}
                >
                  {mat}
                </button>
              ))}
            </div>
            {selectedMaterial && (
              <div className="mex-filter-status">
                {filtered.length} location{filtered.length !== 1 ? "s" : ""} with <strong>{selectedMaterial}</strong>
              </div>
            )}
          </div>

          <div className="mine-panel">
            <div className="mine-panel-header mine-panel-header--row">
              <div className="mine-panel-header-left">
                <span className="mine-panel-title">
                  {selectedMaterial ? `Locations · ${selectedMaterial}` : "All Locations"}
                </span>
                <span className="mine-panel-count">{filtered.length}</span>
              </div>
              <button className="mine-btn-export" onClick={handleExport} title="Download explorer request as JSON">
                Export
              </button>
            </div>

            {filtered.length === 0 ? (
              <div className="mine-empty-state">
                <p className="mine-empty-text">
                  No locations found for the selected material.
                </p>
              </div>
            ) : (
              <div className="mex-card-grid">
                {filtered.map((entry) => (
                  <LocationCard
                    key={entry.locationKey}
                    entry={entry}
                    expanded={expandedKey === entry.locationKey}
                    onToggle={() =>
                      setExpandedKey(expandedKey === entry.locationKey ? null : entry.locationKey)
                    }
                  />
                ))}
              </div>
            )}
          </div>

          <div className="mex-fixture-note">
            Explorer data reflects the currently loaded build-queue fixture only.
          </div>
        </>
      )}
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; data: BuildQueueRecommendationFixture };

export default function MiningModule() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [accessMode, setAccessMode] = useState<AccessMode>("planner");
  const planner = useMiningPlannerState();

  useEffect(() => {
    getMiningRecommendations()
      .then((data) => setState({ status: "ok", data }))
      .catch((err) => setState({ status: "error", message: String(err) }));
  }, []);

  return (
    <div className="mine-page">
      <div className="mine-page-header">
        <div>
          <div className="mine-breadcrumb">
            <span className="mine-breadcrumb-root">Industry</span>
            <span className="mine-breadcrumb-sep">/</span>
            <span className="mine-breadcrumb-active">Mining</span>
          </div>
          <h1 className="mine-page-title">Mining Planner</h1>
          <p className="mine-page-subtitle">
            Build queue demand · source coverage · recommended routes
          </p>
        </div>
        <div className="mine-mode-toggle">
          <button
            className={`mine-mode-btn${accessMode === "planner" ? " mine-mode-btn--active" : ""}`}
            onClick={() => setAccessMode("planner")}
          >
            Planner
          </button>
          <button
            className={`mine-mode-btn${accessMode === "explorer" ? " mine-mode-btn--active" : ""}`}
            onClick={() => setAccessMode("explorer")}
          >
            Explorer
          </button>
          <button
            className={`mine-mode-btn${accessMode === "public" ? " mine-mode-btn--active mine-mode-btn--public" : ""}`}
            onClick={() => setAccessMode("public")}
            title="Public view — hides advanced scoring fields"
          >
            Public
          </button>
        </div>
      </div>

      <CraftTabBar activeTab="mining" />

      {state.status === "loading" && (
        <div className="mine-status-state">
          <span className="mine-status-text">Loading recommendations…</span>
        </div>
      )}

      {state.status === "error" && (
        <div className="mine-status-state mine-status-state--error">
          <span className="mine-status-text">Failed to load: {state.message}</span>
        </div>
      )}

      {state.status === "ok" && state.data && accessMode === "explorer" && (
        <MaterialExplorer fixture={state.data} />
      )}

      {state.status === "ok" && state.data && (accessMode === "planner" || accessMode === "public") && (
        <>
          <SummaryStrip data={state.data} />

          <div className="mine-layout">
            {/* Main column */}
            <div className="mine-panels">
              <MaterialDemandTable
                materials={state.data.requiredMaterials}
                priorityStack={planner.priorityStack}
                onAddPriority={(m) =>
                  planner.addToPriorityStack({
                    materialId: m.materialId,
                    materialName: m.materialName,
                    source: "requiredMaterial",
                  })
                }
              />
              <RoutesPanel
                routes={state.data.bestRoutes}
                isFavorite={planner.isFavorite}
                onToggleFavorite={planner.toggleFavorite}
                showOnlyStarred={planner.filters.showOnlyStarred}
                onToggleShowOnlyStarred={planner.toggleShowOnlyStarred}
                accessMode={accessMode}
              />
              <SourcesByMaterialPanel
                items={state.data.bestSourcesByMaterial}
                accessMode={accessMode}
              />

              {state.data.unmatchedMaterials.length > 0 && (
                <DataGapPanel
                  title="Unmatched Materials"
                  message="Materials needed by the build queue but missing source recommendations."
                />
              )}
              {state.data.missingBlueprints.length > 0 && (
                <DataGapPanel
                  title="Missing Blueprints"
                  message="Queued blueprints could not be matched to blueprints.json."
                />
              )}

              {accessMode === "planner" && (
                <RequestPreviewPanel payload={planner.intentPayload} fixture={state.data} />
              )}
            </div>

            {/* Sidebar — Planner Inputs */}
            <div className="mine-intent-sidebar">
              <div className="mine-sidebar-section-label">Planner Inputs</div>
              <PriorityStackPanel
                items={planner.priorityStack}
                onMoveUp={planner.movePriorityUp}
                onMoveDown={planner.movePriorityDown}
                onRemove={planner.removePriorityItem}
                onTogglePin={planner.togglePriorityPin}
                onClear={planner.clearPriorityStack}
              />
              <ManualDemandPanel
                items={planner.manualDemand}
                onAdd={planner.addManualDemand}
                onRemove={planner.removeManualDemand}
                onClear={planner.clearManualDemand}
              />
            </div>
          </div>
        </>
      )}

      {state.status === "ok" &&
        !state.data.requiredMaterials.length &&
        !state.data.bestRoutes.length && (
          <div className="mine-status-state">
            <span className="mine-status-text">No recommendation data in fixture.</span>
          </div>
        )}
    </div>
  );
}
