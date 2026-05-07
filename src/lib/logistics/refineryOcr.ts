import { createWorker, PSM } from "tesseract.js";
import type { MaterialTemplate } from "../../types/logistics";

interface QualityQuantizationBand {
  start: number;
  end: number;
  mappedValue: number;
}

interface QualityQuantizationRecord {
  guid: string;
  recordName: string;
  recordType: string;
  path: string;
  bands: QualityQuantizationBand[];
}

const QUALITY_QUANTIZATION_URL_CANDIDATES = [
  "/api/crafting/quality_quantization",
  "/api/crafting/quality_quantization.json",
];


// ── Shared types ────────────────────────────────────────────────────────────

export type RefineryScreenType =
  | "refinery_complete"
  | "refinery_input"
  | "unknown";

export interface ParsedRefineryRow {
  rawName: string;
  materialId: string | null;
  /** Final quality used by inventory. This should be a quantized mappedValue when available. */
  quality: number;
  /** OCR/visible quality before quantization validation or snapping. */
  qualityObserved?: number;
  /** Material-specific quantized mappedValue from qualityQuantizationRecords. */
  qualityMapped?: number;
  qualityBandStart?: number;
  qualityBandEnd?: number;
  qualityQuantized?: boolean;
  qualityNeedsReview?: boolean;
  /** Vertical center of the OCR row inside the cropped panel, 0..1. Used only for review UI alignment. */
  rowYRatio?: number;
  quantity: number;
  needsReview: boolean;
}

// Internal-only parse row. The UI/API still receives ParsedRefineryRow.
type ParsedRefineryRowWithY = ParsedRefineryRow & { y?: number };

