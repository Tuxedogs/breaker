import { useState, useMemo } from "react";
import ShipMapTemplate from "./ShipMapTemplate";
import { getViewerConfig, type ViewerShipId } from "./viewerRegistry";

const ACTIVE_SHIP_ID: ViewerShipId = "perseus";
const shipConfig = getViewerConfig(ACTIVE_SHIP_ID);

export default function ViewerPage() {
  const [activeDeckId, setActiveDeckId] = useState(shipConfig.defaultDeckId);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const deckOverlayConfig = useMemo(
    () => ({ decks: [...shipConfig.overlayDecks] }),
    [],
  );

  const deckNodes = useMemo(
    () => shipConfig.viewerNodes.filter((n) => n.deckId === activeDeckId),
    [activeDeckId],
  );

  const selectedNode = selectedNodeId ? shipConfig.nodeMap[selectedNodeId] : null;
  const selectedRoom = selectedNode ? shipConfig.roomMap[selectedNode.roomId] : null;
  const selectedHardpoints = selectedNode ? (shipConfig.hardpointsByRoom[selectedNode.roomId] ?? []) : [];
  const selectedConnections = selectedNode
    ? selectedNode.adjacentNodeIds.map((id) => shipConfig.nodeMap[id]).filter(Boolean)
    : [];

  function handleDeckChange(deckId: string) {
    setActiveDeckId(deckId);
    setSelectedNodeId(null);
  }

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <ShipMapTemplate
        title={shipConfig.label}
        subtitle={shipConfig.subtitle}
        modelPath={shipConfig.modelPath}
        viewStorageKey={shipConfig.viewStorageKey}
        fallbackView={shipConfig.defaultView}
        defaultDeckOverlayId={shipConfig.defaultOverlayDeckId}
        defaultInteriorEnabled
        showDebugPanel
        deckOverlayConfig={deckOverlayConfig}
        showHeader={false}
        immersiveFocus
      />

      <aside
        className="pointer-events-none absolute right-4 top-4 z-30 flex flex-col gap-2"
        style={{ maxHeight: "calc(100% - 2rem)", width: "15rem" }}
      >
        {/* Deck selector tabs */}
        <div className="pointer-events-auto flex gap-1 self-end">
          {shipConfig.logicalDecks.map((deck) => (
            <button
              key={deck.id}
              type="button"
              onClick={() => handleDeckChange(deck.id)}
              className={`rounded border px-2.5 py-1 text-[0.65rem] uppercase tracking-[0.12em] transition ${
                activeDeckId === deck.id
                  ? "border-cyan-300/60 bg-cyan-500/20 text-cyan-100"
                  : "border-white/30 bg-black/50 text-slate-300 hover:bg-black/65"
              }`}
            >
              {deck.label}
            </button>
          ))}
        </div>

        {/* Node list for active deck */}
        {deckNodes.length > 0 && (
          <div className="pointer-events-auto flex flex-col gap-0.5 overflow-y-auto rounded border border-white/15 bg-black/60 p-1.5 backdrop-blur-sm">
            {deckNodes.map((node) => (
              <button
                key={node.id}
                type="button"
                onClick={() => setSelectedNodeId(node.id === selectedNodeId ? null : node.id)}
                className={`flex items-center gap-2 rounded px-2.5 py-1.5 text-left text-xs transition ${
                  selectedNodeId === node.id
                    ? "bg-cyan-500/20 text-cyan-100"
                    : "text-slate-300 hover:bg-white/10"
                }`}
              >
                <span className="w-8 shrink-0 text-center font-mono text-[0.6rem] uppercase tracking-wider opacity-50">
                  {node.token}
                </span>
                <span>{node.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Node details panel */}
        {selectedNode && (
          <div className="pointer-events-auto overflow-y-auto rounded border border-white/20 bg-black/75 p-3 text-xs backdrop-blur-sm">
            <p className="text-[0.6rem] uppercase tracking-[0.14em] text-slate-400">{selectedNode.type}</p>
            <p className="mt-0.5 text-sm font-medium leading-snug text-cyan-100">{selectedNode.label}</p>

            {selectedRoom?.desc && (
              <p className="mt-2 leading-relaxed text-slate-300">{selectedRoom.desc}</p>
            )}

            {selectedConnections.length > 0 && (
              <div className="mt-3">
                <p className="mb-1 text-[0.6rem] uppercase tracking-[0.14em] text-slate-400">Connected</p>
                <div className="flex flex-col gap-0.5">
                  {selectedConnections.map((conn) => (
                    <button
                      key={conn.id}
                      type="button"
                      onClick={() => setSelectedNodeId(conn.id)}
                      className="text-left text-cyan-400 transition hover:text-cyan-100"
                    >
                      → {conn.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedHardpoints.length > 0 && (
              <div className="mt-3">
                <p className="mb-1 text-[0.6rem] uppercase tracking-[0.14em] text-slate-400">
                  Hardpoints ({selectedHardpoints.length})
                </p>
                <div className="flex flex-col gap-0.5">
                  {selectedHardpoints.map((hp) => (
                    <p key={hp.id} className="truncate font-mono text-[0.6rem] text-slate-400">
                      {hp.kind} — {hp.name}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
