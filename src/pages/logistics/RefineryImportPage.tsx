import { useState, useRef, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useLogisticsStore, createInventoryEntryDraft } from "../../stores/logisticsStore";
import { formatQuantity } from "../../lib/logistics/inventory";
import { parseRefineryScreenshot } from "../../lib/logistics/refineryOcr";
import type {
  ParsedRefineryRow,
  ParsedWorkOrder,
  ParsedInputRow,
  RefineryScreenType,
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
  rows: DraftRow[];
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

function toDraftWorkOrder(wo: ParsedWorkOrder, screenshotId: string): DraftWorkOrder {
  return {
    screenshotId,
    workOrderNumber: wo.workOrderNumber,
    totalYieldCscu: wo.totalYieldCscu,
    rows: wo.rows.map(toDraftRow),
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
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

  const inputRef = useRef<HTMLInputElement>(null);

  const loadFiles = useCallback((files: File[]) => {
    if (files.length === 0) return;
    const imageFiles = files.filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      setParseError("Files must be images (PNG or JPG).");
      return;
    }
    setScreenshots((prev) => [
      ...prev,
      ...imageFiles.map((file) => ({
        id: crypto.randomUUID(),
        file,
        preview: URL.createObjectURL(file),
      })),
    ]);
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
        const ocrResult = await parseRefineryScreenshot(screenshot.file, materials, (pct) => {
          setParseProgress(Math.round(((i + pct / 100) / screenshots.length) * 100));
        });

        if (ocrResult.screenType === "refinery_complete") {
          if (nextState?.type === "refinery_input") {
            throw new Error("Upload completed-order screenshots separately from materials selected screenshots.");
          }
          const existingWorkOrders: DraftWorkOrder[] = nextState?.type === "refinery_complete" ? nextState.workOrders : [];
          nextState = {
            type: "refinery_complete",
            workOrders: [...existingWorkOrders, ...ocrResult.workOrders.map((wo) => toDraftWorkOrder(wo, screenshot.id))],
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
            rows: applyDuplicateFlags([...existingRows, ...newRows], existingRows.length),
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

  function updateInputRow(idx: number, patch: Partial<InputDraftRow>) {
    setParseState((s) => {
      if (!s || s.type !== "refinery_input") return s;
      const updated = s.rows.map((r, i) => (i === idx ? { ...r, ...patch } : r));
      const needsDedup = "selectedMaterialId" in patch || "editedQuality" in patch;
      return { ...s, rows: needsDedup ? applyDuplicateFlags(updated, updated.length) : updated };
    });
  }

  function handleImport() {
    if (!parseState || parseState.type === "unknown") return;
    const entries =
      parseState.type === "refinery_complete"
        ? parseState.workOrders.flatMap((wo) =>
            wo.rows
              .filter((r) => r.include && r.selectedMaterialId)
              .map((r) =>
                createInventoryEntryDraft({
                  id: crypto.randomUUID(),
                  materialId: r.selectedMaterialId,
                  quantity: cscuToScu(r.editedQuantity),
                  quality: r.editedQuality,
                  locationId: locationId || undefined,
                }),
              ),
          )
        : parseState.rows
            .filter((r) => r.include && r.selectedMaterialId)
            .map((r) =>
              createInventoryEntryDraft({
                id: crypto.randomUUID(),
                materialId: r.selectedMaterialId,
                quantity: cscuToScu(r.editedQtyCscu),
                quality: r.editedQuality,
                locationId: locationId || undefined,
              }),
            );
    if (entries.length === 0) return;
    addInventoryEntries(entries);
    setImported(true);
  }

  function handleClear() {
    screenshots.forEach((ss) => URL.revokeObjectURL(ss.preview));
    setScreenshots([]);
    setParseState(null);
    setParseError(null);
    setImported(false);
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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="logi-page ri-page">
      <div className="logi-page-header">
        <div>
          <div className="logi-breadcrumb">
            <Link to="/logistics" className="logi-breadcrumb-link">Logistics</Link>
            {returnLink && (
              <>
                <span className="logi-breadcrumb-sep">/</span>
                <Link to={returnLink.to} className="logi-breadcrumb-link">Back to {returnLink.label}</Link>
              </>
            )}
            <span className="logi-breadcrumb-sep">/</span>
            <span className="logi-breadcrumb-active">Refinery Import</span>
          </div>
          <h1 className="logi-page-title">Refinery Import</h1>
          <p className="logi-page-subtitle">Upload refinery screenshots to import materials into inventory.</p>
        </div>
      </div>

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
            <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="32" height="32" opacity="0.35">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
            </svg>
            <span className="ri-drop-label">Drop screenshots or click to browse</span>
            <span className="ri-drop-hint">PNG · JPG · Multiple files supported</span>
          </div>

          <div className="ri-helper-card">
            <div className="ri-helper-title">What this importer reads</div>
            <div className="ri-helper-types">
              <div className="ri-helper-type">
                <span className="logi-refimport-screen-badge logi-refimport-screen-badge--complete">Completed Work Order</span>
                <span className="ri-helper-type-desc">End-of-refinery panel showing refined yields per material. One screenshot may contain multiple work order panels.</span>
              </div>
              <div className="ri-helper-type">
                <span className="logi-refimport-screen-badge logi-refimport-screen-badge--input">Materials Selected</span>
                <span className="ri-helper-type-desc">Refinery input screen showing ore quantities before processing.</span>
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
        </div>
      )}

      {/* ── Pre-parse: files queued ── */}
      {screenshots.length > 0 && parseState === null && (
        <div className="ri-preparse">
          <div
            className={["ri-dropzone ri-dropzone--compact", isDragOver ? "ri-dropzone--drag" : ""].filter(Boolean).join(" ")}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
          >
            <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14" opacity="0.4">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
            </svg>
            <span className="ri-drop-label">{screenshots.length} file{screenshots.length !== 1 ? "s" : ""} queued — drop more or click to add</span>
          </div>

          <div className="ri-file-stack">
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
            <button type="button" className="logi-btn-ghost logi-refimport-btn-sm" onClick={handleClear} disabled={parsing}>
              Clear all
            </button>
          </div>

          <button type="button" className="logi-btn-primary ri-parse-btn" onClick={handleParse} disabled={parsing}>
            {parsing ? (
              <><span className="logi-refimport-spinner" aria-hidden /> Parsing… {parseProgress}%</>
            ) : (
              `Parse ${screenshots.length === 1 ? "Screenshot" : `${screenshots.length} Screenshots`}`
            )}
          </button>
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
            return (
              <ScreenshotCard
                key={screenshot.id}
                screenshot={screenshot}
                detectedType="refinery_complete"
                hasRows={woItems.some(({ wo }) => wo.rows.length > 0)}
                onRemove={() => removeScreenshot(screenshot.id)}
                onEnlarge={() => setLightboxId(screenshot.id)}
                disabled={parsing}
              >
                {woItems.length === 0 ? (
                  <div className="ri-empty-rows">No work orders detected in this screenshot.</div>
                ) : (
                  woItems.map(({ wo, idx: woIdx }) => (
                    <div key={woIdx} className="ri-wo-group">
                      <div className="ri-wo-hdr">
                        <span className="ri-wo-label">// WORK ORDER {wo.workOrderNumber}</span>
                        {wo.totalYieldCscu != null && (
                          <span className="ri-wo-yield">{wo.totalYieldCscu} <small className="logi-refimport-unit">cSCU</small></span>
                        )}
                      </div>
                      <CompleteOrderTable
                        rows={wo.rows}
                        materials={materials}
                        onUpdate={(rowIdx, patch) => updateCompleteRow(woIdx, rowIdx, patch)}
                      />
                    </div>
                  ))
                )}
              </ScreenshotCard>
            );
          })}

          {/* Materials selected cards */}
          {parseState.type === "refinery_input" && (() => {
            let rowOffset = 0;
            return parseState.screenshotGroups.map(({ screenshotId, rowCount }) => {
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
                    <div className="ri-wo-hdr">
                      <span className="ri-wo-label">// MATERIALS SELECTED</span>
                    </div>
                    {rowCount === 0 ? (
                      <div className="ri-empty-rows">No rows detected.</div>
                    ) : (
                      <InputTable
                        rows={groupRows}
                        materials={materials}
                        startIdx={startIdx}
                        onUpdate={updateInputRow}
                      />
                    )}
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
                          <span className="logi-refimport-lightbox-val">Q {row.quality}</span>
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
        />
      )}
    </div>
  );
}

// ── ScreenshotCard ────────────────────────────────────────────────────────────

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

// ── CompleteOrderTable ────────────────────────────────────────────────────────

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
}

function InputTable({ rows, materials, startIdx, onUpdate }: InputTableProps) {
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
          <button
            type="button"
            className="logi-btn-primary"
            onClick={onImport}
            disabled={includedCount === 0}
          >
            Import {includedCount > 0 ? `${includedCount} ` : ""}{includedCount === 1 ? "Entry" : "Entries"}
          </button>
        )}
      </div>
    </div>
  );
}
