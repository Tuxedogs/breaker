import { apiUrl } from "../apiUrl";

export type FittingConfidence = "high" | "medium" | "low";

export type FittingApiMeta = {
  apiVersion: "1";
  artifactSchemaVersion: number;
  channel: "LIVE" | "PTU";
  buildId: string;
  generatedAt: string;
};

type Page = { limit: number; nextCursor: string | null };
type DetailResponse<T> = { meta: FittingApiMeta; data: T };
type ListResponse<T> = DetailResponse<T[]> & { page: Page };

export type FittingShipSummary = {
  id: string;
  name: string;
  displayName: string;
  manufacturer: string | null;
  vehicleType: string;
  isGroundVehicle: boolean;
  career: string | null;
  role: string | null;
  crew: { min: number | null; max: number | null };
  cargoCapacityScu: number | null;
  confidence: FittingConfidence;
};

export type FittingShipDetail = FittingShipSummary & {
  description: string | null;
  className: string | null;
  performance: {
    scmSpeed?: number | null;
    maxSpeed?: number | null;
    pitchRate?: number | null;
    yawRate?: number | null;
    rollRate?: number | null;
    boostSpeedForward?: number | null;
    boostSpeedBackward?: number | null;
    boostCapacity?: number | null;
    boostRegen?: number | null;
  };
};

export function isDisplayableFittingShip(ship: FittingShipSummary): boolean {
  const label = (ship.displayName || ship.name).trim();
  return label.length > 0 && !label.startsWith("<=") && label.toLowerCase() !== "unknown";
}

export type FittingComponentSummary = {
  id: string;
  name: string;
  displayName: string;
  manufacturer: string | null;
  type: string;
  subtype: string | null;
  size: number | null;
  grade: string | null;
  class: string | null;
  confidence: FittingConfidence;
};

export type FittingHardpoint = {
  id: string;
  parentId: string | null;
  name: string;
  type: string;
  subtype: string | null;
  size?: { min: number | null; max: number | null; exact: number | null };
  editable: boolean;
  bespoke: boolean;
  locked: boolean;
  defaultComponentId: string | null;
  compatibilityStatus: string | null;
  confidence: FittingConfidence;
  children: FittingHardpoint[];
};

export type FittingLoadoutEntry = {
  portId: string;
  componentId: string | null;
  status: "resolved" | "unresolved" | "empty" | "locked" | "unknown";
  confidence: FittingConfidence;
};

export type FittingCalculationCategory = {
  available: boolean;
  confidence: FittingConfidence;
  unavailableReason: string | null;
  derived: Record<string, string | number | boolean | null>;
};

export type FittingCalculation = {
  shipId: string;
  scope: "stock_default_loadout";
  resolutionStatus: string;
  componentCountsByType: Record<string, number>;
  categories: Partial<Record<"power" | "cooling" | "shields" | "weapons" | "quantum" | "radar" | "performance", FittingCalculationCategory>>;
  warnings: string[];
};

export type FittingValidationResult = {
  valid: boolean;
  shipId: string;
  portsChecked: number;
  missingRequiredPorts: string[];
  emptyOptionalPorts: string[];
  incompatibleItems: Array<{ portId: string; componentId: string; reason: string; confidence: FittingConfidence }>;
  lockedBespokePorts: string[];
  unknownItemIds: Array<{ portId: string; componentId: string }>;
  unknownPortIds: string[];
  mismatchReasons: Array<{ portId: string; componentId: string; kind: string; message: string; confidence: FittingConfidence }>;
  confidence: FittingConfidence;
  unresolvedReferences: Array<{ kind: string; message: string; confidence: FittingConfidence }>;
};

export type FittingCalculateResult = {
  shipId: string;
  scope: "custom_loadout";
  resolutionStatus: string;
  componentCountsByType: Record<string, number>;
  categories: FittingCalculation["categories"];
  summary: {
    firepower: { weaponAlphaTotal: number | null; weaponDpsTotal: number | null; weaponCount: number; confidence: FittingConfidence; inferred: boolean };
    shields: { totalShieldHP: number | null; totalRegenRate: number | null; confidence: FittingConfidence; inferred: boolean };
    power: { produced: number | null; required: number | null; margin: number | null; confidence: FittingConfidence; inferred: boolean };
    cooling: { produced: number | null; required: number | null; margin: number | null; confidence: FittingConfidence; inferred: boolean };
    quantum: { componentCount: number; confidence: FittingConfidence; inferred: boolean };
    radar: { componentCount: number; maxSignatureSensitivity: number | null; confidence: FittingConfidence; inferred: boolean };
  };
  warnings: string[];
  confidence: FittingConfidence;
  unresolvedReferences: Array<{ kind: string; message: string; confidence: FittingConfidence }>;
  missingStats: Array<{ portId: string; componentId: string; fields: string[]; confidence: FittingConfidence }>;
  unknownItemIds: string[];
  stockComparison?: Record<string, unknown>;
};

