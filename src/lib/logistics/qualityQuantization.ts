import { getQualityQuantizationFromApi } from "../craftingReferenceApi";

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

let records: QualityQuantizationRecord[] = [];
let loadPromise: Promise<QualityQuantizationRecord[]> | null = null;

export async function loadQualityQuantizationRecords(): Promise<QualityQuantizationRecord[]> {
  loadPromise ??= getQualityQuantizationFromApi()
    .then((loadedRecords) => {
      records = loadedRecords;
      return records;
    });
  return loadPromise;
}

export function primeQualityQuantizationRecords(loadedRecords: QualityQuantizationRecord[]): void {
  records = loadedRecords;
  loadPromise = Promise.resolve(records);
}

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
