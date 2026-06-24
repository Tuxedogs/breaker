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