function stripMaterialNoise(input: string): string {
  return input
    .replace(/^\/\/\s*/, "")
    .replace(/^[^A-Za-z]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

export interface ParsedWorkOrder {
  workOrderNumber: number;
  rows: ParsedRefineryRow[];
  totalYieldCscu: number | null;
  /** Best-effort OCR from the full screenshot header, e.g. ORBITUARY. */
  sourceLocationName?: string | null;
}

export interface ParsedInputRow {
  rawName: string;
  rawType: "RAW" | "ORE" | null;
  materialId: string | null;
  /** Final quality used by inventory. This should be a quantized mappedValue when available. */
  quality: number;
  /** OCR/visible quality before quantization validation or snapping. */
  qualityObserved?: number;
  /** Material-specific quantized mappedValue from qualityQuantizationRecords. */
  qualityMapped?: number;
  qualityBandStart?: number;
  qualityBandEnd?: number;
  qualityQuantized?: boolean;
  qualityNeedsReview?: boolean;
  qtyCscu: number;
  yieldCscu: number | null;
  selectedForRefine: boolean;
}

export interface ParsedInputResult {
  rows: ParsedInputRow[];
  rawText: string;
}

export type RefineryParseResult =
  | { screenType: "refinery_complete"; workOrders: ParsedWorkOrder[] }
  | { screenType: "refinery_input"; data: ParsedInputResult }
  | { screenType: "unknown"; rawText: string };

// ── Alias tables ─────────────────────────────────────────────────────────────

const MATERIAL_ALIASES: Record<string, string> = {
  aluminum: "aluminum",
  aluminium: "aluminum",
  beryl: "beryl",
  diamond: "diamond",
  quartz: "quartz",
  silicon: "silicon",
  silicn: "silicon",
  sillcon: "silicon",
  "silic on": "silicon",
  "silicon ore": "silicon",
  beradom: "beradom",
  carinite: "carinite",
  glacosite: "glacosite",
  janalite: "janalite",
  lindinium: "lindinium",
  ouratite: "ouratite",
  sadaryx: "sadaryx",
  saldynium: "saldynium",
  taranite: "taranite",
  riccite: "riccite",
  hadanite: "hadanite",
  aphorite: "aphorite",
  dolivine: "dolivine",

  "stileron ore": "stileron-ore",
  "riccite ore": "riccite",
  "taranite ore": "taranite",
  "quartz ore": "quartz",
  "beryl ore": "beryl",
  "diamond ore": "diamond",
  "aluminum ore": "aluminum",
  "aluminium ore": "aluminum",

  rmc: "rmc",
  "recycled material composite": "rmc",
  "construction materials": "construction-materials",
  "construction material": "construction-materials",

  laranite: "laranite",
  larantte: "laranite",
  borase: "borase",
  feynmaline: "feynmaline",
  tungsten: "tungsten",
  savrilium: "savrilium",
  quantanium: "quantanium",
  quantainium: "quantanium",
  stileron: "stileron",
  "copper ore": "copper-ore",
  copper: "copper-ore",
  titanium: "titanium",
  gold: "gold",
  agricium: "agricium",
  agrictum: "agricium",
  aslarite: "aslarite",
  bexalite: "bexalite",
  corundum: "corundum",
  hephaestanite: "hephaestanite",
  iron: "iron",
  torite: "torite",
  "pressurized ice": "pressurized-ice",
};

const INPUT_MATERIAL_ALIASES: Record<string, string> = {
  aluminum: "aluminum",
  aluminium: "aluminum",
  "aluminum ore": "aluminum",
  "aluminium ore": "aluminum",

  beryl: "beryl",
  "beryl ore": "beryl",

  diamond: "diamond",
  "diamond ore": "diamond",

  silicon: "silicon",
  silicn: "silicon",
  sillcon: "silicon",
  "silic on": "silicon",
  "silicon raw": "silicon",
  "silicon ore": "silicon",

  hadanite: "hadanite",
  aphorite: "aphorite",
  dolivine: "dolivine",

  rmc: "rmc",
  "recycled material composite": "rmc",

  "construction material": "construction-materials",
  "construction materials": "construction-materials",

  "stileron ore": "stileron-ore",
  stileron: "stileron-ore",
  quartz: "quartz",
  "quartz raw": "quartz",
  taranite: "taranite",
  "taranite raw": "taranite",
  riccite: "riccite",
  "riccite ore": "riccite",
  laranite: "laranite",
  "laranite ore": "laranite",
  borase: "borase",
  "borase ore": "borase",
  "copper ore": "copper-ore",
  copper: "copper-ore",
  "titanium ore": "titanium",
  titanium: "titanium",
  corundum: "corundum",
  "corundum raw": "corundum",
  bexalite: "bexalite",
  "bexalite raw": "bexalite",
  gold: "gold",
  "gold ore": "gold",
  agricium: "agricium",
  "agricium raw": "agricium",
  aslarite: "aslarite",
  "aslarite raw": "aslarite",
  iron: "iron",
  "iron ore": "iron",
};

const SKIP_LINES = new Set([
  "quality",
  "yield",
  "material",
  "cscu",
  "scu",
  "details",
  "results",
  "completed",
  "collect",
  "refinement",
  "center",
  "profile",
  "selection",
  "selected",
  "yielded",
]);

const JUNK_NAMES = new Set([
  "WORK",
  "ORDER",
  "REFINERY",
  "STATION",
  "USER",
  "FUNDS",
  "MODULE",
  "RESULTS",
  "DETAILS",
  "YIELD",
  "QUALITY",
  "MATERIAL",
  "COLLECT",
  "CURRENT",
  "CAPACITY",
  "SETUP",
  "COMPLETED",
  "REFINEMENT",
  "CENTER",
  "PROFILE",
  "SELECTION",
  "SELECTED",
  "YIELDED",
  "SECURE",
  "CONFIGURATION",
  "SELECT",
  "STORAGE",
  "OPTION",
]);

// ── Normalization ────────────────────────────────────────────────────────────

function cleanText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[()]/g, "")
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isRawIceOnlyName(input: string | null | undefined): boolean {
  const key = cleanText(input ?? "").replace(/\s+/g, "");
  return key === "ice" || key === "rawice";
}

function isPressurizedIceName(input: string | null | undefined): boolean {
  return /pressurized\s+ice/i.test(input ?? "");
}

// ── Quality quantization ────────────────────────────────────────────────────

interface ResolvedQualityQuantization {
  quality: number;
  qualityObserved: number;
  qualityMapped?: number;
  qualityBandStart?: number;
  qualityBandEnd?: number;
  qualityQuantized: boolean;
  qualityNeedsReview: boolean;
}

function normalizeQuantizationKey(input: string | null | undefined): string {
  if (!input) return "";

  return cleanText(input)
    .replace(/^quantization\s+/, "")
    .replace(/\b(raw|ore)\b/g, "")
    .replace(/\s+/g, "")
    .trim();
}

const QUANTIZATION_KEY_ALIASES: Record<string, string> = {
  aluminium: "aluminum",
  quantanium: "quantainium",
  quantainium: "quantainium",
  pressurizedice: "rawice",
  rawice: "rawice",
  recycledmaterialcomposite: "rmc",
  constructionmaterial: "constructionmaterials",
  constructionmaterials: "constructionmaterials",
  copperore: "copper",
  stileronore: "stileron",
};

function canonicalQuantizationKey(input: string | null | undefined): string {
  const key = normalizeQuantizationKey(input);
  return QUANTIZATION_KEY_ALIASES[key] ?? key;
}

let QUALITY_QUANTIZATION_BY_KEY = new Map<string, QualityQuantizationRecord>();
let qualityQuantizationLoadPromise: Promise<void> | null = null;

function buildQualityQuantizationMap(records: QualityQuantizationRecord[]): Map<string, QualityQuantizationRecord> {
  const map = new Map<string, QualityQuantizationRecord>();

  for (const record of records) {
    const recordKey = canonicalQuantizationKey(record.recordName);
    const pathKey = canonicalQuantizationKey(record.path.split("/").pop()?.replace(/\.xml$/i, ""));

    if (recordKey) map.set(recordKey, record);
    if (pathKey) map.set(pathKey, record);
  }

  return map;
}

async function ensureQualityQuantizationLoaded(): Promise<void> {
  if (QUALITY_QUANTIZATION_BY_KEY.size > 0) return;

  if (!qualityQuantizationLoadPromise) {
    qualityQuantizationLoadPromise = (async () => {
      for (const url of QUALITY_QUANTIZATION_URL_CANDIDATES) {
        try {
          const response = await fetch(url, { cache: "force-cache" });
          if (!response.ok) continue;

          const records = (await response.json()) as QualityQuantizationRecord[];
          if (!Array.isArray(records)) continue;

          QUALITY_QUANTIZATION_BY_KEY = buildQualityQuantizationMap(records);
          return;
        } catch {
          // Try the next candidate path. If all fail, parsing still works but
          // quality values are marked for review instead of being quantized.
        }
      }
    })();
  }

  await qualityQuantizationLoadPromise;
}

function getQualityQuantizationRecord(materialId: string | null, rawName: string) {
  const candidates = [materialId, rawName, getKnownMaterialAliasId(rawName)]
    .map((value) => canonicalQuantizationKey(value))
    .filter(Boolean);

  for (const candidate of candidates) {
    const record = QUALITY_QUANTIZATION_BY_KEY.get(candidate);
    if (record) return record;
  }

  return null;
}

function isQuantizedQualityForMaterial(materialId: string | null, rawName: string, value: number): boolean {
  const record = getQualityQuantizationRecord(materialId, rawName);
  if (!record) return value >= 100 && value <= 1000;
  return record.bands.some((band) => band.mappedValue === value);
}

function isPlausibleObservedQualityForMaterial(materialId: string | null, rawName: string, value: number): boolean {
  const record = getQualityQuantizationRecord(materialId, rawName);
  if (!record) return value >= 100 && value <= 1000;

  if (record.bands.some((band) => band.mappedValue === value)) return true;

  const nearest = record.bands.reduce((best, band) => {
    const distance = Math.abs(band.mappedValue - value);
    const bestDistance = Math.abs(best.mappedValue - value);
    return distance < bestDistance ? band : best;
  }, record.bands[0]);

  const snapDistance = value >= 900 ? 8 : 5;
  return Math.abs(nearest.mappedValue - value) <= snapDistance;
}

function pickProcessingQualityYield(
  materialId: string | null,
  rawName: string,
  numbers: number[],
): { quality: number; quantity: number } | null {
  let best: { quality: number; quantity: number; score: number } | null = null;

  for (let idx = 0; idx < numbers.length - 1; idx++) {
    const quality = numbers[idx];
    const quantity = numbers[idx + 1];

    if (!Number.isFinite(quality) || !Number.isFinite(quantity)) continue;
    if (quality < 0 || quality > 1000) continue;
    if (quantity <= 0) continue;
    if (!isPlausibleObservedQualityForMaterial(materialId, rawName, quality)) continue;

    let score = 0;
    if (isQuantizedQualityForMaterial(materialId, rawName, quality)) score += 1000;
    if (quality >= 100) score += 100;
    if (quality < 20) score -= 300;
    if (quantity <= 10000) score += 20;
    if (idx === 0) score += 5;

    // Processing rows are usually QUALITY | YIELD | TO DO | DONE. If there are
    // more numbers after the pair, the selected pair is more plausible when the
    // following values can be todo/done metadata.
    if (numbers.length >= idx + 4) score += 15;

    if (!best || score > best.score) best = { quality, quantity, score };
  }

  if (!best) return null;

  // Do not accept nonsense like quality 8 / yield 0 or quality 7 / yield 522.
  // If a quantization record exists, the quality should be a mapped value unless
  // OCR only missed by a tiny amount and the quantization pass can flag it.
  if (best.quality < 100 && !isQuantizedQualityForMaterial(materialId, rawName, best.quality)) {
    return null;
  }

  return { quality: best.quality, quantity: best.quantity };
}

function resolveQualityQuantization(
  materialId: string | null,
  rawName: string,
  observedQuality: number,
): ResolvedQualityQuantization {
  const record = getQualityQuantizationRecord(materialId, rawName);

  if (!record) {
    return {
      quality: observedQuality,
      qualityObserved: observedQuality,
      qualityQuantized: false,
      qualityNeedsReview: false,
    };
  }

  const exactMappedBand = record.bands.find((band) => band.mappedValue === observedQuality);
  if (exactMappedBand) {
    return {
      quality: exactMappedBand.mappedValue,
      qualityObserved: observedQuality,
      qualityMapped: exactMappedBand.mappedValue,
      qualityBandStart: exactMappedBand.start,
      qualityBandEnd: exactMappedBand.end,
      qualityQuantized: true,
      qualityNeedsReview: false,
    };
  }

  const nearestMappedBand = record.bands.reduce((best, band) => {
    const distance = Math.abs(band.mappedValue - observedQuality);
    const bestDistance = Math.abs(best.mappedValue - observedQuality);
    return distance < bestDistance ? band : best;
  }, record.bands[0]);

  // OCR can read 710 as 71O, 522 as 523, etc. Snap only very close values.
  // Do not turn nonsense like 7 into Quartz 522; that should remain reviewable.
  const SNAP_DISTANCE = observedQuality >= 900 ? 8 : 5;
  if (Math.abs(nearestMappedBand.mappedValue - observedQuality) <= SNAP_DISTANCE) {
    return {
      quality: nearestMappedBand.mappedValue,
      qualityObserved: observedQuality,
      qualityMapped: nearestMappedBand.mappedValue,
      qualityBandStart: nearestMappedBand.start,
      qualityBandEnd: nearestMappedBand.end,
      qualityQuantized: true,
      qualityNeedsReview: true,
    };
  }

  return {
    quality: observedQuality,
    qualityObserved: observedQuality,
    qualityBandStart: nearestMappedBand.start,
    qualityBandEnd: nearestMappedBand.end,
    qualityMapped: nearestMappedBand.mappedValue,
    qualityQuantized: false,
    qualityNeedsReview: true,
  };
}

function isRejectedRefineryRow(row: Pick<ParsedRefineryRow, "rawName" | "materialId">): boolean {
  return (isRawIceOnlyName(row.rawName) || isRawIceOnlyName(row.materialId)) && !isPressurizedIceName(row.rawName);
}

function applyQualityQuantizationToRow<T extends { rawName: string; materialId: string | null; quality: number; needsReview?: boolean }>(
  row: T,
): T & Pick<ParsedRefineryRow, "qualityObserved" | "qualityMapped" | "qualityBandStart" | "qualityBandEnd" | "qualityQuantized" | "qualityNeedsReview"> {
  const resolved = resolveQualityQuantization(row.materialId, row.rawName, row.quality);

  return {
    ...row,
    quality: resolved.quality,
    qualityObserved: resolved.qualityObserved,
    qualityMapped: resolved.qualityMapped,
    qualityBandStart: resolved.qualityBandStart,
    qualityBandEnd: resolved.qualityBandEnd,
    qualityQuantized: resolved.qualityQuantized,
    qualityNeedsReview: resolved.qualityNeedsReview,
    needsReview: Boolean(row.needsReview || resolved.qualityNeedsReview),
  };
}

// ── Levenshtein distance ─────────────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  const n = b.length;
  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j);

  for (let i = 1; i <= a.length; i++) {
    let prev = i - 1;
    dp[0] = i;

    for (let j = 1; j <= n; j++) {
      const oldDp = dp[j];
      dp[j] =
        a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = oldDp;
    }
  }

  return dp[n];
}

