import type { FittingCalculateResult } from "./fittingApi";

type FittedComponentEntry = {
  stats?: Record<string, number | null>;
};

function categoryExtracted(
  result: FittingCalculateResult | null,
  category: string,
): Record<string, unknown> | null {
  const categoryData = result?.categories?.[category as keyof NonNullable<FittingCalculateResult["categories"]>];
  const extracted = categoryData?.extracted;
  return extracted && typeof extracted === "object" ? extracted as Record<string, unknown> : null;
}

export function fittedComponentStats(
  result: FittingCalculateResult | null,
  category: string,
): FittedComponentEntry[] {
  const extracted = categoryExtracted(result, category);
  const components = extracted?.components;
  if (!Array.isArray(components)) return [];
  return components.filter((entry): entry is FittedComponentEntry => !!entry && typeof entry === "object");
}

export function maxStatFromFitted(
  result: FittingCalculateResult | null,
  category: string,
  statKey: string,
): number | null {
  const values = fittedComponentStats(result, category)
    .map((entry) => entry.stats?.[statKey])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (values.length === 0) return null;
  return Math.max(...values);
}

export function firstStatFromFitted(
  result: FittingCalculateResult | null,
  category: string,
  statKey: string,
): number | null {
  for (const entry of fittedComponentStats(result, category)) {
    const value = entry.stats?.[statKey];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}
