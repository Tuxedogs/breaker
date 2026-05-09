import type { RarityTier } from "../../../../types/logistics";

export type QualityBand = {
  start: string | number;
  end: string | number;
  mappedValue: string | number;
};

export const DEFAULT_BAND_INDEX = 1;

export const FALLBACK_QUALITY_BANDS: QualityBand[] = [
  { start: "0", end: "399", mappedValue: "346" },
  { start: "400", end: "599", mappedValue: "500" },
  { start: "600", end: "699", mappedValue: "650" },
  { start: "700", end: "799", mappedValue: "750" },
  { start: "800", end: "899", mappedValue: "850" },
  { start: "900", end: "949", mappedValue: "925" },
  { start: "950", end: "998", mappedValue: "975" },
  { start: "999", end: "1000", mappedValue: "1000" },
];

export function clampQuality(value: number): number {
  if (!Number.isFinite(value)) return 500;
  return Math.max(0, Math.min(1000, Math.round(value)));
}

export function clampBandIndex(value: number, bands: QualityBand[]): number {
  const max = Math.max(0, bands.length - 1);
  if (!Number.isFinite(value)) return DEFAULT_BAND_INDEX;
  return Math.max(0, Math.min(max, Math.round(value)));
}

export function getBandEffectiveQuality(bands: QualityBand[], bandIndex: number): number {
  const safeIndex = clampBandIndex(bandIndex, bands);
  return clampQuality(Number(bands[safeIndex]?.mappedValue ?? 500));
}

export function rarityFromBandIndex(bandNumber: number | null | undefined): Extract<RarityTier, "common" | "rare" | "epic" | "legendary"> {
  if (!Number.isFinite(bandNumber)) return "common";
  const band = Math.trunc(Number(bandNumber));
  if (band >= 7 && band <= 8) return "legendary";
  if (band >= 5 && band <= 6) return "epic";
  if (band >= 3 && band <= 4) return "rare";
  if (band >= 1 && band <= 2) return "common";
  return "common";
}

export function rarityClassFromBandIndex(bandNumber: number | null | undefined): string {
  return `craft-value-tier--${rarityFromBandIndex(bandNumber)}`;
}

export function findNearestBandForQuality(bands: QualityBand[], value: number): number {
  if (bands.length === 0) return DEFAULT_BAND_INDEX;
  const quality = clampQuality(value);
  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (let i = 0; i < bands.length; i += 1) {
    const mappedValue = clampQuality(Number(bands[i]?.mappedValue ?? 0));
    const distance = Math.abs(mappedValue - quality);
    if (distance < nearestDistance) {
      nearestIndex = i;
      nearestDistance = distance;
    }
  }

  return nearestIndex;
}