// ── Screen detection ─────────────────────────────────────────────────────────

export function detectScreenType(text: string): RefineryScreenType {
  if (/MATERIALS\s+YIELDED/i.test(text)) return "refinery_complete";
  if (/MATERIALS\s+SELECTED/i.test(text)) return "refinery_input";
  if (/\bCOMPLETED\b/i.test(text) && /\bYIELD\b/i.test(text))
    return "refinery_complete";
  if (
    /\bSELECTED\b/i.test(text) &&
    /\bQTY\b/i.test(text) &&
    /\bREFINE\b/i.test(text)
  )
    return "refinery_input";
  return "unknown";
}

export function normalizeMaterialName(
  rawName: string,
  templates: MaterialTemplate[],
): string | null {
  const key = cleanText(rawName);

  // Processing/Complete refinery output should say PRESSURIZED ICE.
  // Standalone ICE/RAW ICE is pre-refine naming or OCR noise, so do not let
  // fuzzy matching promote it into a refinery import row.
  if (isRawIceOnlyName(rawName) && !isPressurizedIceName(rawName)) return null;

  const aliasId = MATERIAL_ALIASES[key];
  if (aliasId && templates.some((t) => t.id === aliasId)) return aliasId;

  const byName = templates.find((t) => cleanText(t.name) === key);
  if (byName) return byName.id;

  const partial = templates.find((t) => {
    const templateName = cleanText(t.name);
    return templateName.includes(key) || key.includes(templateName);
  });
  if (partial) return partial.id;

  const threshold = Math.max(2, Math.floor(key.length * 0.25));
  let bestId: string | null = null;
  let bestDist = Infinity;

  for (const t of templates) {
    const d = levenshtein(key, cleanText(t.name));
    if (d < bestDist) {
      bestDist = d;
      bestId = t.id;
    }
  }

  return bestDist <= threshold ? bestId : null;
}

