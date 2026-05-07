import { useEffect, useMemo, useState } from "react";
import CraftTabBar from "../crafting/CraftTabBar";
import {
  buildRecommendationRequest,
  getMiningRecommendations,
  type RecommendationResponse,
} from "../../../features/mining/recommenderAdapter";
import { getBuildQueueRequirements } from "../../../features/buildQueue/buildQueueRequirementsApi";
import { useMiningPlannerState } from "../../../features/mining/useMiningPlannerState";
import type {
  ManualMiningDemandItem,
  PublicLocationEntry,
  RequiredMaterial,
} from "../../../features/mining/types";
import "./mining.css";
import { useLogisticsStore } from "../../../stores/logisticsStore";
import { createMaterialResolver } from "../../../lib/logistics/materialResolver";
import { getBuildQueueShortageSummary } from "../../../lib/logistics/selectors";

// ── Access mode ───────────────────────────────────────────────────────────────

const accessMode = "public";
const showAdvancedScores = accessMode !== "public";

// ── Helpers ───────────────────────────────────────────────────────────────────

function spawnTypeLabel(spawnType: string): string {
  const s = spawnType.toLowerCase();
  if (s.includes("ship") || s === "mineable") return "Ship";
  if (s.includes("surface")) return "Surface";
  if (s.includes("hand") || s.includes("fps")) return "Hand";
  if (s.includes("mixed")) return "Mixed";
  return spawnType.replace(/_/g, " ");
}

function spawnTypeBadgeClass(spawnType: string): string {
  const s = spawnType.toLowerCase();
  if (s.includes("ship") || s === "mineable") return "mloc-badge--ship";
  if (s.includes("surface")) return "mloc-badge--surface";
  if (s.includes("hand") || s.includes("fps")) return "mloc-badge--hand";
  return "mloc-badge--mixed";
}

function miningTypeFromSpawn(spawnType: string): string {
  const s = spawnType.toLowerCase();
  if (s.includes("ship") || s === "mineable") return "Ship";
  if (s.includes("surface")) return "Surface";
  if (s.includes("hand") || s.includes("fps")) return "Hand";
  return "Mixed";
}

function formatMiningQuantity(quantity: number, unitType?: "unit" | "SCU" | "scu" | "cscu"): string {
  return unitType === "unit" ? `x${quantity}` : `${quantity.toFixed(2)} SCU`;
}

function isRefinableMaterial(material: unknown): boolean {
  return typeof material === "object" && material !== null && "isRefinable" in material
    ? Boolean((material as { isRefinable?: boolean }).isRefinable)
    : false;
}

// Derives a deterministic reason string from existing data.
function deriveLocationReason(
  entry: PublicLocationEntry,
  coveredBQ: string[],
  missingBQ: string[],
): string {
  const total = coveredBQ.length + missingBQ.length;
  const method = spawnTypeLabel(entry.spawnType).toLowerCase();
  if (total === 0) return `${entry.locationName} has no tracked queue materials.`;
  if (coveredBQ.length === 0) return `No queue materials found here via ${method} mining.`;
  if (coveredBQ.length === total) {
    const list = coveredBQ.slice(0, 3).join(", ") + (coveredBQ.length > 3 ? ` +${coveredBQ.length - 3} more` : "");
    return `Full queue coverage via ${method} mining: ${list}.`;
  }
  const coveredList = coveredBQ.slice(0, 2).join(", ") + (coveredBQ.length > 2 ? ` +${coveredBQ.length - 2} more` : "");
  const missingList = missingBQ.slice(0, 2).join(", ") + (missingBQ.length > 2 ? ` +${missingBQ.length - 2} more` : "");
  return `Covers ${coveredBQ.length} of ${total} queue materials via ${method} mining (${coveredList}). Still needs: ${missingList}.`;
}

// ── Load state ────────────────────────────────────────────────────────────────

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; data: RecommendationResponse };

// ── Location strip panel ──────────────────────────────────────────────────────