export type FittingLoadoutRequest = {
  shipId: string;
  loadout: Record<string, string | null>;
  options?: { compareToStock?: boolean };
};

async function writeJson<T>(path: string, payload: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(apiUrl(path), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });
  if (!response.ok) {
    const problem = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(problem?.detail ?? `Fitting API request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function validateFittingLoadout(request: FittingLoadoutRequest, signal?: AbortSignal): Promise<FittingValidationResult> {
  return (await writeJson<DetailResponse<FittingValidationResult>>("/api/v1/fitting/validate", request, signal)).data;
}

export async function calculateFittingLoadout(request: FittingLoadoutRequest, signal?: AbortSignal): Promise<FittingCalculateResult> {
  return (await writeJson<DetailResponse<FittingCalculateResult>>("/api/v1/fitting/calculate", request, signal)).data;
}

async function readResponse<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(apiUrl(path), { signal });
  if (!response.ok) throw new Error(`Fitting API request failed: ${response.status}`);
  return response.json() as Promise<T>;
}

async function readAllPages<T>(path: string, signal?: AbortSignal): Promise<T[]> {
  const records: T[] = [];
  let cursor: string | null = null;
  for (let pageNumber = 0; pageNumber < 100; pageNumber += 1) {
    const separator = path.includes("?") ? "&" : "?";
    const cursorQuery: string = cursor ? `&cursor=${encodeURIComponent(cursor)}` : "";
    const response: ListResponse<T> = await readResponse<ListResponse<T>>(`${path}${separator}limit=200${cursorQuery}`, signal);
    records.push(...response.data);
    cursor = response.page.nextCursor;
    if (!cursor) return records;
  }
  throw new Error("Fitting API pagination exceeded the safety limit.");
}

export function listFittingShips(signal?: AbortSignal): Promise<FittingShipSummary[]> {
  return readAllPages<FittingShipSummary>("/api/v1/fitting/ships", signal);
}

export function listFittingComponents(signal?: AbortSignal): Promise<FittingComponentSummary[]> {
  return readAllPages<FittingComponentSummary>("/api/v1/fitting/components", signal);
}

export async function getFittingShip(shipId: string, signal?: AbortSignal): Promise<FittingShipDetail> {
  return (await readResponse<DetailResponse<FittingShipDetail>>(`/api/v1/fitting/ships/${encodeURIComponent(shipId)}`, signal)).data;
}

export async function getFittingHardpoints(shipId: string, signal?: AbortSignal): Promise<FittingHardpoint[]> {
  const response = await readResponse<DetailResponse<{ shipId: string; format: "flat"; ports: FittingHardpoint[] }>>(
    `/api/v1/fitting/ships/${encodeURIComponent(shipId)}/hardpoints?format=flat`,
    signal,
  );
  return response.data.ports;
}

export async function getFittingLoadout(shipId: string, signal?: AbortSignal): Promise<FittingLoadoutEntry[]> {
  const response = await readResponse<DetailResponse<{ shipId: string; scope: "stock_default_loadout"; entries: FittingLoadoutEntry[] }>>(
    `/api/v1/fitting/ships/${encodeURIComponent(shipId)}/loadout`,
    signal,
  );
  return response.data.entries;
}

export async function getFittingCalculations(shipId: string, signal?: AbortSignal): Promise<FittingCalculation> {
  return (await readResponse<DetailResponse<FittingCalculation>>(
    `/api/v1/fitting/ships/${encodeURIComponent(shipId)}/calculations`,
    signal,
  )).data;
}

export type FittingComponentDetail = FittingComponentSummary & {
  stats: Record<string, number | null>;
};

export async function getFittingComponent(componentId: string, signal?: AbortSignal): Promise<FittingComponentDetail> {
  return (await readResponse<DetailResponse<FittingComponentDetail>>(
    `/api/v1/fitting/components/${encodeURIComponent(componentId)}`,
    signal,
  )).data;
}
