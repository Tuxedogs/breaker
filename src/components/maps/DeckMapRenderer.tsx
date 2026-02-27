import { useMemo, useState } from "react";

export type DeckMapRouteTarget = "engineering" | "bridge";

export type DeckMapIcon = {
  id: string;
  kind: "exit" | "engineering" | "bridge" | "poi";
  label: string;
  x: number;
  y: number;
};

export type DeckMapLabel = {
  id: string;
  text: string;
  x: number;
  y: number;
};

export type DeckMapNode = {
  id: string;
  x: number;
  y: number;
  role?: "exit" | DeckMapRouteTarget;
};

export type DeckMapEdge = {
  from: string;
  to: string;
};

export type DeckMapDeck = {
  id: string;
  name: string;
  deckMin: number;
  deckMax: number;
  svgPath: string;
  viewBox: [number, number];
  icons: DeckMapIcon[];
  labels: DeckMapLabel[];
  nodes: DeckMapNode[];
  edges: DeckMapEdge[];
};

export type ShipDeckMapConfig = {
  shipId: string;
  shipName: string;
  decks: DeckMapDeck[];
};

type DeckMapRendererProps = {
  config: ShipDeckMapConfig;
};

function buildRoute(
  nodes: DeckMapNode[],
  edges: DeckMapEdge[],
  startId: string,
  targetId: string,
): DeckMapNode[] {
  const adjacency = new Map<string, string[]>();
  for (const node of nodes) {
    adjacency.set(node.id, []);
  }
  for (const edge of edges) {
    adjacency.get(edge.from)?.push(edge.to);
    adjacency.get(edge.to)?.push(edge.from);
  }

  const queue = [startId];
  const parent = new Map<string, string | null>();
  parent.set(startId, null);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    if (current === targetId) break;

    const nextNodes = adjacency.get(current) ?? [];
    for (const next of nextNodes) {
      if (parent.has(next)) continue;
      parent.set(next, current);
      queue.push(next);
    }
  }

  if (!parent.has(targetId)) return [];

  const pathIds: string[] = [];
  let cursor: string | null = targetId;
  while (cursor) {
    pathIds.push(cursor);
    cursor = parent.get(cursor) ?? null;
  }
  pathIds.reverse();

  const byId = new Map(nodes.map((node) => [node.id, node]));
  return pathIds.map((id) => byId.get(id)).filter((node): node is DeckMapNode => Boolean(node));
}

function routePoints(path: DeckMapNode[]): string {
  return path.map((node) => `${node.x},${node.y}`).join(" ");
}