function LocationPanel({
  entry,
  selectedMaterials,
  buildQueueMaterialDisplayNames,
  starred,
  selected,
  onSelect,
  onToggleStar,
}: {
  entry: PublicLocationEntry;
  selectedMaterials: Set<string>;
  buildQueueMaterialDisplayNames: Set<string>;
  starred: boolean;
  selected: boolean;
  onSelect: () => void;
  onToggleStar: (e: React.MouseEvent) => void;
}) {
  const coveredBQ = useMemo(
    () => entry.materials.filter((m) => buildQueueMaterialDisplayNames.has(m)),
    [entry.materials, buildQueueMaterialDisplayNames]
  );
  const coveredSelected = useMemo(
    () => entry.materials.filter((m) => selectedMaterials.has(m)),
    [entry.materials, selectedMaterials]
  );

  const primaryCovered = selectedMaterials.size > 0 ? coveredSelected : coveredBQ;
  const totalRelevant = selectedMaterials.size > 0 ? selectedMaterials.size : buildQueueMaterialDisplayNames.size;
  const coveragePct = totalRelevant > 0 ? Math.round((primaryCovered.length / totalRelevant) * 100) : 0;

  const chipLimit = 4;
  const chips = primaryCovered.slice(0, chipLimit);
  const extraCount = primaryCovered.length - chipLimit;

  return (
    <button
      className={`mloc-panel${selected ? " mloc-panel--selected" : ""}${starred ? " mloc-panel--starred" : ""}`}
      onClick={onSelect}
      type="button"
    >
      <div className="mloc-panel-topbar">
        <span className="mloc-panel-system">{entry.systemName}</span>
        <span className={`mloc-badge ${spawnTypeBadgeClass(entry.spawnType)}`}>
          {spawnTypeLabel(entry.spawnType)}
        </span>
        <button
          className={`mloc-star-btn${starred ? " mloc-star-btn--on" : ""}`}
          onClick={onToggleStar}
          title={starred ? "Unstar" : "Star"}
          aria-label={starred ? "Unstar" : "Star"}
        >
          {starred ? "★" : "☆"}
        </button>
      </div>

      <div className="mloc-panel-name">{entry.locationName}</div>

      {totalRelevant > 0 && (
        <div className="mloc-panel-coverage">
          <div className="mloc-cov-bar">
            <div
              className={`mloc-cov-fill${coveragePct === 100 ? " mloc-cov-fill--full" : ""}`}
              style={{ width: `${coveragePct}%` }}
            />
          </div>
          <span className="mloc-cov-label">{primaryCovered.length}/{totalRelevant} materials</span>
        </div>
      )}

      <div className="mloc-panel-chips">
        {chips.map((m) => (
          <span key={m} className="mloc-mat-chip mloc-mat-chip--bq">{m}</span>
        ))}
        {extraCount > 0 && <span className="mloc-mat-chip">+{extraCount}</span>}
        {chips.length === 0 && (
          <span className="mloc-empty-chips">No queue materials</span>
        )}
      </div>
    </button>
  );
}

// ── Location detail panel ─────────────────────────────────────────────────────

