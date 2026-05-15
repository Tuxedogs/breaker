import type { ComponentType, ReactElement, SVGProps } from "react";

const cargoDeckUrl = "/images/maps/deckmaps/percy-cargo.png";
const midDeckUrl = "/images/maps/deckmaps/percy-midDeck.png";
const topDeckUrl = "/images/maps/deckmaps/percy-topDeck.png";

function createDeckImageComponent(
  href: string,
  viewBox: [number, number],
): ComponentType<SVGProps<SVGSVGElement>> {
  return function DeckImageComponent(props): ReactElement {
    return (
      <svg viewBox={`0 0 ${viewBox[0]} ${viewBox[1]}`} xmlns="http://www.w3.org/2000/svg" {...props}>
        <image href={href} x="0" y="0" width={viewBox[0]} height={viewBox[1]} preserveAspectRatio="xMidYMid meet" />
      </svg>
    );
  };
}

export const decks = {
  cargo: createDeckImageComponent(cargoDeckUrl, [1506, 956]),
  mid: createDeckImageComponent(midDeckUrl, [2063, 694]),
  top: createDeckImageComponent(topDeckUrl, [980, 289]),
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
      offsetX: 0.030,
      offsetZ: 0.2,
      scaleMultiplier: 1,
    },
    Component: decks.mid,
  },
  {
    id: "top",
    label: "Top Deck",
    deckMin: 0.213,
    enabled: true,
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
