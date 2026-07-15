import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import MaterialIcon from "../components/logistics/MaterialIcon";
import { useLogisticsStore } from "../stores/logisticsStore";
import { deriveUserDashStats } from "../lib/dashboardStats";
import type { LogisticsMaterialTemplate } from "../data/logistics/seed";
import { buildRecommendationRequest, getMiningRecommendations } from "../features/mining/recommenderAdapter";
import type { PublicLocationEntry, RequiredMaterial } from "../features/mining/types";
import {
  formatInventoryQuantity,
  getActiveInventoryEntries,
  getBuildQueueItemInputs,
  getGlobalTopQualityMaterials,
  resolveInventoryItemName,
  resolveInventoryUnitType,
} from "../lib/logistics/inventory";
import { getQueueLedgerModel, type QueueLedgerLine } from "../lib/logistics/queueLedger";
import { getMaterialReservationCoverage, validateReservedAllocations } from "../lib/logistics/selectors";
import { isDisplayableFittingShip, listFittingShips, type FittingShipSummary as ApiFittingShipSummary } from "../lib/fitting/fittingApi";
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

type FittingShipSummary = {
  shipKey: string;
  name: string;
  manufacturer: string | null;
  role: string | null;
  career: string | null;
  movementClass: string | null;
  crewSize: number | null;
  isGroundVehicle: boolean | null;
};

function adaptFittingShip(ship: ApiFittingShipSummary): FittingShipSummary {
  return {
    shipKey: ship.id,
    name: ship.displayName || ship.name,
    manufacturer: ship.manufacturer,
    role: ship.role,
    career: ship.career,
    movementClass: ship.vehicleType,
    crewSize: ship.crew.max ?? ship.crew.min,
    isGroundVehicle: ship.isGroundVehicle,
  };
}

const ENABLE_FITTING_UI = import.meta.env.VITE_ENABLE_FITTING_UI === "true";

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

function getMiningRecReason(rec: PublicLocationEntry): string {
  if (rec.requiredMaterials && rec.requiredMaterials.length > 0) return "Needed for active build";
  return "Shortage material";
}

function getMiningRecQuality(rec: PublicLocationEntry): string | null {
  const quality = rec.requiredMaterials?.[0]?.selectedQuality ?? rec.routeScores?.[0]?.selectedQuality;
  if (quality == null || !Number.isFinite(quality)) return null;
  return `Quality ${formatDashNumber(quality)}`;
}

function formatDashNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/\.?0+$/, "");
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

function buildInventoryLocationSummaries(
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
    .sort((a, b) => b.scu - a.scu || b.units - a.units || b.entries - a.entries || a.name.localeCompare(b.name));
}

function formatLocationQuantity(location: ReturnType<typeof buildInventoryLocationSummaries>[number]) {
  const parts: string[] = [];
  if (location.scu > 0) parts.push(`${formatDashNumber(location.scu)} SCU`);
  if (location.units > 0) parts.push(`x${formatDashNumber(location.units)}`);
  return parts.join(" / ") || "0";
}