function LocationDetail({
  entry,
  buildQueueMaterialDisplayNames,
  selectedMaterials,
  requiredMaterials,
}: {
  entry: PublicLocationEntry;
  buildQueueMaterialDisplayNames: Set<string>;
  selectedMaterials: Set<string>;
  requiredMaterials: RequiredMaterial[];
}) {
  const coveredBQ = useMemo(
    () => entry.materials.filter((m) => buildQueueMaterialDisplayNames.has(m)),
    [entry.materials, buildQueueMaterialDisplayNames]
  );
  const missingBQ = useMemo(
    () => [...buildQueueMaterialDisplayNames].filter((m) => !entry.materials.includes(m)),
    [entry.materials, buildQueueMaterialDisplayNames]
  );

  const reason = useMemo(
    () => deriveLocationReason(entry, coveredBQ, missingBQ),
    [entry, coveredBQ, missingBQ]
  );

  const coveredRequirements = useMemo(
    () => requiredMaterials.filter((mat) => coveredBQ.includes(mat.materialName)),
    [requiredMaterials, coveredBQ]
  );

  const missingRequirements = useMemo(
    () => requiredMaterials.filter((mat) => missingBQ.includes(mat.materialName)),
    [requiredMaterials, missingBQ]
  );

  return (
    <div className="mloc-detail">
      <div className="mloc-detail-header">
        <div className="mloc-detail-title-group">
          <div className="mloc-detail-name">{entry.locationName}</div>
          <div className="mloc-detail-meta">
            <span className="mloc-detail-system">{entry.systemName}</span>
            {entry.locationKind && (
              <span className="mloc-detail-kind">{entry.locationKind.replace(/_/g, " ")}</span>
            )}
            <span className={`mloc-badge ${spawnTypeBadgeClass(entry.spawnType)}`}>
              {spawnTypeLabel(entry.spawnType)} Mining
            </span>
          </div>
        </div>
        {entry.nearbyStations.length > 0 && (
          <div className="mloc-detail-stations">
            <span className="mloc-stations-label">Nearby</span>
            {entry.nearbyStations.map((s) => (
              <span key={s} className="mloc-station-chip">{s}</span>
            ))}
          </div>
        )}
      </div>

      <div className="mloc-detail-reason">{reason}</div>

      <div className="mloc-detail-split">
        <div className="mloc-detail-col">
          <div className="mloc-detail-col-label mloc-detail-col-label--covered">
            Covered ({coveredBQ.length})
          </div>
          {coveredRequirements.length > 0 ? (
            <div className="mloc-detail-mat-list">
              {coveredRequirements.map((mat) => (
                <div key={mat.materialId} className="mloc-detail-mat-row mloc-detail-mat-row--covered">
                  <span className="mloc-detail-mat-name">{mat.materialName}</span>
                  <span className="mloc-detail-mat-qty">{formatMiningQuantity(mat.requiredQuantity, mat.unitType)}</span>
                  <div className="mloc-detail-mat-usedby">
                    {mat.usedBy.slice(0, 2).map((ub) => (
                      <span key={ub.blueprintGuid + ub.slot} className="mbq-used-chip">{ub.displayName}</span>
                    ))}
                    {mat.usedBy.length > 2 && (
                      <span className="mbq-used-chip">+{mat.usedBy.length - 2}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : coveredBQ.length > 0 ? (
            <div className="mloc-panel-chips">
              {coveredBQ.map((m) => (
                <span key={m} className="mloc-mat-chip mloc-mat-chip--bq">{m}</span>
              ))}
            </div>
          ) : (
            <p className="mloc-detail-none">None</p>
          )}
        </div>

        <div className="mloc-detail-col">
          <div className="mloc-detail-col-label mloc-detail-col-label--missing">
            Missing ({missingBQ.length})
          </div>
          {missingRequirements.length > 0 ? (
            <div className="mloc-detail-mat-list">
              {missingRequirements.map((mat) => (
                <div key={mat.materialId} className="mloc-detail-mat-row mloc-detail-mat-row--missing">
                  <span className="mloc-detail-mat-name">{mat.materialName}</span>
                  <span className="mloc-detail-mat-qty">{formatMiningQuantity(mat.requiredQuantity, mat.unitType)}</span>
                  <div className="mloc-detail-mat-usedby">
                    {mat.usedBy.slice(0, 2).map((ub) => (
                      <span key={ub.blueprintGuid + ub.slot} className="mbq-used-chip mbq-used-chip--missing">{ub.displayName}</span>
                    ))}
                    {mat.usedBy.length > 2 && (
                      <span className="mbq-used-chip mbq-used-chip--missing">+{mat.usedBy.length - 2}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : missingBQ.length > 0 ? (
            <div className="mloc-panel-chips">
              {missingBQ.map((m) => (
                <span key={m} className="mloc-mat-chip">{m}</span>
              ))}
            </div>
          ) : (
            <p className="mloc-detail-none">None — full coverage!</p>
          )}
        </div>
      </div>

      {/* Show all materials when there's no queue or selection context */}
      {buildQueueMaterialDisplayNames.size === 0 && selectedMaterials.size === 0 && entry.materials.length > 0 && (
        <div className="mloc-detail-all-mats">
          <span className="mloc-detail-all-label">All materials at this location</span>
          <div className="mloc-panel-chips">
            {entry.materials.map((m) => (
              <span key={m} className="mloc-mat-chip">{m}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Collapsible panel ─────────────────────────────────────────────────────────

function CollapsiblePanel({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="msb-collapsible">
      <button className="msb-collapsible-header" onClick={() => setOpen((p) => !p)}>
        <span className="msb-section-label">{title}</span>
        {count !== undefined && count > 0 && (
          <span className="msb-count-pill">{count}</span>
        )}
        <span className="msb-collapse-arrow">{open ? "▲" : "▼"}</span>
      </button>
      {open && <div className="msb-collapsible-body">{children}</div>}
    </div>
  );
}

// ── Manual Demand (compact) ───────────────────────────────────────────────────

function ManualDemandCompact({
  items,
  materials,
  onAdd,
  onRemove,
  onClear,
}: {
  items: ManualMiningDemandItem[];
  materials: string[];
  onAdd: (opts: Omit<ManualMiningDemandItem, "id" | "createdAt">) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  const [name, setName] = useState("");
  const [quality, setQuality] = useState("");
  const [ore, setOre] = useState("");
  const [error, setError] = useState("");
  const materialListId = "mining-manual-materials";

  function handleAdd() {
    const trimName = name.trim();
    const parsedQuality = parseFloat(quality);
    if (!trimName) { setError("Name required"); return; }
    if (isNaN(parsedQuality) || parsedQuality < 0) { setError("Quality required"); return; }
    setError("");
    onAdd({ materialName: trimName, desiredQuantity: parsedQuality, sourceType: "ore", notes: ore.trim(), addToPriority: false });
    setName(""); setQuality(""); setOre("");
  }

  return (
    <div className="msb-demand-wrap">
      <div className="msb-demand-form">
        <input className="mine-input" list={materialListId} placeholder="Search materials" value={name} onChange={(e) => setName(e.target.value)} />
        <datalist id={materialListId}>
          {materials.map((material) => <option key={material} value={material} />)}
        </datalist>
        <input className="mine-input mine-input--short mine-input--no-spinner" placeholder="Quality" type="number" min="0" max="100" step="any" value={quality} onChange={(e) => setQuality(e.target.value)} />
        <input className="mine-input mine-input--short" placeholder="Ore" value={ore} onChange={(e) => setOre(e.target.value)} />
        <button className="mine-add-btn" onClick={handleAdd}>Add</button>
      </div>
      {error && <div className="mine-form-error">{error}</div>}
      {items.length > 0 && (
        <div className="msb-demand-list">
          {items.map((item) => (
            <div key={item.id} className="msb-demand-row">
              <span className="msb-demand-name">{item.materialName}</span>
              <span className="msb-demand-qty">Q {item.desiredQuantity}</span>
              {item.notes && <span className="msb-demand-qty">{item.notes}</span>}
              <button className="mine-remove-btn" onClick={() => onRemove(item.id)}>✕</button>
            </div>
          ))}
          <button className="mine-clear-btn msb-demand-clear" onClick={onClear}>Clear all</button>
        </div>
      )}
    </div>
  );
}

// ── Material demand row ───────────────────────────────────────────────────────

function MaterialDemandRow({
  materialName,
  totalQty,
  unitType,
  selectedQuality,
  estimatedRawOreNeeded,
  usedByItems,
  covered,
  sourceLocationNames,
}: {
  materialName: string;
  totalQty: number;
  unitType?: "unit" | "SCU" | "scu" | "cscu";
  selectedQuality?: number;
  estimatedRawOreNeeded?: number;
  usedByItems: string[];
  covered: boolean;
  sourceLocationNames: string[];
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`mdem-row${covered ? " mdem-row--covered" : " mdem-row--missing"}`}>
      <div className="mdem-main">
        <span className={`mdem-dot${covered ? " mdem-dot--covered" : " mdem-dot--missing"}`} />
        <span className="mdem-name">{materialName}</span>
        <span className="mdem-qty">{formatMiningQuantity(totalQty, unitType)}</span>
        {totalQty <= 0 && <span className="mdem-tag mdem-tag--ok">In inventory</span>}
        {estimatedRawOreNeeded !== undefined && estimatedRawOreNeeded > 0 && (
          <span className="mdem-ore-hint">≈ {formatMiningQuantity(estimatedRawOreNeeded, "SCU")} raw</span>
        )}
        <div className="mdem-right">
          <span className={`mdem-status${covered ? " mdem-status--covered" : " mdem-status--missing"}`}>
            {covered ? "Covered" : "Not in results"}
          </span>
          <button
            className="mdem-expand-btn"
            onClick={() => setExpanded((p) => !p)}
            title="Show queue items"
          >
            {usedByItems.length} item{usedByItems.length !== 1 ? "s" : ""}
            <span className="mdem-expand-arrow">{expanded ? " ▲" : " ▼"}</span>
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mdem-expanded">
          <div className="mdem-expanded-row">
            <span className="mdem-exp-label">Used by</span>
            <div className="mdem-chip-group">
              {usedByItems.map((n) => (
                <span key={n} className="mbq-used-chip">{n}</span>
              ))}
            </div>
          </div>
          {covered && sourceLocationNames.length > 0 && (
            <div className="mdem-expanded-row">
              <span className="mdem-exp-label">Found at</span>
              <div className="mdem-chip-group">
                {sourceLocationNames.map((loc) => (
                  <span key={loc} className="mbq-location-chip">{loc}</span>
                ))}
              </div>
            </div>
          )}
          {selectedQuality !== undefined && (
            <div className="mdem-expanded-row">
              <span className="mdem-exp-label">Selected quality</span>
              <span className="mbq-location-chip">Q {selectedQuality}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Resource demand panel ─────────────────────────────────────────────────────

function ResourceDemandPanel({
  requiredMaterials,
  visibleMaterialKeys,
  visibleLocationNames,
}: {
  requiredMaterials: RequiredMaterial[];
  visibleMaterialKeys: Set<string>;
  visibleLocationNames: string[];
}) {
  const coveredCount = requiredMaterials.filter((m) => visibleMaterialKeys.has(m.materialId)).length;

  return (
    <div className="mres-panel">
      <div className="mres-header">
        <span className="mres-title">RESOURCE DEMAND</span>
        <span className="mres-meta">
          {coveredCount}/{requiredMaterials.length} covered by visible locations
        </span>
      </div>
      <div className="mres-list">
        {requiredMaterials.map((mat) => (
          <MaterialDemandRow
            key={mat.materialId}
            materialName={mat.materialName}
            totalQty={mat.requiredQuantity}
            unitType={mat.unitType}
            selectedQuality={mat.selectedQuality}
            estimatedRawOreNeeded={mat.estimatedRawOreNeeded}
            usedByItems={mat.usedBy.map((ub) => ub.displayName)}
            covered={visibleMaterialKeys.has(mat.materialId)}
            sourceLocationNames={visibleMaterialKeys.has(mat.materialId) ? visibleLocationNames : []}
          />
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MiningModule() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const planner = useMiningPlannerState();
  const buildQueue = useLogisticsStore((store) => store.buildQueue);
  const recipeInputsByRecipeId = useLogisticsStore((store) => store.recipeInputTemplates);
  const recipes = useLogisticsStore((store) => store.recipeTemplates);
  const inventoryEntries = useLogisticsStore((store) => store.inventoryEntries);
  const materials = useLogisticsStore((store) => store.materialTemplates);

  const [selectedMaterials, setSelectedMaterials] = useState<Set<string>>(new Set());
  const [selectedSystems, setSelectedSystems] = useState<Set<string>>(new Set());
  const [selectedMiningTypes, setSelectedMiningTypes] = useState<Set<string>>(new Set());
  const [selectedLocationKey, setSelectedLocationKey] = useState<string | null>(null);
  const [showAllLocations, setShowAllLocations] = useState(false);
  const [requirementState, setRequirementState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ok"; data: RequiredMaterial[] }
  >({ status: "loading" });

  useEffect(() => {
    setRequirementState({ status: "loading" });
    getBuildQueueRequirements({ buildQueue, recipeInputTemplates: recipeInputsByRecipeId, inventoryEntries })
      .then((data) => {
        setRequirementState({
          status: "ok",
          data: data.requirements.map((requirement) => {
            const material = materials.find((entry) => entry.id === requirement.materialId);
            return {
              ...requirement,
              estimatedRawOreNeeded: isRefinableMaterial(material) ? Math.ceil(requirement.requiredQuantity * 2.5) : undefined,
            };
          }),
        });
      })
      .catch((err) => setRequirementState({ status: "error", message: String(err) }));
  }, [buildQueue, inventoryEntries, materials, recipeInputsByRecipeId]);

  const miningRequiredMaterials = requirementState.status === "ok" ? requirementState.data : [];

  useEffect(() => {
    const request = buildRecommendationRequest({
      priorityStack: planner.priorityStack,
      manualDemand: planner.manualDemand,
      favoriteLocationIds: planner.favorites.map((favorite) => favorite.key),
      filters: planner.filters,
    }, null, miningRequiredMaterials);
    setState({ status: "loading" });
    getMiningRecommendations(request)
      .then((data) => setState({ status: "ok", data }))
      .catch((err) => setState({ status: "error", message: String(err) }));
  }, [miningRequiredMaterials, planner.favorites, planner.filters, planner.manualDemand, planner.priorityStack]);

  const locations = useMemo(
    () => state.status === "ok" ? state.data.recommendations : [],
    [state],
  );

  const buildQueueMaterials = useMemo<Set<string>>(() => {
    return new Set(miningRequiredMaterials.map((m) => m.materialId));
  }, [miningRequiredMaterials]);

  const allSystems = useMemo(
    () => Array.from(new Set(locations.map((l) => l.systemName))).sort(),
    [locations]
  );

  const allMiningTypes = useMemo(
    () => Array.from(new Set(locations.map((l) => miningTypeFromSpawn(l.spawnType)))).sort(),
    [locations]
  );

  const allMaterials = useMemo(
    () => Array.from(new Set(locations.flatMap((l) => l.materials))).sort(),
    [locations]
  );

  const materialKeyByDisplayName = useMemo(() => {
    const resolve = createMaterialResolver(materials);
    return new Map(allMaterials.map((name) => [name, resolve({ displayName: name, materialName: name })?.materialKey ?? name]));
  }, [allMaterials, materials]);

  const buildQueueMaterialDisplayNames = useMemo(() => {
    return new Set([...buildQueueMaterials].map((key) => materials.find((material) => material.id === key)?.name ?? key));
  }, [buildQueueMaterials, materials]);

  const filteredLocations = useMemo(() => {
    let result = locations;
    if (selectedSystems.size > 0) result = result.filter((l) => selectedSystems.has(l.systemName));
    if (selectedMiningTypes.size > 0) result = result.filter((l) => selectedMiningTypes.has(miningTypeFromSpawn(l.spawnType)));
    if (selectedMaterials.size > 0) result = result.filter((l) => l.materials.some((m) => selectedMaterials.has(m)));
    if (planner.filters.showOnlyStarred) {
      result = result.filter((l) =>
        planner.isFavorite({ system: l.systemName, location: l.locationName, spawnType: l.spawnType })
      );
    }
    return result;
  }, [locations, selectedSystems, selectedMiningTypes, selectedMaterials, planner.filters.showOnlyStarred, planner.isFavorite]);

  const stripLocations = showAllLocations ? filteredLocations : filteredLocations.slice(0, 4);

  const selectedEntry = useMemo(() => {
    if (selectedLocationKey) {
      return filteredLocations.find((l) => l.locationKey === selectedLocationKey) ?? filteredLocations[0] ?? null;
    }
    return filteredLocations[0] ?? null;
  }, [selectedLocationKey, filteredLocations]);

  useEffect(() => {
    setSelectedLocationKey(null);
  }, [selectedMaterials, selectedSystems, selectedMiningTypes]);

  function toggleMaterial(mat: string) {
    setSelectedMaterials((prev) => {
      const next = new Set(prev);
      if (next.has(mat)) next.delete(mat); else next.add(mat);
      return next;
    });
  }

  function toggleSystem(sys: string) {
    setSelectedSystems((prev) => {
      const next = new Set(prev);
      if (next.has(sys)) next.delete(sys); else next.add(sys);
      return next;
    });
  }

  function toggleMiningType(type: string) {
    setSelectedMiningTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  }

  function selectBuildQueueMaterials() {
    setSelectedMaterials(new Set([...buildQueueMaterials].map((key) => materials.find((material) => material.id === key)?.name ?? key)));
  }

  function clearAllFilters() {
    setSelectedMaterials(new Set());
    setSelectedSystems(new Set());
    setSelectedMiningTypes(new Set());
  }

  const activeFilterCount = selectedMaterials.size + selectedSystems.size + selectedMiningTypes.size;
  const activeQueue = buildQueue.filter((item) => item.status !== "complete");
  const queueBadge = activeQueue.length > 0 ? activeQueue.length : null;
  const { shortages } = getBuildQueueShortageSummary(
    inventoryEntries,
    buildQueue,
    recipes,
    recipeInputsByRecipeId,
  );

  const visibleCards = filteredLocations.slice(0, 4);
  const visibleMaterialKeys = new Set(visibleCards.flatMap((c) =>
    c.materials.map((name) => materialKeyByDisplayName.get(name) ?? name),
  ));
  const visibleLocationNames = visibleCards.map((c) => c.locationName);

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
          <p className="mine-page-subtitle">Where can I mine the materials I need?</p>
        </div>
      </div>

      <CraftTabBar activeTab="mining" queueBadge={queueBadge} missingCount={shortages.length} />

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

      {state.status === "ok" && (
        <div className="mloc-layout">

          {/* ── Filter sidebar ──────────────────────────────────────── */}
          <div className="msb-sidebar">
            <div className="msb-section">
              <div className="msb-section-label">BUILD QUEUE</div>
              <div className="msb-chip-rail">
                <button
                  className={`msb-chip msb-chip--action${[...buildQueueMaterialDisplayNames].every((m) => selectedMaterials.has(m)) && buildQueueMaterialDisplayNames.size > 0 ? " msb-chip--active" : ""}`}
                  onClick={selectBuildQueueMaterials}
                  title="Select all build queue materials"
                >
                  Explore Build Queue
                </button>
              </div>
            </div>

            {allSystems.length > 0 && (
              <div className="msb-section">
                <div className="msb-section-label">SYSTEM</div>
                <div className="msb-chip-rail">
                  {allSystems.map((sys) => (
                    <button
                      key={sys}
                      className={`msb-chip${selectedSystems.has(sys) ? " msb-chip--active" : ""}`}
                      onClick={() => toggleSystem(sys)}
                    >
                      {sys}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {allMiningTypes.length > 0 && (
              <div className="msb-section">
                <div className="msb-section-label">MINING TYPE</div>
                <div className="msb-chip-rail">
                  {allMiningTypes.map((type) => (
                    <button
                      key={type}
                      className={`msb-chip${selectedMiningTypes.has(type) ? " msb-chip--active" : ""}`}
                      onClick={() => toggleMiningType(type)}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {allMaterials.length > 0 && (
              <div className="msb-section">
                <div className="msb-section-label">RESOURCES</div>
                <div className="msb-chip-rail">
                  {allMaterials.map((m) => {
                    const isBQ = buildQueueMaterials.has(materialKeyByDisplayName.get(m) ?? m);
                    const isActive = selectedMaterials.has(m);
                    return (
                      <button
                        key={m}
                        className={`msb-chip${isActive ? " msb-chip--active" : ""}${isBQ && !isActive ? " msb-chip--bq" : ""}`}
                        onClick={() => toggleMaterial(m)}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {selectedMaterials.size > 0 && (
              <div className="msb-section">
                <div className="msb-section-label-row">
                  <span className="msb-section-label">SELECTED</span>
                  <button className="mine-clear-btn" onClick={() => setSelectedMaterials(new Set())}>Clear</button>
                </div>
                <div className="msb-chip-rail">
                  {[...selectedMaterials].map((m) => (
                    <button
                      key={m}
                      className="msb-chip msb-chip--selected"
                      onClick={() => toggleMaterial(m)}
                    >
                      {m} <span className="msb-chip-x">×</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="msb-divider" />

            <CollapsiblePanel title="MANUAL DEMAND" count={planner.manualDemand.length}>
              <ManualDemandCompact
                items={planner.manualDemand}
                materials={allMaterials}
                onAdd={planner.addManualDemand}
                onRemove={planner.removeManualDemand}
                onClear={planner.clearManualDemand}
              />
            </CollapsiblePanel>
          </div>

          {/* ── Main content ───────────────────────────────────────── */}
          <div className="mloc-main">
            <div className="mloc-toolbar">
              <div className="mloc-toolbar-right">
                <button
                  className={`mine-filter-btn${planner.filters.showOnlyStarred ? " mine-filter-btn--active" : ""}`}
                  onClick={planner.toggleShowOnlyStarred}
                  title="Starred only"
                >
                  ★ Starred
                </button>
                {activeFilterCount > 0 && (
                  <button className="mloc-clear-filters-btn" onClick={clearAllFilters}>
                    Clear filters
                  </button>
                )}
              </div>
            </div>

            {filteredLocations.length === 0 ? (
              <div className="mine-empty-state">
                <p className="mine-empty-text">
                  {planner.filters.showOnlyStarred
                    ? "No starred locations. Click ☆ on a panel to star it."
                    : "No locations match the current filters."}
                </p>
              </div>
            ) : (
              <>
                {/* ── Location strip ─────────────────────────────── */}
                <div className="mloc-strip-section">
                  <div className="mloc-strip-header">
                    <span className="mloc-strip-label">RECOMMENDED LOCATIONS</span>
                    <span className="mloc-strip-count">{filteredLocations.length} total</span>
                  </div>
                  <div className="mloc-strip">
                    {stripLocations.map((entry) => (
                      <LocationPanel
                        key={entry.locationKey}
                        entry={entry}
                        selectedMaterials={selectedMaterials}
                        buildQueueMaterialDisplayNames={buildQueueMaterialDisplayNames}
                        starred={planner.isFavorite({
                          system: entry.systemName,
                          location: entry.locationName,
                          spawnType: entry.spawnType,
                        })}
                        selected={selectedEntry?.locationKey === entry.locationKey}
                        onSelect={() => setSelectedLocationKey(entry.locationKey)}
                        onToggleStar={(e) => {
                          e.stopPropagation();
                          planner.toggleFavorite({
                            system: entry.systemName,
                            location: entry.locationName,
                            spawnType: entry.spawnType,
                          });
                        }}
                      />
                    ))}
                  </div>
                  {filteredLocations.length > 4 && (
                    <button
                      className="mloc-view-all-btn"
                      onClick={() => setShowAllLocations((p) => !p)}
                    >
                      {showAllLocations
                        ? "Show top 4 ↑"
                        : `View all ${filteredLocations.length} locations ↓`}
                    </button>
                  )}
                </div>

                {/* ── Selected location detail ───────────────────── */}
                {selectedEntry && (
                  <LocationDetail
                    entry={selectedEntry}
                    buildQueueMaterialDisplayNames={buildQueueMaterialDisplayNames}
                    selectedMaterials={selectedMaterials}
                    requiredMaterials={miningRequiredMaterials}
                  />
                )}
              </>
            )}

            {/* ── Resource demand ────────────────────────────────── */}
            {miningRequiredMaterials.length > 0 && (
              <ResourceDemandPanel
                requiredMaterials={miningRequiredMaterials}
                visibleMaterialKeys={visibleMaterialKeys}
                visibleLocationNames={visibleLocationNames}
              />
            )}

            {showAdvancedScores && (
              <div className="mex-fixture-note">Advanced scoring active · fixture data</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
