import type { ShipDeckMapConfig } from "../../components/maps/DeckMapRenderer";

export const perseusDeckMapConfig: ShipDeckMapConfig = {
  shipId: "perseus",
  shipName: "RSI Perseus",
  decks: [
    {
      id: "cargo_percy",
      name: "Perseus Cargo Deck",
      deckMin: -0.236,
      deckMax: -0.086,
      svgPath: "/images/maps/deckmaps/percycargo.svg",
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
      svgPath: "/images/maps/deckmaps/percymiddeck.svg",
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
  ],
};
