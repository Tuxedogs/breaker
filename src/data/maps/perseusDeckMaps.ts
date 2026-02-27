import type { ShipDeckMapConfig } from "../../components/maps/DeckMapRenderer";

export const perseusDeckMapConfig: ShipDeckMapConfig = {
  shipId: "perseus",
  shipName: "RSI Perseus",
  decks: [
    {
      id: "cargo_percy",
      name: "Cargo Deck Percy",
      deckMin: -0.236,
      deckMax: -0.086,
      svgPath: "/maps/ships/perseus/decks/cargo-percy.svg",
      viewBox: [4096, 4096],
      icons: [
        { id: "exit_a", kind: "exit", label: "Exit A", x: 620, y: 3480 },
        { id: "engineering", kind: "engineering", label: "Engineering", x: 2900, y: 2890 },
        { id: "bridge", kind: "bridge", label: "Bridge", x: 2080, y: 830 },
      ],
      labels: [
        { id: "cargo_text", text: "Cargo Deck", x: 1700, y: 2080 },
        { id: "lift_text", text: "Lift", x: 1920, y: 2980 },
      ],
      nodes: [
        { id: "n_exit", x: 620, y: 3480, role: "exit" },
        { id: "n_hall_1", x: 1230, y: 3210 },
        { id: "n_hall_2", x: 1750, y: 2820 },
        { id: "n_eng", x: 2900, y: 2890, role: "engineering" },
        { id: "n_core", x: 2080, y: 2200 },
        { id: "n_bridge", x: 2080, y: 830, role: "bridge" },
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
      svgPath: "/maps/ships/perseus/decks/percy-mid.svg",
      viewBox: [4096, 4096],
      icons: [
        { id: "mid_exit", kind: "exit", label: "Exit", x: 800, y: 3380 },
        { id: "mid_engineering", kind: "engineering", label: "Engineering", x: 3000, y: 2600 },
        { id: "mid_bridge", kind: "bridge", label: "Bridge", x: 2080, y: 700 },
      ],
      labels: [
        { id: "mid_text", text: "Percy Mid Deck", x: 1540, y: 2060 },
      ],
      nodes: [
        { id: "m_exit", x: 800, y: 3380, role: "exit" },
        { id: "m_1", x: 1350, y: 3020 },
        { id: "m_2", x: 1900, y: 2450 },
        { id: "m_eng", x: 3000, y: 2600, role: "engineering" },
        { id: "m_core", x: 2080, y: 1780 },
        { id: "m_bridge", x: 2080, y: 700, role: "bridge" },
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
      deckMin: 0.213,
      deckMax: 0.406,
      svgPath: "/maps/ships/perseus/decks/percy-top.svg",
      viewBox: [4096, 4096],
      icons: [
        { id: "top_exit", kind: "exit", label: "Exit", x: 980, y: 3300 },
        { id: "top_engineering", kind: "engineering", label: "Engineering", x: 2840, y: 2420 },
        { id: "top_bridge", kind: "bridge", label: "Bridge", x: 2080, y: 620 },
      ],
      labels: [
        { id: "top_text", text: "Percy Top Deck", x: 1600, y: 2020 },
      ],
      nodes: [
        { id: "t_exit", x: 980, y: 3300, role: "exit" },
        { id: "t_1", x: 1450, y: 2940 },
        { id: "t_2", x: 2000, y: 2300 },
        { id: "t_eng", x: 2840, y: 2420, role: "engineering" },
        { id: "t_core", x: 2080, y: 1600 },
        { id: "t_bridge", x: 2080, y: 620, role: "bridge" },
      ],
      edges: [
        { from: "t_exit", to: "t_1" },
        { from: "t_1", to: "t_2" },
        { from: "t_2", to: "t_core" },
        { from: "t_2", to: "t_eng" },
        { from: "t_core", to: "t_bridge" },
      ],
    },
  ],
};
