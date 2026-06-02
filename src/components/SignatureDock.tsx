import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MINEABLE_SIGNATURES } from "../data/mineableSignatures";
import {
  DEFAULT_SIGNATURE_PRESET_CATALOG,
  buildSignaturePresetCatalog,
  resolveSignaturePresetMaterialKeys,
} from "../data/signaturePresets";
import { loadStaticMiningIndex } from "../features/mining/staticMiningIndex";
import "./SignatureDock.css";

// ── persistence ──────────────────────────────────────────────────────────────
const LS_KEY = "sdock_state";

interface PersistedState {
  open: boolean;
  pinned: boolean;
  minimized: boolean;
  fontWeight?: number;
  fontSize: number;
  pos: { x: number; y: number } | null;
  activeIds: number[];
  activePresetId?: string | null;
  activeMaterialKeys?: string[];
  pinnedMaterialKeys?: string[];
  isPresetModified?: boolean;
}

function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as PersistedState;
  } catch { /* ignore */ }
  return { open: false, pinned: false, minimized: false, fontWeight: 800, fontSize: 12, pos: null, activeIds: [] };
}

function saveState(s: PersistedState) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

// ── drag helper ───────────────────────────────────────────────────────────────
function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function startDrag(
  e: React.PointerEvent,
  onMove: (dx: number, dy: number) => void
) {
  e.preventDefault();
  const startX = e.clientX;
  const startY = e.clientY;
  const target = e.currentTarget as HTMLElement;
  target.setPointerCapture(e.pointerId);

  function handleMove(me: PointerEvent) { onMove(me.clientX - startX, me.clientY - startY); }
  function handleUp() {
    target.removeEventListener("pointermove", handleMove);
    target.removeEventListener("pointerup", handleUp);
  }
  target.addEventListener("pointermove", handleMove);
  target.addEventListener("pointerup", handleUp);
}

// ── default position ──────────────────────────────────────────────────────────
// Anchor point = top-left corner of the tab / panel / strip.
// Tab default: right edge of viewport, 30% from top.
// We store the left edge so: x = viewportWidth - tabWidth(44)
function defaultPos() {
  return {
    x: window.innerWidth - 44,
    y: Math.round(window.innerHeight * 0.3),
  };
}

function formatVal(n: number) {
  return n.toLocaleString("en-US");
}

function normalizeMaterialKey(value: string) {
  const compact = value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (compact === "aluminum") return "aluminium";
  if (compact === "quantainium") return "quantanium";
  if (compact === "savrillium") return "savrilium";
  if (compact === "pressurizedice") return "ice";
  return compact;
}

const signatureIndexByMaterialKey = new Map(
  MINEABLE_SIGNATURES.map((signature, index) => [normalizeMaterialKey(signature.name), index])
);

function materialKeysFromIds(ids: number[]) {
  return ids
    .map((id) => MINEABLE_SIGNATURES[id]?.name)
    .filter((name): name is string => Boolean(name))
    .map(normalizeMaterialKey);
}

function rowsFromMaterialKeys(materialKeys: Set<string> | string[]) {
  const keySet = Array.isArray(materialKeys) ? new Set(materialKeys) : materialKeys;
  return MINEABLE_SIGNATURES.filter((signature) => keySet.has(normalizeMaterialKey(signature.name)));
}

function signatureRowKey(index: number) {
  return normalizeMaterialKey(MINEABLE_SIGNATURES[index]?.name ?? "");
}

