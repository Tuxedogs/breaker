import type { FittingCalculateResult } from "../../../lib/fitting/fittingApi";
import { formatNumber, formatSigned } from "../../../lib/fitting/fittingPortGrouping";

export function derivedNum(result: FittingCalculateResult | null, category: string, key: string): number | null {
  const categoryData = result?.categories?.[category as keyof NonNullable<FittingCalculateResult["categories"]>];
  const value = categoryData?.derived?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function extractedNum(result: FittingCalculateResult | null, category: string, key: string): number | null {
  const categoryData = result?.categories?.[category as keyof NonNullable<FittingCalculateResult["categories"]>];
  const extracted = categoryData?.extracted;
  if (!extracted || typeof extracted !== "object") return null;
  const value = (extracted as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function alphaLabel(value: number | null | undefined, loading = false): string {
  if (loading) return "...";
  if (typeof value === "number" && Number.isFinite(value)) return formatNumber(value);
  return "Not calculated yet";
}

export function valueOrUnavailable(value: number | null, unit = ""): string {
  if (value == null) return "Not calculated yet";
  return `${formatNumber(value)}${unit}`;
}

export { formatSigned };
