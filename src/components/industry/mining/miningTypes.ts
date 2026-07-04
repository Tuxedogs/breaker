import type { MiningCoverageMode } from "../../../features/mining/coveragePlan";
import type { RecommendationResponse } from "../../../features/mining/recommenderAdapter";
import type { QueueLedgerLine } from "../../../lib/logistics/queueLedger";

export type MiningRankingMode = "quality" | "quantity" | "balanced";
export type MiningQueueScope = "all-shortfalls" | "critical-missing" | "refinable-only" | "partial-stock";
export type MiningEncounterTier = "Low" | "Medium" | "High" | "Unknown";

export type MiningSidebarState = {
  buildQueueActive: boolean;
  systems: string[];
  miningTypes: string[];
  encounterTiers?: MiningEncounterTier[];
  resources: string[];
};

export const EMPTY_MINING_SIDEBAR_STATE: MiningSidebarState = {
  buildQueueActive: false,
  systems: [],
  miningTypes: [],
  encounterTiers: [],
  resources: [],
};

export const MINING_FILTER_STORAGE_KEY = "scintel:mining:msb-sidebar:v1";
export const MINING_RANKING_MODE_STORAGE_KEY = "scintel:mining:ranking-mode:v1";
export const MINING_COVERAGE_MODE_STORAGE_KEY = "scintel:mining:coverage-mode:v1";
export const MINING_QUEUE_SCOPE_STORAGE_KEY = "scintel:mining:queue-scope:v1";
export const MINING_QUEUE_FOCUS_STORAGE_KEY = "scintel:mining:queue-focus:v1";

export const MINING_COVERAGE_MODES: Array<{ value: MiningCoverageMode; label: string }> = [
  { value: "complete-set", label: "Complete Set" },
  { value: "best-single", label: "Best Single" },
  { value: "rare-first", label: "Rare First" },
  { value: "quality-hunt", label: "Quality Hunt" },
];
export const MINING_QUEUE_SCOPES: Array<{ value: MiningQueueScope; label: string }> = [
  { value: "all-shortfalls", label: "All Shortfalls" },
  { value: "critical-missing", label: "No Stock" },
  { value: "refinable-only", label: "Refinable" },
  { value: "partial-stock", label: "Partial Stock" },
];
export const MINING_SYSTEM_FILTERS = ["Stanton", "Nyx", "Pyro"];
export const MINING_METHOD_FILTERS = [
  { value: "Hand", label: "Hand" },
  { value: "Ship", label: "Surface Ship" },
  { value: "Ground Vehicle", label: "Vehicle" },
];
export const MINING_ENCOUNTER_TIER_FILTERS: MiningEncounterTier[] = ["Low", "Medium", "High"];

export type LoadState =
  | { status: "loading"; data?: RecommendationResponse }
  | { status: "loaded"; data: RecommendationResponse }
  | { status: "error"; message: string; data?: RecommendationResponse };

export type QualityDisplay =
  | { kind: "ignored" }
  | { kind: "none" }
  | { kind: "chance"; label: string };

export type DemandRow = {
  name: string;
  key: string;
  miningType: string;
  coverage: string;
  targetQualityChanceLabel: string;
  quality900Label: string;
  densityLabel: string;
  compositionLabel: string;
  sourceStrength: string;
  sourceWeight: number | undefined;
  status: "strong" | "moderate" | "low" | "missing";
};

export type ResourceRow = {
  name: string;
  key: string;
  miningType: string;
  qualityLabel: string;
  quality900Label: string;
  densityLabel: string;
  compositionLabel: string;
  sourceStrength: string;
  sourceWeight: number | undefined;
  sourceTitle?: string;
  status: "strong" | "moderate" | "low" | "none";
};

export function queueScopeMatches(line: QueueLedgerLine, scope: MiningQueueScope): boolean {
  if (scope === "all-shortfalls") return true;
  if (scope === "critical-missing") return line.totalAvailableEquivalent <= 0;
  if (scope === "refinable-only") return line.isRefinable && line.rawOreNeeded > 0;
  if (scope === "partial-stock") return line.totalAvailableEquivalent > 0 && line.netMissingRefined > 0;
  return true;
}

export function readStoredSidebarState<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeStoredSidebarState<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export function readStoredRankingMode(): MiningRankingMode {
  try {
    const raw = localStorage.getItem(MINING_RANKING_MODE_STORAGE_KEY);
    return raw === "quantity" || raw === "balanced" || raw === "quality" ? raw : "quality";
  } catch {
    return "quality";
  }
}

export function readStoredCoverageMode(): MiningCoverageMode {
  try {
    const raw = localStorage.getItem(MINING_COVERAGE_MODE_STORAGE_KEY);
    return raw === "best-single" || raw === "rare-first" || raw === "quality-hunt" || raw === "complete-set"
      ? raw
      : "complete-set";
  } catch {
    return "complete-set";
  }
}

export function readStoredQueueScope(): MiningQueueScope {
  try {
    const raw = localStorage.getItem(MINING_QUEUE_SCOPE_STORAGE_KEY);
    return raw === "critical-missing" || raw === "refinable-only" || raw === "partial-stock" || raw === "all-shortfalls"
      ? raw
      : "all-shortfalls";
  } catch {
    return "all-shortfalls";
  }
}

export function readStoredQueueFocus(): string {
  try {
    return localStorage.getItem(MINING_QUEUE_FOCUS_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}
