import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useLogisticsStore, createInventoryEntryDraft } from "../../stores/logisticsStore";
import { formatQuantity } from "../../lib/logistics/inventory";
import { parseRefineryScreenshot } from "../../lib/logistics/refineryOcr";
import type {
  ParsedRefineryRow,
  ParsedWorkOrder,
  ParsedInputRow,
  RefineryScreenType,
  PanelRegion,
} from "../../lib/logistics/refineryOcr";
import type { MaterialTemplate } from "../../types/logistics";

// ── Draft row types ───────────────────────────────────────────────────────────

interface DraftRow extends ParsedRefineryRow {
  selectedMaterialId: string;
  editedQuality: number;
  editedQuantity: number;
  include: boolean;
}

interface DraftWorkOrder {
  screenshotId: string;
  workOrderNumber: number;
  totalYieldCscu: number | null;
  sourceLocationName?: string | null;
  rows: DraftRow[];
  panelRegion?: PanelRegion;
}

interface InputDraftRow extends ParsedInputRow {
  selectedMaterialId: string;
  editedQuality: number;
  editedQtyCscu: number;
  include: boolean;
  isDuplicate: boolean;
}

function toDraftRow(row: ParsedRefineryRow): DraftRow {
  return {
    ...row,
    selectedMaterialId: row.materialId ?? "",
    editedQuality: row.quality,
    editedQuantity: row.quantity,
    include: true,
  };
}

function toDraftWorkOrder(wo: ParsedWorkOrder, screenshotId: string, panelRegion?: PanelRegion): DraftWorkOrder {
  return {
    screenshotId,
    workOrderNumber: wo.workOrderNumber,
    totalYieldCscu: wo.totalYieldCscu,
    sourceLocationName: wo.sourceLocationName ?? null,
    rows: wo.rows.filter((row) => !isRejectedRefineryRow(row)).map(toDraftRow),
    panelRegion,
  };
}

function toDraftInputRow(row: ParsedInputRow): InputDraftRow {
  return {
    ...row,
    selectedMaterialId: row.materialId ?? "",
    editedQuality: row.quality,
    editedQtyCscu: row.qtyCscu,
    include: row.selectedForRefine,
    isDuplicate: false,
  };
}

function cscuToScu(quantityCscu: number): number {
  return quantityCscu / 100;
}

const FALLBACK_REVIEW_MATERIALS: Array<Pick<MaterialTemplate, "id" | "name">> = [
  { id: "silicon", name: "Silicon" },
];

function withFallbackReviewMaterials(materials: MaterialTemplate[]): MaterialTemplate[] {
  const existing = new Set(materials.map((material) => material.id));
  const byName = new Set(materials.map((material) => material.name.trim().toLowerCase()));
  const fallback = FALLBACK_REVIEW_MATERIALS
    .filter((material) => !existing.has(material.id) && !byName.has(material.name.toLowerCase()))
    .map((material) => material as MaterialTemplate);

  return [...materials, ...fallback].sort((a, b) => a.name.localeCompare(b.name));
}

type RefineryMaterialFlags = Partial<MaterialTemplate> & {
  acceptedInRefineryImport?: boolean;
  canComeFromRefinery?: boolean;
  isRefinable?: boolean;
};