export default function DeckMapRenderer({ config }: DeckMapRendererProps) {
  const [activeDeckId, setActiveDeckId] = useState(config.decks[0]?.id ?? "");
  const [routeTarget, setRouteTarget] = useState<DeckMapRouteTarget | null>(null);

  const activeDeck = useMemo(
    () => config.decks.find((deck) => deck.id === activeDeckId) ?? config.decks[0],
    [activeDeckId, config.decks],
  );

  const activeRoute = useMemo(() => {
    if (!activeDeck || !routeTarget) return [];
    const start = activeDeck.nodes.find((node) => node.role === "exit");
    const target = activeDeck.nodes.find((node) => node.role === routeTarget);
    if (!start || !target) return [];
    return buildRoute(activeDeck.nodes, activeDeck.edges, start.id, target.id);
  }, [activeDeck, routeTarget]);

  if (!activeDeck) return null;

  return (
    <section className="route-fade pb-8 pt-2">
      <article className="framework-modern-card framework-modern-card-ships rounded-[1.9rem] border border-amber-300/35 bg-black/35 p-4 backdrop-blur sm:p-6">
        <header className="framework-modern-card-head rounded-[1.2rem] border border-white/15 p-5">
          <p className="framework-modern-kicker">Deck Authoring Scaffold</p>
          <h2 className="title-font mt-2 text-3xl tracking-[0.07em] text-amber-200 sm:text-4xl">
            {config.shipName} Deck Maps
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-200 sm:text-base">
            SVG floorplan + data overlays. Keep static geometry in SVG and place icons, labels, and routes via data.
          </p>
        </header>

        <div className="mt-4 flex flex-wrap gap-2">
          {config.decks.map((deck) => {
            const isActive = deck.id === activeDeck.id;
            return (
              <button
                key={deck.id}
                type="button"
                onClick={() => setActiveDeckId(deck.id)}
                className={`rounded-md border px-3 py-2 text-xs uppercase tracking-[0.14em] transition min-h-11 ${
                  isActive
                    ? "border-amber-300/55 bg-black/55 text-amber-100"
                    : "border-white/35 bg-black/40 text-white hover:bg-black/55"
                }`}
              >
                {deck.name}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setRouteTarget("engineering")}
            className="min-h-11 rounded-md border border-cyan-300/40 bg-black/45 px-3 py-2 text-xs uppercase tracking-[0.14em] text-cyan-100 transition hover:bg-black/60"
          >
            Highlight Exit to Engineering
          </button>
          <button
            type="button"
            onClick={() => setRouteTarget("bridge")}
            className="min-h-11 rounded-md border border-cyan-300/40 bg-black/45 px-3 py-2 text-xs uppercase tracking-[0.14em] text-cyan-100 transition hover:bg-black/60"
          >
            Highlight Exit to Bridge
          </button>
          <button
            type="button"
            onClick={() => setRouteTarget(null)}
            className="min-h-11 rounded-md border border-white/35 bg-black/40 px-3 py-2 text-xs uppercase tracking-[0.14em] text-white transition hover:bg-black/55"
          >
            Clear Route
          </button>
        </div>

        <div className="mt-4 overflow-hidden rounded-[1.2rem] border border-white/15 bg-black/30 p-3">
          <div className="mx-auto w-full max-w-[960px]">
            <svg
              viewBox={`0 0 ${activeDeck.viewBox[0]} ${activeDeck.viewBox[1]}`}
              className="h-auto w-full"
              role="img"
              aria-label={`${activeDeck.name} deck map`}
            >
              <image href={activeDeck.svgPath} x="0" y="0" width={activeDeck.viewBox[0]} height={activeDeck.viewBox[1]} />

              {activeRoute.length >= 2 ? (
                <polyline
                  points={routePoints(activeRoute)}
                  fill="none"
                  stroke="#67e8f9"
                  strokeWidth="18"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.9"
                >
                  <animate attributeName="stroke-dasharray" values="0,1200;1200,0" dur="1.6s" fill="freeze" />
                </polyline>
              ) : null}

              {activeDeck.icons.map((icon) => (
                <g key={icon.id}>
                  <circle
                    cx={icon.x}
                    cy={icon.y}
                    r="22"
                    fill={icon.kind === "exit" ? "#f59e0b" : icon.kind === "engineering" ? "#22d3ee" : "#e2e8f0"}
                    opacity="0.95"
                  />
                  <text x={icon.x} y={icon.y + 6} textAnchor="middle" fontSize="14" fill="#050a12">
                    {icon.kind === "exit" ? "E" : icon.kind === "engineering" ? "EN" : icon.kind === "bridge" ? "B" : "I"}
                  </text>
                </g>
              ))}

              {activeDeck.labels.map((label) => (
                <text key={label.id} x={label.x} y={label.y} fontSize="30" fill="#f8fafc">
                  {label.text}
                </text>
              ))}
            </svg>
          </div>
        </div>

        <div className="mt-3 rounded-md border border-white/20 bg-black/40 px-3 py-2 text-[11px] leading-relaxed text-slate-200">
          <p>deck: {activeDeck.name}</p>
          <p>
            slice window: [{activeDeck.deckMin.toFixed(3)}, {activeDeck.deckMax.toFixed(3)}]
          </p>
          <p>active route: {routeTarget ?? "none"}</p>
        </div>
      </article>
    </section>
  );
}
