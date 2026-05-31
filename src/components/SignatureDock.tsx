import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MINEABLE_SIGNATURES } from "../data/mineableSignatures";
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

// ── component ─────────────────────────────────────────────────────────────────
export default function SignatureDock() {
  const init = useRef(loadState()).current;

  const [open, setOpen]           = useState(init.open);
  const [pinned, setPinned]       = useState(init.pinned);
  const [minimized, setMinimized] = useState(init.minimized);
  const [fontWeight, setFontWeight] = useState(init.fontWeight ?? 800);
  const [fontSize, setFontSize]   = useState(init.fontSize ?? 12);
  const [activeIds, setActiveIds] = useState<Set<number>>(() => new Set(init.activeIds));
  const [search, setSearch]       = useState("");
  const [pos, setPos]             = useState<{ x: number; y: number }>(init.pos ?? defaultPos());

  const elRef = useRef<HTMLDivElement>(null);

  // ── persist ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    saveState({ open, pinned, minimized, fontWeight, fontSize, pos, activeIds: Array.from(activeIds) });
  }, [open, pinned, minimized, fontWeight, fontSize, pos, activeIds]);

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
    setActiveIds((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }, []);

  const handleOpen     = useCallback(() => { setOpen(true); setMinimized(false); }, []);
  const handleMinimize = useCallback(() => setMinimized(true), []);
  const handleClose    = useCallback(() => { setOpen(false); setMinimized(false); }, []);
  const resetPosition  = useCallback(() => setPos(defaultPos()), []);

  // ── derived ──────────────────────────────────────────────────────────────────
  const q = search.trim().toLowerCase();
  const rows = q
    ? MINEABLE_SIGNATURES.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.values.some((v) => formatVal(v).includes(q) || String(v).includes(q))
      )
    : MINEABLE_SIGNATURES;

  const activeRows = MINEABLE_SIGNATURES.filter((_, i) => activeIds.has(i));

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
          <div className="sdock-pinned-header" onPointerDown={onDrag}>
            <span className="sdock-pinned-header-label">
              {activeRows.length > 0 ? "Active Sigs" : "Signature Dock"}
            </span>
            <button
              className="sdock-pinned-expand-btn"
              onClick={handleOpen}
              onPointerDown={(e) => e.stopPropagation()}
              title="Open Signature Dock"
            >◈</button>
          </div>
          {pinned && activeRows.length > 0 && (
            <div className="sdock-pinned-body" style={{ fontSize, fontWeight }}>
              {activeRows.map((m, i) => (
                <div key={i} className="sdock-pinned-row">
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
          <div className="sdock-topbar" onPointerDown={onDrag}>
            <span className="sdock-title">Signature Dock</span>
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
                className={`sdock-ctrl-btn${pinned ? " active" : ""}`}
                onClick={() => {
                  setPinned((p) => {
                    if (!p) setMinimized(true);
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
                      const isActive = activeIds.has(idx);
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
