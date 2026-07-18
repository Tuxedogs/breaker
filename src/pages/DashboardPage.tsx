import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import MaterialIcon from "../components/logistics/MaterialIcon";
import { useLogisticsStore } from "../stores/logisticsStore";
import { deriveUserDashStats } from "../lib/dashboardStats";
import type { LogisticsMaterialTemplate, RecipeInputTemplate } from "../data/logistics/seed";
import {
  formatInventoryQuantity,
  getActiveInventoryEntries,
  getBuildQueueItemInputs,
  getGlobalTopQualityMaterials,
  resolveInventoryItemName,
  resolveInventoryUnitType,
} from "../lib/logistics/inventory";
import { getQueueLedgerModel, type QueueLedgerLine } from "../lib/logistics/queueLedger";
import {
  allocationMatchesRequirement,
  getAvailableQuantityForInventoryEntry,
  getMaterialReservationCoverage,
  validateReservedAllocations,
} from "../lib/logistics/selectors";
import {
  getAllocationTotal,
  getQualityProjectionStatus,
  getRequirementLineKey,
  getWeightedEffectiveQuality,
} from "../lib/logistics/buildQueueReservations";
import {
  getQualityBandsForMaterial,
  loadQualityQuantizationRecords,
} from "../lib/logistics/qualityQuantization";
import { getActiveBuildQueueEntries } from "../lib/logistics/buildQueueEntries";
import type { BuildQueueItem, InventoryEntry, InventoryLocation, MaterialTemplate } from "../types/logistics";

function ArrowRight({ size = 12 }: { size?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width={size} height={size} className="dash-card-footer-arrow">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

type StatIconType = "materials" | "owned" | "needed" | "shortage" | "queue" | "volume" | "high" | "low" | "complete";
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
    complete: { bg: "rgba(74,222,128,0.12)", color: "#4ade80", d: "M20 6L9 17l-5-5" },
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

function formatDashNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/\.?0+$/, "");
}

function getQueueItemName(item: BuildQueueItem, recipesById: Map<string, { name: string }>) {
  return item.itemName ?? recipesById.get(item.recipeId)?.name ?? item.recipeId;
}
type DashboardOverviewTab = "mining" | "inventory";

type QueueRequirementRef = {
  item: BuildQueueItem;
  itemName: string;
  input: RecipeInputTemplate;
  inputIndex: number;
  materialKey: string;
  requirementId: string;
  requiredQuantity: number;
};

type MiningOverviewRow = {
  materialKey: string;
  material: MaterialTemplate & Partial<LogisticsMaterialTemplate>;
  displayName: string;
  target: number | null;
  bandBelow: number | null;
  bandAbove: number | null;
  requiredQuantity: number;
  ledgerLine: QueueLedgerLine | null;
  unitType: RecipeInputTemplate["unitType"];
  requiredBy: QueueRequirementRef[];
  isRefinable: boolean;
};

type InventoryReservationTone = "unreserved" | "partial" | "fulfilled";

function isMineableMaterial(material: MaterialTemplate | undefined): material is MaterialTemplate & Partial<LogisticsMaterialTemplate> {
  const sourceGroups = (material as Partial<LogisticsMaterialTemplate> | undefined)?.sourceGroups ?? [];
  return sourceGroups.some((group) => group === "ores" || group === "vehicleMining" || group === "fpsMining");
}
function isRefinableMineable(material: MaterialTemplate & Partial<LogisticsMaterialTemplate>): boolean {
  return material.isRefinable === true || material.canComeFromRefinery === true || material.sourceGroups?.includes("ores") === true;
}
function getAdjacentBandValues(
  bands: Array<{ mappedValue: string | number }> | null | undefined,
  target: number | null,
): { below: number | null; above: number | null } {
  if (target == null || !bands?.length) return { below: null, above: null };
  const mappedValues = [...new Set(
    bands
      .map((band) => Number(band.mappedValue))
      .filter((value) => Number.isFinite(value)),
  )].sort((left, right) => left - right);
  return {
    below: mappedValues.filter((value) => value < target).at(-1) ?? null,
    above: mappedValues.find((value) => value > target) ?? null,
  };
}

function getUniqueRequiredBy(requirements: QueueRequirementRef[]): QueueRequirementRef[] {
  const seen = new Set<string>();
  return requirements.filter((requirement) => {
    if (seen.has(requirement.item.id)) return false;
    seen.add(requirement.item.id);
    return true;
  });
}

function getQueueItemIdentifier(requirement: QueueRequirementRef): string {
  const fromName = requirement.itemName.trim().split(/\s+/)[0]?.replace(/[^a-z0-9-]/gi, "") ?? "";
  const fromItemId = requirement.item.itemId?.replace(/[^a-z0-9-]/gi, "") ?? "";
  return (fromName || fromItemId || "Item").slice(0, 5);
}

function OverviewTooltip({
  content,
  ariaLabel,
  children,
}: {
  content: string;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <span className="dash-overview-tooltip" tabIndex={0} aria-label={ariaLabel}>
      {children}
      <span className="dash-overview-tooltip-content" role="tooltip">{content}</span>
    </span>
  );
}
function RequiredByValue({ requirements }: { requirements: QueueRequirementRef[] }) {
  const requiredBy = getUniqueRequiredBy(requirements);
  if (requiredBy.length === 0) return <span className="dash-overview-muted">—</span>;
  const itemNames = requiredBy.map((requirement) => requirement.itemName);
  const visibleLabel = requiredBy.length === 1
    ? getQueueItemIdentifier(requiredBy[0])
    : `${requiredBy.length} items`;
  return (
    <OverviewTooltip
      content={itemNames.join(" · ")}
      ariaLabel={`Required by ${itemNames.join(", ")}`}
    >
      <span className="dash-required-by-value">{visibleLabel}</span>
    </OverviewTooltip>
  );
}