function getKnownMaterialAliasId(rawName: string): string | null {
  const key = cleanText(rawName);
  if (isRawIceOnlyName(rawName) && !isPressurizedIceName(rawName)) return null;
  if (MATERIAL_ALIASES[key]) return MATERIAL_ALIASES[key];

  // OCR sometimes splits Silicon into "SILIC ON" or drops one letter. Keep this
  // fallback intentionally tiny so junk UI labels do not become material rows.
  const compact = key.replace(/\s+/g, "");
  if (compact === "silicon" || compact === "silicn" || compact === "sillcon") {
    return "silicon";
  }

  return null;
}

function resolveMaterialCandidate(
  rawName: string,
  templates: MaterialTemplate[],
): { materialId: string | null; isKnownMaterial: boolean } {
  if (isRawIceOnlyName(rawName) && !isPressurizedIceName(rawName)) {
    return { materialId: null, isKnownMaterial: false };
  }

  const materialId = normalizeMaterialName(rawName, templates);
  if (materialId) return { materialId, isKnownMaterial: true };

  const aliasId = getKnownMaterialAliasId(rawName);
  if (!aliasId) return { materialId: null, isKnownMaterial: false };

  // If the current material template set does not contain the recovered alias,
  // still surface the row for manual review instead of silently dropping it.
  return {
    materialId: templates.some((t) => t.id === aliasId) ? aliasId : null,
    isKnownMaterial: true,
  };
}

function normalizeInputMaterialName(
  rawName: string,
  rawType: "RAW" | "ORE" | null,
  templates: MaterialTemplate[],
): string | null {
  if (/^INERT\s+MATERIALS?$/i.test(rawName)) return null;

  const nameKey = cleanText(rawName);

  if (rawType) {
    const compound = cleanText(`${nameKey} ${rawType}`);
    const id = INPUT_MATERIAL_ALIASES[compound];
    if (id && templates.some((t) => t.id === id)) return id;
  }

  const aliasId = INPUT_MATERIAL_ALIASES[nameKey];
  if (aliasId && templates.some((t) => t.id === aliasId)) return aliasId;

  return normalizeMaterialName(rawName, templates);
}

// ── Image helpers ────────────────────────────────────────────────────────────

function getImageDimensions(file: File): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ w: img.naturalWidth, h: img.naturalHeight });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image load failed"));
    };

    img.src = url;
  });
}

function scaleImageForDetection(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const TARGET = 600;
      const scale = Math.min(1, TARGET / img.naturalWidth);

      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas 2D not available"));
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("toBlob failed"));
      }, "image/png");
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image load failed"));
    };

    img.src = url;
  });
}

export function preprocessImageRegion(
  file: File,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const SCALE = 2;
      const canvas = document.createElement("canvas");
      canvas.width = sw * SCALE;
      canvas.height = sh * SCALE;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas 2D not available"));
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.filter = "grayscale(100%) contrast(150%)";
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("toBlob failed"));
      }, "image/png");
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image load failed"));
    };

    img.src = url;
  });
}

// ── OCR helpers ──────────────────────────────────────────────────────────────

export interface PanelRegion {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

interface OcrWord {
  text: string;
  bbox: { x0: number; x1: number; y0?: number; y1?: number };
}

interface OcrLine {
  words?: OcrWord[] | null;
  text?: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

interface OcrParagraph {
  lines?: OcrLine[] | null;
}

interface OcrBlock {
  paragraphs?: OcrParagraph[] | null;
}

function getOcrLines(blocks: OcrBlock[] | null | undefined): OcrLine[] {
  return (blocks ?? []).flatMap((block) =>
    (block.paragraphs ?? []).flatMap((paragraph) => paragraph.lines ?? []),
  );
}

function getOcrWords(blocks: OcrBlock[] | null | undefined): OcrWord[] {
  return getOcrLines(blocks).flatMap((line) => line.words ?? []);
}

function inferPanelCountFromWidth(W: number): number {
  if (W >= 2200) return 4;
  if (W >= 1500) return 3;
  if (W >= 950) return 2;
  return 1;
}

function buildPanelRegions(
  _centers: number[],
  W: number,
  H: number,
): PanelRegion[] {
  const sy = Math.floor(H * 0.02);
  const sh = H - sy;

  // OCR can hallucinate/miss the COMPLETED headers, so use screenshot geometry.
  // Panels are laid out evenly left-to-right for complete work-order screens.
  const count = inferPanelCountFromWidth(W);

  return Array.from({ length: count }, (_, i) => {
    const sx = Math.round((W / count) * i);
    const nextX = i === count - 1 ? W : Math.round((W / count) * (i + 1));

    return {
      sx,
      sy,
      sw: nextX - sx,
      sh,
    };
  });
}

// ── Work-order helpers ───────────────────────────────────────────────────────

function extractWorkOrderNumber(text: string): number | null {
  const m = text.match(/WORK\s+ORDER\s+(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}

function getCompleteRowKey(row: ParsedRefineryRow): string {
  return `${row.materialId ?? cleanText(row.rawName)}|${row.quality}|${row.quantity}`;
}

function sortAndDeduplicateCompleteRows(
  rows: ParsedRefineryRowWithY[],
  processedPanelHeight?: number,
): ParsedRefineryRow[] {
  const seen = new Set<string>();

  return rows
    .map((row) => applyQualityQuantizationToRow(row))
    .filter((row) => row.quantity > 0 && row.quality >= 0 && row.quality <= 1000)
    .filter((row) => {
      const key = getCompleteRowKey(row);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => {
      const ay = typeof a.y === "number" ? a.y : Number.POSITIVE_INFINITY;
      const by = typeof b.y === "number" ? b.y : Number.POSITIVE_INFINITY;
      if (ay !== by) return ay - by;
      return a.quality - b.quality;
    })
    .map(({ y, ...row }) => {
      if (typeof y === "number" && processedPanelHeight && processedPanelHeight > 0) {
        return {
          ...row,
          rowYRatio: Math.max(0, Math.min(1, y / processedPanelHeight)),
        };
      }
      return row;
    });
}

function inferRowYFromNumbers(
  row: ParsedRefineryRow,
  ocrLines: OcrLine[],
): number | undefined {
  const nums = ocrLines
    .map((line) => ({
      line,
      value: parseOcrInteger(line.text ?? ""),
      y: (line.bbox.y0 + line.bbox.y1) / 2,
    }))
    .filter((n): n is { line: OcrLine; value: number; y: number } => n.value !== null);

  const qualityCells = nums.filter((n) => n.value === row.quality);
  const quantityCells = nums.filter((n) => n.value === row.quantity);

  let best: { y: number; distance: number } | null = null;

  for (const q of qualityCells) {
    for (const qty of quantityCells) {
      const dy = Math.abs(q.y - qty.y);

      if (qty.line.bbox.x0 <= q.line.bbox.x0) continue;
      if (dy > 70) continue;

      const distance = dy + Math.abs(q.line.bbox.x0 - qty.line.bbox.x0) * 0.01;
      const y = (q.y + qty.y) / 2;

      if (!best || distance < best.distance) {
        best = { y, distance };
      }
    }
  }

  return best?.y;
}


function cleanLocationCandidate(input: string): string | null {
  const text = cleanText(input)
    .replace(/^\/+\s*/, "")
    .replace(/\bREFINERY\b/gi, "")
    .replace(/\bSYSTEM\b/gi, "")
    .replace(/\bC\d+(?:\.\d+)?\b/gi, "")
    .trim();

  if (!text) return null;
  if (/^(user|funds|module|refinement|center|station|profile|material|yield)$/i.test(text)) return null;
  if (text.length < 3 || text.length > 32) return null;
  if (!/[a-z]/i.test(text)) return null;
  return text.toUpperCase();
}

async function extractSourceLocationName(
  worker: Awaited<ReturnType<typeof createWorker>>,
  imageFile: File,
  dims: { w: number; h: number },
): Promise<string | null> {
  try {
    const sx = 0;
    const sy = 0;
    const sw = Math.max(1, Math.floor(dims.w * 0.34));
    const sh = Math.max(1, Math.floor(dims.h * 0.12));
    const blob = await preprocessImageRegion(imageFile, sx, sy, sw, sh);
    const { data } = await worker.recognize(blob);
    const candidates = (data.text ?? "")
      .split("\n")
      .map(cleanLocationCandidate)
      .filter((value): value is string => Boolean(value));

    // Prefer the largest uppercase title-looking token. In refinery screens this is the station/location name.
    return candidates.sort((a, b) => b.length - a.length)[0] ?? null;
  } catch {
    return null;
  }
}

// ── Main export ──────────────────────────────────────────────────────────────

export async function parseRefineryScreenshot(
  imageFile: File,
  templates: MaterialTemplate[],
  onProgress?: (pct: number) => void,
  manualPanelRegions?: PanelRegion[],
): Promise<RefineryParseResult> {
  const dims = await getImageDimensions(imageFile);
  await ensureQualityQuantizationLoaded();

  const worker = await createWorker("eng", 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text" && onProgress) {
        onProgress(Math.round(m.progress * 100));
      }
    },
  });

  try {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });

    const detBlob = await scaleImageForDetection(imageFile);
    const { data: detData } = await worker.recognize(detBlob, undefined, {
      blocks: true,
    });
    const detText = detData.text;
    const sourceLocationName = await extractSourceLocationName(worker, imageFile, dims);

    if (/MATERIALS\s+SELECTED/i.test(detText)) {
      const sx = Math.floor(dims.w * 0.15);
      const sy = Math.floor(dims.h * 0.04);
      const sw = Math.floor(dims.w * 0.35);
      const sh = Math.floor(dims.h * 0.74);

      const panelBlob = await preprocessImageRegion(imageFile, sx, sy, sw, sh);
      const { data: pd } = await worker.recognize(panelBlob);

      return {
        screenType: "refinery_input",
        data: extractInputData(pd.text, templates),
      };
    }

    let panelRegions = manualPanelRegions?.filter((region) => region.sw > 0 && region.sh > 0) ?? [];

    if (panelRegions.length === 0) {
      const detScale = Math.min(1, 600 / dims.w);
      const words = getOcrWords(detData.blocks);

      const rawCenters = words
        .filter((w) => /^completed$/i.test(w.text.trim()))
        .map((w) => Math.round((w.bbox.x0 + w.bbox.x1) / 2 / detScale))
        .sort((a, b) => a - b);

      const centers = rawCenters.filter(
        (c, i, arr) => i === 0 || c - arr[i - 1] > dims.w * 0.1,
      );

      panelRegions = buildPanelRegions(centers, dims.w, dims.h);
    }

    const workOrders: ParsedWorkOrder[] = [];
    let lastRawText = detText;

    for (let i = 0; i < panelRegions.length; i++) {
      const { sx, sy, sw, sh } = panelRegions[i];

      if (onProgress) {
        onProgress(Math.round(((i + 0.5) / panelRegions.length) * 80 + 10));
      }

      const panelBlob = await preprocessImageRegion(imageFile, sx, sy, sw, sh);
      const { data: pd } = await worker.recognize(panelBlob, undefined, {
        blocks: true,
      });

      await worker.setParameters({ tessedit_char_whitelist: "0123456789" });
      const { data: digitData } = await worker.recognize(panelBlob, undefined, {
        blocks: true,
      });
      await worker.setParameters({ tessedit_char_whitelist: "" });

      lastRawText = pd.text;

      const screenType = detectScreenType(pd.text);
      const lowConf = (pd.confidence as number) < 70;
      const lines = pd.text
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      const allPanelLines = [
        ...getOcrLines(pd.blocks),
        ...getOcrLines(digitData.blocks),
      ];

      const ocrRows = [
        ...extractCompleteRowsFromOcrLines(allPanelLines, templates, lowConf),
        ...extractRowsFromKnownLineText(allPanelLines, templates, lowConf),
      ];

      const sequentialRows = extractCompleteRowsSequential(
        lines,
        templates,
        lowConf,
      ).map((row) => ({ ...row, y: inferRowYFromNumbers(row, allPanelLines) }));

      let rows =
        sequentialRows.length >= ocrRows.length
          ? sequentialRows
          : ocrRows;

      rows = sortAndDeduplicateCompleteRows(rows, sh * 2).filter((row) => !isRejectedRefineryRow(row));

      if (rows.length > 0 || screenType !== "unknown") {
        workOrders.push({
          workOrderNumber: i + 1,
          rows,
          totalYieldCscu: extractTotalYield(lines),
          sourceLocationName,
        });
      }
    }

    if (onProgress) onProgress(100);

    if (workOrders.some((wo) => wo.rows.length > 0)) {
      return { screenType: "refinery_complete", workOrders };
    }

    const fullBlob = await preprocessImageRegion(
      imageFile,
      0,
      0,
      dims.w,
      dims.h,
    );
    const { data: fullData } = await worker.recognize(fullBlob, undefined, {
      blocks: true,
    });
    const fullLines = fullData.text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const fullScreenType = detectScreenType(fullData.text);

