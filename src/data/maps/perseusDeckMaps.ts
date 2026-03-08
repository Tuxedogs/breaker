import type { DeckMapPieceOverlay, ShipDeckMapConfig } from "../../components/maps/DeckMapRenderer";

export type PerseusMidDeckAnnotationKind =
  | "Main Turret"
  | "Terminal"
  | "Power"
  | "Shield"
  | "Cooler"
  | "Radar"
  | "Quantum"
  | "Life-Support"
  | "Ladder"
  | "Elevator"
  | "Cargo";

export type PerseusDeckAnnotationPathing = {
  connectsDeckIds: Array<"bottom" | "mid" | "top">;
  toLabels?: string[];
};

export type PerseusDeckAnnotationBase = {
  id: string;
  label: string;
  token?: string;
  kind: PerseusMidDeckAnnotationKind;
  worldPosition: [number, number, number];
  screenOffset?: [number, number];
  colorHint?: string;
  pathing?: PerseusDeckAnnotationPathing;
};

export type PerseusDeckComponentAnnotation = PerseusDeckAnnotationBase & {
  annotationType: "component";
};

export type PerseusDeckLabelAnnotation = PerseusDeckAnnotationBase & {
  annotationType: "label";
};

export type PerseusDeckAnnotationConfig = {
  fixedHeightAboveDeckMin: number;
  components: PerseusDeckComponentAnnotation[];
  labels: PerseusDeckLabelAnnotation[];
};

export const perseusMidDeckPieceOverlays: DeckMapPieceOverlay[] = [
  {
    id: "frontz0",
    texturePath: "/images/maps/deckmaps/Frontz0.png",
    z: 0,
    offsetX: -0.04,
    offsetZ: -0.15,
    yOffset: 0.005,
    scaleMultiplier: 0.8,
  },
  {
    id: "midcargo",
    texturePath: "/images/maps/deckmaps/mid-cargo.png",
    z: 20,
    offsetX: 0.01,
    offsetZ: 0.27,
    scaleMultiplier: 0.85, 
    widthMultiplier: 1.0,
    heightMultiplier: 0.75,
  },
  {
    id: "stairsz2",
    texturePath: "/images/maps/deckmaps/z2 stairs.png",
    z: 2,
   offsetX: 0.01,
    offsetZ: 0.92,
    scaleMultiplier: 0.15,
  },
  {
    id: "rearz3",
    texturePath: "/images/maps/deckmaps/rearz3.png",
    z: 3,
    offsetX: 0.03,
    offsetZ: 0.98,
    scaleMultiplier: 0.2, 
    widthMultiplier: 1.0,
    heightMultiplier: 8.0,
  },
];

