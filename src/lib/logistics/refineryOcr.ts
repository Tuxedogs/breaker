import { createWorker, PSM } from "tesseract.js";
import type { MaterialTemplate } from "../../types/logistics";

// ── Shared types ────────────────────────────────────────────────────────────

export type RefineryScreenType =
  | "refinery_complete"
  | "refinery_input"
  | "unknown";

export interface ParsedRefineryRow {
  rawName: string;
  materialId: string | null;
  quality: number;
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
  /** Processing screens only. The current page can ignore this until the review UI is upgraded. */
  timeRemainingSeconds?: number | null;
}

export interface ParsedInputRow {
  rawName: string;
  rawType: "RAW" | "ORE" | null;
  materialId: string | null;
  quality: number;
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

function isProcessingScreenText(text: string): boolean {
  return (
    /\bPROCESSING\b/i.test(text) ||
    /\bTIME\s+REMAINING\b/i.test(text) ||
    (/\bTODO\b|\bTO\s+DO\b/i.test(text) && /\bDONE\b/i.test(text))
  );
}

export function normalizeMaterialName(
  rawName: string,
  templates: MaterialTemplate[],
): string | null {
  const key = cleanText(rawName);

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
  bbox: { x0: number; x1: number };
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
): ParsedRefineryRow[] {
  const seen = new Set<string>();

  return rows
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
    .map(({ y: _y, ...row }) => row);
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


// ── Processing order row extractor ──────────────────────────────────────────

const PROCESSING_ROW_PATTERN =
  /^([A-Z][A-Z\s-]{1,34}?)\s+(\d{1,4})\s+(\d{1,7})(?:\s+(\d{1,7}))?(?:\s+(\d{1,7}))?$/i;

const PROCESSING_STOP = [
  /^YIELD\s+\d/i,
  /^TIME\s+REMAINING/i,
  /^WORK\s+ORDER/i,
  /^PROCESSING$/i,
  /^TODO$/i,
  /^TO\s+DO$/i,
  /^DONE$/i,
  /^QUALITY$/i,
  /^MATERIAL$/i,
];

function parseTimeRemainingSeconds(text: string): number | null {
  const compact = text.replace(/\s+/g, " ");

  const hms = compact.match(
    /(\d{1,2})\s*h(?:ours?)?\s*(\d{1,2})\s*m(?:in(?:utes?)?)?\s*(\d{1,2})\s*s?/i,
  );
  if (hms) return Number(hms[1]) * 3600 + Number(hms[2]) * 60 + Number(hms[3]);

  const ms =
    compact.match(/(\d{1,2})\s*m(?:in(?:utes?)?)?\s*(\d{1,2})\s*s/i) ||
    compact.match(/\b(\d{1,2}):(\d{2})\s*s?\b/i);
  if (ms) return Number(ms[1]) * 60 + Number(ms[2]);

  const seconds = compact.match(/\b(\d{1,4})\s*s(?:ec(?:onds?)?)?\b/i);
  if (seconds) return Number(seconds[1]);

  return null;
}

function isProcessingMaterialCandidate(line: string, templates: MaterialTemplate[]): boolean {
  const rawName = stripMaterialNoise(line);
  const cleanedName = cleanText(rawName);

  if (cleanedName.length < 3) return false;
  if (/^\d+$/.test(cleanedName)) return false;
  if (SKIP_LINES.has(cleanedName)) return false;
  if (JUNK_NAMES.has(cleanedName.toUpperCase())) return false;
  if (PROCESSING_STOP.some((p) => p.test(line))) return false;

  return normalizeMaterialName(rawName, templates) !== null;
}

function extractProcessingRowsInline(
  lines: string[],
  templates: MaterialTemplate[],
  lowConfidence: boolean,
): ParsedRefineryRow[] {
  const rows: ParsedRefineryRow[] = [];

  for (const line of lines) {
    const m = PROCESSING_ROW_PATTERN.exec(line);
    if (!m) continue;

    const rawName = stripMaterialNoise(m[1]);
    const materialId = normalizeMaterialName(rawName, templates);
    if (!materialId) continue;

    const quality = parseInt(m[2], 10);
    const quantity = parseInt(m[3], 10); // Processing: Yield column becomes inventory quantity.

    if (quality < 0 || quality > 1000) continue;
    if (quantity <= 0) continue;

    rows.push({
      rawName,
      materialId,
      quality,
      quantity,
      needsReview: lowConfidence || materialId === null,
    });
  }

  return rows;
}

function extractProcessingRowsSequential(
  lines: string[],
  templates: MaterialTemplate[],
  lowConfidence: boolean,
): ParsedRefineryRow[] {
  const rows: ParsedRefineryRow[] = [];

  for (let i = 0; i < lines.length - 2; i++) {
    const rawName = stripMaterialNoise(lines[i]);
    if (!isProcessingMaterialCandidate(rawName, templates)) continue;

    const quality = parseOcrInteger(lines[i + 1]);
    const quantity = parseOcrInteger(lines[i + 2]); // Processing: Yield column becomes inventory quantity.

    if (quality === null || quantity === null) continue;
    if (quality < 0 || quality > 1000) continue;
    if (quantity <= 0) continue;

    const materialId = normalizeMaterialName(rawName, templates);

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

function extractProcessingRows(
  lines: string[],
  templates: MaterialTemplate[],
  lowConfidence: boolean,
): ParsedRefineryRow[] {
  const inlineRows = extractProcessingRowsInline(lines, templates, lowConfidence);
  const sequentialRows = extractProcessingRowsSequential(lines, templates, lowConfidence);

  return inlineRows.length >= sequentialRows.length ? inlineRows : sequentialRows;
}

// ── Main export ──────────────────────────────────────────────────────────────

export async function parseRefineryScreenshot(
  imageFile: File,
  templates: MaterialTemplate[],
  onProgress?: (pct: number) => void,
  manualPanelRegions?: PanelRegion[],
): Promise<RefineryParseResult> {
  const dims = await getImageDimensions(imageFile);

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

      if (isProcessingScreenText(pd.text)) {
        const rows = extractProcessingRows(lines, templates, lowConf);

        if (rows.length > 0) {
          workOrders.push({
            workOrderNumber: extractWorkOrderNumber(pd.text) ?? i + 1,
            rows,
            totalYieldCscu: extractTotalYield(lines),
            timeRemainingSeconds: parseTimeRemainingSeconds(pd.text),
          });
          continue;
        }
      }

      const allPanelLines = [
        ...getOcrLines(pd.blocks),
        ...getOcrLines(digitData.blocks),
      ];

      const ocrRows = extractCompleteRowsFromOcrLines(
        allPanelLines,
        templates,
        lowConf,
      );

      const sequentialRows = extractCompleteRowsSequential(
        lines,
        templates,
        lowConf,
      ).map((row) => ({ ...row, y: inferRowYFromNumbers(row, allPanelLines) }));

      let rows =
        sequentialRows.length >= ocrRows.length
          ? sequentialRows
          : ocrRows;

      rows = sortAndDeduplicateCompleteRows(rows);

      if (rows.length > 0 || screenType !== "unknown") {
        workOrders.push({
          workOrderNumber: i + 1,
          rows,
          totalYieldCscu: extractTotalYield(lines),
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

    if (isProcessingScreenText(fullData.text)) {
      const rows = extractProcessingRows(fullLines, templates, true);

      if (rows.length > 0) {
        return {
          screenType: "refinery_complete",
          workOrders: [
            {
              workOrderNumber: extractWorkOrderNumber(fullData.text) ?? 1,
              rows,
              totalYieldCscu: extractTotalYield(fullLines),
              timeRemainingSeconds: parseTimeRemainingSeconds(fullData.text),
            },
          ],
        };
      }
    }

    if (fullScreenType === "refinery_input") {
      const data = extractInputData(fullData.text, templates);
      if (data.rows.length > 0) return { screenType: "refinery_input", data };
    }

    const fullOcrLines = getOcrLines(fullData.blocks);
    const fallbackRows = sortAndDeduplicateCompleteRows([
      ...extractCompleteRowsFromOcrLines(fullOcrLines, templates, true),
      ...extractCompleteRows(fullLines, templates, false, true).map((row) => ({
        ...row,
        y: inferRowYFromNumbers(row, fullOcrLines),
      })),
      ...extractCompleteRowsSequential(fullLines, templates, true).map((row) => ({
        ...row,
        y: inferRowYFromNumbers(row, fullOcrLines),
      })),
    ]);

    if (fallbackRows.length > 0) {
      return {
        screenType: "refinery_complete",
        workOrders: [
          {
            workOrderNumber: extractWorkOrderNumber(fullData.text) ?? 1,
            rows: fallbackRows,
            totalYieldCscu: extractTotalYield(fullLines),
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

    const materialId = normalizeMaterialName(rawName, templates);

    // Reject weak/noisy material candidates before pairing nearby numbers.
    if (!materialId) continue;
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
      needsReview: lowConfidence,
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

function extractCompleteRowsFromOcrLines(
  ocrLines: OcrLine[],
  templates: MaterialTemplate[],
  lowConfidence: boolean,
): ParsedRefineryRowWithY[] {
  const materialLines = ocrLines
    .map((line) => {
      const raw = line.text ?? "";
      const materialText = stripMaterialNoise(raw);
      const text = cleanText(materialText);
      return { line, raw, materialText, text };
    })
    .filter(({ text }) => {
      if (text.length < 3) return false;
      if (JUNK_NAMES.has(text.toUpperCase())) return false;
      return normalizeMaterialName(text, templates) !== null;
    });

  const numberLines = ocrLines
    .map((line) => {
      const text = line.text ?? "";

      return {
        line,
        value: parseOcrInteger(text),
        digitCount: getOcrDigitCount(text),
      };
    })
    .filter(
      (entry): entry is { line: OcrLine; value: number; digitCount: number } =>
        entry.value !== null,
    );

  const rows: ParsedRefineryRowWithY[] = [];
  const usedYs = new Set<number>();

  for (const { line, raw, materialText, text } of materialLines) {
    const materialId = normalizeMaterialName(text, templates);
    if (!materialId) continue;

    const rowMidY = (line.bbox.y0 + line.bbox.y1) / 2;
    const rowHeight = Math.max(18, line.bbox.y1 - line.bbox.y0);

    const rowNumbers = numberLines
      .filter(({ line: numberLine }) => {
        const numberMidY = (numberLine.bbox.y0 + numberLine.bbox.y1) / 2;

        return (
          Math.abs(numberMidY - rowMidY) <= Math.max(rowHeight * 2.4, 56) &&
          numberLine.bbox.x0 > line.bbox.x1
        );
      })
      .sort((a, b) => a.line.bbox.x0 - b.line.bbox.x0)
      .reduce<Array<{ line: OcrLine; value: number; digitCount: number }>>(
        (cells, entry) => {
          const previous = cells[cells.length - 1];

          if (
            !previous ||
            Math.abs(entry.line.bbox.x0 - previous.line.bbox.x0) > 12
          ) {
            cells.push(entry);
          } else if (
            entry.digitCount > previous.digitCount ||
            (entry.digitCount === previous.digitCount &&
              entry.value > previous.value)
          ) {
            cells[cells.length - 1] = entry;
          }

          return cells;
        },
        [],
      );

    if (rowNumbers.length < 2) {
      if (rowNumbers.length === 1) {
        const quality = rowNumbers[0].value;

        if (quality >= 0 && quality <= 1000) {
          rows.push({
            rawName: materialText || raw.trim() || text,
            materialId,
            quality,
            quantity: 0,
            needsReview: true,
            y: rowMidY,
          });
        }
      }

      continue;
    }

    const quality = rowNumbers[0].value;
    const quantity = rowNumbers[1].value;

    if (quality < 0 || quality > 1000) continue;
    if (quantity <= 0) continue;

    const yKey = Math.round(rowMidY / 4);
    if (usedYs.has(yKey)) continue;
    usedYs.add(yKey);

    rows.push({
      rawName: materialText || raw.trim() || text,
      materialId,
      quality,
      quantity,
      needsReview: lowConfidence,
      y: rowMidY,
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

    rows.push({
      rawName,
      rawType,
      materialId: normalizeInputMaterialName(rawName, rawType, templates),
      quality,
      qtyCscu,
      yieldCscu,
      selectedForRefine: yieldCscu !== null,
    });
  }

  return { rows, rawText: text };
}
