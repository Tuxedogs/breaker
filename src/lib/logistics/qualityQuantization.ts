// src/lib/logistics/qualityQuantization.ts
import qualityQuantizationRecords from "../../data/quality_quantization.json";

export type QualityBand = {
  start: number;
  end: number;
  mappedValue: number;
};

export type QualityQuantizationRecord = {
  guid: string;
  recordName: string;
  recordType: string;
  path: string;
  bands: QualityBand[];
};

const records = qualityQuantizationRecords as QualityQuantizationRecord[];

function normalizeMaterialName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(ore\)|\(raw\)/gi, "")
    .replace(/[^a-z0-9]/g, "");
}

export function getQualityBandsForMaterial(materialName: string): QualityBand[] | null {
  const normalized = normalizeMaterialName(materialName);

  const record = records.find((entry) => {
    const recordMaterial = entry.recordName.replace(/^Quantization_/i, "");
    return normalizeMaterialName(recordMaterial) === normalized;
  });

  return record?.bands ?? null;
}

export function resolveQuantizedQuality(materialName: string, observedQuality: number) {
  const bands = getQualityBandsForMaterial(materialName);

  if (!bands) {
    return {
      observed: observedQuality,
      mapped: observedQuality,
      bandStart: null,
      bandEnd: null,
      quantized: false,
      needsReview: true,
    };
  }

  const directBand = bands.find(
    (band) => observedQuality >= band.start && observedQuality <= band.end
  );

  if (directBand) {
    return {
      observed: observedQuality,
      mapped: directBand.mappedValue,
      bandStart: directBand.start,
      bandEnd: directBand.end,
      quantized: true,
      needsReview: observedQuality !== directBand.mappedValue,
    };
  }

  return {
    observed: observedQuality,
    mapped: observedQuality,
    bandStart: null,
    bandEnd: null,
    quantized: false,
    needsReview: true,
  };
}