export const perseusMidDeckAnnotations: PerseusDeckAnnotationConfig = {
  fixedHeightAboveDeckMin: 0.02,
  components: [
    {
      id: "gun-01",
      annotationType: "component",
      label: "Gun 01",
      token: "MT",
      kind: "Main Turret",
      worldPosition: [0.04, -0.052, -1.41],
      colorHint: "#f59e0b",
    },
    {
      id: "engineer-terminal-1",
      annotationType: "component",
      label: "Engineer Terminal 1",
      token: "TRM",
      kind: "Terminal",
      worldPosition: [-0.104, -0.052, -0.764],
      colorHint: "#67e8f9",
    },
    {
      id: "torpedo-operator-terminal",
      annotationType: "component",
      label: "Torpedo Operator Terminal",
      token: "TRM",
      kind: "Terminal",
      worldPosition: [0.176, -0.052, -0.752],
      colorHint: "#67e8f9",
    },
    {
      id: "power-plant-1",
      annotationType: "component",
      label: "Power Plant 1",
      token: "PWR",
      kind: "Power",
      worldPosition: [0.341, -0.052, -0.428],
      colorHint: "#f59e0b",
    },
    {
      id: "cooler-1",
      annotationType: "component",
      label: "Cooler 1",
      token: "CLR",
      kind: "Cooler",
      worldPosition: [-0.265, -0.052, -0.41],
      colorHint: "#93c5fd",
    },
    {
      id: "shield-generator-1",
      annotationType: "component",
      label: "Shield Generator 1",
      token: "SHD",
      kind: "Shield",
      worldPosition: [0.138, -0.052, -1.078],
      colorHint: "#a78bfa",
    },
    {
      id: "power-plant-2",
      annotationType: "component",
      label: "Power Plant 2",
      token: "PWR",
      kind: "Power",
      worldPosition: [0.307, -0.052, 1.528],
      colorHint: "#f59e0b",
    },
    {
      id: "shield-generator-2",
      annotationType: "component",
      label: "Shield Generator 2",
      token: "SHD",
      kind: "Shield",
      worldPosition: [0.266, -0.052, 1.641],
      colorHint: "#a78bfa",
    },
    {
      id: "radar",
      annotationType: "component",
      label: "Radar",
      token: "RDR",
      kind: "Radar",
      worldPosition: [0.266, -0.052, 1.641],
      colorHint: "#38bdf8",
    },
    {
      id: "qt-drive",
      annotationType: "component",
      label: "QT Drive",
      token: "QT",
      kind: "Quantum",
      worldPosition: [0.052, -0.052, 1.852],
      colorHint: "#22d3ee",
    },
    {
      id: "life-support",
      annotationType: "component",
      label: "Life Support",
      token: "LIFE",
      kind: "Life-Support",
      worldPosition: [0.503, -0.052, 0.624],
      colorHint: "#4ade80",
    },
    {
      id: "cooler-2",
      annotationType: "component",
      label: "Cooler 2",
      token: "CLR",
      kind: "Cooler",
      worldPosition: [-0.18, -0.052, 1.524],
      colorHint: "#93c5fd",
    },
    {
      id: "engineer-terminal-2",
      annotationType: "component",
      label: "Engineer Terminal 2",
      token: "TRM",
      kind: "Terminal",
      worldPosition: [0.053, -0.052, 1.663],
      colorHint: "#67e8f9",
    },
  ],
  labels: [
    {
      id: "crew-quarters-section",
      annotationType: "label",
      label: "Crew",
      token: "CRW",
      kind: "Cargo",
      worldPosition: [0.511, -0.052, 1.033],
      colorHint: "#e2e8f0",
    },
    {
      id: "armory-section",
      annotationType: "label",
      label: "Armory",
      token: "ARM",
      kind: "Cargo",
      worldPosition: [0.503, -0.052, 0.624],
      colorHint: "#fca5a5",
    },
    {
      id: "main-ladder",
      annotationType: "label",
      label: "Main Ladder",
      token: "LDR",
      kind: "Ladder",
      worldPosition: [0.197, -0.052, 0.627],
      colorHint: "#f8fafc",
      pathing: {
        connectsDeckIds: ["bottom", "mid", "top"],
        toLabels: ["To Cargo Deck", "To Bridge"],
      },
    },
    {
      id: "elevator",
      annotationType: "label",
      label: "Elevator",
      token: "ELV",
      kind: "Elevator",
      worldPosition: [0.22, -0.052, 0.787],
      colorHint: "#fde68a",
      pathing: {
        connectsDeckIds: ["bottom", "mid", "top"],
        toLabels: ["To Cargo Deck", "To Bridge"],
      },
    },
    {
      id: "secondary-ladder-port",
      annotationType: "label",
      label: "Ladder",
      token: "LDR",
      kind: "Ladder",
      worldPosition: [-0.44, -0.052, -0.294],
      colorHint: "#f8fafc",
      pathing: {
        connectsDeckIds: ["bottom", "mid"],
        toLabels: ["To Cargo Deck"],
      },
    },
    {
      id: "secondary-ladder-starboard",
      annotationType: "label",
      label: "Ladder",
      token: "LDR",
      kind: "Ladder",
      worldPosition: [0.303, -0.052, 0.368],
      colorHint: "#f8fafc",
      pathing: {
        connectsDeckIds: ["bottom", "mid"],
        toLabels: ["To Cargo Deck"],
      },
    },
  ],
};

