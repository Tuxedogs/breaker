import type { ComponentType, SVGProps } from "react";
import CargoDeck from "../../assets/maps/decks/perseus/perseus_cargo.svg?react";
import MidDeck from "../../assets/maps/decks/perseus/perseus_mid.svg?react";
import TopDeck from "../../assets/maps/decks/perseus/perseus_top.svg?react";
import cargoDeckUrl from "../../assets/maps/decks/perseus/perseus_cargo.svg";
import midDeckUrl from "../../assets/maps/decks/perseus/perseus_mid.svg";
import topDeckUrl from "../../assets/maps/decks/perseus/perseus_top.svg";

export const decks = {
  cargo: CargoDeck,
  mid: MidDeck,
  top: TopDeck,
} as const;

export type DeckId = keyof typeof decks;

export type DeckFloorDefinition = {
  id: DeckId;
  label: string;
  deckMin: number;
  enabled: boolean;
  nativeViewBox: [number, number];
  svgUrl: string;
  overlayAdjustments?: {
    rotationDeg?: number;
    offsetY?: number;
    offsetX?: number;
    offsetZ?: number;
    scaleMultiplier?: number;
  };
  Component: ComponentType<SVGProps<SVGSVGElement>>;
};

export const perseusDeckFloors: DeckFloorDefinition[] = [
  {
    id: "cargo",
    label: "Cargo Deck",
    deckMin: -0.19,
    enabled: true,
    nativeViewBox: [1506, 956],
    svgUrl: cargoDeckUrl,
    overlayAdjustments: {
      rotationDeg: 90,
      offsetX: .0,
      offsetZ: .15,
      scaleMultiplier: .65,
    },
    Component: decks.cargo,
  },
  {
    id: "mid",
    label: "Mid Deck",
    deckMin: -0.052,
    enabled: true,
    nativeViewBox: [2063, 694],
    svgUrl: midDeckUrl,
    overlayAdjustments: {
      rotationDeg: 90,
      offsetX: 0.069,
      offsetZ: 0.2,
      scaleMultiplier: 1,
    },
    Component: decks.mid,
  },
  {
    id: "top",
    label: "Top Deck",
    deckMin: 0.213,
    enabled: false,
    nativeViewBox: [980, 289],
    svgUrl: topDeckUrl,
    overlayAdjustments: {
      rotationDeg: 90,
      offsetX: 0,
      offsetZ: 0.80,
      offsetY: 0.10,
      scaleMultiplier: 0.45,
    },
    Component: decks.top,
  },
];