// ── component ─────────────────────────────────────────────────────────────────
export default function SignatureDock() {
  const [init] = useState<PersistedState>(() => loadState());

  const [open, setOpen]           = useState(init.open);
  const [pinned, setPinned]       = useState(init.pinned);
  const [minimized, setMinimized] = useState(init.minimized);
  const [fontWeight, setFontWeight] = useState(init.fontWeight ?? 800);
  const [fontSize, setFontSize]   = useState(init.fontSize ?? 12);
  const [activePresetId, setActivePresetId] = useState<string | null>(init.activePresetId ?? null);
  const [activeMaterialKeys, setActiveMaterialKeys] = useState<Set<string>>(
    () => new Set(init.activeMaterialKeys ?? materialKeysFromIds(init.activeIds))
  );
  const [pinnedMaterialKeys, setPinnedMaterialKeys] = useState<Set<string>>(
    () => new Set(init.pinnedMaterialKeys ?? init.activeMaterialKeys ?? materialKeysFromIds(init.activeIds))
  );
  const [isPresetModified, setIsPresetModified] = useState(init.isPresetModified ?? false);
  const [presetPickerOpen, setPresetPickerOpen] = useState(false);
  const [presetSearch, setPresetSearch] = useState("");
  const [highlightedPresetIndex, setHighlightedPresetIndex] = useState(0);
  const [presetCatalog, setPresetCatalog] = useState(DEFAULT_SIGNATURE_PRESET_CATALOG);
  const [search, setSearch]       = useState("");
  const [pos, setPos]             = useState<{ x: number; y: number }>(init.pos ?? defaultPos());

  const elRef = useRef<HTMLDivElement>(null);
  const presetPickerRef = useRef<HTMLDivElement>(null);

  // ── persist ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    saveState({
      open,
      pinned,
      minimized,
      fontWeight,
      fontSize,
      pos,
      activeIds: Array.from(activeMaterialKeys)
        .map((key) => signatureIndexByMaterialKey.get(normalizeMaterialKey(key)))
        .filter((id): id is number => typeof id === "number"),
      activePresetId,
      activeMaterialKeys: Array.from(activeMaterialKeys),
      pinnedMaterialKeys: Array.from(pinnedMaterialKeys),
      isPresetModified,
    });
  }, [open, pinned, minimized, fontWeight, fontSize, pos, activePresetId, activeMaterialKeys, pinnedMaterialKeys, isPresetModified]);

  // ── viewport clamp on resize ─────────────────────────────────────────────────
  useEffect(() => {
    function onResize() {
      setPos((p) => ({
        x: clamp(p.x, 0, window.innerWidth - 44),
        y: clamp(p.y, 0, window.innerHeight - 44),
      }));
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!presetPickerOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (!presetPickerRef.current?.contains(e.target as Node)) {
        setPresetPickerOpen(false);
        setPresetSearch("");
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [presetPickerOpen]);

  useEffect(() => {
    let cancelled = false;
    loadStaticMiningIndex()
      .then((index) => {
        if (!cancelled) setPresetCatalog(buildSignaturePresetCatalog(index.rows));
      })
      .catch((error) => {
        if (import.meta.env.DEV) console.warn("[signature dock] failed to load location presets", error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ── single shared drag handler ────────────────────────────────────────────────
  const onDrag = useCallback(
    (e: React.PointerEvent) => {
      const startX = pos.x;
      const startY = pos.y;
      const elW = elRef.current?.offsetWidth ?? 44;
      const elH = elRef.current?.offsetHeight ?? 44;
      startDrag(e, (dx, dy) => {
        setPos({
          x: clamp(startX + dx, 0, window.innerWidth - elW),
          y: clamp(startY + dy, 0, window.innerHeight - elH),
        });
      });
    },
    [pos]
  );

  // ── helpers ──────────────────────────────────────────────────────────────────
  const toggleRow = useCallback((idx: number) => {
    const materialKey = signatureRowKey(idx);
    setActiveMaterialKeys((prev) => {
      const next = new Set(prev);
      if (next.has(materialKey)) next.delete(materialKey); else next.add(materialKey);
      if (next.size === 0) {
        setActivePresetId(null);
        setPinnedMaterialKeys(new Set());
        setIsPresetModified(false);
        return next;
      }
      if (pinned) setPinnedMaterialKeys(new Set(next));
      if (activePresetId) setIsPresetModified(true);
      return next;
    });
  }, [activePresetId, pinned]);

  const selectPreset = useCallback((presetId: string) => {
    const materialKeys = resolveSignaturePresetMaterialKeys(presetId, presetCatalog);
    const next = new Set(materialKeys);
    setActivePresetId(presetId);
    setActiveMaterialKeys(next);
    setPinnedMaterialKeys(new Set(next));
    setPinned(true);
    setMinimized(true);
    setIsPresetModified(false);
    setPresetPickerOpen(false);
    setPresetSearch("");
  }, [presetCatalog]);

  const handleOpen     = useCallback(() => { setOpen(true); setMinimized(false); }, []);
  const handleMinimize = useCallback(() => setMinimized(true), []);
  const handleClose    = useCallback(() => { setOpen(false); setMinimized(false); }, []);
  const resetPosition  = useCallback(() => setPos(defaultPos()), []);
  const clearSelectedMaterials = useCallback(() => {
    setActivePresetId(null);
    setActiveMaterialKeys(new Set());
    setPinnedMaterialKeys(new Set());
    setPinned(false);
    setIsPresetModified(false);
    setPresetPickerOpen(false);
    setPresetSearch("");
  }, []);

  // ── derived ──────────────────────────────────────────────────────────────────
  const q = search.trim().toLowerCase();
  const rows = q
    ? MINEABLE_SIGNATURES.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.values.some((v) => formatVal(v).includes(q) || String(v).includes(q))
      )
    : MINEABLE_SIGNATURES;

  const pinnedRows = rowsFromMaterialKeys(pinnedMaterialKeys);
  const activePreset = activePresetId ? presetCatalog.presetById.get(activePresetId) : null;
  const selectionLabel = activePreset
    ? `${activePreset.shortLabel}${isPresetModified ? " + Custom" : ""}`
    : "";
  const presetOptions = useMemo(() => {
    return presetCatalog.presetGroups.flatMap((group) =>
      group.presetIds
        .map((presetId) => presetCatalog.presetById.get(presetId))
        .filter((preset): preset is NonNullable<ReturnType<typeof presetCatalog.presetById.get>> => Boolean(preset?.enabled))
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((preset) => {
          const sources = preset.sourceLocationIds
            .map((sourceId) => presetCatalog.locationSourceById.get(sourceId))
            .filter((source): source is NonNullable<ReturnType<typeof presetCatalog.locationSourceById.get>> => Boolean(source?.enabled));
          return {
            preset,
            group,
            searchText: [
              preset.label,
              preset.shortLabel,
              preset.system,
              ...sources.flatMap((source) => [
                source.label,
                source.shortLabel,
                source.parentLocation,
                source.system,
                source.locationType,
              ]),
            ].join(" ").toLowerCase(),
          };
        })
    );
  }, [presetCatalog]);
  const filteredPresetOptions = useMemo(() => {
    const qPreset = presetSearch.trim().toLowerCase();
    if (!qPreset) return presetOptions;
    return presetOptions.filter((option) => option.searchText.includes(qPreset));
  }, [presetOptions, presetSearch]);

  const presetTriggerLabel = selectionLabel || (pinnedRows.length > 0 ? "Custom" : "Signature Dock");

  const presetPicker = (
    <div className="sdock-preset-picker" ref={presetPickerRef} onPointerDown={(e) => e.stopPropagation()}>
      {presetPickerOpen ? (
        <div className="sdock-preset-search-shell">
          <input
            className="sdock-preset-combobox-input"
            autoFocus
            aria-label="Search location presets"
            value={presetSearch}
            placeholder="Search location..."
            onChange={(e) => {
              setPresetSearch(e.target.value);
              setHighlightedPresetIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHighlightedPresetIndex((index) =>
                  filteredPresetOptions.length === 0 ? 0 : Math.min(index + 1, filteredPresetOptions.length - 1)
                );
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlightedPresetIndex((index) => Math.max(index - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                const option = filteredPresetOptions[highlightedPresetIndex];
                if (option) selectPreset(option.preset.id);
              } else if (e.key === "Escape") {
                e.preventDefault();
                setPresetPickerOpen(false);
                setPresetSearch("");
              }
            }}
          />
        </div>
      ) : (
        <button
          className="sdock-preset-trigger"
          type="button"
          title="Search location presets"
          onClick={() => {
            setHighlightedPresetIndex(0);
            setPresetPickerOpen(true);
          }}
        >
          <span>{presetTriggerLabel}</span>
          <span className="sdock-preset-caret" aria-hidden="true">▾</span>
        </button>
      )}
      {presetPickerOpen && (
        <div className="sdock-preset-menu" role="listbox">
          {filteredPresetOptions.length === 0 ? (
            <div className="sdock-preset-menu-empty">No locations</div>
          ) : (
            filteredPresetOptions.map((option, index) => (
              <button
                key={option.preset.id}
                className={`sdock-preset-option${option.preset.id === activePresetId ? " active" : ""}${index === highlightedPresetIndex ? " highlighted" : ""}`}
                type="button"
                role="option"
                aria-selected={option.preset.id === activePresetId}
                onMouseEnter={() => setHighlightedPresetIndex(index)}
                onClick={() => selectPreset(option.preset.id)}
              >
                <span className="sdock-preset-option-label">{option.preset.shortLabel}</span>
                <span className="sdock-preset-option-meta">{option.group.label}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );

  const dragHandle = (
    <button
      type="button"
      className="sdock-drag-handle"
      aria-label="Move Signature Dock"
      title="Move Signature Dock"
      onPointerDown={onDrag}
    >
      <span aria-hidden="true">::</span>
    </button>
  );

  const clearButton = (
    <button
      type="button"
      className="sdock-clear-selection-btn"
      aria-label="Clear selected materials"
      title="Clear selected materials"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={clearSelectedMaterials}
    >
      <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6h18" />
        <path d="M8 6V4h8v2" />
        <path d="M6 6l1 16h10l1-16" />
        <path d="M10 11v6M14 11v6" />
      </svg>
    </button>
  );

  const showStrip = !open || minimized;
  const showPanel = open && !minimized;

  // ── render ───────────────────────────────────────────────────────────────────
  const content = (
    <>
      {/* ── Strip (always visible when panel is closed or minimized) ── */}
      {showStrip && (
        <div
          className="sdock-pinned-strip"
          ref={elRef}
          style={{ left: pos.x, top: pos.y, fontSize, fontWeight }}
        >
          
          <div className="sdock-pinned-header">
            {dragHandle}
            {presetPicker}
            {clearButton}
            
            <button
              className="sdock-pinned-expand-btn"
              onClick={handleOpen}
              onPointerDown={(e) => e.stopPropagation()}
              title="Open Signature Dock"
            >◈</button>
          </div>
          {pinned && pinnedRows.length > 0 && (
            <div className="sdock-pinned-body" style={{ fontSize, fontWeight }}>
              {pinnedRows.map((m) => (
                <div key={m.name} className="sdock-pinned-row">
                  <span className="sdock-pinned-row-name">{m.name}</span>
                  <div className="sdock-pinned-row-values">
                    {m.values.map((v, vi) => (
                      <span key={vi} className="sdock-pinned-sig-muted">
                        {formatVal(v)}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Panel ── */}
      {showPanel && (
        <div
          className="sdock-panel"
          ref={elRef}
          style={{ left: pos.x, top: pos.y }}
        >
          <div className="sdock-topbar">
            {dragHandle}
            {presetPicker}
            {clearButton}
            <div className="sdock-topbar-controls" onPointerDown={(e) => e.stopPropagation()}>
              <div className="sdock-opacity-row">
                <span className="sdock-opacity-label">Weight</span>
                <input
                  type="range"
                  className="sdock-opacity-slider"
                  min={500}
                  max={800}
                  step={100}
                  value={fontWeight}
                  onChange={(e) => setFontWeight(Number(e.target.value))}
                />
              </div>
              <div className="sdock-opacity-row">
                <span className="sdock-opacity-label">Size</span>
                <input
                  type="range"
                  className="sdock-opacity-slider"
                  min={10}
                  max={16}
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                />
              </div>
              <button className="sdock-ctrl-btn" onClick={resetPosition} title="Reset position">⌖</button>
              <button
                className={`sdock-ctrl-btn sdock-pin-quiet${pinned ? " active" : ""}`}
                onClick={() => {
                  setPinned((p) => {
                    if (!p) {
                      setPinnedMaterialKeys(new Set(activeMaterialKeys));
                      setMinimized(true);
                    }
                    return !p;
                  });
                }}
                title={pinned ? "Unpin" : "Pin active rows"}
              >
                📌
              </button>
              <button className="sdock-ctrl-btn" onClick={handleMinimize} title="Minimize">−</button>
              <button className="sdock-ctrl-btn" onClick={handleClose} title="Close">×</button>
            </div>
          </div>

          <div className="sdock-body">
            <div className="sdock-search-row">
              <input
                className="sdock-search-input"
                type="text"
                placeholder="Filter minerals…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="sdock-table-wrap" style={{ fontSize, fontWeight }}>
              {rows.length === 0 ? (
                <div className="sdock-empty">No results</div>
              ) : (
                <table className="sdock-table">
                  <thead>
                    <tr>
                      <th>Material</th>
                      <th className="sdock-th-values">Signature Values</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((m) => {
                      const idx = MINEABLE_SIGNATURES.indexOf(m);
                      const isActive = activeMaterialKeys.has(signatureRowKey(idx));
                      return (
                        <tr
                          key={idx}
                          className={isActive ? "sdock-row-active" : ""}
                          onClick={() => toggleRow(idx)}
                        >
                          <td className="sdock-td-name">
                            {isActive && <span className="sdock-active-dot" />}
                            {m.name}
                          </td>
                          <td className="sdock-td-values">
                            <div className="sdock-values-wrap">
                              {m.values.map((v, vi) => (
                                <span
                                  key={vi}
                                  className={`sdock-val-chip${vi === 0 ? " sdock-val-chip-first" : ""}`}
                                >
                                  {formatVal(v)}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );

  return createPortal(content, document.body);
}