function getTopRecordedInventoryLocation(locations: ReturnType<typeof buildInventoryLocationSummaries>) {
  return [...locations].sort((a, b) => b.entries - a.entries || b.scu - a.scu || b.units - a.units || a.name.localeCompare(b.name))[0] ?? null;
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
  const [miningState, setMiningState] = useState<{ status: "idle" | "loading" | "loaded" | "error"; data: PublicLocationEntry[] }>({
    status: "idle",
    data: [],
  });
  const [selectedNextRunId, setSelectedNextRunId] = useState<string | null>(null);

  const queueLedger = useMemo(
    () => getQueueLedgerModel({ buildQueue, inventoryEntries, materials: materialTemplates, recipeInputsByRecipeId: recipeInputTemplates }),
    [buildQueue, inventoryEntries, materialTemplates, recipeInputTemplates]
  );
  const activeQueueItems = useMemo(() => buildQueue.filter((item) => item.status !== "complete"), [buildQueue]);
  const completedQueueItems = useMemo(() => buildQueue.filter((item) => item.status === "complete"), [buildQueue]);
  const recipesById = useMemo(() => new Map(recipeTemplates.map((recipe) => [recipe.id, recipe])), [recipeTemplates]);
  const locationNamesById = useMemo(() => new Map(locations.map((location) => [location.id, location.name])), [locations]);
  const topQualityMaterials = useMemo(
    () => getGlobalTopQualityMaterials(inventoryEntries, materialTemplates)
      .filter(({ entry }) => entry.quality != null && Number.isFinite(entry.quality))
      .slice(0, 6),
    [inventoryEntries, materialTemplates]
  );
  const inventoryLocationSummaries = useMemo(
    () => buildInventoryLocationSummaries(inventoryEntries, locations, materialTemplates),
    [inventoryEntries, locations, materialTemplates]
  );
  const primaryLocations = useMemo(() => inventoryLocationSummaries.slice(0, 5), [inventoryLocationSummaries]);
  const topRecordedInventoryLocation = useMemo(
    () => getTopRecordedInventoryLocation(inventoryLocationSummaries),
    [inventoryLocationSummaries]
  );
  const inventoryOverviewTarget = topRecordedInventoryLocation
    ? `/logistics/inventory?location=${encodeURIComponent(topRecordedInventoryLocation.id)}`
    : "/logistics/inventory";
  const shortageRows = queueLedger.refinedShortfallLines.slice(0, 5);
  const reserveSummary = queueLedger.summary;
  const qualityTargetCount = useMemo(
    () => activeQueueItems.filter((item) => item.finalProductQualityBand != null && item.allowLowerQuality !== true).length,
    [activeQueueItems],
  );
  const avgQueueProgress = useMemo(() => {
    const progresses = activeQueueItems
      .map((item) => getQueueItemProgress(item, inventoryEntries, recipeInputTemplates))
      .filter((progress): progress is number => progress !== null);
    if (progresses.length === 0) return null;
    return Math.round(progresses.reduce((sum, value) => sum + value, 0) / progresses.length);
  }, [activeQueueItems, inventoryEntries, recipeInputTemplates]);
  const topVolumeMaterial = userStats.top3Volume[0];
  const miningRequiredMaterials = useMemo(
    () => toRequiredMaterials(
      queueLedger.rawOreRequirementLines.length > 0 ? queueLedger.rawOreRequirementLines : queueLedger.refinedShortfallLines
    ),
    [queueLedger.rawOreRequirementLines, queueLedger.refinedShortfallLines]
  );
  const displayedMiningState = miningRequiredMaterials.length === 0
    ? { status: "idle" as const, data: [] as PublicLocationEntry[] }
    : miningState;
  const topMiningRec = displayedMiningState.data[0];
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
    if (miningRequiredMaterials.length === 0) return;

    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) setMiningState((current) => ({ status: "loading", data: current.data }));
    });
    getMiningRecommendations(
      buildRecommendationRequest({
        priorityStack: [],
        manualDemand: [],
        favoriteLocationIds: [],
        filters: { showOnlyStarred: false },
      }, null, miningRequiredMaterials, "quality"),
      controller.signal
    )
      .then((response) => {
        if (!controller.signal.aborted) setMiningState({ status: "loaded", data: response.recommendations.slice(0, 3) });
      })
      .catch(() => {
        if (!controller.signal.aborted) setMiningState((current) => ({ status: "error", data: current.data }));
      });
    return () => controller.abort();
  }, [miningRequiredMaterials]);

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

            <div className="dash-hero-workflow" aria-label="Operations snapshot">
              <Link to="/logistics/inventory" className="dash-hero-mini dash-hero-mini--inventory">
                <span className="dash-hero-mini-label">Inventory</span>
                <span className="dash-hero-mini-value dash-tabnum">
                  {userStats.totalVolume > 0
                    ? (userStats.totalVolumeUnit === "x"
                      ? `x${userStats.totalVolume}`
                      : `${userStats.totalVolume} SCU`)
                    : "—"}
                </span>
                <span className="dash-hero-mini-meta">
                  {topVolumeMaterial ? `Top: ${topVolumeMaterial.name}` : `${inventoryEntries.length} records`}
                </span>
              </Link>

              <Link to="/logistics/build-queue" className="dash-hero-mini dash-hero-mini--reserve">
                <span className="dash-hero-mini-label">Auto Reserve</span>
                <span className="dash-hero-mini-value dash-tabnum">
                  {reserveSummary.reservableLines > 0 ? reserveSummary.reservableLines : "—"}
                  <small> ready</small>
                </span>
                <span className="dash-hero-mini-meta">
                  {queueLedger.refinedShortfallLines.length > 0
                    ? `${queueLedger.refinedShortfallLines.length} shortfall${queueLedger.refinedShortfallLines.length === 1 ? "" : "s"}`
                    : qualityTargetCount > 0
                      ? `${qualityTargetCount} quality target${qualityTargetCount === 1 ? "" : "s"}`
                      : "No shortages"}
                </span>
              </Link>

              <Link to="/logistics/build-queue" className="dash-hero-mini dash-hero-mini--queue">
                <span className="dash-hero-mini-label">Build Queue</span>
                <span className="dash-hero-mini-value dash-tabnum">
                  {activeQueueItems.length}
                  <small> active</small>
                </span>
                <span className="dash-hero-mini-meta">
                  {avgQueueProgress != null ? `${avgQueueProgress}% materials covered` : `${buildQueue.length} queued`}
                </span>
              </Link>

              <Link to="/industry/mining" className="dash-hero-mini dash-hero-mini--mining">
                <span className="dash-hero-mini-label">Mining</span>
                <span className="dash-hero-mini-value dash-hero-mini-value--truncate">
                  {topMiningRec
                    ? (topMiningRec.requiredMaterials?.[0]?.displayName ?? topMiningRec.materials[0] ?? "Route ready")
                    : (displayedMiningState.status === "loading" ? "Loading…" : "—")}
                </span>
                <span className="dash-hero-mini-meta dash-hero-mini-meta--truncate">
                  {topMiningRec
                    ? [
                        `${topMiningRec.systemName} / ${topMiningRec.locationName}`,
                        getMiningRecQuality(topMiningRec),
                      ].filter(Boolean).join(" · ")
                    : "No shortage routes"}
                </span>
              </Link>
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
              <div className="dash-stat-value">{buildQueue.length}</div>
              <div className="dash-stat-sublabel">{activeQueueItems.length} active builds</div>
            </div>
            <StatIcon type="queue" />
          </div>
        </section>

        <div className="dash-cards-row">
          <article className="dash-card ops-primary-card" aria-label="Inventory overview">
            <div className="dash-card-header"><span className="dash-card-title">Inventory Overview</span></div>
            <div className="dash-card-body dash-inventory-body">
              {topQualityMaterials.length > 0 ? (
                <div className="dash-inventory-quality-list">
                  <div className="dash-inventory-quality-head" aria-hidden>
                    <span>Material</span>
                    <span>Location</span>
                    <span>Amount</span>
                    <span>Quality</span>
                  </div>
                  {topQualityMaterials.map(({ entry, material }) => {
                    const itemName = resolveInventoryItemName(entry, material);
                    const locationId = entry.locationId ?? "__unassigned__";
                    const locationName = entry.locationId ? locationNamesById.get(entry.locationId) ?? "Unknown Location" : "Unassigned Stock";
                    return (
                      <Link
                        key={entry.id}
                        to={`/logistics/inventory?location=${encodeURIComponent(locationId)}`}
                        className="dash-inventory-quality-row"
                      >
                        <MaterialIcon
                          materialName={itemName}
                          materialState={material?.materialType === "refined" ? "refined" : "raw"}
                          size={18}
                        />
                        <span className="dash-inventory-quality-name">{itemName}</span>
                        <span className="dash-inventory-quality-loc">{locationName}</span>
                        <span className="dash-inventory-quality-qty dash-tabnum">
                          {formatInventoryQuantity(entry.quantity, resolveInventoryUnitType(entry, material))}
                        </span>
                        <span className="dash-inventory-quality-value dash-tabnum" style={{ color: entry.rarity.colorHex }}>
                          Quality {entry.quality}
                        </span>
                        <ArrowRight />
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="dash-empty-state">{inventoryEntries.length > 0 ? "No material quality recorded" : "No inventory recorded"}</div>
              )}
            </div>
            <div className="dash-card-footer">
              <Link to={inventoryOverviewTarget} className="dash-card-footer-link">Go to Inventory <ArrowRight /></Link>
            </div>
          </article>

          <article className="dash-card ops-primary-card" aria-label="Auto reserve readiness">
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

          <article className="dash-card ops-primary-card" aria-label="Material shortages">
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

          <article className="dash-card ops-primary-card" aria-label="Build queue">
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

        <NextFabricationRunModule
          run={nextFabricationRun}
          runs={nextFabricationRuns}
          onSelectRun={setSelectedNextRunId}
        />
      </div>

      <aside className="dash-right-col" aria-label="System panels">
        <QuickInventoryPanel
          entryCount={inventoryEntries.length}
          uniqueItems={new Set(inventoryEntries.map((entry) => entry.materialId ?? entry.catalogItemId ?? entry.itemName ?? entry.id)).size}
          totalVolume={userStats.totalVolume}
          totalVolumeUnit={userStats.totalVolumeUnit}
          topMaterialName={topVolumeMaterial?.name ?? null}
        />
        {ENABLE_FITTING_UI && <FittingLaunchPanel />}

        <div className="dash-card dash-card--rail ops-primary-card">
          <div className="dash-card-header"><span className="dash-card-title">Primary Locations</span></div>
          <div className="dash-card-body dash-card-body--compact">
            <ul className="dash-locations-list" role="list">
              {primaryLocations.map((loc) => (
                <li key={loc.id} className="dash-location-row">
                  <LocationIcon type={loc.type} />
                  <span className="dash-location-name">{loc.name}</span>
                  <span className="dash-location-scu dash-tabnum">{formatLocationQuantity(loc)}</span>
                </li>
              ))}
              {primaryLocations.length === 0 && <li className="dash-empty-state">No records yet</li>}
            </ul>
          </div>
        </div>

        <div className="dash-card dash-card--rail ops-primary-card">
          <div className="dash-card-header"><span className="dash-card-title">Mining Recommendations</span></div>
          <div className="dash-card-body dash-card-body--compact">
            <ul className="dash-mining-list" role="list">
              {displayedMiningState.data.map((rec) => {
                const materialName = rec.requiredMaterials?.[0]?.displayName ?? rec.materials[0] ?? "Mining route";
                const qualityLabel = getMiningRecQuality(rec);
                return (
                  <li key={rec.locationKey} className="dash-mining-item">
                    <div className="dash-mining-item-head">
                      <MaterialIcon materialName={materialName} size={16} />
                      <span className="dash-mining-material">{materialName}</span>
                      {qualityLabel && <span className="dash-mining-quality dash-tabnum">{qualityLabel}</span>}
                    </div>
                    <div className="dash-mining-location">{rec.systemName} / {rec.locationName}</div>
                    <div className="dash-mining-reason">{getMiningRecReason(rec)}</div>
                  </li>
                );
              })}
              {displayedMiningState.data.length === 0 && (
                <li className="dash-empty-state">{displayedMiningState.status === "loading" ? "Loading recommendations" : "No queue shortages to route"}</li>
              )}
            </ul>
          </div>
          <div className="dash-card-footer">
            <Link to="/industry/mining" className="dash-card-footer-link">View Mining <ArrowRight /></Link>
          </div>
        </div>
      </aside>
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

function QuickInventoryPanel({
  entryCount,
  uniqueItems,
  totalVolume,
  totalVolumeUnit,
  topMaterialName,
}: {
  entryCount: number;
  uniqueItems: number;
  totalVolume: number;
  totalVolumeUnit: "SCU" | "x";
  topMaterialName: string | null;
}) {
  return (
    <div className="dash-card dash-card--rail ops-primary-card">
      <div className="dash-card-header"><span className="dash-card-title">Quick Inventory</span></div>
      <div className="dash-card-body dash-card-body--compact">
        <div className="dash-qinv-stats">
          <div className="dash-qinv-stat">
            <span className="dash-qinv-stat-label">Records</span>
            <span className="dash-qinv-stat-value dash-tabnum">{entryCount > 0 ? entryCount : "—"}</span>
          </div>
          <div className="dash-qinv-stat">
            <span className="dash-qinv-stat-label">Items</span>
            <span className="dash-qinv-stat-value dash-tabnum">{uniqueItems > 0 ? uniqueItems : "—"}</span>
          </div>
          <div className="dash-qinv-stat dash-qinv-stat--wide">
            <span className="dash-qinv-stat-label">Total volume</span>
            <span className="dash-qinv-stat-value dash-tabnum">
              {totalVolume > 0
                ? (totalVolumeUnit === "x" ? `x${totalVolume}` : `${totalVolume} SCU`)
                : "—"}
            </span>
          </div>
        </div>
        {topMaterialName && (
          <p className="dash-qinv-lead">Led by <strong>{topMaterialName}</strong></p>
        )}
      </div>
      <div className="dash-card-footer">
        <Link to="/logistics/inventory" className="dash-card-footer-link">View Inventory <ArrowRight /></Link>
      </div>
    </div>
  );
}

function FittingLaunchPanel() {
  const [ships, setShips] = useState<FittingShipSummary[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [query, setQuery] = useState("");
  const [selectedShipKey, setSelectedShipKey] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) setStatus("loading");
    });
    listFittingShips(controller.signal)
      .then((payload) => {
        if (controller.signal.aborted) return;
        const records = payload.filter(isDisplayableFittingShip).map(adaptFittingShip);
        setShips(records);
        setSelectedShipKey((current) => current ?? records[0]?.shipKey ?? null);
        setStatus("loaded");
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus("error");
      });
    return () => controller.abort();
  }, []);

  const filteredShips = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = needle
      ? ships.filter((ship) => [
        ship.name,
        ship.manufacturer,
        ship.role,
        ship.career,
      ].filter(Boolean).join(" ").toLowerCase().includes(needle))
      : ships;
    return matches.slice(0, 8);
  }, [query, ships]);

  const selectedShip = useMemo(
    () => ships.find((ship) => ship.shipKey === selectedShipKey) ?? filteredShips[0] ?? null,
    [filteredShips, selectedShipKey, ships],
  );

  return (
    <div className="dash-panel dash-fitting-panel">
      <div className="dash-panel-header">
        <span className="dash-panel-title">Fitting</span>
        <span className="dash-fitting-count">{status === "loaded" ? `${ships.length} ships` : "Internal"}</span>
      </div>
      <div className="dash-panel-body dash-fitting-body">
        <label className="dash-fitting-search">
          <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search ships..."
            aria-label="Search fitting ships"
          />
        </label>

        <div className="dash-fitting-selector" role="listbox" aria-label="Fitting ship selector">
          {filteredShips.map((ship) => {
            const selected = ship.shipKey === selectedShip?.shipKey;
            return (
              <button
                key={ship.shipKey}
                type="button"
                className={["dash-fitting-option", selected ? "dash-fitting-option--active" : ""].filter(Boolean).join(" ")}
                onClick={() => setSelectedShipKey(ship.shipKey)}
                role="option"
                aria-selected={selected}
              >
                <span className="dash-fitting-option-main">
                  <span className="dash-fitting-option-name">{ship.name}</span>
                  <span className="dash-fitting-option-meta">{ship.manufacturer ?? "Unknown"} / {ship.role ?? ship.career ?? "Unclassified"}</span>
                </span>
                <span className="dash-fitting-proto dash-fitting-proto--ready">Ready</span>
              </button>
            );
          })}
          {status === "loading" && <div className="dash-empty-state">Loading fitting ships</div>}
          {status === "error" && <div className="dash-empty-state">Fitting ships unavailable</div>}
          {status === "loaded" && filteredShips.length === 0 && <div className="dash-empty-state">No matching ships</div>}
        </div>

        {selectedShip && (
          <div className="dash-fitting-summary" aria-label="Selected fitting ship">
            <div className="dash-fitting-summary-head">
              <span>{selectedShip.manufacturer ?? "Unknown"}</span>
              <strong>{selectedShip.name}</strong>
            </div>
            <div className="dash-fitting-metrics">
              <span><b>Role</b>{selectedShip.role ?? selectedShip.career ?? "Unknown"}</span>
              <span><b>Crew</b>{selectedShip.crewSize ?? "-"}</span>
              <span><b>Dataset</b>Stock loadout</span>
            </div>
            <Link to={`/fitting/${selectedShip.shipKey}`} className="dash-fitting-open">
              Open Fitting
              <ArrowRight size={10} />
            </Link>
          </div>
        )}

        <p className="dash-fitting-note">
          Read-only LIVE fitting data. Dashboard preview only.
        </p>
      </div>
    </div>
  );
}