    if (fullScreenType === "refinery_input") {
      const data = extractInputData(fullData.text, templates);
      if (data.rows.length > 0) return { screenType: "refinery_input", data };
    }

    const fullOcrLines = getOcrLines(fullData.blocks);
    const fallbackRows = sortAndDeduplicateCompleteRows([
      ...extractCompleteRowsFromOcrLines(fullOcrLines, templates, true),
      ...extractRowsFromKnownLineText(fullOcrLines, templates, true),
      ...extractCompleteRows(fullLines, templates, false, true).map((row) => ({
        ...row,
        y: inferRowYFromNumbers(row, fullOcrLines),
      })),
      ...extractCompleteRowsSequential(fullLines, templates, true).map((row) => ({
        ...row,
        y: inferRowYFromNumbers(row, fullOcrLines),
      })),
    ], dims.h * 2).filter((row) => !isRejectedRefineryRow(row));

    if (fallbackRows.length > 0) {
      return {
        screenType: "refinery_complete",
        workOrders: [
          {
            workOrderNumber: extractWorkOrderNumber(fullData.text) ?? 1,
            rows: fallbackRows,
            totalYieldCscu: extractTotalYield(fullLines),
            sourceLocationName,
          },
        ],
      };
    }

    return {
      screenType: "unknown",
      rawText: [lastRawText, fullData.text]
        .filter(Boolean)
        .join("\n\n--- FULL IMAGE OCR ---\n\n"),
    };
  } finally {
    await worker.terminate();
  }
}

// ── Completed order row extractor ────────────────────────────────────────────

const ROW_PATTERN_STRICT = /^([A-Z][A-Z\s-]{1,29}?)\s+(\d{1,4})\s+(\d{1,7})$/;
const ROW_PATTERN_LOOSE =
  /^([A-Z]{3,}(?:\s+[A-Z]+)?)\s+(\d{2,4})\s+(\d{1,7})(?:\s|$)/;

const COMPLETE_STOP = [
  /^YIELD\s+\d/i,
  /^\/\/\s*RESULTS/i,
  /^WORK\s+ORDER\s+COMPLETE/i,
  /^COLLECT$/i,
  /^SETUP\s+WORK/i,
  /^SELECT\s+STORAGE/i,
];

function extractCompleteRows(
  lines: string[],
  templates: MaterialTemplate[],
  anchored: boolean,
  lowConfidence: boolean,
): ParsedRefineryRow[] {
  let startIdx = 0;

  if (anchored) {
    const matIdx = lines.findIndex((l) => /MATERIALS\s+YIELDED/i.test(l));
    if (matIdx === -1) return [];
    startIdx = matIdx + 1;
  }

  const rows: ParsedRefineryRow[] = [];

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];

    if (anchored && COMPLETE_STOP.some((p) => p.test(line))) break;

    const cleanedLine = cleanText(line.replace(/^\/\/\s*/, ""));
    if (SKIP_LINES.has(cleanedLine)) continue;

    let m = ROW_PATTERN_STRICT.exec(line);
    let looseMatch = false;

    if (!m) {
      m = ROW_PATTERN_LOOSE.exec(line);
      if (m) looseMatch = true;
    }

    if (!m) continue;

    const rawName = stripMaterialNoise(m[1]);
    const cleanedName = cleanText(rawName);

    if (JUNK_NAMES.has(cleanedName.toUpperCase())) continue;
    if (cleanedName.length < 3) continue;

    const quality = parseInt(m[2], 10);
    const quantity = parseInt(m[3], 10);

    if (quality < 0 || quality > 1000) continue;
    if (quantity <= 0) continue;

    const materialId = normalizeMaterialName(cleanedName, templates);

    rows.push({
      rawName,
      materialId,
      quality,
      quantity,
      needsReview: looseMatch || lowConfidence || materialId === null,
    });
  }

  return rows;
}

function extractCompleteRowsSequential(
  lines: string[],
  templates: MaterialTemplate[],
  lowConfidence: boolean,
): ParsedRefineryRow[] {
  const rows: ParsedRefineryRow[] = [];

  for (let i = 0; i < lines.length - 2; i++) {
    const line = lines[i];
    const cleanedLine = cleanText(line.replace(/^\/\/\s*/, ""));

    // Header/footer handling:
    // The table header contains "YIELD" before any material rows, so do not break
    // until at least one real row has already been recovered.
    if (/^YIELD\b/i.test(line) || /RESULTS/i.test(line)) {
      if (rows.length > 0) break;
      continue;
    }

    if (SKIP_LINES.has(cleanedLine)) continue;
    if (JUNK_NAMES.has(cleanedLine.toUpperCase())) continue;

    const rawName = stripMaterialNoise(line);

    const resolved = resolveMaterialCandidate(rawName, templates);
    const materialId = resolved.materialId;

    // Reject weak/noisy material candidates before pairing nearby numbers.
    if (!resolved.isKnownMaterial) continue;
    if (rawName.length < 4) continue;
    if (/^\d+$/.test(rawName)) continue;

    const quality = parseOcrInteger(lines[i + 1]);
    const quantity = parseOcrInteger(lines[i + 2]);

    if (quality === null || quantity === null) continue;
    if (quality < 0 || quality > 1000) continue;
    if (quantity <= 0) continue;

    // Prevent footer/UI noise like "7" and "2" from becoming fake material rows.
    if (quality < 10 && quantity < 10) continue;
    if (quality > 2000 || quantity > 2000) continue;

    rows.push({
      rawName,
      materialId,
      quality,
      quantity,
      needsReview: lowConfidence || materialId === null,
    });

    i += 2;
  }

  return rows;
}

function parseOcrInteger(text: string): number | null {
  let normalized = text
    .replace(/^[sS$](?=\d)/, "5")
    .replace(/[oO](?=\d)|(?<=\d)[oO]/g, "0");

  let digits = normalized.replace(/\D/g, "");

  if (!digits && text.trim().length <= 4) {
    normalized = text
      .replace(/[rR]/g, "2")
      .replace(/[yY]/g, "5")
      .replace(/[)\]]/g, "7")
      .replace(/[sS$]/g, "5")
      .replace(/[oO]/g, "0");

    digits = normalized.replace(/\D/g, "");
  }

  return digits ? parseInt(digits, 10) : null;
}

function getOcrDigitCount(text: string): number {
  return text.replace(/\D/g, "").length;
}