function MiningAmount({ row }: { row: MiningOverviewRow }) {
  if (row.isRefinable) {
    const oreRequired = row.ledgerLine?.rawOreNeeded ?? 0;
    return (
      <span className="dash-mining-amount dash-tabnum">
        <span className="dash-material-state-badge dash-material-state-badge--ore">{formatDashNumber(oreRequired)}</span>
        <span className="dash-material-state-badge dash-material-state-badge--refined">{formatDashNumber(row.requiredQuantity)}</span>
        <span className="dash-mining-amount-unit">SCU</span>
      </span>
    );
  }
  const unitType = row.unitType === "SCU" || row.unitType === "scu" || row.unitType === "cscu" ? "scu" : "unit";
  return (
    <span className="dash-mining-amount dash-tabnum">
      <span className="dash-material-state-badge dash-material-state-badge--raw">
        {unitType === "unit" ? `x ${formatDashNumber(row.requiredQuantity)}` : formatDashNumber(row.requiredQuantity)}
      </span>
      {unitType === "scu" && <span className="dash-mining-amount-unit">SCU</span>}
    </span>
  );
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

type NextRunBoxState = "available" | "selected" | "reserved" | "unavailable";
type NextRunMovementState = "warehouse" | "pull" | "pending";

type NextRunBox = {
  id: string;
  label: string;
  quality?: number;
  quantity: string;
  reservedQuantity?: string;
  availability: NextRunBoxState;
  reservationLabel: string;
  owner?: string;
  movement: NextRunMovementState;
  pullOrder?: number;
  remainder?: string;
};

type NextRunMaterial = {
  id: string;
  name: string;
  requirement: string;
  state: "covered" | "partial" | "missing";
  boxes: NextRunBox[];
};

type NextRunLocation = {
  id: string;
  name: string;
  visitOrder?: number;
  materials: NextRunMaterial[];
};

type NextFabricationRun = {
  queueItemId: string;
  itemName: string;
  quantity: number;
  target?: string;
  projected?: string;
  readiness: string;
  coverage: string;
  targetState: "met" | "unavailable" | "pending";
  minimumQuality?: string;
  minimumQuantity?: string;
  bestAchievable?: string;
  locations: NextRunLocation[];
  locationsToVisit: string;
  boxesToRetrieve: string;
  missingMaterials: string;
  expectedExcess?: string;
  actionLabel: string;
  actionNote: string;
  fixtureOnly?: boolean;
};

const DEV_NEXT_FABRICATION_RUNS: NextFabricationRun[] = import.meta.env.DEV ? [
{
  queueItemId: "fixture-allocated",
  itemName: "Avalanche Cooler",
  quantity: 4,
  target: "900",
  projected: "918",
  readiness: "Ready to retrieve",
  coverage: "2 of 2 requirements covered",
  targetState: "met",
  locationsToVisit: "1 location",
  boxesToRetrieve: "3 boxes",
  missingMaterials: "None identified",
  expectedExcess: "0.06 SCU expected remainder",
  actionLabel: "Review Pull Plan",
  actionNote: "All reserved boxes are ready for warehouse retrieval.",
  fixtureOnly: true,
  locations: [
    {
      id: "fixture-allocated-everus",
      name: "Everus Harbor · Manufacturing Storage",
      visitOrder: 1,
      materials: [
        {
          id: "fixture-allocated-copper",
          name: "Copper",
          requirement: "0.18 SCU required · Target 900",
          state: "covered",
          boxes: [
            { id: "fixture-allocated-copper-01", label: "Box CPR-118", quality: 936, quantity: "0.14 SCU", reservedQuantity: "0.14 SCU selected", availability: "selected", reservationLabel: "Selected", owner: "Avalanche Cooler ×4", movement: "pull", pullOrder: 1, remainder: "Consumed" },
            { id: "fixture-allocated-copper-02", label: "Box CPR-204", quality: 902, quantity: "0.10 SCU", reservedQuantity: "0.04 SCU selected", availability: "selected", reservationLabel: "Selected", owner: "Avalanche Cooler ×4", movement: "pull", pullOrder: 2, remainder: "0.06 SCU remains" },
          ],
        },
        {
          id: "fixture-allocated-quartz",
          name: "Quartz",
          requirement: "0.08 SCU required · Target 860",
          state: "covered",
          boxes: [
            { id: "fixture-allocated-quartz-01", label: "Box QTZ-044", quality: 884, quantity: "0.08 SCU", reservedQuantity: "0.08 SCU reserved", availability: "reserved", reservationLabel: "Reserved", owner: "Avalanche Cooler ×4", movement: "pull", pullOrder: 3, remainder: "Consumed" },
          ],
        },
      ],
    },
  ],
},
{
  queueItemId: "fixture-partial",
  itemName: "P6-LR \"Archangel\" Sniper Rifle",
  quantity: 2,
  target: "924",
  projected: "911",
  readiness: "Review required",
  coverage: "92% material coverage",
  targetState: "unavailable",
  minimumQuality: "965",
  minimumQuantity: "0.08 SCU",
  bestAchievable: "911",
  locationsToVisit: "3 locations",
  boxesToRetrieve: "6 boxes",
  missingMaterials: "0.08 SCU Tungsten",
  expectedExcess: "0.14 SCU expected refund",
  actionLabel: "Review Pull Plan",
  actionNote: "Review source allocations and the unresolved Tungsten shortfall.",
  fixtureOnly: true,
  locations: [
    {
      id: "fixture-orbituary",
      name: "Everus Harbor · Cargo Center A",
      visitOrder: 1,
      materials: [
        {
          id: "fixture-taranite",
          name: "Taranite",
          requirement: "0.12 SCU required · Target 924",
          state: "covered",
          boxes: [
            { id: "fixture-tar-01", label: "Box TAR-184", quality: 978, quantity: "0.10 SCU", reservedQuantity: "0.10 SCU selected", availability: "selected", reservationLabel: "Selected", owner: "P6-LR ×2", movement: "pull", pullOrder: 1, remainder: "No remainder" },
            { id: "fixture-tar-02", label: "Box TAR-203", quality: 941, quantity: "0.16 SCU", reservedQuantity: "0.02 SCU selected", availability: "selected", reservationLabel: "Selected", owner: "P6-LR ×2", movement: "pull", pullOrder: 2, remainder: "0.14 SCU remains" },
          ],
        },
        {
          id: "fixture-hephaestanite",
          name: "Hephaestanite",
          requirement: "0.04 SCU required · Target 900",
          state: "covered",
          boxes: [
            { id: "fixture-hep-01", label: "Box HEP-044", quality: 936, quantity: "0.04 SCU", reservedQuantity: "0.04 SCU reserved", availability: "reserved", reservationLabel: "Reserved", owner: "P6-LR ×2", movement: "pull", pullOrder: 3, remainder: "Consumed" },
          ],
        },
      ],
    },
    {
      id: "fixture-seraphim",
      name: "Seraphim Station · Industrial Storage Annex 04",
      visitOrder: 2,
      materials: [
        {
          id: "fixture-iron",
          name: "Iron",
          requirement: "0.06 SCU required · Target 640",
          state: "covered",
          boxes: [
            { id: "fixture-iron-01", label: "Box IRN-771", quality: 681, quantity: "0.18 SCU", reservedQuantity: "0.06 SCU selected", availability: "selected", reservationLabel: "Selected", owner: "P6-LR ×2", movement: "pull", pullOrder: 4, remainder: "0.12 SCU remains" },
            { id: "fixture-iron-02", label: "Box IRN-640", quality: 640, quantity: "0.24 SCU", availability: "reserved", reservationLabel: "Reserved", owner: "AD5B Ballistic Gatling", movement: "warehouse", remainder: "0.24 SCU remains" },
          ],
        },
      ],
    },
    {
      id: "fixture-magnus",
      name: "Magnus Gateway · Warehouse Row 12",
      visitOrder: 3,
      materials: [
        {
          id: "fixture-tungsten",
          name: "Tungsten",
          requirement: "0.20 SCU required · 0.08 SCU short",
          state: "partial",
          boxes: [
            { id: "fixture-tung-01", label: "Box TNG-508", quality: 966, quantity: "0.12 SCU", reservedQuantity: "0.12 SCU selected", availability: "selected", reservationLabel: "Selected", owner: "P6-LR ×2", movement: "pull", pullOrder: 5, remainder: "Consumed" },
            { id: "fixture-tung-02", label: "Required box unavailable", quality: 965, quantity: "0.08 SCU needed", availability: "unavailable", reservationLabel: "Missing", movement: "pending" },
          ],
        },
      ],
    },
  ],
},
{
  queueItemId: "fixture-unreserved",
  itemName: "Long-Range Industrial Power Coupling Assembly",
  quantity: 1,
  target: "875",
  projected: "Not available",
  readiness: "Reservations required",
  coverage: "0 of 2 requirements covered",
  targetState: "pending",
  locationsToVisit: "Not planned",
  boxesToRetrieve: "No boxes selected",
  missingMaterials: "0.24 SCU Copper · 0.10 SCU Quartz",
  actionLabel: "Reserve Materials",
  actionNote: "Select eligible boxes in the Build Queue before planning retrieval.",
  fixtureOnly: true,
  locations: [],
},
] : [];

function formatRunQuantity(quantity: number, unitType: string | undefined) {
  return formatInventoryQuantity(quantity, unitType === "unit" ? "unit" : "scu");
}

function buildProductionNextFabricationRun(
  item: BuildQueueItem | undefined,
  inventoryEntries: InventoryEntry[],
  materialTemplates: MaterialTemplate[],
  locations: InventoryLocation[],
  recipesById: Map<string, { name: string }>,
  recipeInputTemplates: Parameters<typeof getBuildQueueItemInputs>[1],
): NextFabricationRun | null {
  if (!item) return null;

  const inputs = getBuildQueueItemInputs(item, recipeInputTemplates);
  const allocations = item.reservedAllocations ?? [];
  const validations = validateReservedAllocations(allocations, inventoryEntries);
  const validationByAllocationId = new Map(validations.map((validation) => [validation.allocation.id, validation]));
  const inventoryById = new Map(inventoryEntries.map((entry) => [entry.id, entry]));
  const materialById = new Map(materialTemplates.map((material) => [material.id, material]));
  const locationById = new Map(locations.map((location) => [location.id, location]));
  const itemName = getQueueItemName(item, recipesById);

  const inputStates = inputs.map((input, index) => {
    const materialId = input.materialId ?? input.materialKey ?? `requirement-${index}`;
    const requirementId = input.requirementId ?? `${item.id}:${materialId}:${index}`;
    const requiredQuantity = input.quantity * item.quantity;
    const coverage = getMaterialReservationCoverage(
      item,
      materialId,
      requiredQuantity,
      inventoryEntries,
      { requirementId, selectedQuality: input.selectedQuality, unitType: input.unitType },
    );
    return { input, materialId, requirementId, requiredQuantity, coverage };
  });

  const coveredCount = inputStates.filter(({ coverage }) => coverage.coverageState === "covered" || coverage.coverageState === "overReserved").length;
  const missingStates = inputStates.filter(({ coverage }) => coverage.coverageState !== "covered" && coverage.coverageState !== "overReserved");
  const grouped = new Map<string, NextRunLocation>();

  for (const allocation of allocations) {
    const inventoryEntry = inventoryById.get(allocation.inventoryEntryId);
    const validation = validationByAllocationId.get(allocation.id);
    const locationId = inventoryEntry?.locationId ?? allocation.locationId ?? "unassigned";
    const location = locationId === "unassigned" ? undefined : locationById.get(locationId);
    const locationName = locationId === "unassigned"
      ? "Unassigned Stock"
      : location?.name ?? "Unknown Location";
    const materialId = allocation.materialId;
    const inputState = inputStates.find(({ requirementId, materialId: inputMaterialId }) =>
      (allocation.requirementId ? requirementId === allocation.requirementId : inputMaterialId === materialId));
    const materialName = allocation.materialName ?? materialById.get(materialId)?.name ?? inputState?.input.displayName ?? inputState?.input.materialName ?? materialId;
    const locationGroup = grouped.get(locationId) ?? { id: locationId, name: locationName, materials: [] };
    let materialGroup = locationGroup.materials.find((material) => material.id === materialId);
    if (!materialGroup) {
      materialGroup = {
        id: materialId,
        name: materialName,
        requirement: inputState
          ? `${formatRunQuantity(inputState.requiredQuantity, inputState.input.unitType)} required${inputState.input.selectedQuality != null ? ` · Target ${formatDashNumber(inputState.input.selectedQuality)}` : ""}`
          : "Reserved material",
        state: inputState?.coverage.coverageState === "covered" || inputState?.coverage.coverageState === "overReserved"
          ? "covered"
          : inputState?.coverage.coverageState === "missing" ? "missing" : "partial",
        boxes: [],
      };
      locationGroup.materials.push(materialGroup);
    }
    const unitType = allocation.unitType ?? inventoryEntry?.unitType;
    const isStale = validation?.isStale ?? !inventoryEntry;
    materialGroup.boxes.push({
      id: allocation.id,
      label: inventoryEntry?.container ? `Box ${inventoryEntry.container}` : `Box ${materialGroup.boxes.length + 1}`,
      quality: allocation.quality ?? inventoryEntry?.quality,
      quantity: inventoryEntry ? formatRunQuantity(inventoryEntry.quantity, unitType) : "Box unavailable",
      reservedQuantity: `${formatRunQuantity(allocation.quantityReserved, unitType)} reserved`,
      availability: isStale ? "unavailable" : "reserved",
      reservationLabel: isStale ? "Needs review" : "Reserved",
      owner: itemName,
      movement: "pending",
    });
    grouped.set(locationId, locationGroup);
  }

  const missingLabels = missingStates.map(({ input, requiredQuantity, coverage }) => {
    const remaining = Math.max(0, requiredQuantity - coverage.reservedQuantity);
    const materialName = input.displayName ?? input.materialName ?? materialById.get(input.materialId)?.name ?? input.materialId;
    return `${formatRunQuantity(remaining, input.unitType)} ${materialName}`;
  });

  return {
    queueItemId: item.id,
    itemName,
    quantity: item.quantity,
    projected: item.finalProductQualityAverage != null ? `Band ${formatDashNumber(item.finalProductQualityAverage)}` : undefined,
    readiness: missingStates.length === 0 ? "Allocated" : "Needs allocation",
    coverage: inputs.length > 0 ? `${coveredCount} of ${inputs.length} requirements covered` : "No material requirements",
    targetState: "pending",
    locations: [...grouped.values()],
    locationsToVisit: grouped.size > 0 ? `${grouped.size} location${grouped.size === 1 ? "" : "s"}` : "Not planned",
    boxesToRetrieve: allocations.length > 0 ? `${allocations.length} reserved box${allocations.length === 1 ? "" : "es"}` : "Not planned",
    missingMaterials: missingLabels.length > 0 ? missingLabels.join(" · ") : "None identified",
    actionLabel: allocations.length > 0 ? "Review Pull Plan" : "Reserve Materials",
    actionNote: allocations.length > 0
      ? "Review source allocations before warehouse retrieval."
      : "Select eligible boxes in the Build Queue before planning retrieval.",
  };
}

export default function DashboardPage() {
  const { inventoryEntries: allInventoryEntries, materialTemplates, buildQueue, recipeTemplates, recipeInputTemplates, locations } = useLogisticsStore();
  const inventoryEntries = useMemo(() => getActiveInventoryEntries(allInventoryEntries), [allInventoryEntries]);
  const userStats = deriveUserDashStats(inventoryEntries, materialTemplates as LogisticsMaterialTemplate[]);
  const [selectedNextRunId, setSelectedNextRunId] = useState<string | null>(null);
  const [overviewTab, setOverviewTab] = useState<DashboardOverviewTab>("mining");
  const [openReservationEntryId, setOpenReservationEntryId] = useState<string | null>(null);
  const [highlightedQueueItemId, setHighlightedQueueItemId] = useState<string | null>(null);
  const [qualityBandsReady, setQualityBandsReady] = useState(false);

  const queueLedger = useMemo(
    () => getQueueLedgerModel({ buildQueue, inventoryEntries, materials: materialTemplates, recipeInputsByRecipeId: recipeInputTemplates }),
    [buildQueue, inventoryEntries, materialTemplates, recipeInputTemplates]
  );
  const activeQueueItems = useMemo(() => getActiveBuildQueueEntries(buildQueue), [buildQueue]);
  const completedQueueItems = useMemo(() => buildQueue.filter((item) => item.status === "complete"), [buildQueue]);
  const recipesById = useMemo(() => new Map(recipeTemplates.map((recipe) => [recipe.id, recipe])), [recipeTemplates]);
  const locationNamesById = useMemo(() => new Map(locations.map((location) => [location.id, location.name])), [locations]);
  const queueRequirementsByMaterial = useMemo(() => {
    const grouped = new Map<string, QueueRequirementRef[]>();
    for (const item of activeQueueItems) {
      const itemName = getQueueItemName(item, recipesById);
      getBuildQueueItemInputs(item, recipeInputTemplates).forEach((input, inputIndex) => {
        const materialKey = input.materialKey ?? input.materialId;
        const requirement: QueueRequirementRef = {
          item,
          itemName,
          input,
          inputIndex,
          materialKey,
          requirementId: getRequirementLineKey(item, input, inputIndex),
          requiredQuantity: input.quantity * item.quantity,
        };
        grouped.set(materialKey, [...(grouped.get(materialKey) ?? []), requirement]);
      });
    }
    return grouped;
  }, [activeQueueItems, recipeInputTemplates, recipesById]);
  const topQualityMaterials = useMemo(
    () => getGlobalTopQualityMaterials(inventoryEntries, materialTemplates)
      .filter(({ entry }) => entry.quality != null && Number.isFinite(entry.quality))
      .slice(0, 6),
    [inventoryEntries, materialTemplates]
  );
  const shortageRows = queueLedger.refinedShortfallLines.slice(0, 5);
  const reserveSummary = queueLedger.summary;
  const qualityTargetCount = useMemo(
    () => activeQueueItems.filter((item) => item.finalProductQualityBand != null && item.allowLowerQuality !== true).length,
    [activeQueueItems],
  );
  const miningOverviewRows = useMemo<MiningOverviewRow[]>(() => {
    const ledgerByMaterial = new Map(queueLedger.lines.map((line) => [line.materialKey, line]));
    return [...queueRequirementsByMaterial.entries()]
      .map(([materialKey, requirements]) => {
        const material = materialTemplates.find((candidate) => candidate.id === materialKey);
        if (!isMineableMaterial(material)) return null;
        const targetRequirement = requirements
          .filter((requirement) => requirement.input.selectedQuality != null && Number.isFinite(requirement.input.selectedQuality))
          .sort((left, right) => (right.input.selectedQuality ?? 0) - (left.input.selectedQuality ?? 0))[0];
        const target = targetRequirement?.input.selectedQuality ?? null;
        const bands = targetRequirement?.input.qualityBands?.length
          ? targetRequirement.input.qualityBands
          : qualityBandsReady
            ? getQualityBandsForMaterial(material.name)
            : null;
        const adjacentBands = getAdjacentBandValues(bands, target);
        const ledgerLine = ledgerByMaterial.get(materialKey) ?? ledgerByMaterial.get(material.id) ?? null;
        return {
          materialKey,
          material,
          displayName: material.name,
          target,
          bandBelow: adjacentBands.below,
          bandAbove: adjacentBands.above,
          requiredQuantity: requirements.reduce((sum, requirement) => sum + requirement.requiredQuantity, 0),
          ledgerLine,
          unitType: requirements[0]?.input.unitType,
          requiredBy: requirements,
          isRefinable: isRefinableMineable(material),
        };
      })
      .filter((row): row is MiningOverviewRow => row !== null)
      .sort((left, right) => right.requiredQuantity - left.requiredQuantity || left.displayName.localeCompare(right.displayName));
  }, [materialTemplates, qualityBandsReady, queueLedger.lines, queueRequirementsByMaterial]);
  const inventoryOverviewRows = useMemo(() => topQualityMaterials.map(({ entry, material }) => {
    const materialKey = entry.materialId ?? entry.catalogItemId ?? entry.itemName ?? entry.id;
    const requirements = queueRequirementsByMaterial.get(materialKey) ?? [];
    const assignedItems = activeQueueItems.filter((item) =>
      (item.reservedAllocations ?? []).some((allocation) => allocation.inventoryEntryId === entry.id),
    );
    const assignedRequirements = requirements.filter((requirement) =>
      assignedItems.some((item) => item.id === requirement.item.id) &&
      (requirement.item.reservedAllocations ?? []).some((allocation) =>
        allocation.inventoryEntryId === entry.id &&
        allocationMatchesRequirement(allocation, materialKey, {
          requirementId: requirement.requirementId,
          selectedQuality: requirement.input.selectedQuality,
          unitType: requirement.input.unitType,
          allowLowerQuality: Boolean(requirement.item.allowLowerQuality),
        }),
      ),
    );
    const fulfilled = assignedRequirements.length > 0 && assignedRequirements.every((requirement) => {
      const identity = {
        requirementId: requirement.requirementId,
        selectedQuality: requirement.input.selectedQuality,
        unitType: requirement.input.unitType,
        allowLowerQuality: Boolean(requirement.item.allowLowerQuality),
      };
      const coverage = getMaterialReservationCoverage(
        requirement.item,
        materialKey,
        requirement.requiredQuantity,
        inventoryEntries,
        identity,
      );
      const allocations = (requirement.item.reservedAllocations ?? []).filter((allocation) =>
        allocationMatchesRequirement(allocation, materialKey, identity),
      );
      const allocatedAmount = getAllocationTotal(allocations);
      const qualityStatus = getQualityProjectionStatus(
        allocatedAmount,
        requirement.requiredQuantity,
        getWeightedEffectiveQuality(allocations),
        requirement.input.selectedQuality,
      );
      const quantityMet = coverage.coverageState === "covered" || coverage.coverageState === "overReserved";
      const qualityMet = requirement.item.allowLowerQuality === true || requirement.input.selectedQuality == null || qualityStatus === "meets" || qualityStatus === "above";
      return quantityMet && qualityMet;
    });
    const reservationTone: InventoryReservationTone = assignedItems.length === 0
      ? "unreserved"
      : fulfilled
        ? "fulfilled"
        : "partial";
    const eligibleRequirements = requirements.filter((requirement) => {
      if (getAvailableQuantityForInventoryEntry(entry, buildQueue, requirement.item.id) <= 0) return false;
      const target = requirement.input.selectedQuality;
      return target == null || requirement.item.allowLowerQuality === true || (entry.quality != null && entry.quality >= target);
    });
    const locationName = entry.locationId
      ? locationNamesById.get(entry.locationId) ?? "Unknown Location"
      : "Unassigned Stock";
    return {
      entry,
      material,
      materialKey,
      itemName: resolveInventoryItemName(entry, material),
      locationName,
      requirements,
      assignedItems,
      eligibleRequirements: getUniqueRequiredBy(eligibleRequirements),
      reservationTone,
    };
  }), [activeQueueItems, buildQueue, inventoryEntries, locationNamesById, queueRequirementsByMaterial, topQualityMaterials]);
  const displayedBuildQueueItems = useMemo(() => {
    const visible = activeQueueItems.slice(0, 5);
    if (!highlightedQueueItemId || visible.some((item) => item.id === highlightedQueueItemId)) return visible;
    const highlighted = activeQueueItems.find((item) => item.id === highlightedQueueItemId);
    if (!highlighted) return visible;
    return visible.length < 5 ? [...visible, highlighted] : [...visible.slice(0, 4), highlighted];
  }, [activeQueueItems, highlightedQueueItemId]);
  const nextRunFixtureMode = import.meta.env.DEV
    ? new URLSearchParams(window.location.search).get("fixture")
    : null;
  const nextFabricationRuns = useMemo(() => {
    if (nextRunFixtureMode === "next-fabrication-empty") return [];
    if (nextRunFixtureMode === "next-fabrication") return DEV_NEXT_FABRICATION_RUNS;
    return activeQueueItems
      .map((item) => buildProductionNextFabricationRun(
        item,
        inventoryEntries,
        materialTemplates,
        locations,
        recipesById,
        recipeInputTemplates,
      ))
      .filter((run): run is NextFabricationRun => run !== null);
  }, [activeQueueItems, inventoryEntries, locations, materialTemplates, nextRunFixtureMode, recipeInputTemplates, recipesById]);
  const nextFabricationRun = nextFabricationRuns.find((run) => run.queueItemId === selectedNextRunId)
    ?? nextFabricationRuns[0]
    ?? null;

  useEffect(() => {
    let cancelled = false;
    loadQualityQuantizationRecords()
      .then(() => {
        if (!cancelled) setQualityBandsReady(true);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!openReservationEntryId) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest(".dash-reservation-control")) return;
      setOpenReservationEntryId(null);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [openReservationEntryId]);

  return (
    <div className="dash-content-grid">
      <div className="dash-main-col">
        <section className="dash-hero" aria-label="Welcome">
          <div className="dash-hero-inner">
            <div className="dash-hero-content">
              <p className="dash-hero-kicker">Welcome to Scintel</p>
              <h1 className="dash-hero-title">Plan crafts. Reserve materials. Mine smarter.</h1>
              <p className="dash-hero-subtitle">
                Track inventory, auto-reserve build materials, and surface the shortages that matter next.
              </p>
              <div className="dash-hero-actions">
                <Link to="/logistics/build-queue" className="dash-hero-cta dash-hero-cta--primary">
                  Review Build Queue
                  <ArrowRight size={14} />
                </Link>
                <Link to="/logistics/inventory" className="dash-hero-cta dash-hero-cta--secondary">
                  View Inventory
                </Link>
              </div>
            </div>

            <div className="dash-hero-sequence" aria-label="Current production sequence">
              <Link to="/logistics/inventory" className="dash-hero-sequence-step">
                <span>01 / Inventory</span>
                <strong className="dash-tabnum">{inventoryEntries.length} records positioned</strong>
              </Link>
              <ArrowRight size={14} />
              <Link to="/logistics/build-queue" className="dash-hero-sequence-step">
                <span>02 / Reserve</span>
                <strong className="dash-tabnum">
                  {reserveSummary.reservableLines} ready · {queueLedger.refinedShortfallLines.length} short
                </strong>
              </Link>
              <ArrowRight size={14} />
              <div className="dash-hero-sequence-step dash-hero-sequence-step--current">
                <span>03 / Fabricate next</span>
                <strong title={nextFabricationRun?.itemName}>
                  {nextFabricationRun?.itemName ?? "No active fabrication run"}
                </strong>
              </div>
            </div>
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
              <div className="dash-stat-label">Completed Crafts</div>
              <div className="dash-stat-value dash-stat-value--complete">
                {completedQueueItems.length > 0 ? completedQueueItems.length : "-"}
              </div>
              <div className="dash-stat-sublabel">{activeQueueItems.length} active builds remain</div>
            </div>
            <StatIcon type="complete" />
          </div>

          <div className="dash-stat-card">
            <div className="dash-stat-main">
              <div className="dash-stat-label">Build Queue</div>
              <div className="dash-stat-value">{activeQueueItems.length}</div>
              <div className="dash-stat-sublabel">{activeQueueItems.length} active builds</div>
            </div>
            <StatIcon type="queue" />
          </div>
        </section>

        <div className="dash-cards-row">
          <article className="dash-card dash-card--inventory-primary ops-primary-card" aria-label="Mining and inventory overview">
            <div className="dash-card-header dash-overview-header">
              <div className="dash-overview-tabs" role="tablist" aria-label="Overview type">
                <button
                  id="dash-mining-overview-tab"
                  type="button"
                  role="tab"
                  aria-selected={overviewTab === "mining"}
                  aria-controls="dash-mining-overview-panel"
                  className={overviewTab === "mining" ? "is-active" : ""}
                  onClick={() => {
                    setOverviewTab("mining");
                    setOpenReservationEntryId(null);
                  }}
                >
                  Mining Overview
                </button>
                <button
                  id="dash-inventory-overview-tab"
                  type="button"
                  role="tab"
                  aria-selected={overviewTab === "inventory"}
                  aria-controls="dash-inventory-overview-panel"
                  className={overviewTab === "inventory" ? "is-active" : ""}
                  onClick={() => {
                    setOverviewTab("inventory");
                    setOpenReservationEntryId(null);
                  }}
                >
                  Inventory Overview
                </button>
              </div>
            </div>
            <div className="dash-card-body dash-inventory-body dash-overview-body">
              {overviewTab === "mining" ? (
                <div
                  id="dash-mining-overview-panel"
                  role="tabpanel"
                  aria-labelledby="dash-mining-overview-tab"
                  className="dash-overview-panel"
                >
                  {miningOverviewRows.length > 0 ? (
                    <table className="dash-overview-table dash-overview-table--mining">
                      <thead>
                        <tr>
                          <th>Material</th>
                          <th>Target</th>
                          <th>
                            <OverviewTooltip
                              content="The first value is the mapped quality band immediately below the target; the second is immediately above it."
                              ariaLabel="Band. Shows the mapped quality immediately below and above the target."
                            >
                              <span className="dash-overview-header-tooltip">Band</span>
                            </OverviewTooltip>
                          </th>
                          <th>
                            <span className="dash-overview-amount-heading" aria-label="Amount state badges">
                              <span className="dash-material-state-badge dash-material-state-badge--ore">ore</span>
                              <span className="dash-material-state-badge dash-material-state-badge--refined">Refined</span>
                              <span className="dash-material-state-badge dash-material-state-badge--raw">raw</span>
                            </span>
                          </th>
                          <th>Required By</th>
                        </tr>
                      </thead>
                      <tbody>
                        {miningOverviewRows.map((row) => {
                          const bandLabel = row.bandBelow != null && row.bandAbove != null
                            ? `${formatDashNumber(row.bandBelow)} / ${formatDashNumber(row.bandAbove)}`
                            : "—";
                          return (
                            <tr key={row.materialKey}>
                              <td>
                                <span className="dash-overview-material">
                                  <MaterialIcon materialName={row.displayName} materialState="raw" size={18} />
                                  <span>{row.displayName}</span>
                                </span>
                              </td>
                              <td className="dash-tabnum">{row.target != null ? formatDashNumber(row.target) : "—"}</td>
                              <td>
                                <OverviewTooltip
                                  content="Lower / upper mapped quality surrounding this target."
                                  ariaLabel={`${bandLabel}. Lower and upper mapped quality surrounding the target.`}
                                >
                                  <span className="dash-overview-band-value dash-tabnum">{bandLabel}</span>
                                </OverviewTooltip>
                              </td>
                              <td><MiningAmount row={row} /></td>
                              <td><RequiredByValue requirements={row.requiredBy} /></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <div className="dash-empty-state">No mineable materials are required by the active Build Queue</div>
                  )}
                </div>
              ) : (
                <div
                  id="dash-inventory-overview-panel"
                  role="tabpanel"
                  aria-labelledby="dash-inventory-overview-tab"
                  className="dash-overview-panel"
                >
                  {inventoryOverviewRows.length > 0 ? (
                    <table className="dash-overview-table dash-overview-table--inventory">
                      <thead>
                        <tr>
                          <th>Material</th>
                          <th>Location</th>
                          <th>Reserved</th>
                          <th>Amount</th>
                          <th>Quality</th>
                          <th>Required By</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inventoryOverviewRows.map((row) => {
                          const assignedRequirement = row.requirements.find((requirement) =>
                            row.assignedItems.some((item) => item.id === requirement.item.id),
                          );
                          const reservationLabel = row.reservationTone === "unreserved"
                            ? `Not reserved by the Build Queue. Show eligible builds for ${row.itemName}.`
                            : row.reservationTone === "partial"
                              ? `Reserved for ${assignedRequirement?.itemName ?? "a Build Queue item"}, but quantity or quality requirements are not fulfilled.`
                              : `Reserved for ${assignedRequirement?.itemName ?? "a Build Queue item"}; quantity and quality requirements are fulfilled.`;
                          const popoverOpen = row.reservationTone === "unreserved" && openReservationEntryId === row.entry.id;
                          return (
                            <tr key={row.entry.id}>
                              <td>
                                <Link
                                  to={`/logistics/inventory?location=${encodeURIComponent(row.entry.locationId ?? "__unassigned__")}`}
                                  className="dash-overview-material dash-overview-material--link"
                                >
                                  <MaterialIcon
                                    materialName={row.itemName}
                                    materialState={row.material?.materialType === "refined" ? "refined" : "raw"}
                                    size={18}
                                  />
                                  <span>{row.itemName}</span>
                                </Link>
                              </td>
                              <td className="dash-overview-location" title={row.locationName}>{row.locationName}</td>
                              <td>
                                <div className="dash-reservation-control">
                                  <button
                                    type="button"
                                    className={`dash-reservation-indicator dash-reservation-indicator--${row.reservationTone}`}
                                    aria-label={reservationLabel}
                                    aria-expanded={row.reservationTone === "unreserved" ? popoverOpen : undefined}
                                    onClick={() => {
                                      if (row.reservationTone === "unreserved") {
                                        setOpenReservationEntryId((current) => current === row.entry.id ? null : row.entry.id);
                                        return;
                                      }
                                      setOpenReservationEntryId(null);
                                      setHighlightedQueueItemId(row.assignedItems[0]?.id ?? null);
                                    }}
                                  >
                                    <span aria-hidden />
                                  </button>
                                  {popoverOpen && (
                                    <div className="dash-reservation-popover" role="dialog" aria-label={`Eligible builds for ${row.itemName}`}>
                                      <strong>Eligible builds</strong>
                                      {row.eligibleRequirements.length > 0 ? (
                                        <ul role="list">
                                          {row.eligibleRequirements.map((requirement) => (
                                            <li key={requirement.item.id}>{requirement.itemName}</li>
                                          ))}
                                        </ul>
                                      ) : (
                                        <span>No valid queue items</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="dash-tabnum">{formatInventoryQuantity(row.entry.quantity, resolveInventoryUnitType(row.entry, row.material))}</td>
                              <td className="dash-overview-quality dash-tabnum" style={{ color: row.entry.rarity.colorHex }}>{row.entry.quality}</td>
                              <td><RequiredByValue requirements={row.requirements} /></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <div className="dash-empty-state">{inventoryEntries.length > 0 ? "No material quality recorded" : "No inventory recorded"}</div>
                  )}
                </div>
              )}
            </div>
            <div className="dash-card-footer">
              <Link
                to={overviewTab === "mining" ? "/industry/mining" : "/logistics/inventory"}
                className="dash-card-footer-link"
              >
                {overviewTab === "mining" ? "Open Mining" : "Go to Inventory"} <ArrowRight />
              </Link>
            </div>
          </article>

          <div className="dash-status-deck" aria-label="Operational status">
          <article className="dash-card dash-card--reserve-status ops-primary-card" aria-label="Auto reserve readiness">
            <div className="dash-card-header"><span className="dash-card-title">Auto Reserve</span></div>
            <div className="dash-card-body dash-reserve-body">
              <div className="dash-reserve-metrics">
                <div className="dash-reserve-metric dash-reserve-metric--ready">
                  <span className="dash-reserve-metric-label">Ready to reserve</span>
                  <span className="dash-reserve-metric-value dash-tabnum">{reserveSummary.reservableLines}</span>
                  <span className="dash-reserve-metric-hint">materials with stock</span>
                </div>
                <div className="dash-reserve-metric dash-reserve-metric--short">
                  <span className="dash-reserve-metric-label">Shortfalls</span>
                  <span className="dash-reserve-metric-value dash-tabnum">{queueLedger.refinedShortfallLines.length}</span>
                  <span className="dash-reserve-metric-hint">{reserveSummary.noStockLines} with no stock</span>
                </div>
                <div className="dash-reserve-metric dash-reserve-metric--warn">
                  <span className="dash-reserve-metric-label">Quality targets</span>
                  <span className="dash-reserve-metric-value dash-tabnum">{qualityTargetCount}</span>
                  <span className="dash-reserve-metric-hint">active builds locked</span>
                </div>
              </div>
              {shortageRows.length > 0 && (
                <ul className="dash-reserve-preview" role="list">
                  {shortageRows.slice(0, 3).map((row) => (
                    <li key={row.materialKey} className="dash-reserve-preview-row">
                      <MaterialIcon materialName={row.displayName} size={16} />
                      <span className="dash-reserve-preview-name">{row.displayName}</span>
                      <span className={`dash-reserve-preview-status ${row.totalAvailableEquivalent > 0 ? "dash-reserve-preview-status--partial" : "dash-reserve-preview-status--missing"}`}>
                        {row.totalAvailableEquivalent > 0 ? "Partial" : "Missing"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {shortageRows.length === 0 && (
                <div className="dash-empty-state">Queue materials are covered</div>
              )}
            </div>
            <div className="dash-card-footer">
              <Link to="/logistics/build-queue" className="dash-card-footer-link">Open Auto Reserve <ArrowRight /></Link>
            </div>
          </article>

          <article className="dash-card dash-card--shortage-status ops-primary-card" aria-label="Material shortages">
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
                      <td><span className="dash-shortage-badge dash-tabnum">{formatInventoryQuantity(row.netMissingRefined, row.unitType === "unit" ? "unit" : "scu")}</span></td>
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
          </div>

          <article className="dash-card dash-card--queue-secondary ops-primary-card" aria-label="Build queue">
            <div className="dash-card-header">
              <span className="dash-card-title">Build Queue</span>
              <div className="dash-card-meta">
                <span>{activeQueueItems.length} Items Queued</span>
                <span className="dash-card-meta-sep">/</span>
                <span>{activeQueueItems.length} Active</span>
              </div>
            </div>
            <div className="dash-card-body">
              <ul className="dash-bq-list" role="list">
                {displayedBuildQueueItems.map((item) => {
                  const progress = getQueueItemProgress(item, inventoryEntries, recipeInputTemplates);
                  const queued = progress === null;
                  const highlighted = item.id === highlightedQueueItemId;
                  return (
                    <li
                      key={item.id}
                      className={`dash-bq-item${highlighted ? " dash-bq-item--highlighted" : ""}`}
                      aria-label={highlighted ? `${getQueueItemName(item, recipesById)}, highlighted from Inventory Overview` : undefined}
                    >
                      <BqThumb color="#ff9d00" />
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
                {activeQueueItems.length === 0 && <li className="dash-empty-state">No builds queued yet</li>}
              </ul>
            </div>
            <div className="dash-card-footer">
              <Link to="/logistics/build-queue" className="dash-card-footer-link">View Build Queue <ArrowRight /></Link>
            </div>
          </article>
        </div>

        <NextFabricationRunModule
          run={nextFabricationRun}
          runs={nextFabricationRuns}
          onSelectRun={setSelectedNextRunId}
        />
      </div>
    </div>
  );
}
function RunStateIcon({ state }: { state: NextRunBoxState | NextRunMovementState | NextFabricationRun["targetState"] }) {
  const path = state === "unavailable"
    ? "M12 2L2 20h20L12 2zm0 6v5m0 3.5v.5"
    : state === "pull"
      ? "M5 19h14M12 5v10m0 0l-4-4m4 4l4-4"
      : state === "warehouse"
        ? "M3 9l9-6 9 6v11H3V9zm4 3h10m-10 4h10"
        : state === "pending"
          ? "M12 3a9 9 0 109 9m-9-5v5l3 2"
          : "M20 6L9 17l-5-5";
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}

function NextFabricationRunModule({
  run,
  runs,
  onSelectRun,
}: {
  run: NextFabricationRun | null;
  runs: NextFabricationRun[];
  onSelectRun: (queueItemId: string) => void;
}) {
  return (
    <article className="dash-next-run ops-primary-card" aria-labelledby="dash-next-run-title" data-fixture={run?.fixtureOnly ? "development" : undefined}>
      <header className="dash-next-run-header">
        <div>
          <span className="dash-next-run-kicker">Operations handoff</span>
          <h2 id="dash-next-run-title">Next Fabrication Run</h2>
        </div>
        {run && (
          <span className={`dash-next-run-status dash-next-run-status--${run.targetState}`}>
            <RunStateIcon state={run.targetState} />
            {run.targetState === "met" ? "Target Met" : run.targetState === "unavailable" ? "Target Unavailable With Current Inventory" : "Target pending"}
          </span>
        )}
      </header>

      {!run ? (
        <div className="dash-next-run-empty">
          <div className="dash-next-run-empty-icon" aria-hidden>◇</div>
          <div>
            <strong>No fabrication run is queued</strong>
            <span>Add a craft to the Build Queue to review its material pull plan here.</span>
          </div>
          <Link to="/logistics/build-queue" className="dash-next-run-action dash-next-run-action--secondary">
            Open Build Queue <ArrowRight size={14} />
          </Link>
        </div>
      ) : (
        <div className="dash-next-run-layout">
          <section className="dash-next-run-summary" aria-label="Craft summary">
            <div className="dash-next-run-item">
              <div className="dash-next-run-item-icon" aria-hidden>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
                  <path d="M12 2l9 5-9 5-9-5 9-5zm-9 5v10l9 5 9-5V7M12 12v10" />
                </svg>
              </div>
              <div>
                <span>Craft ×{run.quantity}</span>
                <label className="dash-next-run-selector">
                  <span className="dash-sr-only">Queued craft</span>
                  <select
                    aria-label="Select queued craft"
                    value={run.queueItemId}
                    onChange={(event) => onSelectRun(event.target.value)}
                  >
                    {runs.map((candidate) => (
                      <option key={candidate.queueItemId} value={candidate.queueItemId}>
                        {candidate.itemName}
                      </option>
                    ))}
                  </select>
                  <svg aria-hidden viewBox="0 0 16 16"><path d="M4 6l4 4 4-4" /></svg>
                </label>
              </div>
            </div>

            <dl className="dash-next-run-metrics">
              <div><dt>Target</dt><dd className="dash-tabnum">{run.target ?? "Not provided"}</dd></div>
              <div><dt>Projected</dt><dd className="dash-tabnum">{run.projected ?? "Not provided"}</dd></div>
              <div><dt>Readiness</dt><dd>{run.readiness}</dd></div>
              <div><dt>Coverage</dt><dd>{run.coverage}</dd></div>
            </dl>

            <div className="dash-next-run-boundary" aria-label="Minimum to target status">
              <span className="dash-next-run-boundary-label">Min to Target</span>
              {run.minimumQuality && run.minimumQuantity ? (
                <>
                  <strong>Minimum Quality {run.minimumQuality}</strong>
                  <span>{run.minimumQuantity} still required</span>
                  {run.bestAchievable && <span>Best achievable: Projected {run.bestAchievable}</span>}
                </>
              ) : (
                <span>Production inputs not available</span>
              )}
            </div>
          </section>

          <section className="dash-next-run-pull" aria-label="Locations, materials, and boxes">
            <div className="dash-next-run-pull-head">
              <span>Locations → Materials → Individual Boxes</span>
            </div>
            <div className="dash-next-run-scroll">
              {run.locations.length > 0 ? run.locations.map((location, locationIndex) => (
                <details key={location.id} className="dash-next-run-location" open={locationIndex < 2}>
                  <summary>
                    <span className="dash-next-run-location-order">{location.visitOrder ?? locationIndex + 1}</span>
                    <span className="dash-next-run-location-name" title={location.name}>{location.name}</span>
                    <span>{location.materials.length} material{location.materials.length === 1 ? "" : "s"}</span>
                    <svg aria-hidden viewBox="0 0 16 16"><path d="M4 6l4 4 4-4" /></svg>
                  </summary>
                  <div className="dash-next-run-location-body">
                    {location.materials.map((material) => (
                      <div key={material.id} className={`dash-next-run-material dash-next-run-material--${material.state}`}>
                        <div className="dash-next-run-material-head">
                          <span className="dash-next-run-material-name">
                            <MaterialIcon materialName={material.name} size={16} />
                            <strong>{material.name}</strong>
                          </span>
                          <span>{material.requirement}</span>
                        </div>
                        <div className="dash-next-run-box-head" aria-hidden>
                          <span>Box</span><span>Quality</span><span>Quantity</span><span>Reservation</span><span>State</span><span>Expected</span>
                        </div>
                        {material.boxes.map((box) => (
                          <div key={box.id} className={`dash-next-run-box dash-next-run-box--${box.availability}`}>
                            <span className="dash-next-run-box-name" title={box.label}>{box.label}</span>
                            <span className="dash-next-run-box-quality dash-tabnum">{box.quality != null ? `Quality ${formatDashNumber(box.quality)}` : "Not recorded"}</span>
                            <span className="dash-next-run-box-quantity dash-tabnum">
                              <strong>{box.quantity}</strong>
                              {box.reservedQuantity && <small>{box.reservedQuantity}</small>}
                            </span>
                            <span className="dash-next-run-box-reservation">
                              <span className={`dash-next-run-chip dash-next-run-chip--${box.availability}`}>
                                <RunStateIcon state={box.availability} /> {box.reservationLabel}
                              </span>
                              {box.owner && <small title={box.owner}>{box.owner}</small>}
                            </span>
                            <span className={`dash-next-run-chip dash-next-run-chip--${box.movement}`}>
                              <RunStateIcon state={box.movement} /> {box.movement === "pull" ? `${box.pullOrder ? `${box.pullOrder}. ` : ""}Pull` : box.movement === "warehouse" ? "Warehouse" : "Plan pending"}
                            </span>
                            <span className="dash-next-run-box-remainder">{box.remainder ?? box.owner ?? "Not provided"}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </details>
              )) : (
                <div className="dash-next-run-inline-empty">No reserved boxes are attached to this craft yet.</div>
              )}
            </div>
          </section>

          <aside className="dash-next-run-actions" aria-label="Action summary">
            <div className="dash-next-run-action-list">
              <div><span>Locations to visit</span><strong>{run.locationsToVisit}</strong></div>
              <div><span>Boxes to retrieve</span><strong>{run.boxesToRetrieve}</strong></div>
              <div className={run.missingMaterials === "None identified" ? "is-ok" : "is-warning"}><span>Missing materials</span><strong>{run.missingMaterials}</strong></div>
              <div><span>Expected excess / refund</span><strong>{run.expectedExcess ?? "Not provided"}</strong></div>
            </div>
            <Link to="/logistics/build-queue" className="dash-next-run-action">
              {run.actionLabel} <ArrowRight size={14} />
            </Link>
            <span className="dash-next-run-action-note">{run.actionNote}</span>
          </aside>
        </div>
      )}
    </article>
  );
}