export const perseusDeckMapConfig: ShipDeckMapConfig = {
  shipId: "perseus",
  shipName: "RSI Perseus",
  decks: [
    {
      id: "cargo_percy",
      name: "Perseus Cargo Deck",
      deckMin: -0.236,
      deckMax: -0.086,
      svgPath: "/images/maps/deckmaps/percy-cargo.png",
      viewBox: [1506, 956],
      icons: [
        { id: "exit_a", kind: "exit", label: "Exit A", x: 228, y: 812 },
        { id: "engineering", kind: "engineering", label: "Engineering", x: 1066, y: 675 },
        { id: "bridge", kind: "bridge", label: "Bridge", x: 765, y: 194 },
      ],
      labels: [
        { id: "cargo_text", text: "Cargo Deck", x: 625, y: 486 },
        { id: "lift_text", text: "Lift", x: 705, y: 695 },
      ],
      nodes: [
        { id: "n_exit", x: 228, y: 812, role: "exit" },
        { id: "n_hall_1", x: 452, y: 749 },
        { id: "n_hall_2", x: 643, y: 658 },
        { id: "n_eng", x: 1066, y: 675, role: "engineering" },
        { id: "n_core", x: 765, y: 513 },
        { id: "n_bridge", x: 765, y: 194, role: "bridge" },
      ],
      edges: [
        { from: "n_exit", to: "n_hall_1" },
        { from: "n_hall_1", to: "n_hall_2" },
        { from: "n_hall_2", to: "n_core" },
        { from: "n_hall_2", to: "n_eng" },
        { from: "n_core", to: "n_bridge" },
      ],
    },
    {
      id: "percy_mid",
      name: "Percy Mid Deck",
      deckMin: -0.086,
      deckMax: 0.139,
      pieceOverlays: perseusMidDeckPieceOverlays,
      annotations: perseusMidDeckAnnotations,
      viewBox: [2063, 694],
      icons: [
        { id: "mid_exit", kind: "exit", label: "Exit", x: 403, y: 572 },
        { id: "mid_engineering", kind: "engineering", label: "Engineering", x: 1511, y: 441 },
        { id: "mid_bridge", kind: "bridge", label: "Bridge", x: 1048, y: 119 },
      ],
      labels: [
        { id: "mid_text", text: "Percy Mid Deck", x: 775, y: 349 },
      ],
      nodes: [
        { id: "m_exit", x: 403, y: 572, role: "exit" },
        { id: "m_1", x: 680, y: 511 },
        { id: "m_2", x: 957, y: 415 },
        { id: "m_eng", x: 1511, y: 441, role: "engineering" },
        { id: "m_core", x: 1048, y: 302 },
        { id: "m_bridge", x: 1048, y: 119, role: "bridge" },
      ],
      edges: [
        { from: "m_exit", to: "m_1" },
        { from: "m_1", to: "m_2" },
        { from: "m_2", to: "m_core" },
        { from: "m_2", to: "m_eng" },
        { from: "m_core", to: "m_bridge" },
      ],
    },
    {
      id: "percy_top",
      name: "Percy Top Deck",
      deckMin: 0.139,
      deckMax: 0.36,
      svgPath: "/images/maps/deckmaps/percy-topDeck.png",
      viewBox: [980, 289],
      icons: [
        { id: "top_bridge", kind: "bridge", label: "Bridge", x: 490, y: 144 },
      ],
      labels: [
        { id: "top_text", text: "Percy Top Deck", x: 490, y: 76 },
      ],
      nodes: [
        { id: "t_bridge", x: 490, y: 144, role: "bridge" },
      ],
      edges: [],
    },
  ],
};
