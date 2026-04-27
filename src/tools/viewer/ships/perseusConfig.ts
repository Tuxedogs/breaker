import type { ViewerShipConfig } from '../viewerRegistry';
import type { ShipMapDeckAnnotationConfig, ShipMapDeckOverlay } from '../ShipMapTemplate';
import {
  perseusShipData,
  perseusRoomMap,
  perseusHardpointsByRoom,
  perseusViewerNodeMap,
} from '../../../data/ships/perseusData';
import { perseusDeckFloors } from '../../maps/data/perseusDeckFloorRegistry';

// ─────────────────────────────────────────────────────────────────────────────
// Mid-deck annotations — worldPositions are in viewer model space, manually
// tuned against the GLB. Ship systems (power, shields, radar, QT, cooler,
// life support) are not present in the perseusData.ts XML extract, so their
// positions and metadata must stay manually defined here.
// ─────────────────────────────────────────────────────────────────────────────

const midDeckAnnotations: ShipMapDeckAnnotationConfig = {
  fixedHeightAboveDeckMin: 0.02,
  worldOffset: [0, 0, 0],
  components: [
    { id: 'gun-01',                    annotationType: 'component', label: 'Gun 01',                    token: 'Gun 01',   kind: 'Main Turret',  worldPosition: [ 0.013, -0.052, -1.42  ], colorHint: '#f50b0b' },
    { id: 'engineer-terminal-1',       annotationType: 'component', label: 'Engineer Terminal 1',       token: 'ENG TRM',  kind: 'Terminal',     worldPosition: [-0.154, -0.052, -0.794 ], colorHint: '#67a1f9' },
    { id: 'torpedo-operator-terminal', annotationType: 'component', label: 'Torpedo Operator Terminal', token: 'TORP TRM', kind: 'Terminal',     worldPosition: [ 0.170, -0.052, -0.785 ], colorHint: '#f50b0b' },
    { id: 'power-plant-1',             annotationType: 'component', label: 'Power Plant 1',             token: 'PWR',      kind: 'Power',        worldPosition: [ 0.318, -0.052, -0.43  ], colorHint: '#f59e0b' },
    { id: 'cooler-1',                  annotationType: 'component', label: 'Cooler 1',                  token: 'CLR',      kind: 'Cooler',       worldPosition: [-0.295, -0.052, -0.42  ], colorHint: '#93c5fd' },
    { id: 'shield-generator-1',        annotationType: 'component', label: 'Shield Generator 1',        token: 'SHD',      kind: 'Shield',       worldPosition: [ 0.108, -0.052, -1.100 ], colorHint: '#06a7bd' },
    { id: 'power-plant-2',             annotationType: 'component', label: 'Power Plant 2',             token: 'PWR',      kind: 'Power',        worldPosition: [ 0.267, -0.052,  1.526 ], colorHint: '#f59e0b' },
    { id: 'shield-generator-2',        annotationType: 'component', label: 'Shield Generator 2',        token: 'Shield',   kind: 'Shield',       worldPosition: [ 0.280, -0.052,  1.70  ], colorHint: '#06a7bd' },
    { id: 'radar',                     annotationType: 'component', label: 'Radar',                     token: 'RADAR',    kind: 'Radar',        worldPosition: [ 0.230, -0.052,  1.645 ], colorHint: '#1ed10e' },
    { id: 'qt-drive',                  annotationType: 'component', label: 'QT Drive',                  token: 'QT',       kind: 'Quantum',      worldPosition: [ 0.020, -0.052,  1.86  ], colorHint: '#911696' },
    { id: 'life-support',              annotationType: 'component', label: 'Life Support',              token: 'LIFE',     kind: 'Life-Support', worldPosition: [-0.216, -0.052,  1.695 ], colorHint: '#4ade80' },
    { id: 'cooler-2',                  annotationType: 'component', label: 'Cooler 2',                  token: 'CLR',      kind: 'Cooler',       worldPosition: [-0.216, -0.052,  1.52  ], colorHint: '#93c5fd' },
    { id: 'engineer-terminal-2',       annotationType: 'component', label: 'Engineer Terminal 2',       token: 'ENG',      kind: 'Terminal',     worldPosition: [ 0.010, -0.052,  1.663 ], colorHint: '#67e8f9' },
  ],
  labels: [
    { id: 'crew-quarters-section',       annotationType: 'label', label: 'Crew',        token: 'CRW', kind: 'Cargo',    worldPosition: [ 0.516, -0.052, 1.079 ], colorHint: '#e2e8f0' },
    { id: 'armory-section',              annotationType: 'label', label: 'Armory',       token: 'ARM', kind: 'Cargo',    worldPosition: [ 0.501, -0.052, 0.702 ], colorHint: '#fca5a5' },
    { id: 'main-ladder',                 annotationType: 'label', label: 'Main Ladder',  token: 'LDR', kind: 'Ladder',   worldPosition: [ 0.170, -0.052, 0.62  ], colorHint: '#01ffd5', pathing: { connectsDeckIds: ['bottom', 'mid', 'top'], toLabels: ['To Cargo Deck', 'To Bridge'] } },
    { id: 'elevator',                    annotationType: 'label', label: 'Elevator',     token: 'ELV', kind: 'Elevator', worldPosition: [ 0.170, -0.052, 0.77  ], colorHint: '#01ffd5', pathing: { connectsDeckIds: ['bottom', 'mid', 'top'], toLabels: ['To Cargo Deck', 'To Bridge'] } },
    { id: 'secondary-ladder-port',       annotationType: 'label', label: 'Ladder',       token: 'LDR', kind: 'Ladder',   worldPosition: [-0.440, -0.052, -0.294], colorHint: '#f8fafc', pathing: { connectsDeckIds: ['bottom', 'mid'], toLabels: ['To Cargo Deck'] } },
    { id: 'secondary-ladder-starboard',  annotationType: 'label', label: 'Ladder',       token: 'LDR', kind: 'Ladder',   worldPosition: [ 0.303, -0.052,  0.368], colorHint: '#f8fafc', pathing: { connectsDeckIds: ['bottom', 'mid'], toLabels: ['To Cargo Deck'] } },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Overlay decks — built from perseusDeckFloorRegistry so deckMin, svgPath,
// viewBox, and overlay adjustments have a single source of truth.
//
// What stays manual here:
//   id       — ShipMapTemplate stores this in localStorage; keep stable
//   deckMax  — viewer-tuned model-space cutoff, not in game extract
//   annotations — mid-deck only, see above
// ─────────────────────────────────────────────────────────────────────────────

const OVERLAY_ID: Record<string, string> = {
  cargo: 'cargo_percy',
  mid:   'percy_mid',
  top:   'percy_top',
};

const DECK_MAX: Record<string, number> = {
  cargo: -0.086,
  mid:    0.139,
  top:    0.36,
};

const overlayDecks: ShipMapDeckOverlay[] = perseusDeckFloors
  .filter((f) => f.enabled)
  .sort((a, b) => a.deckMin - b.deckMin)
  .map((floor) => ({
    id:              OVERLAY_ID[floor.id]  ?? floor.id,
    title:           `Perseus ${floor.label}`,
    deckMin:         floor.deckMin,
    deckMax:         DECK_MAX[floor.id]   ?? floor.deckMin + 0.2,
    svgPath:         floor.svgUrl,
    viewBox:         floor.nativeViewBox,
    rotationDeg:     floor.overlayAdjustments?.rotationDeg,
    offsetX:         floor.overlayAdjustments?.offsetX,
    offsetZ:         floor.overlayAdjustments?.offsetZ,
    scaleMultiplier: floor.overlayAdjustments?.scaleMultiplier,
    ...(floor.id === 'mid' ? { annotations: midDeckAnnotations } : {}),
  }));

// ─────────────────────────────────────────────────────────────────────────────
// Perseus viewer config
// Game-derived data (rooms, hardpoints, nodes, decks) comes from perseusData.ts.
// UI-only values (camera, storage key, SVG overlay positions) are defined here.
// ─────────────────────────────────────────────────────────────────────────────

export const perseusViewerConfig: ViewerShipConfig = {
  id:             'perseus',
  label:          `${perseusShipData.name} Holo Viewer`,
  subtitle:       'Drag to orbit, right-drag to pan, scroll or pinch to zoom. Use Interior to pick a deck, then tap legend items to highlight systems and trace paths between components.',
  modelPath:      '/models/perctex.glb',
  defaultView: {
    position: [-1.946,  2.097, 0.398],
    target:   [ 0.004, -0.011, 0.4  ],
  },
  viewStorageKey:      'ship-map:perseus:default-view',
  defaultOverlayDeckId: OVERLAY_ID.mid,
  defaultDeckId:        'main',
  logicalDecks:  perseusShipData.decks.map((d) => ({ id: d.id, label: d.label })),
  overlayDecks,
  viewerNodes:       perseusShipData.viewerNodes,
  roomMap:           perseusRoomMap,
  hardpointsByRoom:  perseusHardpointsByRoom,
  nodeMap:           perseusViewerNodeMap,
};
