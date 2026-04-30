import { createWorker, PSM } from "tesseract.js";
import type { MaterialTemplate } from "../../types/logistics";

// ── Shared types ────────────────────────────────────────────────────────────

export type RefineryScreenType = "refinery_complete" | "refinery_input" | "unknown";

export interface ParsedRefineryRow {
  rawName: string;
  materialId: string | null;
  quality: number;
  quantity: number;
  needsReview: boolean;
}

// One completed work-order panel
export interface ParsedWorkOrder {
  workOrderNumber: number;
  rows: ParsedRefineryRow[];
  totalYieldCscu: number | null;
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
  laranite: "laranite",
  larantte: "laranite",
  borase: "borase",
  feynmaline: "feynmaline",
  tungsten: "tungsten",
  savrilium: "savrilium",
  quantanium: "quantanium",
  quantainium: "quantanium",  // alternate in-game spelling
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
  "stileron ore": "stileron-ore",
  "stileron (ore)": "stileron-ore",
  stileron: "stileron-ore",
  quartz: "quartz",
  "quartz raw": "quartz",
  "quartz (raw)": "quartz",
  taranite: "taranite",
  "taranite raw": "taranite",
  "taranite (raw)": "taranite",
  riccite: "riccite",
  "riccite ore": "riccite",
  "riccite (ore)": "riccite",
  "laranite ore": "laranite",
  "laranite (ore)": "laranite",
  "borase ore": "borase",
  "borase (ore)": "borase",
  "copper ore": "copper-ore",
  "copper (ore)": "copper-ore",
  "titanium ore": "titanium",
  "titanium (ore)": "titanium",
  "corundum raw": "corundum",
  "corundum (raw)": "corundum",
  "bexalite raw": "bexalite",
  "bexalite (raw)": "bexalite",
  "gold ore": "gold",
  "gold (ore)": "gold",
  "agricium raw": "agricium",
  "agricium (raw)": "agricium",
  "aslarite raw": "aslarite",
  "aslarite (raw)": "aslarite",
  "iron ore": "iron",
  "iron (ore)": "iron",
};

const SKIP_LINES = new Set([
  "quality", "yield", "material", "cscu", "scu", "details", "results",
  "completed", "collect", "refinement", "center", "profile", "selection",
  "selected", "yielded",
]);

const JUNK_NAMES = new Set([
  "WORK", "ORDER", "REFINERY", "STATION", "USER", "FUNDS", "MODULE",
  "RESULTS", "DETAILS", "YIELD", "QUALITY", "MATERIAL", "COLLECT",
  "CURRENT", "CAPACITY", "SETUP", "COMPLETED", "REFINEMENT", "CENTER",
  "PROFILE", "SELECTION", "SELECTED", "YIELDED", "SECURE", "CONFIGURATION",
  "SELECT", "STORAGE", "OPTION",
]);

// ── Levenshtein distance ──────────────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  const n = b.length;
  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = i - 1;
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const oldDp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = oldDp;
    }
  }
  return dp[n];
}

// ── Screen detection ──────────────────────────────────────────────────────────

export function detectScreenType(text: string): RefineryScreenType {
  if (/MATERIALS\s+YIELDED/i.test(text)) return "refinery_complete";
  if (/MATERIALS\s+SELECTED/i.test(text)) return "refinery_input";
  if (/\bCOMPLETED\b/i.test(text) && /\bYIELD\b/i.test(text)) return "refinery_complete";
  if (/\bSELECTED\b/i.test(text) && /\bQTY\b/i.test(text) && /\bREFINE\b/i.test(text)) return "refinery_input";
  return "unknown";
}

// ── Normalization ─────────────────────────────────────────────────────────────

export function normalizeMaterialName(rawName: string, templates: MaterialTemplate[]): string | null {
  const key = rawName.toLowerCase().trim().replace(/\s+/g, " ");

  const aliasId = MATERIAL_ALIASES[key];
  if (aliasId && templates.some((t) => t.id === aliasId)) return aliasId;

  const byName = templates.find((t) => t.name.toLowerCase() === key);
  if (byName) return byName.id;

  const partial = templates.find(
    (t) => t.name.toLowerCase().includes(key) || key.includes(t.name.toLowerCase()),
  );
  if (partial) return partial.id;

  const threshold = Math.max(2, Math.floor(key.length * 0.25));
  let bestId: string | null = null;
  let bestDist = Infinity;
  for (const t of templates) {
    const d = levenshtein(key, t.name.toLowerCase());
    if (d < bestDist) { bestDist = d; bestId = t.id; }
  }
  return bestDist <= threshold ? bestId : null;
}

