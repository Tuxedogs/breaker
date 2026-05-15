import type { ShipMapViewState, ShipMapDeckOverlay } from './ShipMapTemplate';

// ─────────────────────────────────────────────────────────────────────────────
// Generic viewer types — ship-agnostic shapes used by ViewerPage
// ─────────────────────────────────────────────────────────────────────────────

export type ViewerShipId = 'perseus';

export type ViewerLogicalDeck = {
  id: string;
  label: string;
};

export type ViewerNode = {
  id: string;
  label: string;
  type: string;
  roomId: string;
  deckId: string;
  token: string;
  adjacentNodeIds: readonly string[];
};

export type ViewerRoom = {
  id: string;
  label: string;
  desc?: string;
};

export type ViewerHardpoint = {
  id: string;
  kind: string;
  name: string;
};

export type ViewerShipConfig = {
  id: ViewerShipId;
  label: string;
  subtitle: string;
  modelPath: string;
  defaultView: ShipMapViewState;
  viewStorageKey: string;
  defaultOverlayDeckId: string;
  defaultDeckId: string;
  logicalDecks: readonly ViewerLogicalDeck[];
  overlayDecks: readonly ShipMapDeckOverlay[];
  viewerNodes: readonly ViewerNode[];
  roomMap: Record<string, ViewerRoom>;
  hardpointsByRoom: Record<string, ViewerHardpoint[]>;
  nodeMap: Record<string, ViewerNode>;
};

// ─────────────────────────────────────────────────────────────────────────────
// Registry — add a new ship by importing its config and registering it here
// ─────────────────────────────────────────────────────────────────────────────

import { perseusViewerConfig } from './ships/perseusConfig';

const viewerRegistry: Record<ViewerShipId, ViewerShipConfig> = {
  perseus: perseusViewerConfig,
};

export function getViewerConfig(id: ViewerShipId): ViewerShipConfig {
  return viewerRegistry[id];
}