function isRawIceOnlyMaterialName(value: string | null | undefined): boolean {
  const key = (value ?? "")
    .toLowerCase()
    .replace(/[()_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return key === "ice" || key === "raw ice" || key === "rawice";
}

function isPressurizedIceMaterialName(value: string | null | undefined): boolean {
  return /pressurized\s+ice/i.test(value ?? "");
}

function isRefineryReviewMaterial(material: MaterialTemplate): boolean {
  const flagged = material as RefineryMaterialFlags;
  const hasExplicitRule = typeof flagged.acceptedInRefineryImport === "boolean";

  if (isRawIceOnlyMaterialName(material.id) || isRawIceOnlyMaterialName(material.name)) {
    return false;
  }

  if (hasExplicitRule) return flagged.acceptedInRefineryImport === true;

  return true;
}

function isRejectedRefineryRow(row: ParsedRefineryRow): boolean {
  const id = row.materialId ?? "";
  const rawName = row.rawName ?? "";

  // Refinery Processing/Complete should surface PRESSURIZED ICE if ice is valid.
  // Standalone ICE / RAW ICE rows are usually OCR debris from headers, timers, or old pre-refine naming.
  return (isRawIceOnlyMaterialName(id) || isRawIceOnlyMaterialName(rawName)) && !isPressurizedIceMaterialName(rawName);
}

function getWorkOrderId(screenshotId: string, workOrderNumber: number): string {
  return `${screenshotId}:work-order-${workOrderNumber}`;
}

function getRefineryOutputDedupeKey(opts: {
  locationId: string;
  sourceLocationName?: string | null;
  workOrderNumber: number;
  materialId: string;
  quantity: number;
  totalYieldCscu?: number | null;
}): string {
  return [
    "refinery-output",
    opts.locationId,
    opts.sourceLocationName ?? "unknown-source",
    opts.workOrderNumber,
    opts.materialId,
    opts.quantity,
    opts.totalYieldCscu ?? "unknown-yield",
  ].join(":");
}

// ── Dedup helpers (input screen only) ────────────────────────────────────────

function makeDedupeKey(row: InputDraftRow): string {
  const mat = row.selectedMaterialId || row.rawName.toLowerCase();
  return `${mat}|${row.rawType ?? "none"}|${row.editedQuality}`;
}

function applyDuplicateFlags(rows: InputDraftRow[], newRowsStart: number): InputDraftRow[] {
  const seen = new Set<string>();
  return rows.map((row, idx) => {
    const key = makeDedupeKey(row);
    if (seen.has(key)) {
      return { ...row, isDuplicate: true, ...(idx >= newRowsStart ? { include: false } : {}) };
    }
    seen.add(key);
    return { ...row, isDuplicate: false };
  });
}

function applyDuplicateFlagsByGroup(rows: InputDraftRow[], groups: ScreenshotGroup[]): InputDraftRow[] {
  let offset = 0;
  const next = [...rows];
  for (const group of groups) {
    const groupRows = next.slice(offset, offset + group.rowCount);
    const flagged = applyDuplicateFlags(groupRows, groupRows.length);
    flagged.forEach((row, idx) => {
      next[offset + idx] = row;
    });
    offset += group.rowCount;
  }
  return next;
}

// ── Parse state union ─────────────────────────────────────────────────────────

type ScreenshotGroup = { screenshotId: string; rowCount: number };

type PageParseState =
  | { type: "refinery_complete"; workOrders: DraftWorkOrder[] }
  | { type: "refinery_input"; lastRawText: string; screenshotCount: number; rows: InputDraftRow[]; screenshotGroups: ScreenshotGroup[] }
  | { type: "unknown"; rawText: string };

interface QueuedScreenshot {
  id: string;
  file: File;
  preview: string;
  naturalWidth: number;
  naturalHeight: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type AlignmentMode = "manual";

interface PanelCropBound {
  left: number;
  right: number;
}

interface ManualAlignment {
  panelCount: 1 | 2 | 3 | 4;
  dividers: number[];
  cropBounds: PanelCropBound[];
  naturalWidth: number;
  naturalHeight: number;
}

function defaultDividers(panelCount: 1 | 2 | 3 | 4): number[] {
  return Array.from({ length: panelCount - 1 }, (_, idx) => (idx + 1) / panelCount);
}

function defaultCropBounds(panelCount: 1 | 2 | 3 | 4): PanelCropBound[] {
  const dividers = defaultDividers(panelCount);
  const edges = [0, ...dividers, 1];
  return edges.slice(0, -1).map((left, idx) => ({ left, right: edges[idx + 1] }));
}

function boundsToConnectedEdges(panelCount: 1 | 2 | 3 | 4, cropBounds?: PanelCropBound[]): number[] {
  const defaults = defaultCropBounds(panelCount);
  const rawBounds = defaults.map((fallback, idx) => cropBounds?.[idx] ?? fallback);
  const MIN_WIDTH = 0.025;

  const edges = [rawBounds[0]?.left ?? 0, ...rawBounds.map((bound) => bound.right)];
  const clean = edges.map((value) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0)));

  clean[0] = Math.max(0, Math.min(1 - MIN_WIDTH * panelCount, clean[0]));
  for (let idx = 1; idx < clean.length; idx++) {
    const min = clean[idx - 1] + MIN_WIDTH;
    const max = 1 - MIN_WIDTH * (clean.length - idx - 1);
    clean[idx] = Math.max(min, Math.min(max, clean[idx]));
  }
  clean[clean.length - 1] = Math.min(1, clean[clean.length - 1]);

  return clean;
}

function edgesToCropBounds(edges: number[]): PanelCropBound[] {
  return edges.slice(0, -1).map((left, idx) => ({ left, right: edges[idx + 1] }));
}

function sanitizeCropBounds(panelCount: 1 | 2 | 3 | 4, cropBounds?: PanelCropBound[]): PanelCropBound[] {
  return edgesToCropBounds(boundsToConnectedEdges(panelCount, cropBounds));
}

function centeredRefineryCropBounds(panelCount: 1 | 2 | 3 | 4): PanelCropBound[] {
  // Preset for full refinery screens where work-order panels sit in the center,
  // with station profile on the left and empty refinery background on the right.
  const panelWidthByCount: Record<1 | 2 | 3 | 4, number> = {
    1: 0.22,
    2: 0.205,
    3: 0.155,
    4: 0.12,
  };
  const gap = 0.006;
  const panelWidth = panelWidthByCount[panelCount];
  const totalWidth = panelCount * panelWidth + (panelCount - 1) * gap;
  const start = Math.max(0, 0.5 - totalWidth / 2);
  const edges = Array.from({ length: panelCount + 1 }, (_, idx) => start + idx * (panelWidth + gap));
  edges[edges.length - 1] = start + totalWidth;
  return edgesToCropBounds(edges);
}

function buildManualRegions(
  alignment: ManualAlignment | undefined,
  screenshot?: QueuedScreenshot,
): PanelRegion[] | undefined {
  if (!alignment) return undefined;

  const naturalWidth = alignment.naturalWidth || screenshot?.naturalWidth || 0;
  const naturalHeight = alignment.naturalHeight || screenshot?.naturalHeight || 0;

  if (!naturalWidth || !naturalHeight) return undefined;

  const cropBounds = sanitizeCropBounds(alignment.panelCount, alignment.cropBounds);

  return cropBounds.map(({ left, right }) => {
    const sx = Math.round(left * naturalWidth);
    const ex = Math.round(right * naturalWidth);

    return {
      sx,
      sy: 0,
      sw: Math.max(1, ex - sx),
      sh: naturalHeight,
    };
  });
}

const SCREEN_LABEL: Record<RefineryScreenType, string> = {
  refinery_complete: "Completed Order",
  refinery_input: "Materials Selected",
  unknown: "Unknown Screen",
};

const SCREEN_MOD: Record<RefineryScreenType, string> = {
  refinery_complete: "logi-refimport-screen-badge--complete",
  refinery_input: "logi-refimport-screen-badge--input",
  unknown: "logi-refimport-screen-badge--unknown",
};

const RETURN_LINKS: Record<string, { label: string; to: string }> = {
  inventory: { label: "Inventory", to: "/logistics/inventory" },
  locations: { label: "Locations", to: "/logistics/locations" },
  "build-queue": { label: "Build Queue", to: "/logistics/build-queue" },
  dashboard: { label: "Dashboard", to: "/dashboard" },
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RefineryImportPage() {
  const [searchParams] = useSearchParams();
  const returnLink = RETURN_LINKS[searchParams.get("source") ?? ""] ?? null;
  const materials = useLogisticsStore((s) => s.materialTemplates);
  const refineryReviewMaterials = useMemo(() => materials.filter(isRefineryReviewMaterial), [materials]);
  const reviewMaterials = useMemo(() => withFallbackReviewMaterials(refineryReviewMaterials), [refineryReviewMaterials]);
  const locations = useLogisticsStore((s) => s.locations);
  const addInventoryEntries = useLogisticsStore((s) => s.addInventoryEntries);

  const [screenshots, setScreenshots] = useState<QueuedScreenshot[]>([]);
  const [parsing, setParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState(0);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseState, setParseState] = useState<PageParseState | null>(null);
  const [locationId, setLocationId] = useState("");
  const [imported, setImported] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [lightboxId, setLightboxId] = useState<string | null>(null);
  const alignmentMode: AlignmentMode = "manual";
  const [manualAlignments, setManualAlignments] = useState<Record<string, ManualAlignment>>({});
  const [alignmentConfirmed, setAlignmentConfirmed] = useState<Record<string, boolean>>({});

  const inputRef = useRef<HTMLInputElement>(null);

  const loadFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    const imageFiles = files.filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      setParseError("Files must be images (PNG or JPG).");
      return;
    }

    const queued = await Promise.all(
      imageFiles.map(async (file): Promise<QueuedScreenshot> => {
        const preview = URL.createObjectURL(file);

        const dims = await new Promise<{ naturalWidth: number; naturalHeight: number }>((resolve) => {
          const img = new Image();
          img.onload = () => resolve({ naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight });
          img.onerror = () => resolve({ naturalWidth: 0, naturalHeight: 0 });
          img.src = preview;
        });

        return {
          id: crypto.randomUUID(),
          file,
          preview,
          naturalWidth: dims.naturalWidth,
          naturalHeight: dims.naturalHeight,
        };
      }),
    );

    setScreenshots((prev) => [...prev, ...queued]);
    setParseError(imageFiles.length === files.length ? null : "Skipped non-image files.");
    setImported(false);
  }, []);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    loadFiles(Array.from(e.dataTransfer.files));
  }

  function removeScreenshot(id: string) {
    setScreenshots((prev) => {
      const match = prev.find((item) => item.id === id);
      if (match) URL.revokeObjectURL(match.preview);
      return prev.filter((item) => item.id !== id);
    });
    setParseState(null);
    setImported(false);
    setManualAlignments((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setAlignmentConfirmed((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function updateManualAlignment(id: string, patch: Partial<ManualAlignment>) {
    setManualAlignments((prev) => {
      const screenshot = screenshots.find((item) => item.id === id);
      const current = prev[id] ?? {
        panelCount: 2,
        dividers: defaultDividers(2),
        cropBounds: centeredRefineryCropBounds(2),
        naturalWidth: screenshot?.naturalWidth ?? 0,
        naturalHeight: screenshot?.naturalHeight ?? 0,
      };
      const panelCount = patch.panelCount ?? current.panelCount;

      return {
        ...prev,
        [id]: {
          ...current,
          ...patch,
          panelCount,
          dividers: patch.panelCount ? defaultDividers(panelCount) : (patch.dividers ?? current.dividers),
          cropBounds: patch.panelCount ? centeredRefineryCropBounds(panelCount) : sanitizeCropBounds(panelCount, patch.cropBounds ?? current.cropBounds),
        },
      };
    });
    if (patch.panelCount !== undefined) {
      setAlignmentConfirmed((prev) => ({ ...prev, [id]: false }));
    }
  }

  async function handleParse() {
    if (screenshots.length === 0) return;
    setParsing(true);
    setParseProgress(0);
    setParseError(null);
    try {
      let nextState: PageParseState | null = null;
      const unknownRawText: string[] = [];

      for (let i = 0; i < screenshots.length; i++) {
        const screenshot = screenshots[i];
        const manualPanelRegions = alignmentMode === "manual" ? buildManualRegions(manualAlignments[screenshot.id], screenshot) : undefined;
        const ocrResult = await parseRefineryScreenshot(
          screenshot.file,
          reviewMaterials,
          (pct) => {
            setParseProgress(Math.round(((i + pct / 100) / screenshots.length) * 100));
          },
          manualPanelRegions,
        );

        if (ocrResult.screenType === "refinery_complete") {
          if (nextState?.type === "refinery_input") {
            throw new Error("Upload completed-order screenshots separately from materials selected screenshots.");
          }
          const existingWorkOrders: DraftWorkOrder[] = nextState?.type === "refinery_complete" ? nextState.workOrders : [];
          nextState = {
            type: "refinery_complete",
            workOrders: [...existingWorkOrders, ...ocrResult.workOrders.map((wo, woIdx) => toDraftWorkOrder(wo, screenshot.id, manualPanelRegions?.[woIdx]))],
          };
        } else if (ocrResult.screenType === "refinery_input") {
          if (nextState?.type === "refinery_complete") {
            throw new Error("Upload materials selected screenshots separately from completed-order screenshots.");
          }
          const existingRows: InputDraftRow[] = nextState?.type === "refinery_input" ? nextState.rows : [];
          const existingCount: number = nextState?.type === "refinery_input" ? nextState.screenshotCount : 0;
          const existingGroups: ScreenshotGroup[] = nextState?.type === "refinery_input" ? nextState.screenshotGroups : [];
          const newRows = ocrResult.data.rows.map(toDraftInputRow);
          nextState = {
            type: "refinery_input",
            lastRawText: ocrResult.data.rawText,
            screenshotCount: existingCount + 1,
            rows: applyDuplicateFlagsByGroup([...existingRows, ...newRows], [...existingGroups, { screenshotId: screenshot.id, rowCount: newRows.length }]),
            screenshotGroups: [...existingGroups, { screenshotId: screenshot.id, rowCount: newRows.length }],
          };
        } else {
          unknownRawText.push(`${screenshot.file.name}\n${ocrResult.rawText}`);
        }
      }

      setParseProgress(100);
      setParseState(nextState ?? { type: "unknown", rawText: unknownRawText.join("\n\n") });
      if (unknownRawText.length > 0 && nextState) {
        setParseError(`${unknownRawText.length} screenshot${unknownRawText.length === 1 ? "" : "s"} could not be recognized.`);
      }
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "OCR failed — check browser console.");
    } finally {
      setParsing(false);
    }
  }

  function updateCompleteRow(woIdx: number, rowIdx: number, patch: Partial<DraftRow>) {
    setParseState((s) => {
      if (!s || s.type !== "refinery_complete") return s;
      return {
        ...s,
        workOrders: s.workOrders.map((wo, wi) =>
          wi !== woIdx
            ? wo
            : { ...wo, rows: wo.rows.map((r, ri) => (ri === rowIdx ? { ...r, ...patch } : r)) },
        ),
      };
    });
  }

  function deleteCompleteRow(woIdx: number, rowIdx: number) {
    setParseState((s) => {
      if (!s || s.type !== "refinery_complete") return s;
      return {
        ...s,
        workOrders: s.workOrders.map((wo, wi) =>
          wi !== woIdx ? wo : { ...wo, rows: wo.rows.filter((_, ri) => ri !== rowIdx) },
        ),
      };
    });
  }

  function updateInputRow(idx: number, patch: Partial<InputDraftRow>) {
    setParseState((s) => {
      if (!s || s.type !== "refinery_input") return s;
      const updated = s.rows.map((r, i) => (i === idx ? { ...r, ...patch } : r));
      const needsDedup = "selectedMaterialId" in patch || "editedQuality" in patch;
      return { ...s, rows: needsDedup ? applyDuplicateFlagsByGroup(updated, s.screenshotGroups) : updated };
    });
  }

  function deleteInputRow(idx: number) {
    setParseState((s) => {
      if (!s || s.type !== "refinery_input") return s;
      let running = 0;
      const screenshotGroups = s.screenshotGroups.map((group) => {
        const start = running;
        running += group.rowCount;
        if (idx >= start && idx < start + group.rowCount) {
          return { ...group, rowCount: Math.max(0, group.rowCount - 1) };
        }
        return group;
      });
      return { ...s, rows: s.rows.filter((_, rowIdx) => rowIdx !== idx), screenshotGroups };
    });
  }

  function updateCompleteColumn(woIdx: number, patch: Partial<DraftRow>) {
    setParseState((s) => {
      if (!s || s.type !== "refinery_complete") return s;
      return {
        ...s,
        workOrders: s.workOrders.map((wo, wi) =>
          wi === woIdx ? { ...wo, rows: wo.rows.map((row) => ({ ...row, ...patch })) } : wo,
        ),
      };
    });
  }

  function clearCompleteColumn(woIdx: number) {
    setParseState((s) => {
      if (!s || s.type !== "refinery_complete") return s;
      return { ...s, workOrders: s.workOrders.map((wo, wi) => wi === woIdx ? { ...wo, rows: [] } : wo) };
    });
  }

  function updateInputColumn(startIdx: number, rowCount: number, patch: Partial<InputDraftRow>) {
    setParseState((s) => {
      if (!s || s.type !== "refinery_input") return s;
      return {
        ...s,
        rows: s.rows.map((row, idx) => idx >= startIdx && idx < startIdx + rowCount ? { ...row, ...patch } : row),
      };
    });
  }

  function clearInputColumn(groupIdx: number, startIdx: number, rowCount: number) {
    setParseState((s) => {
      if (!s || s.type !== "refinery_input") return s;
      return {
        ...s,
        rows: s.rows.filter((_, idx) => idx < startIdx || idx >= startIdx + rowCount),
        screenshotGroups: s.screenshotGroups.map((group, idx) => idx === groupIdx ? { ...group, rowCount: 0 } : group),
      };
    });
  }

  function handleImport() {
    if (!parseState || parseState.type === "unknown") return;
    if (!locationId) {
      setParseError("Choose a location before saving parsed rows.");
      return;
    }
    const entries =
      parseState.type === "refinery_complete"
        ? parseState.workOrders.flatMap((wo) =>
            wo.rows
              .filter((r) => r.include)
              .filter((r) => r.selectedMaterialId && r.editedQuality >= 0 && r.editedQuantity > 0)
              .filter((r) => reviewMaterials.some((material) => material.id === r.selectedMaterialId))
              .map((r) => {
                const quantity = cscuToScu(r.editedQuantity);
                const workOrderId = getRefineryOutputDedupeKey({
                  locationId,
                  sourceLocationName: wo.sourceLocationName,
                  workOrderNumber: wo.workOrderNumber,
                  materialId: r.selectedMaterialId,
                  quantity,
                  totalYieldCscu: wo.totalYieldCscu,
                });
                return createInventoryEntryDraft({
                  id: crypto.randomUUID(),
                  materialId: r.selectedMaterialId,
                  quantity,
                  quality: r.editedQuality,
                  locationId,
                  source: "screenshot_parser",
                  sourceHistory: ["screenshot_parser"],
                  workOrderId,
                  workOrderIds: [workOrderId, getWorkOrderId(wo.screenshotId, wo.workOrderNumber)],
                });
              }),
          )
        : parseState.rows
            .filter((r) => r.include)
            .filter((r) => r.selectedMaterialId && r.editedQuality >= 0 && r.editedQtyCscu > 0)
            .map((r) =>
              createInventoryEntryDraft({
                id: crypto.randomUUID(),
                materialId: r.selectedMaterialId,
                quantity: cscuToScu(r.editedQtyCscu),
                quality: r.editedQuality,
                locationId,
                source: "screenshot_parser",
                sourceHistory: ["screenshot_parser"],
              }),
            );
    if (entries.length === 0) {
      setParseError("Selected rows need material, quality, quantity, and location before saving.");
      return;
    }
    addInventoryEntries(entries);
    setParseError(null);
    setImported(true);
  }

  function handleClear() {
    screenshots.forEach((ss) => URL.revokeObjectURL(ss.preview));
    setScreenshots([]);
    setParseState(null);
    setParseError(null);
    setImported(false);
    setManualAlignments({});
    setAlignmentConfirmed({});
  }

  // ── Derived state ─────────────────────────────────────────────────────────

  const includedCount =
    parseState?.type === "refinery_complete"
      ? parseState.workOrders.reduce((sum, wo) => sum + wo.rows.filter((r) => r.include && r.selectedMaterialId).length, 0)
      : parseState?.type === "refinery_input"
        ? parseState.rows.filter((r) => r.include && r.selectedMaterialId).length
        : 0;

  const hasRows =
    parseState?.type === "refinery_complete"
      ? parseState.workOrders.some((wo) => wo.rows.length > 0)
      : parseState?.type === "refinery_input"
        ? parseState.rows.length > 0
        : false;

  const noRows = parseState !== null && !hasRows && !parsing;

  const screenTypeBadge: RefineryScreenType =
    parseState?.type === "refinery_complete"
      ? "refinery_complete"
      : parseState?.type === "refinery_input"
        ? "refinery_input"
        : "unknown";

  const debugRawText =
    parseState?.type === "unknown"
      ? parseState.rawText
      : parseState?.type === "refinery_input"
        ? parseState.lastRawText
        : null;

  const totalWorkOrders =
    parseState?.type === "refinery_complete"
      ? parseState.workOrders.filter((wo) => wo.rows.length > 0).length
      : parseState?.type === "refinery_input"
        ? parseState.screenshotGroups.filter((g) => g.rowCount > 0).length
        : 0;

  const totalScu =
    parseState?.type === "refinery_complete"
      ? parseState.workOrders.reduce(
          (sum, wo) =>
            sum + wo.rows.filter((r) => r.include && r.selectedMaterialId).reduce((s, r) => s + cscuToScu(r.editedQuantity), 0),
          0,
        )
      : parseState?.type === "refinery_input"
        ? parseState.rows.filter((r) => r.include && r.selectedMaterialId).reduce((sum, r) => sum + cscuToScu(r.editedQtyCscu), 0)
        : 0;

  const warningCount =
    parseState?.type === "refinery_complete"
      ? parseState.workOrders.reduce((sum, wo) => sum + wo.rows.filter((r) => r.needsReview || r.materialId === null).length, 0)
      : parseState?.type === "refinery_input"
        ? parseState.rows.filter((r) => r.materialId === null || r.isDuplicate).length
        : 0;

  // ── Lightbox data ─────────────────────────────────────────────────────────

  const lightboxScreenshot = lightboxId ? screenshots.find((s) => s.id === lightboxId) : null;
  const lightboxSections: { label: string; rows: { name: string; quality: number; qty: number; unit: string }[] }[] =
    lightboxId && parseState?.type === "refinery_complete"
      ? parseState.workOrders
          .filter((wo) => wo.screenshotId === lightboxId)
          .map((wo) => ({
            label: `// WORK ORDER ${wo.workOrderNumber}`,
            rows: wo.rows.map((r) => ({
              name: r.selectedMaterialId
                ? (materials.find((m) => m.id === r.selectedMaterialId)?.name ?? r.rawName)
                : r.rawName,
              quality: r.editedQuality,
              qty: r.editedQuantity,
              unit: "cSCU",
            })),
          }))
      : lightboxId && parseState?.type === "refinery_input"
        ? (() => {
            const gIdx = parseState.screenshotGroups.findIndex((g) => g.screenshotId === lightboxId);
            if (gIdx === -1) return [];
            const startIdx = parseState.screenshotGroups.slice(0, gIdx).reduce((s, g) => s + g.rowCount, 0);
            const group = parseState.screenshotGroups[gIdx];
            return [
              {
                label: "// MATERIALS SELECTED",
                rows: parseState.rows.slice(startIdx, startIdx + group.rowCount).map((r) => ({
                  name: r.selectedMaterialId
                    ? (materials.find((m) => m.id === r.selectedMaterialId)?.name ?? r.rawName)
                    : r.rawName,
                  quality: r.editedQuality,
                  qty: r.editedQtyCscu,
                  unit: "cSCU",
                })),
              },
            ];
          })()
        : [];

  const allManualAlignmentsConfirmed = screenshots.length > 0 && screenshots.every((ss) => alignmentConfirmed[ss.id] ?? false);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="logi-page ri-page">

      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/jpg"
        style={{ display: "none" }}
        onChange={(e) => {
          loadFiles(Array.from(e.target.files ?? []));
          e.currentTarget.value = "";
        }}
      />

      {parseError && <div className="logi-refimport-error" role="alert">{parseError}</div>}

      {/* ── Empty state ── */}
      {screenshots.length === 0 && (
        <div className="ri-empty">
          <div className="ri-helper-card">
            <div className="ri-helper-title">What this importer reads</div>
            <div className="ri-helper-types">
              <div className="ri-helper-type">
                <span className="logi-refimport-screen-badge logi-refimport-screen-badge--input">Processing Runs</span>
                <span className="ri-helper-type-desc">
                  <strong>Most accurate and reliable.</strong> A screenshot taken during an active processing run. Keep the shot flat to the screen, uncropped, and capture the full refinery screen for best results.
                </span>
              </div>
              <div className="ri-helper-type ri-helper-type--secondary">
                <span className="logi-refimport-screen-badge logi-refimport-screen-badge--complete">Completed Work Order</span>
                <span className="ri-helper-type-desc">Secondary method. End-of-refinery panel showing refined yields per material. One screenshot may contain multiple work order panels.</span>
              </div>
            </div>
            <div className="ri-helper-divider" />
            <div className="ri-helper-examples-label">// example extractions</div>
            <div className="ri-helper-examples">
              {[
                { mat: "Quantanium", q: "Q 533", qty: "41 SCU" },
                { mat: "Copper Ore", q: "Q 324", qty: "209 SCU" },
                { mat: "Aluminum", q: "Q 796", qty: "35 SCU" },
              ].map(({ mat, q, qty }) => (
                <div key={mat} className="ri-helper-ex-row">
                  <span className="ri-helper-ex-mat">{mat}</span>
                  <span className="ri-helper-ex-q">{q}</span>
                  <span className="ri-helper-ex-qty">{qty}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="ri-dropzone-wrap">
            <div
              className={["ri-dropzone", isDragOver ? "ri-dropzone--drag" : ""].filter(Boolean).join(" ")}
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onClick={() => inputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
              aria-label="Upload refinery screenshot"
            >
              <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="36" height="36" style={{ opacity: 0.45, color: "rgba(96,165,250,1)" }}>
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
              </svg>
              <span className="ri-drop-label">Drop screenshots here</span>
              <span className="ri-drop-browse">Browse files</span>
              <span className="ri-drop-hint">PNG · JPG · Multiple files supported</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Pre-parse: files queued ── */}
      {screenshots.length > 0 && parseState === null && (
        <div className="ri-preparse ri-preparse--manual">
          <div className="ri-preparse-shell">
            <button
              type="button"
              className={["ri-upload-square", isDragOver ? "ri-upload-square--drag" : ""].filter(Boolean).join(" ")}
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onClick={() => inputRef.current?.click()}
              disabled={parsing}
              aria-label="Add refinery screenshot"
            >
              <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="28" height="28">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
              </svg>
              <span className="ri-upload-square-title">Add Screenshot</span>
              <span className="ri-upload-square-sub">{screenshots.length} queued</span>
            </button>

            <div className="ri-preparse-main">
              <div className="ri-file-toolbar">
                <div className="ri-file-stack ri-file-stack--compact">
                  {screenshots.map((ss, idx) => (
                    <div key={ss.id} className="ri-file-row">
                      <img src={ss.preview} alt="" className="ri-file-thumb" />
                      <span className="ri-file-name">{idx + 1}. {ss.file.name}</span>
                      <button
                        type="button"
                        className="logi-btn-ghost logi-refimport-btn-sm"
                        onClick={() => removeScreenshot(ss.id)}
                        disabled={parsing}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" className="logi-btn-ghost logi-refimport-btn-sm" onClick={handleClear} disabled={parsing}>
                  Clear all
                </button>
              </div>

              <div className="ri-align-cards">
                {screenshots.map((ss, idx) => {
                  const alignment = manualAlignments[ss.id];
                  const confirmed = alignmentConfirmed[ss.id] ?? false;
                  const panelCount = alignment?.panelCount ?? 2;
                  const canParseFromThisCard = confirmed && allManualAlignmentsConfirmed && !parsing;
                  return (
                    <div key={ss.id} className={`ri-ss-align-card${confirmed ? " ri-ss-align-card--confirmed" : ""}`}>
                      <div className="ri-ss-align-hdr">
                        <span className="ri-ss-card-name">{idx + 1}. {ss.file.name}</span>
                        {confirmed ? (
                          <span className="ri-align-status ri-align-status--ready">
                            <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="10" height="10"><polyline points="20 6 9 17 4 12" /></svg>
                            Ready
                          </span>
                        ) : (
                          <span className="ri-align-status ri-align-status--warn">Alignment required</span>
                        )}
                        <button
                          type="button"
                          className="logi-btn-ghost logi-refimport-btn-sm"
                          onClick={() => removeScreenshot(ss.id)}
                          disabled={parsing}
                        >
                          Remove
                        </button>
                      </div>

                      <div className="ri-align-workarea">
                        <aside className="ri-align-side" aria-label="Alignment steps">
                          <div className="ri-align-side-kicker">Manual alignment</div>

                          <div className="ri-align-side-step">
                            <span className="ri-align-side-num">01</span>
                            <div className="ri-align-side-copy">
                              <strong>Select panel count</strong>
                              <span>Choose how many work-order panels are visible.</span>
                              <div className="ri-panel-count" aria-label="Panel count">
                                {([1, 2, 3, 4] as (1 | 2 | 3 | 4)[]).map((count) => (
                                  <button
                                    key={count}
                                    type="button"
                                    className={panelCount === count ? "ri-panel-count-btn ri-panel-count-btn--active" : "ri-panel-count-btn"}
                                    onClick={() => updateManualAlignment(ss.id, { panelCount: count })}
                                    disabled={parsing}
                                  >
                                    {count}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="ri-align-side-step">
                            <span className="ri-align-side-num">02</span>
                            <div className="ri-align-side-copy">
                              <strong>Fit each panel</strong>
                              <span>Drag the vertical edges until each box hugs one work-order panel. Use the top handle to move the whole group.</span>
                            </div>
                          </div>

                          <button
                            type="button"
                            className={confirmed ? "ri-align-confirm-action ri-align-confirm-action--confirmed" : "ri-align-confirm-action"}
                            onClick={() => {
                              if (canParseFromThisCard) {
                                void handleParse();
                                return;
                              }
                              if (!confirmed) {
                                setAlignmentConfirmed((prev) => ({ ...prev, [ss.id]: true }));
                              }
                            }}
                            disabled={parsing || (confirmed && !allManualAlignmentsConfirmed)}
                            title={confirmed && !allManualAlignmentsConfirmed ? "Confirm every queued screenshot before parsing." : undefined}
                          >
                            {parsing ? (
                              <><span className="logi-refimport-spinner" aria-hidden /> Parsing… {parseProgress}%</>
                            ) : confirmed ? (
                              allManualAlignmentsConfirmed ? "Alignment confirmed — click to parse" : "Alignment confirmed — waiting"
                            ) : (
                              "Click to confirm"
                            )}
                          </button>
                        </aside>

                        <div className="ri-align-preview-shell">
                          <ManualAlignmentPreview
                            screenshot={ss}
                            alignment={alignment}
                            onChange={(patch) => updateManualAlignment(ss.id, patch)}
                            disabled={parsing}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Post-parse: review cards ── */}
      {parseState !== null && (
        <div className="ri-review-area">
          <div className="ri-reparse-bar">
            <div className="ri-reparse-left">
              <span className={`logi-refimport-screen-badge ${SCREEN_MOD[screenTypeBadge]}`}>
                {SCREEN_LABEL[screenTypeBadge]}
                {parseState.type === "refinery_complete" && parseState.workOrders.length > 1 && (
                  <span className="logi-refimport-panel-count">{parseState.workOrders.length} panels</span>
                )}
              </span>
              {noRows && <span className="ri-no-rows-hint">No rows detected — try a cleaner screenshot.</span>}
            </div>
            <div className="ri-reparse-actions">
              <button type="button" className="logi-btn-ghost logi-refimport-btn-sm" onClick={() => inputRef.current?.click()} disabled={parsing}>+ Add</button>
              <button type="button" className="logi-btn-ghost logi-refimport-btn-sm" onClick={handleParse} disabled={parsing || screenshots.length === 0}>
                {parsing ? `${parseProgress}%` : "Re-parse"}
              </button>
              <button type="button" className="logi-btn-ghost logi-refimport-btn-sm" onClick={handleClear}>Clear all</button>
            </div>
          </div>

          {/* Completed order cards */}
          {parseState.type === "refinery_complete" && screenshots.map((screenshot) => {
            const woItems = parseState.workOrders
              .map((wo, idx) => ({ wo, idx }))
              .filter(({ wo }) => wo.screenshotId === screenshot.id);
            if (woItems.length === 0) return null;
            const totalPanels = woItems.length;
            return (
              <div key={screenshot.id} className="ri-ss-group">
                <div className="ri-ss-group-hdr">
                  <span className="ri-ss-card-name">{screenshot.file.name}</span>
                  <span className={`logi-refimport-screen-badge ${SCREEN_MOD["refinery_complete"]}`}>
                    {SCREEN_LABEL["refinery_complete"]}
                  </span>
                  {!woItems.some(({ wo }) => wo.rows.length > 0) && (
                    <span className="logi-refimport-screen-badge logi-refimport-screen-badge--unknown">No rows</span>
                  )}
                  <button
                    type="button"
                    className="logi-btn-ghost logi-refimport-btn-sm ri-ss-remove"
                    onClick={() => removeScreenshot(screenshot.id)}
                    disabled={parsing}
                  >
                    Remove
                  </button>
                </div>
                <div className="ri-wo-review-grid">
                  {woItems.map(({ wo, idx: woIdx }, panelIdx) => (
                    <WorkOrderReviewCard
                      key={woIdx}
                      workOrder={wo}
                      totalPanelsInScreenshot={totalPanels}
                      panelIdxInScreenshot={panelIdx}
                      screenshot={screenshot}
                      materials={reviewMaterials}
                      onUpdate={(rowIdx, patch) => updateCompleteRow(woIdx, rowIdx, patch)}
                      onDelete={(rowIdx) => deleteCompleteRow(woIdx, rowIdx)}
                      onSelectAll={() => updateCompleteColumn(woIdx, { include: true })}
                      onDeselectAll={() => updateCompleteColumn(woIdx, { include: false })}
                      onClear={() => clearCompleteColumn(woIdx)}
                      onEnlarge={() => setLightboxId(screenshot.id)}
                      disabled={parsing}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {/* Materials selected cards */}
          {parseState.type === "refinery_input" && (() => {
            let rowOffset = 0;
            return parseState.screenshotGroups.map(({ screenshotId, rowCount }, groupIdx) => {
              const screenshot = screenshots.find((s) => s.id === screenshotId);
              const startIdx = rowOffset;
              rowOffset += rowCount;
              if (!screenshot) return null;
              const groupRows = parseState.rows.slice(startIdx, startIdx + rowCount);
              return (
                <ScreenshotCard
                  key={screenshotId}
                  screenshot={screenshot}
                  detectedType="refinery_input"
                  hasRows={rowCount > 0}
                  onRemove={() => removeScreenshot(screenshotId)}
                  onEnlarge={() => setLightboxId(screenshotId)}
                  disabled={parsing}
                >
                  <div className="ri-wo-group">
                    <div className="ri-wo-columns">
                      <WorkOrderColumn
                        label="// MATERIALS SELECTED"
                        selectedCount={groupRows.filter((row) => row.include && row.selectedMaterialId).length}
                        onSelectAll={() => updateInputColumn(startIdx, rowCount, { include: true })}
                        onDeselectAll={() => updateInputColumn(startIdx, rowCount, { include: false })}
                        onClear={() => clearInputColumn(groupIdx, startIdx, rowCount)}
                      >
                        {rowCount === 0 ? (
                          <div className="ri-empty-rows">No rows detected.</div>
                        ) : (
                          <InputTable
                            rows={groupRows}
                            materials={reviewMaterials}
                            startIdx={startIdx}
                            onUpdate={updateInputRow}
                            onDelete={deleteInputRow}
                          />
                        )}
                      </WorkOrderColumn>
                    </div>
                  </div>
                </ScreenshotCard>
              );
            });
          })()}

          {/* Unknown screen */}
          {parseState.type === "unknown" && (
            <div className="ri-unknown-card">
              <div className="ri-unknown-title">Screen type not recognized</div>
              <div className="ri-unknown-hint">Expected a completed work order or materials selected screenshot.</div>
              {debugRawText && (
                <details className="logi-refimport-rawtext">
                  <summary>Raw OCR output</summary>
                  <pre>{debugRawText}</pre>
                </details>
              )}
            </div>
          )}

          <div className="ri-bar-spacer" />
        </div>
      )}

      {/* ── Lightbox ── */}
      {lightboxScreenshot && (
        <div
          className="logi-refimport-lightbox-overlay"
          onClick={() => setLightboxId(null)}
          role="dialog"
          aria-modal
          aria-label="Screenshot preview"
        >
          <div className="logi-refimport-lightbox" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="logi-refimport-lightbox-close"
              onClick={() => setLightboxId(null)}
              aria-label="Close preview"
            >
              ×
            </button>
            <div className="logi-refimport-lightbox-body">
              <img
                src={lightboxScreenshot.preview}
                alt="Screenshot enlarged"
                className="logi-refimport-lightbox-img"
              />
              {lightboxSections.length > 0 && (
                <div className="logi-refimport-lightbox-data">
                  {lightboxSections.map((section, i) => (
                    <div key={i} className="logi-refimport-lightbox-section">
                      <div className="logi-refimport-lightbox-section-label">{section.label}</div>
                      {section.rows.map((row, j) => (
                        <div key={j} className="logi-refimport-lightbox-row">
                          <span className="logi-refimport-lightbox-name">{row.name}</span>
                          <span className="logi-refimport-lightbox-val">{row.quality}</span>
                          <span className="logi-refimport-lightbox-val">{row.qty} {row.unit}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Sticky import bar ── */}
      {parseState !== null && hasRows && (
        <ImportBar
          screenshots={screenshots}
          totalWorkOrders={totalWorkOrders}
          includedCount={includedCount}
          totalScu={totalScu}
          warningCount={warningCount}
          locationId={locationId}
          setLocationId={setLocationId}
          locations={locations}
          imported={imported}
          onImport={handleImport}
          onCancel={handleClear}
        />
      )}
    </div>
  );
}

// ── ScreenshotCard ────────────────────────────────────────────────────────────

interface ManualAlignmentPreviewProps {
  screenshot: QueuedScreenshot;
  alignment: ManualAlignment | undefined;
  onChange: (patch: Partial<ManualAlignment>) => void;
  disabled: boolean;
}

function ManualAlignmentPreview({ screenshot, alignment, onChange, disabled }: ManualAlignmentPreviewProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelCount = alignment?.panelCount ?? 2;
  const cropBounds = sanitizeCropBounds(panelCount, alignment?.cropBounds);
  const edges = boundsToConnectedEdges(panelCount, cropBounds);

  const SNAP_PX = 8;
  const MIN_PANEL_WIDTH = 0.025;

  function snapToUsefulEdges(value: number, rectWidth: number) {
    const snapFrac = SNAP_PX / rectWidth;
    const usefulEdges = [0, 0.25, 1 / 3, 0.4, 0.5, 0.6, 2 / 3, 0.75, 1];
    const hit = usefulEdges.find((edge) => Math.abs(value - edge) < snapFrac);
    return hit ?? value;
  }

  function applyEdges(nextEdges: number[]) {
    onChange({ cropBounds: edgesToCropBounds(nextEdges) });
  }

  function moveEdge(edgeIdx: number, clientX: number) {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;

    const pointerValue = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const nextValue = snapToUsefulEdges(pointerValue, rect.width);
    const nextEdges = [...edges];
    const min = edgeIdx === 0 ? 0 : nextEdges[edgeIdx - 1] + MIN_PANEL_WIDTH;
    const max = edgeIdx === nextEdges.length - 1 ? 1 : nextEdges[edgeIdx + 1] - MIN_PANEL_WIDTH;
    nextEdges[edgeIdx] = Math.max(min, Math.min(max, nextValue));
    applyEdges(nextEdges);
  }

  function movePanelGroup(clientX: number, dragStartClientX: number, startEdges: number[]) {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;

    const delta = (clientX - dragStartClientX) / rect.width;
    const minDelta = -startEdges[0];
    const maxDelta = 1 - startEdges[startEdges.length - 1];
    const safeDelta = Math.max(minDelta, Math.min(maxDelta, delta));
    applyEdges(startEdges.map((edge) => edge + safeDelta));
  }

  const groupCenter = (edges[0] + edges[edges.length - 1]) / 2;

  return (
    <div className="ri-align-image-wrap" ref={wrapRef} style={{ position: "relative", overflow: "hidden" }}>
        <img
          src={screenshot.preview}
          alt="Refinery screenshot alignment preview"
          className="ri-align-image"
          onLoad={(event) => {
            const img = event.currentTarget;
            onChange({ naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight });
          }}
          draggable={false}
        />
        <button
          type="button"
          className="ri-align-group-handle"
          style={{ left: `${groupCenter * 100}%` }}
          onPointerDown={(event) => {
            if (disabled) return;
            const startClientX = event.clientX;
            const startEdges = [...edges];
            event.currentTarget.setPointerCapture(event.pointerId);
            event.currentTarget.dataset.dragging = "true";
            if (wrapRef.current) wrapRef.current.dataset.dragging = "true";
            event.currentTarget.dataset.startClientX = String(startClientX);
            event.currentTarget.dataset.startEdges = JSON.stringify(startEdges);
            movePanelGroup(event.clientX, startClientX, startEdges);
          }}
          onPointerMove={(event) => {
            if (disabled || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
            const startClientX = Number(event.currentTarget.dataset.startClientX ?? event.clientX);
            const startEdges = JSON.parse(event.currentTarget.dataset.startEdges ?? "[]") as number[];
            if (startEdges.length) movePanelGroup(event.clientX, startClientX, startEdges);
          }}
          onPointerUp={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId);
              delete event.currentTarget.dataset.dragging;
              delete event.currentTarget.dataset.startClientX;
              delete event.currentTarget.dataset.startEdges;
              if (wrapRef.current) delete wrapRef.current.dataset.dragging;
            }
          }}
          aria-label="Move all panel edges together"
          disabled={disabled}
        >
          Move Panels
        </button>
        {cropBounds.map((bound, panelIdx) => (
          <div
            key={panelIdx}
            className="ri-align-panel-tint"
            style={{
              left: `${bound.left * 100}%`,
              width: `${(bound.right - bound.left) * 100}%`,
            }}
          >
            <span className="ri-align-panel-label">Panel {panelIdx + 1}</span>
          </div>
        ))}
        {edges.map((value, edgeIdx) => (
          <button
            key={`edge-${edgeIdx}`}
            type="button"
            className="ri-align-divider ri-align-divider--edge"
            style={{
              left: `${value * 100}%`,
            }}
            onPointerDown={(event) => {
              if (disabled) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              event.currentTarget.dataset.dragging = "true";
              if (wrapRef.current) wrapRef.current.dataset.dragging = "true";
              moveEdge(edgeIdx, event.clientX);
            }}
            onPointerMove={(event) => {
              if (disabled || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
              moveEdge(edgeIdx, event.clientX);
            }}
            onPointerUp={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
                delete event.currentTarget.dataset.dragging;
                if (wrapRef.current) delete wrapRef.current.dataset.dragging;
              }
            }}
            aria-label={edgeIdx === 0 ? "Move left outer panel edge" : edgeIdx === edges.length - 1 ? "Move right outer panel edge" : `Move shared edge between panel ${edgeIdx} and panel ${edgeIdx + 1}`}
            disabled={disabled}
          />
        ))}
    </div>
  );
}

interface ScreenshotCardProps {
  screenshot: QueuedScreenshot;
  detectedType: RefineryScreenType;
  hasRows: boolean;
  onRemove: () => void;
  onEnlarge: () => void;
  disabled: boolean;
  children: React.ReactNode;
}

function ScreenshotCard({ screenshot, detectedType, hasRows, onRemove, onEnlarge, disabled, children }: ScreenshotCardProps) {
  return (
    <div className="ri-ss-card">
      <div className="ri-ss-card-hdr">
        <span className="ri-ss-card-name">{screenshot.file.name}</span>
        <span className={`logi-refimport-screen-badge ${SCREEN_MOD[detectedType]}`}>
          {SCREEN_LABEL[detectedType]}
        </span>
        {!hasRows && (
          <span className="logi-refimport-screen-badge logi-refimport-screen-badge--unknown">No rows</span>
        )}
        <button
          type="button"
          className="logi-btn-ghost logi-refimport-btn-sm ri-ss-remove"
          onClick={onRemove}
          disabled={disabled}
        >
          Remove
        </button>
      </div>
      <div className="ri-ss-card-body">
        <div className="ri-ss-card-preview-col">
          <img
            src={screenshot.preview}
            alt="Refinery screenshot"
            className="ri-ss-card-img"
            onClick={onEnlarge}
            title="Click to enlarge"
          />
          <button type="button" className="ri-enlarge-btn" onClick={onEnlarge}>
            <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="11" height="11">
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
            </svg>
            Enlarge
          </button>
        </div>
        <div className="ri-ss-card-rows-col">
          {children}
        </div>
      </div>
    </div>
  );
}


interface CroppedPanelImageProps {
  src: string;
  region?: PanelRegion;
  totalPanelsInScreenshot: number;
  panelIdxInScreenshot: number;
  className?: string;
  alt: string;
  onClick?: () => void;
}

function CroppedPanelImage({
  src,
  region,
  totalPanelsInScreenshot,
  panelIdxInScreenshot,
  className,
  alt,
  onClick,
}: CroppedPanelImageProps) {
  void totalPanelsInScreenshot;
  void panelIdxInScreenshot;

  const [croppedSrc, setCroppedSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!region) {
      setCroppedSrc(null);
      return;
    }

    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, region.sw);
      canvas.height = Math.max(1, region.sh);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setCroppedSrc(null);
        return;
      }
      ctx.drawImage(
        img,
        region.sx,
        region.sy,
        region.sw,
        region.sh,
        0,
        0,
        canvas.width,
        canvas.height,
      );
      setCroppedSrc(canvas.toDataURL("image/png"));
    };
    img.onerror = () => setCroppedSrc(null);
    img.src = src;

    return () => {
      cancelled = true;
    };
  }, [src, region?.sx, region?.sy, region?.sw, region?.sh]);

  const reviewImageStyle: React.CSSProperties = {
    width: "100%",
    height: "auto",
    maxHeight: "none",
    objectFit: "initial",
    objectPosition: "left top",
    cursor: onClick ? "zoom-in" : undefined,
  };

  if (croppedSrc) {
    return (
      <img
        src={croppedSrc}
        className={className}
        style={reviewImageStyle}
        alt={alt}
        draggable={false}
        onClick={onClick}
      />
    );
  }

  return (
    <img
      src={src}
      className={className}
      style={reviewImageStyle}
      alt={alt}
      draggable={false}
      onClick={onClick}
    />
  );
}

// ── WorkOrderReviewCard ───────────────────────────────────────────────────────

interface WorkOrderReviewCardProps {
  workOrder: DraftWorkOrder;
  totalPanelsInScreenshot: number;
  panelIdxInScreenshot: number;
  screenshot: QueuedScreenshot;
  materials: MaterialTemplate[];
  onUpdate: (rowIdx: number, patch: Partial<DraftRow>) => void;
  onDelete: (rowIdx: number) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onClear: () => void;
  onEnlarge: () => void;
  disabled: boolean;
}

function WorkOrderReviewCard({
  workOrder,
  totalPanelsInScreenshot,
  panelIdxInScreenshot,
  screenshot,
  materials,
  onUpdate,
  onDelete,
  onSelectAll,
  onDeselectAll,
  onClear,
  onEnlarge,
  disabled,
}: WorkOrderReviewCardProps) {
  const rows = workOrder.rows;
  const n = rows.length;
  const selectedCount = rows.filter((r) => r.include && r.selectedMaterialId).length;
  const firstRowRatio = rows.find((row) => typeof row.rowYRatio === "number")?.rowYRatio;
  const panelPreviewWidth = 220;
  const panelDisplayHeight = workOrder.panelRegion
    ? panelPreviewWidth * (workOrder.panelRegion.sh / Math.max(1, workOrder.panelRegion.sw))
    : 0;
  const rowAlignTop = typeof firstRowRatio === "number"
    ? Math.max(0, Math.min(240, Math.round(firstRowRatio * panelDisplayHeight + 10)))
    : 0;

  return (
    <div className="ri-wo-review-card">
      <div className="ri-wo-review-hdr">
        <div className="ri-wo-review-hdr-left">
          <span className="ri-wo-label">// Work Order {workOrder.workOrderNumber}</span>
          <span className="ri-wo-count">{selectedCount} selected</span>
          {workOrder.sourceLocationName && (
            <span className="ri-wo-source-loc" title="Detected from the full screenshot header">
              {workOrder.sourceLocationName}
            </span>
          )}
          {workOrder.totalYieldCscu != null && (
            <span className="ri-wo-yield">
              {workOrder.totalYieldCscu} <small className="logi-refimport-unit">cSCU</small>
            </span>
          )}
        </div>
        <div className="ri-wo-review-hdr-actions">
          <button type="button" className="logi-btn-ghost logi-refimport-btn-sm" onClick={onSelectAll} disabled={disabled}>Select all</button>
          <button type="button" className="logi-btn-ghost logi-refimport-btn-sm" onClick={onDeselectAll} disabled={disabled}>Deselect all</button>
          <button type="button" className="logi-btn-ghost logi-refimport-btn-sm" onClick={onClear} disabled={disabled}>Clear</button>
          <button type="button" className="logi-btn-ghost logi-refimport-btn-sm" onClick={onEnlarge} disabled={disabled}>
            <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="11" height="11">
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
            </svg>
            Enlarge
          </button>
        </div>
      </div>

      {n === 0 ? (
        <div className="ri-empty-rows" style={{ padding: "0.75rem 1rem" }}>No rows detected in this panel.</div>
      ) : (
        <div className="ri-wo-review-body">
          <div className="ri-wo-panel-col">
            <div className="ri-wo-panel-clip">
              <CroppedPanelImage
                src={screenshot.preview}
                region={workOrder.panelRegion}
                totalPanelsInScreenshot={totalPanelsInScreenshot}
                panelIdxInScreenshot={panelIdxInScreenshot}
                className="ri-wo-panel-img"
                alt="Work order panel"
                onClick={onEnlarge}
              />
            </div>
          </div>

          <div
            className="ri-wo-review-rows"
            style={{ "--ri-row-align-top": `${rowAlignTop}px` } as React.CSSProperties}
          >
            <table className="logi-table logi-refimport-table">
              <thead>
                <tr>
                  <th style={{ width: 28 }} />
                  <th>Material</th>
                  <th>Quality</th>
                  <th>Yield (cSCU)</th>
                  <th style={{ width: 34 }} />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIdx) => (
                  <tr
                    key={rowIdx}
                    className={!row.include ? "logi-refimport-row--excluded" : ""}
                  >

                    <td>
                      <input
                        type="checkbox"
                        className="logi-refimport-check"
                        checked={row.include}
                        onChange={(e) => onUpdate(rowIdx, { include: e.target.checked })}
                        aria-label={`Include ${row.rawName}`}
                      />
                    </td>
                    <td>
                      {row.needsReview && row.materialId !== null && (
                        <span className="logi-refimport-review-tag" title="Low OCR confidence — please verify">REVIEW</span>
                      )}
                      {row.materialId === null && (
                        <span className="logi-refimport-unmatched-tag">{row.rawName}</span>
                      )}
                      <select
                        className={`logi-select logi-refimport-mat-select${row.materialId === null ? " logi-refimport-mat-select--warn" : ""}`}
                        value={row.selectedMaterialId}
                        onChange={(e) => onUpdate(rowIdx, { selectedMaterialId: e.target.value })}
                        aria-label="Material"
                      >
                        <option value="">— select —</option>
                        {materials.map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        className="logi-refimport-num"
                        min={0}
                        max={1000}
                        value={row.editedQuality}
                        onChange={(e) =>
                          onUpdate(rowIdx, { editedQuality: Math.max(0, Math.min(1000, parseInt(e.target.value, 10) || 0)) })
                        }
                        aria-label="Quality"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className="logi-refimport-num"
                        min={0}
                        value={row.editedQuantity}
                        onChange={(e) =>
                          onUpdate(rowIdx, { editedQuantity: Math.max(0, parseInt(e.target.value, 10) || 0) })
                        }
                        aria-label="Yield (cSCU)"
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="ri-row-delete-btn"
                        onClick={() => onDelete(rowIdx)}
                        aria-label={`Delete ${row.rawName}`}
                        title="Delete row"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── CompleteOrderTable ────────────────────────────────────────────────────────

interface WorkOrderColumnProps {
  label: string;
  selectedCount: number;
  totalYieldCscu?: number | null;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onClear: () => void;
  children: React.ReactNode;
}

function WorkOrderColumn({
  label,
  selectedCount,
  totalYieldCscu,
  onSelectAll,
  onDeselectAll,
  onClear,
  children,
}: WorkOrderColumnProps) {
  return (
    <section className="ri-wo-column" aria-label={label.replace("// ", "")}>
      <div className="ri-wo-column-head">
        <div>
          <div className="ri-wo-label">{label}</div>
          <div className="ri-wo-count">{selectedCount} selected</div>
        </div>
        {totalYieldCscu != null && (
          <span className="ri-wo-yield">{totalYieldCscu} <small className="logi-refimport-unit">cSCU</small></span>
        )}
      </div>
      <div className="ri-wo-actions" aria-label={`${label} actions`}>
        <button type="button" className="logi-btn-ghost logi-refimport-btn-sm" onClick={onSelectAll}>Select all</button>
        <button type="button" className="logi-btn-ghost logi-refimport-btn-sm" onClick={onDeselectAll}>Deselect all</button>
        <button type="button" className="logi-btn-ghost logi-refimport-btn-sm" onClick={onClear}>Clear column</button>
      </div>
      {children}
    </section>
  );
}

interface CompleteOrderTableProps {
  rows: DraftRow[];
  materials: MaterialTemplate[];
  onUpdate: (rowIdx: number, patch: Partial<DraftRow>) => void;
}

function CompleteOrderTable({ rows, materials, onUpdate }: CompleteOrderTableProps) {
  if (rows.length === 0) {
    return <div className="ri-empty-rows">No rows detected in this panel.</div>;
  }
  return (
    <table className="logi-table logi-refimport-table">
      <thead>
        <tr>
          <th style={{ width: 28 }} />
          <th>Material</th>
          <th>Quality</th>
          <th>Yield (cSCU)</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIdx) => (
          <tr key={rowIdx} className={!row.include ? "logi-refimport-row--excluded" : ""}>
            <td>
              <input
                type="checkbox"
                className="logi-refimport-check"
                checked={row.include}
                onChange={(e) => onUpdate(rowIdx, { include: e.target.checked })}
                aria-label={`Include ${row.rawName}`}
              />
            </td>
            <td>
              {row.needsReview && row.materialId !== null && (
                <span className="logi-refimport-review-tag" title="Low OCR confidence — please verify">REVIEW</span>
              )}
              {row.materialId === null && (
                <span className="logi-refimport-unmatched-tag">{row.rawName}</span>
              )}
              <select
                className={`logi-select logi-refimport-mat-select${row.materialId === null ? " logi-refimport-mat-select--warn" : ""}`}
                value={row.selectedMaterialId}
                onChange={(e) => onUpdate(rowIdx, { selectedMaterialId: e.target.value })}
                aria-label="Material"
              >
                <option value="">— select —</option>
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </td>
            <td>
              <input
                type="number"
                className="logi-refimport-num"
                min={0}
                max={1000}
                value={row.editedQuality}
                onChange={(e) =>
                  onUpdate(rowIdx, { editedQuality: Math.max(0, Math.min(1000, parseInt(e.target.value, 10) || 0)) })
                }
                aria-label="Quality"
              />
            </td>
            <td>
              <input
                type="number"
                className="logi-refimport-num"
                min={0}
                value={row.editedQuantity}
                onChange={(e) =>
                  onUpdate(rowIdx, { editedQuantity: Math.max(0, parseInt(e.target.value, 10) || 0) })
                }
                aria-label="Yield (cSCU)"
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── InputTable ────────────────────────────────────────────────────────────────

interface InputTableProps {
  rows: InputDraftRow[];
  materials: MaterialTemplate[];
  startIdx: number;
  onUpdate: (globalIdx: number, patch: Partial<InputDraftRow>) => void;
  onDelete?: (globalIdx: number) => void;
}

function InputTable({ rows, materials, startIdx, onUpdate, onDelete }: InputTableProps) {
  if (rows.length === 0) {
    return <div className="ri-empty-rows">No rows detected.</div>;
  }
  return (
    <table className="logi-table logi-refimport-table">
      <thead>
        <tr>
          <th style={{ width: 28 }} />
          <th>Material</th>
          <th>Type</th>
          <th>Quality</th>
          <th>Qty (cSCU)</th>
          <th>Yield (cSCU)</th>
          <th style={{ width: 34 }} />
        </tr>
      </thead>
      <tbody>
        {rows.map((row, localIdx) => {
          const globalIdx = startIdx + localIdx;
          return (
            <tr
              key={globalIdx}
              className={[
                !row.include ? "logi-refimport-row--excluded" : "",
                row.isDuplicate ? "logi-refimport-row--duplicate" : "",
              ].filter(Boolean).join(" ")}
            >
              <td>
                <input
                  type="checkbox"
                  className="logi-refimport-check"
                  checked={row.include}
                  onChange={(e) => onUpdate(globalIdx, { include: e.target.checked })}
                  aria-label={`Include ${row.rawName}`}
                />
              </td>
              <td>
                {row.isDuplicate && (
                  <span className="logi-refimport-duplicate-tag" title="Duplicate quality stack already detected">DUPLICATE</span>
                )}
                {row.materialId === null && (
                  <span className="logi-refimport-unmatched-tag">{row.rawName}</span>
                )}
                <select
                  className={`logi-select logi-refimport-mat-select${row.materialId === null ? " logi-refimport-mat-select--warn" : ""}`}
                  value={row.selectedMaterialId}
                  onChange={(e) => onUpdate(globalIdx, { selectedMaterialId: e.target.value })}
                  aria-label="Material"
                >
                  <option value="">— select —</option>
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </td>
              <td>
                {row.rawType ? (
                  <span className="logi-refimport-type-pill">{row.rawType}</span>
                ) : (
                  <span className="logi-refimport-type-pill logi-refimport-type-pill--none">—</span>
                )}
              </td>
              <td>
                <input
                  type="number"
                  className="logi-refimport-num"
                  min={0}
                  max={1000}
                  value={row.editedQuality}
                  onChange={(e) =>
                    onUpdate(globalIdx, { editedQuality: Math.max(0, Math.min(1000, parseInt(e.target.value, 10) || 0)) })
                  }
                  aria-label="Quality"
                />
              </td>
              <td>
                <input
                  type="number"
                  className="logi-refimport-num"
                  min={0}
                  value={row.editedQtyCscu}
                  onChange={(e) =>
                    onUpdate(globalIdx, { editedQtyCscu: Math.max(0, parseInt(e.target.value, 10) || 0) })
                  }
                  aria-label="Quantity"
                />
              </td>
              <td>
                {row.yieldCscu != null ? (
                  <span className="logi-refimport-yield-val">
                    {formatQuantity(cscuToScu(row.yieldCscu), materials.find((m) => m.id === row.selectedMaterialId))}
                  </span>
                ) : (
                  <span className="logi-refimport-yield-null">—</span>
                )}
              </td>
              <td>
                {onDelete && (
                  <button
                    type="button"
                    className="ri-row-delete-btn"
                    onClick={() => onDelete(globalIdx)}
                    aria-label={`Delete ${row.rawName}`}
                    title="Delete row"
                  >
                    ×
                  </button>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ── ImportBar ─────────────────────────────────────────────────────────────────

interface ImportBarProps {
  screenshots: QueuedScreenshot[];
  totalWorkOrders: number;
  includedCount: number;
  totalScu: number;
  warningCount: number;
  locationId: string;
  setLocationId: (id: string) => void;
  locations: { id: string; name: string }[];
  imported: boolean;
  onImport: () => void;
  onCancel: () => void;
}

function ImportBar({
  screenshots,
  totalWorkOrders,
  includedCount,
  totalScu,
  warningCount,
  locationId,
  setLocationId,
  locations,
  imported,
  onImport,
  onCancel,
}: ImportBarProps) {
  return (
    <div className="ri-import-bar">
      <div className="ri-import-bar-stats">
        <div className="ri-import-stat">
          <span className="ri-stat-val">{screenshots.length}</span>
          <span className="ri-stat-lbl">screenshot{screenshots.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="ri-stat-sep" />
        <div className="ri-import-stat">
          <span className="ri-stat-val">{totalWorkOrders}</span>
          <span className="ri-stat-lbl">work order{totalWorkOrders !== 1 ? "s" : ""}</span>
        </div>
        <div className="ri-stat-sep" />
        <div className="ri-import-stat">
          <span className="ri-stat-val">{includedCount}</span>
          <span className="ri-stat-lbl">selected</span>
        </div>
        <div className="ri-stat-sep" />
        <div className="ri-import-stat">
          <span className="ri-stat-val">{totalScu.toFixed(2)}</span>
          <span className="ri-stat-lbl">SCU</span>
        </div>
        {warningCount > 0 && (
          <>
            <div className="ri-stat-sep" />
            <div className="ri-import-stat ri-import-stat--warn">
              <span className="ri-stat-val">{warningCount}</span>
              <span className="ri-stat-lbl">warning{warningCount !== 1 ? "s" : ""}</span>
            </div>
          </>
        )}
      </div>
      <div className="ri-import-bar-right">
        <div className="ri-import-location">
          <label className="logi-refimport-field-label" htmlFor="ri-location-bar">Location</label>
          <select
            id="ri-location-bar"
            className="logi-select"
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
          >
            <option value="">— No location —</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>
        {imported ? (
          <div className="logi-refimport-success">
            <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="15" height="15">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {includedCount} entr{includedCount === 1 ? "y" : "ies"} added.
            <Link to="/logistics/inventory" className="logi-refimport-inv-link">View Inventory →</Link>
          </div>
        ) : (
          <>
            {!locationId && (
              <span className="ri-import-location-warn">Location required</span>
            )}
            <button
              type="button"
              className="logi-btn-primary"
              onClick={onImport}
              disabled={includedCount === 0 || !locationId}
            >
              Save selected rows to inventory
            </button>
          </>
        )}
        <button type="button" className="logi-btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