function normalizeInputMaterialName(
  rawName: string,
  rawType: "RAW" | "ORE" | null,
  templates: MaterialTemplate[],
): string | null {
  if (/^INERT\s+MATERIALS?$/i.test(rawName)) return null;
  const nameKey = rawName.toLowerCase().trim().replace(/\s+/g, " ");
  if (rawType) {
    const compound = `${nameKey} ${rawType.toLowerCase()}`;
    const id = INPUT_MATERIAL_ALIASES[compound];
    if (id && templates.some((t) => t.id === id)) return id;
  }
  const aliasId = INPUT_MATERIAL_ALIASES[nameKey];
  if (aliasId && templates.some((t) => t.id === aliasId)) return aliasId;
  return normalizeMaterialName(rawName, templates);
}

// ── Image helpers ─────────────────────────────────────────────────────────────

function getImageDimensions(file: File): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); resolve({ w: img.naturalWidth, h: img.naturalHeight }); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image load failed")); };
    img.src = url;
  });
}

// Downscale to ≤600px wide for the detection pass (fast OCR to find panel positions).
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
      if (!ctx) { reject(new Error("Canvas 2D not available")); return; }
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => { if (blob) resolve(blob); else reject(new Error("toBlob failed")); },
        "image/png",
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image load failed")); };
    img.src = url;
  });
}

// Crop + 2× upscale + grayscale + contrast — the OCR-quality pass for one panel region.
export function preprocessImageRegion(
  file: File,
  sx: number, sy: number, sw: number, sh: number,
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
      if (!ctx) { reject(new Error("Canvas 2D not available")); return; }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.filter = "grayscale(100%) contrast(150%)";
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => { if (blob) resolve(blob); else reject(new Error("toBlob failed")); },
        "image/png",
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image load failed")); };
    img.src = url;
  });
}

// ── Panel region detection ────────────────────────────────────────────────────

interface PanelRegion { sx: number; sy: number; sw: number; sh: number; }
interface OcrWord { text: string; bbox: { x0: number; x1: number }; }
interface OcrLine { words?: OcrWord[] | null; text?: string; bbox: { x0: number; y0: number; x1: number; y1: number }; }
interface OcrParagraph { lines?: OcrLine[] | null; }
interface OcrBlock { paragraphs?: OcrParagraph[] | null; }

function getOcrLines(blocks: OcrBlock[] | null | undefined): OcrLine[] {
  return (blocks ?? []).flatMap((block) =>
    (block.paragraphs ?? []).flatMap((paragraph) => paragraph.lines ?? []),
  );
}

function getOcrWords(blocks: OcrBlock[] | null | undefined): OcrWord[] {
  return getOcrLines(blocks).flatMap((line) => line.words ?? []);
}

// Given sorted x-centers of "COMPLETED" banners (in original image coords),
// returns one crop region per panel.
function buildPanelRegions(centers: number[], W: number, H: number): PanelRegion[] {
  const sy = Math.floor(H * 0.02);
  const sh = Math.floor(H * 0.92);

  if (centers.length === 0) {
    // Fallback: single panel assuming left sidebar present
    return [{ sx: Math.floor(W * 0.15), sy, sw: Math.floor(W * 0.35), sh }];
  }

  if (centers.length === 1) {
    const cx = centers[0];
    if (cx < W * 0.4) {
      // Center is left of screen midpoint → sidebar layout
      return [{ sx: Math.floor(W * 0.15), sy, sw: Math.floor(W * 0.35), sh }];
    }
    // Full-width single panel
    return [{ sx: 0, sy, sw: W, sh }];
  }

  // Multiple completed panels fill the viewport evenly; the title text is
  // right-biased inside each panel, so title midpoints make bad crop boundaries.
  return centers.map((_, i) => {
    const sx = Math.round((W / centers.length) * i);
    const nextX = i === centers.length - 1 ? W : Math.round((W / centers.length) * (i + 1));
    return { sx, sy, sw: nextX - sx, sh };
  });
}

// ── Work-order parsing helpers ────────────────────────────────────────────────