function getMaterialCandidateFromLine(
  line: OcrLine,
  templates: MaterialTemplate[],
): {
  rawName: string;
  materialId: string | null;
  x1: number;
  y: number;
  height: number;
  lineText: string;
} | null {
  const words = (line.words ?? [])
    .map((word) => ({
      text: stripMaterialNoise(word.text ?? ""),
      bbox: word.bbox,
    }))
    .filter((word) => /[A-Za-z]/.test(word.text));

  const rowMidY = (line.bbox.y0 + line.bbox.y1) / 2;
  const rowHeight = Math.max(18, line.bbox.y1 - line.bbox.y0);

  let best:
    | {
        rawName: string;
        materialId: string | null;
        x1: number;
        score: number;
      }
    | null = null;

  // Prefer actual OCR words over the full line bbox. Processing rows often OCR as
  // "QUARTZ 522 7 8 0". If the full line bbox is used, the quality value 522 is
  // treated as part of the material label and gets skipped. Word-level material
  // candidates keep the material x-boundary tight, so the first numeric cell stays
  // eligible.
  for (let start = 0; start < words.length; start++) {
    for (let end = start; end < Math.min(words.length, start + 3); end++) {
      const phrase = words
        .slice(start, end + 1)
        .map((word) => word.text)
        .join(" ")
        .replace(/[^A-Za-z\s-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      if (phrase.length < 3) continue;
      if (JUNK_NAMES.has(cleanText(phrase).toUpperCase())) continue;

      const resolved = resolveMaterialCandidate(phrase, templates);
      if (!resolved.isKnownMaterial) continue;

      const score = phrase.length + (resolved.materialId ? 4 : 0);
      const x1 = words[end].bbox.x1;

      if (!best || score > best.score) {
        best = { rawName: phrase, materialId: resolved.materialId, x1, score };
      }
    }
  }

  if (best) {
    return {
      rawName: best.rawName,
      materialId: best.materialId,
      x1: best.x1,
      y: rowMidY,
      height: rowHeight,
      lineText: line.text ?? "",
    };
  }

  const raw = line.text ?? "";
  const materialText = stripMaterialNoise(raw).replace(/[^A-Za-z\s-]/g, " ").trim();
  const text = cleanText(materialText);
  const resolved = resolveMaterialCandidate(text, templates);

  if (!resolved.isKnownMaterial) return null;
  if (text.length < 3) return null;
  if (JUNK_NAMES.has(text.toUpperCase())) return null;

  return {
    rawName: materialText || raw.trim() || text,
    materialId: resolved.materialId,
    x1: line.bbox.x1,
    y: rowMidY,
    height: rowHeight,
    lineText: line.text ?? "",
  };
}

function isNonMaterialProcessingLine(text: string): boolean {
  const cleaned = cleanText(text);
  if (!cleaned) return true;

  // These lines live below/above the material table. OCR can read TIME as TIN,
  // then pair 3m 53s or 5m 20s as fake quality/yield rows. Reject those lines
  // before material matching, while still allowing PRESSURIZED ICE as a real row.
  if (/\bpressurized\s+ice\b/i.test(text)) return false;

  return /\b(time|remaining|processing|storage|option|stop|collect|work\s*order|details|refinement|center|user|funds|configuration|secure|select|refinery|capacity|yield)\b/i.test(cleaned);
}

function getNumberCellsFromOcrLines(
  ocrLines: OcrLine[],
): Array<{
  x0: number;
  x1: number;
  y: number;
  value: number;
  digitCount: number;
}> {
  const cells: Array<{
    x0: number;
    x1: number;
    y: number;
    value: number;
    digitCount: number;
  }> = [];

  for (const line of ocrLines) {
    const lineY = (line.bbox.y0 + line.bbox.y1) / 2;

    for (const word of line.words ?? []) {
      const value = parseOcrInteger(word.text ?? "");
      const digitCount = getOcrDigitCount(word.text ?? "");
      if (value === null || digitCount === 0) continue;

      cells.push({
        x0: word.bbox.x0,
        x1: word.bbox.x1,
        y:
          typeof word.bbox.y0 === "number" && typeof word.bbox.y1 === "number"
            ? (word.bbox.y0 + word.bbox.y1) / 2
            : lineY,
        value,
        digitCount,
      });
    }

    // Fallback for OCR engines/configs that do not expose word boxes.
    if (!line.words?.length) {
      const value = parseOcrInteger(line.text ?? "");
      const digitCount = getOcrDigitCount(line.text ?? "");
      if (value !== null && digitCount > 0) {
        cells.push({
          x0: line.bbox.x0,
          x1: line.bbox.x1,
          y: lineY,
          value,
          digitCount,
        });
      }
    }
  }

  return cells;
}


function extractNumericSequenceFromLineText(text: string): number[] {
  return (text.match(/\d+/g) ?? [])
    .map((token) => parseInt(token, 10))
    .filter((value) => Number.isFinite(value));
}

function getLineTextNearMaterial(material: { y: number; height: number }, ocrLines: OcrLine[]): string | null {
  const maxDelta = Math.max(material.height * 2.4, 56);
  const nearest = ocrLines
    .map((line) => ({
      line,
      y: (line.bbox.y0 + line.bbox.y1) / 2,
    }))
    .filter((entry) => Math.abs(entry.y - material.y) <= maxDelta)
    .sort((a, b) => Math.abs(a.y - material.y) - Math.abs(b.y - material.y))[0];

  return nearest?.line.text ?? null;
}

function getKnownMaterialNames(templates: MaterialTemplate[]): string[] {
  const names = new Set<string>();

  for (const template of templates) {
    const name = cleanText(template.name);
    if (name.length >= 3) names.add(name);
  }

  for (const key of Object.keys(MATERIAL_ALIASES)) {
    if (key.length >= 3) names.add(cleanText(key));
  }

  return Array.from(names).sort((a, b) => b.length - a.length);
}

function extractRowsFromKnownLineText(
  ocrLines: OcrLine[],
  templates: MaterialTemplate[],
  lowConfidence: boolean,
): ParsedRefineryRowWithY[] {
  const candidates = getKnownMaterialNames(templates);
  const rows: ParsedRefineryRowWithY[] = [];

  for (const line of ocrLines) {
    const raw = line.text ?? "";
    if (!raw.trim()) continue;
    if (isNonMaterialProcessingLine(raw)) continue;

    const cleaned = cleanText(raw.replace(/[^A-Za-z0-9\s-]/g, " "));
    const matched = candidates.filter((name) => {
      const compactName = name.replace(/\s+/g, "");
      const compactLine = cleaned.replace(/\s+/g, "");
      return (
        new RegExp(`(^|\\s)${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=\\s|$|\\d)`).test(cleaned) ||
        (compactName.length >= 5 && compactLine.includes(compactName))
      );
    });

    // If OCR merged multiple rows into one huge line, the shared numeric sequence is
    // too ambiguous for this conservative fallback. Word-box parsing handles that
    // case better.
    if (matched.length !== 1) continue;

    const resolved = resolveMaterialCandidate(matched[0], templates);
    if (!resolved.isKnownMaterial) continue;

    const nums = extractNumericSequenceFromLineText(raw);
    if (nums.length < 2) continue;

    const picked = pickProcessingQualityYield(resolved.materialId, matched[0], nums);
    if (!picked) continue;

    const { quality, quantity } = picked;

    rows.push({
      rawName: matched[0].replace(/\b\w/g, (m) => m.toUpperCase()),
      materialId: resolved.materialId,
      quality,
      quantity,
      needsReview: lowConfidence || resolved.materialId === null,
      y: (line.bbox.y0 + line.bbox.y1) / 2,
    });
  }

  return rows;
}

function extractCompleteRowsFromOcrLines(
  ocrLines: OcrLine[],
  templates: MaterialTemplate[],
  lowConfidence: boolean,
): ParsedRefineryRowWithY[] {
  const materialLines = ocrLines
    .map((line) => getMaterialCandidateFromLine(line, templates))
    .filter(
      (
        candidate,
      ): candidate is {
        rawName: string;
        materialId: string | null;
        x1: number;
        y: number;
        height: number;
        lineText: string;
      } => candidate !== null && !isNonMaterialProcessingLine(candidate.lineText),
    );

  const numberCells = getNumberCellsFromOcrLines(ocrLines);
  const rows: ParsedRefineryRowWithY[] = [];
  const usedYs = new Set<number>();

  for (const material of materialLines) {
    const rowNumbers = numberCells
      .filter((cell) => {
        return (
          Math.abs(cell.y - material.y) <= Math.max(material.height * 2.4, 56) &&
          cell.x0 > material.x1 - 4
        );
      })
      .sort((a, b) => a.x0 - b.x0)
      .reduce<Array<{ x0: number; x1: number; y: number; value: number; digitCount: number }>>(
        (cells, entry) => {
          const previous = cells[cells.length - 1];

          if (!previous || Math.abs(entry.x0 - previous.x0) > 12) {
            cells.push(entry);
          } else if (
            entry.digitCount > previous.digitCount ||
            (entry.digitCount === previous.digitCount && entry.value > previous.value)
          ) {
            cells[cells.length - 1] = entry;
          }

          return cells;
        },
        [],
      );

    if (rowNumbers.length < 2) {
      continue;
    }

    const nearestLineText = getLineTextNearMaterial(material, ocrLines);
    if (nearestLineText && isNonMaterialProcessingLine(nearestLineText)) continue;
    const lineNumbers = nearestLineText ? extractNumericSequenceFromLineText(nearestLineText) : [];
    const rowNumberValues = rowNumbers.map((entry) => entry.value);

    // Prefer full-line text because word boxes occasionally sort merged tokens
    // strangely. Example: QUARTZ 522 7 8 0 should become quality 522, yield 7.
    const pickedFromLine = pickProcessingQualityYield(material.materialId, material.rawName, lineNumbers);
    const pickedFromCells = pickProcessingQualityYield(material.materialId, material.rawName, rowNumberValues);
    const picked = pickedFromLine ?? pickedFromCells;

    if (!picked) continue;

    const { quality, quantity } = picked;

    if (quality < 0 || quality > 1000) continue;
    if (quantity <= 0) continue;

    // In processing screenshots the visible row shape is:
    // MATERIAL | QUALITY | YIELD | TO DO | DONE.
    // We intentionally use the first two numeric cells after the material label:
    // quality and yield. Todo/done are metadata later, not inventory quantity.
    const yKey = Math.round(material.y / 4);
    if (usedYs.has(yKey)) continue;
    usedYs.add(yKey);

    rows.push({
      rawName: material.rawName,
      materialId: material.materialId,
      quality,
      quantity,
      needsReview: lowConfidence || material.materialId === null,
      y: material.y,
    });
  }

  return rows.sort((a, b) => (a.y ?? 0) - (b.y ?? 0));
}

function extractTotalYield(lines: string[]): number | null {
  const line = lines.find((l) => /^YIELD\s+\d+/i.test(l));
  if (!line) return null;

  const m = line.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

// ── Input screen parser ──────────────────────────────────────────────────────

const INPUT_ROW_PATTERN =
  /^([A-Z][A-Z\s-]+?)(?:\s*\(([A-Z]+)\))?\s+(\d+)\s+(\d+)\s+(--?|-|\d+)$/;

const INPUT_STOP = [
  /^TOTAL\s+COST/i,
  /^\/\/\s*PROCESSING/i,
  /^PROCESSING\s+TIME/i,
  /^REFINERY\s+CAPACITY/i,
];

function extractInputData(
  text: string,
  templates: MaterialTemplate[],
): ParsedInputResult {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const matIdx = lines.findIndex((l) => /MATERIALS\s+SELECTED/i.test(l));

  const rows: ParsedInputRow[] = [];
  let i = matIdx === -1 ? 0 : matIdx + 1;

  while (
    i < lines.length &&
    /^(QUALITY|QTY|YIELD|REFINE|MATERIAL|\/\/)$/i.test(lines[i])
  ) {
    i++;
  }

  while (i < lines.length) {
    const line = lines[i++];

    if (INPUT_STOP.some((p) => p.test(line))) break;

    const m = INPUT_ROW_PATTERN.exec(line);
    if (!m) continue;

    const rawName = m[1].trim();
    const rawType = (m[2] as "RAW" | "ORE" | undefined) ?? null;
    const quality = parseInt(m[3], 10);
    const qtyCscu = parseInt(m[4], 10);
    const yieldRaw = m[5];
    const yieldCscu = /^-+$/.test(yieldRaw) ? null : parseInt(yieldRaw, 10);

    if (quality < 0 || quality > 1000) continue;
    if (qtyCscu <= 0) continue;

    rows.push(
      applyQualityQuantizationToRow({
        rawName,
        rawType,
        materialId: normalizeInputMaterialName(rawName, rawType, templates),
        quality,
        qtyCscu,
        yieldCscu,
        selectedForRefine: yieldCscu !== null,
        needsReview: false,
      }),
    );
  }

  return { rows, rawText: text };
}