function extractWorkOrderNumber(text: string): number | null {
  const m = text.match(/WORK\s+ORDER\s+(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}

// Remove rows where name+quality+quantity are identical (OCR double-read within one panel).
function deduplicateCompleteRows(rows: ParsedRefineryRow[]): ParsedRefineryRow[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.rawName.toUpperCase()}|${row.quality}|${row.quantity}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function parseRefineryScreenshot(
  imageFile: File,
  templates: MaterialTemplate[],
  onProgress?: (pct: number) => void,
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

    // ── Detection pass: downscaled full image → find panel positions ──────────
    const detBlob = await scaleImageForDetection(imageFile);
    const { data: detData } = await worker.recognize(detBlob, undefined, { blocks: true });
    const detText = detData.text;

    // Input screen: use single proportional crop
    if (/MATERIALS\s+SELECTED/i.test(detText)) {
      const sx = Math.floor(dims.w * 0.15);
      const sy = Math.floor(dims.h * 0.04);
      const sw = Math.floor(dims.w * 0.35);
      const sh = Math.floor(dims.h * 0.74);
      const panelBlob = await preprocessImageRegion(imageFile, sx, sy, sw, sh);
      const { data: pd } = await worker.recognize(panelBlob);
      return { screenType: "refinery_input", data: extractInputData(pd.text, templates) };
    }

    // Find "COMPLETED" word x-centers in original image coordinates
    const detScale = Math.min(1, 600 / dims.w);
    const words = getOcrWords(detData.blocks);
    const rawCenters = words
      .filter((w) => /^completed$/i.test(w.text.trim()))
      .map((w) => Math.round((w.bbox.x0 + w.bbox.x1) / 2 / detScale))
      .sort((a, b) => a - b);

    // Deduplicate centers within 10% of image width (OCR sometimes double-reads the banner)
    const centers = rawCenters.filter(
      (c, i, arr) => i === 0 || c - arr[i - 1] > dims.w * 0.1,
    );

    const panelRegions = buildPanelRegions(centers, dims.w, dims.h);

    // ── Per-panel OCR pass ────────────────────────────────────────────────────
    const workOrders: ParsedWorkOrder[] = [];
    let lastRawText = detText;

    for (let i = 0; i < panelRegions.length; i++) {
      const { sx, sy, sw, sh } = panelRegions[i];
      if (onProgress) onProgress(Math.round(((i + 0.5) / panelRegions.length) * 80 + 10));

      const panelBlob = await preprocessImageRegion(imageFile, sx, sy, sw, sh);
      const { data: pd } = await worker.recognize(panelBlob, undefined, { blocks: true });
      await worker.setParameters({ tessedit_char_whitelist: "0123456789" });
      const { data: digitData } = await worker.recognize(panelBlob, undefined, { blocks: true });
      await worker.setParameters({ tessedit_char_whitelist: "" });
      lastRawText = pd.text;

      const screenType = detectScreenType(pd.text);
      const lowConf = (pd.confidence as number) < 70;
      const lines = pd.text.split("\n").map((l) => l.trim()).filter(Boolean);

      let rows = extractCompleteRowsFromOcrLines(
        [...getOcrLines(pd.blocks), ...getOcrLines(digitData.blocks)],
        templates,
        lowConf,
      );

      if (rows.length === 0) {
        rows = extractCompleteRows(lines, templates, screenType === "refinery_complete", lowConf);
      }

      // Fallback: anchor-free text scan if anchored pass found nothing
      if (rows.length === 0) {
        rows = extractCompleteRows(lines, templates, false, true);
      }

      rows = deduplicateCompleteRows(rows);

      if (rows.length > 0 || screenType !== "unknown") {
        workOrders.push({
          workOrderNumber: extractWorkOrderNumber(pd.text) ?? (i + 1),
          rows,
          totalYieldCscu: extractTotalYield(lines),
        });
      }
    }

    if (onProgress) onProgress(100);

    if (workOrders.some((wo) => wo.rows.length > 0)) {
      return { screenType: "refinery_complete", workOrders };
    }

    const fullBlob = await preprocessImageRegion(imageFile, 0, 0, dims.w, dims.h);
    const { data: fullData } = await worker.recognize(fullBlob, undefined, { blocks: true });
    const fullLines = fullData.text.split("\n").map((l) => l.trim()).filter(Boolean);
    const fullScreenType = detectScreenType(fullData.text);

    if (fullScreenType === "refinery_input") {
      const data = extractInputData(fullData.text, templates);
      if (data.rows.length > 0) return { screenType: "refinery_input", data };
    }

    const fallbackRows = deduplicateCompleteRows([
      ...extractCompleteRowsFromOcrLines(getOcrLines(fullData.blocks), templates, true),
      ...extractCompleteRows(fullLines, templates, false, true),
    ]);
    if (fallbackRows.length > 0) {
      return {
        screenType: "refinery_complete",
        workOrders: [{
          workOrderNumber: extractWorkOrderNumber(fullData.text) ?? 1,
          rows: fallbackRows,
          totalYieldCscu: extractTotalYield(fullLines),
        }],
      };
    }

    return { screenType: "unknown", rawText: [lastRawText, fullData.text].filter(Boolean).join("\n\n--- FULL IMAGE OCR ---\n\n") };
  } finally {
    await worker.terminate();
  }
}

// ── Completed order row extractor ─────────────────────────────────────────────

const ROW_PATTERN_STRICT = /^([A-Z][A-Z\s-]{1,29}?)\s+(\d{1,4})\s+(\d{1,7})$/;
const ROW_PATTERN_LOOSE = /^([A-Z]{3,}(?:\s+[A-Z]+)?)\s+(\d{2,4})\s+(\d{1,3})(?:\s|$)/;

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
    while (startIdx < lines.length && /^(QUALITY|YIELD|MATERIAL|\/\/)$/i.test(lines[startIdx])) {
      startIdx++;
    }
  }

  const rows: ParsedRefineryRow[] = [];

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    if (anchored && COMPLETE_STOP.some((p) => p.test(line))) break;

    const lower = line.toLowerCase().replace(/^\/\/\s*/, "").trim();
    if (SKIP_LINES.has(lower)) continue;

    let m = ROW_PATTERN_STRICT.exec(line);
    let looseMatch = false;

    if (!m) {
      m = ROW_PATTERN_LOOSE.exec(line);
      if (m) looseMatch = true;
    }

    if (!m) continue;

    const rawName = m[1].trim();
    if (JUNK_NAMES.has(rawName.toUpperCase())) continue;
    if (rawName.length < 3) continue;

    const quality = parseInt(m[2], 10);
    const quantity = parseInt(m[3], 10);
    if (quality < 0 || quality > 1000) continue;
    if (quantity <= 0) continue;

    const materialId = normalizeMaterialName(rawName, templates);
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
): ParsedRefineryRow[] {
  const materialLines = ocrLines
    .map((line) => ({ line, text: (line.text ?? "").trim().replace(/\s+/g, " ") }))
    .filter(({ text }) => {
      if (text.length < 3) return false;
      if (JUNK_NAMES.has(text.toUpperCase())) return false;
      return normalizeMaterialName(text, templates) !== null;
    });

  const numberLines = ocrLines
    .map((line) => {
      const text = line.text ?? "";
      return { line, value: parseOcrInteger(text), digitCount: getOcrDigitCount(text) };
    })
    .filter((entry): entry is { line: OcrLine; value: number; digitCount: number } => entry.value !== null);

  const rows: ParsedRefineryRow[] = [];
  const usedYs = new Set<number>();

  for (const { line, text } of materialLines) {
    const materialId = normalizeMaterialName(text, templates);
    if (!materialId) continue;

    const rowMidY = (line.bbox.y0 + line.bbox.y1) / 2;
    const rowHeight = Math.max(18, line.bbox.y1 - line.bbox.y0);
    const rowNumbers = numberLines
      .filter(({ line: numberLine }) => {
        const numberMidY = (numberLine.bbox.y0 + numberLine.bbox.y1) / 2;
        return Math.abs(numberMidY - rowMidY) <= rowHeight * 0.85 && numberLine.bbox.x0 > line.bbox.x1;
      })
      .sort((a, b) => a.line.bbox.x0 - b.line.bbox.x0)
      .reduce<Array<{ line: OcrLine; value: number; digitCount: number }>>((cells, entry) => {
        const previous = cells[cells.length - 1];
        if (!previous || Math.abs(entry.line.bbox.x0 - previous.line.bbox.x0) > 12) {
          cells.push(entry);
        } else if (entry.digitCount > previous.digitCount || (entry.digitCount === previous.digitCount && entry.value > previous.value)) {
          cells[cells.length - 1] = entry;
        }
        return cells;
      }, []);

    if (rowNumbers.length < 2) continue;

    const quality = rowNumbers[0].value;
    const quantity = rowNumbers[1].value;
    if (quality < 0 || quality > 1000) continue;
    if (quantity <= 0) continue;

    const yKey = Math.round(rowMidY / 4);
    if (usedYs.has(yKey)) continue;
    usedYs.add(yKey);

    rows.push({
      rawName: text,
      materialId,
      quality,
      quantity,
      needsReview: lowConfidence,
    });
  }

  return rows;
}

function extractTotalYield(lines: string[]): number | null {
  const line = lines.find((l) => /^YIELD\s+\d+/i.test(l));
  if (!line) return null;
  const m = line.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

// ── Input (MATERIALS SELECTED) parser ────────────────────────────────────────

const INPUT_ROW_PATTERN =
  /^([A-Z][A-Z\s-]+?)(?:\s*\(([A-Z]+)\))?\s+(\d+)\s+(\d+)\s+(--?|-|\d+)$/;

const INPUT_STOP = [
  /^TOTAL\s+COST/i,
  /^\/\/\s*PROCESSING/i,
  /^PROCESSING\s+TIME/i,
  /^REFINERY\s+CAPACITY/i,
];

function extractInputData(text: string, templates: MaterialTemplate[]): ParsedInputResult {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const matIdx = lines.findIndex((l) => /MATERIALS\s+SELECTED/i.test(l));

  const rows: ParsedInputRow[] = [];
  let i = matIdx === -1 ? 0 : matIdx + 1;
  while (i < lines.length && /^(QUALITY|QTY|YIELD|REFINE|MATERIAL|\/\/)$/i.test(lines[i])) i++;

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
