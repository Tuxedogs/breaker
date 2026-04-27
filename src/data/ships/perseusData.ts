/**
 * RSI Perseus — structured ship data for Scintel viewer
 *
 * Source: rsi_perseus_*.xml  (TileXmlEntry hardpoints + entitycomponentinteriormapsection.xml)
 * Build changelist: 11621005   Total static entities: 649
 *
 * Coordinate system (module-local space, meters):
 *   X = starboard (+) / port (−)
 *   Y = fore (+) / aft (−)
 *   Z = up (+) / down (−)
 *
 * worldPos on every hardpoint is the interactionOffset value directly from XML —
 * it is not normalised or scaled. Apply module-world transforms (from rsi_perseus.xml)
 * before compositing into ship space.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Primitive types
// ─────────────────────────────────────────────────────────────────────────────

export type Vec3 = readonly [number, number, number]
export type Quat4 = readonly [number, number, number, number] // [w, x, y, z]

// ─────────────────────────────────────────────────────────────────────────────
// Decks
// ─────────────────────────────────────────────────────────────────────────────

export type DeckId = 'upper' | 'main' | 'lower'

export type ShipDeck = {
  id: DeckId
  label: string
  /** @vehicle_deck_* entity name from entitycomponentinteriormapsection.xml */
  entityName: string
  /** Source module that owns this deck section entity */
  sourceModuleId: ModuleId
  transform: {
    /** Identity quaternion for all three decks: no rotation applied */
    rotation: Quat4
    /** Module-local translation (meters) */
    translation: Vec3
  }
  /** [width, length, height] in meters */
  size: Vec3
  cryGuid: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Modules & Rooms
// ─────────────────────────────────────────────────────────────────────────────

export type ModuleId =
  | 'top'
  | 'nose'
  | 'bottom'
  | 'cargo'
  | 'habs'
  | 'elevator'
  | 'elevator_car'

export type ShipRoom = {
  id: string
  label: string
  moduleId: ModuleId
  deckId: DeckId
  desc: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Hardpoints
// ─────────────────────────────────────────────────────────────────────────────

export type HardpointKind =
  | 'door'
  | 'door_control'
  | 'light_control'
  | 'light_group'
  | 'room_visarea'
  | 'control_panel'
  | 'fire_extinguisher'
  | 'misc'

export type GridBehavior = 'Interior' | 'Exterior' | 'Both'

export type ShipHardpoint = {
  id: string
  /** Full entity name from port name field in TileItemPortEntries */
  name: string
  kind: HardpointKind
  /** interactionOffset — confirmed from XML, module-local space, meters */
  worldPos: Vec3
  gridBehavior: GridBehavior
  roomId: string
  moduleId: ModuleId
  /** Target room or system decoded from "to{X}" in port name */
  linksTo?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Inter-module relay links
// ─────────────────────────────────────────────────────────────────────────────

export type RelayLink = {
  id: string
  label: string
  fromRoomId: string
  toRoomId: string
  fromModuleId: ModuleId
  toModuleId: ModuleId
  linkType: 'door' | 'control_panel'
  /** Connection point position in source-module local space */
  worldPos: Vec3
}

// ─────────────────────────────────────────────────────────────────────────────
// Torpedo system
// ─────────────────────────────────────────────────────────────────────────────

export type TorpedoLauncher = {
  id: string
  label: string
  /** S5 hardpoint */
  size: 5
  side: 'port' | 'starboard'
  /** Component bay door position — nose module local space */
  compbayDoorPos: Vec3
  /** Door latch control panel position */
  doorControlPos: Vec3
}

export type TorpedoSystem = {
  launchers: readonly TorpedoLauncher[]
  operatorConsole: {
    /** Physical position of the console panel inside the turret bubble */
    inTurretPos: Vec3
    /** Matching panel on the torpedo room side of the same link */
    inTorpedoRoomPos: Vec3
  }
  lightControlPos: Vec3
  lightGroupPos: Vec3
  fireExtinguisherPos: Vec3
  reservePerRack: number
  totalReserve: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Elevator / SCTransit system
// ─────────────────────────────────────────────────────────────────────────────

export type ElevatorTransit = {
  shaftBounds: { min: Vec3; max: Vec3 }
  /** Streaming radius — 209 m; spans the full vertical extent of the ship */
  shaftRadius: number
  lightGroupPos: Vec3
  lightControlPos: Vec3
  /**
   * SCTransit component types instantiated in this module.
   * SCTransitNavSplineData encodes the 3D spline path as CryXmlB binary;
   * decode with cry-xml before consuming in a viewer.
   */
  components: readonly string[]
  /** Path to the binary navspline metadata file */
  navSplineFile: string
  car: { radius: number }
}

// ─────────────────────────────────────────────────────────────────────────────
// Viewer nodes — logical navigation graph for the ship viewer UI
// ─────────────────────────────────────────────────────────────────────────────

export type ViewerNodeType =
  | 'room'
  | 'combat'
  | 'system'
  | 'logistics'
  | 'weapon'
  | 'transit'

export type ViewerNode = {
  id: string
  label: string
  type: ViewerNodeType
  roomId: string
  deckId: DeckId
  /** Short badge text for compact UI contexts */
  token: string
  /** IDs of directly reachable nodes via a door or ladder */
  adjacentNodeIds: readonly string[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Root
// ─────────────────────────────────────────────────────────────────────────────

export type PerseusShipData = {
  id: string
  name: string
  manufacturer: string
  role: string
  focus: string
  crew: { min: number; recommended: number }
  dimensions: { length: number; beam: number; height: number }
  /** CryEngine ObjectContainer names, in load order */
  objectContainers: readonly string[]
  decks: readonly ShipDeck[]
  rooms: readonly ShipRoom[]
  hardpoints: readonly ShipHardpoint[]
  crewStations: readonly string[]
  torpedoSystem: TorpedoSystem
  relayLinks: readonly RelayLink[]
  elevatorTransit: ElevatorTransit
  viewerNodes: readonly ViewerNode[]
  sources: {
    extractedXml: true
    buildChangelist: number
    totalStaticEntities: number
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────────────────────────────────────

export const perseusShipData: PerseusShipData = {
  id: 'perseus',
  name: 'RSI Perseus',
  manufacturer: 'Roberts Space Industries',
  role: 'Heavy Gunship',
  focus: 'Anti-subcapital / Fleet Defense',
  crew: { min: 2, recommended: 6 },
  dimensions: { length: 76, beam: 36, height: 14 },

  objectContainers: [
    'rsi_perseus_top',
    'rsi_perseus_bottom',
    'rsi_perseus_nose',
    'rsi_perseus_habs',
    'rsi_perseus_cargo',
    'rsi_perseus_elevator',
    'rsi_perseus_elevator_car',
    'rsi_perseus_ext_lighting',
    'rsi_perseus_turret_top_lighting',
    'rsi_perseus_turret_bottom_lighting',
  ],

  // ───────────────────────────────────────────────────
  // Decks
  // Source: modules/rsi_perseus_{module}/rsi_perseus_{module}/metadata/entitycomponentinteriormapsection.xml
  // ───────────────────────────────────────────────────
  decks: [
    {
      id: 'upper',
      label: 'Bridge Deck',
      entityName: '@vehicle_deck_upper',
      sourceModuleId: 'top',
      transform: {
        rotation: [1, 0, 0, 0],
        translation: [-0.031068, 2.744865, -0.148999],
      },
      size: [10, 32, 4],
      cryGuid: '4b0e7865-7b7a-2c5c-206d-302073e7b7b3',
    },
    {
      id: 'main',
      label: 'Main Deck',
      entityName: '@vehicle_deck_main',
      sourceModuleId: 'bottom',
      transform: {
        rotation: [1, 0, 0, 0],
        translation: [0.613214, 13.813649, 5.214468],
      },
      size: [22, 68, 3.5],
      cryGuid: '4986ebbd-8bcc-20ae-0996-4e5c373c6492',
    },
    {
      id: 'lower',
      label: 'Hab Deck',
      entityName: '@vehicle_deck_lower',
      sourceModuleId: 'habs',
      transform: {
        rotation: [1, 0, 0, 0],
        translation: [-0.217982, 15.089988, -2.172602],
      },
      size: [20, 45, 3],
      cryGuid: '497d72e7-20a3-d0ea-40c2-51405ea4cea7',
    },
  ],

  // ───────────────────────────────────────────────────
  // Rooms
  // Extracted from [roomId_SETUP] and [roomId_visarea] suffixes in TileItemPortEntries
  // ───────────────────────────────────────────────────
  rooms: [
    // Top module — Bridge Deck
    { id: 'top_bridge', label: 'Bridge', moduleId: 'top', deckId: 'upper', desc: 'Primary flight and command station. Breachable forward door.' },
    { id: 'top_captains_quarters', label: "Captain's Quarters", moduleId: 'top', deckId: 'upper', desc: 'Private bunk and locker room aft of bridge.' },
    { id: 'top_captains_quarters_bathroom', label: "Captain's Bathroom", moduleId: 'top', deckId: 'upper', desc: 'En-suite toilet compartment off captain\'s quarters.' },
    { id: 'top_corridor', label: 'Bridge Corridor', moduleId: 'top', deckId: 'upper', desc: 'Fore-aft passage linking bridge, quarters, and escape pod access.' },
    { id: 'top_corridor_airlock', label: 'Bridge Airlock', moduleId: 'top', deckId: 'upper', desc: 'Three-stage airlock on the bridge deck.' },
    // Nose module — Main Deck (forward section, no dedicated deck entity)
    { id: 'nose_torpedo_room', label: 'Torpedo Room', moduleId: 'nose', deckId: 'main', desc: 'Torpedo operator console, component bays, and cargo-linked access doors.' },
    { id: 'nose_turret_entry', label: 'Nose Turret Entry', moduleId: 'nose', deckId: 'main', desc: 'Access vestibule and control panel for the forward turret station.' },
    // Bottom module — Main Deck
    { id: 'bottom_corridor', label: 'Bottom Corridor', moduleId: 'bottom', deckId: 'main', desc: 'Central passage linking cargo, ladder shafts, and bottom turret entry.' },
    { id: 'bottom_turret_entry', label: 'Bottom Turret Entry', moduleId: 'bottom', deckId: 'main', desc: 'Gunner station vestibule for the ventral turret.' },
    // Cargo module — Main Deck
    { id: 'cargo_bay', label: 'Cargo Bay', moduleId: 'cargo', deckId: 'main', desc: 'Central open bay. Contains port/starboard docking collar doors and basketball hoop.' },
    { id: 'cargo_docking_collar_left', label: 'Port Docking Collar', moduleId: 'cargo', deckId: 'main', desc: 'Port-side pressurised docking collar with independent door controls.' },
    { id: 'cargo_docking_collar_right', label: 'Starboard Docking Collar', moduleId: 'cargo', deckId: 'main', desc: 'Starboard-side pressurised docking collar with independent door controls.' },
    // Habs module — Hab Deck
    { id: 'habs_bunks', label: 'Crew Bunks', moduleId: 'habs', deckId: 'lower', desc: 'Bunk room with closet access, en-suite toilet, and individual light controls.' },
    { id: 'habs_corridor', label: 'Hab Corridor', moduleId: 'habs', deckId: 'lower', desc: 'Central passage through the habitation section.' },
    { id: 'habs_foyer', label: 'Foyer', moduleId: 'habs', deckId: 'lower', desc: 'Transition space between corridor and engineering.' },
    { id: 'habs_engineering', label: 'Engineering', moduleId: 'habs', deckId: 'lower', desc: 'Ship systems engineering room. Contains two engineering terminals.' },
    { id: 'habs_mess', label: 'Mess Hall', moduleId: 'habs', deckId: 'lower', desc: 'Crew dining and recreation space.' },
    // Elevator modules — spans Main Deck and adjacent decks
    { id: 'elevator', label: 'Elevator Shaft', moduleId: 'elevator', deckId: 'main', desc: 'Vertical transit shaft using the SCTransit system. Spans full ship height.' },
    { id: 'elevator_car', label: 'Elevator Car', moduleId: 'elevator_car', deckId: 'main', desc: 'Moving cabin; SCTransitPeripheral component. Radius 7.44 m.' },
  ],

  // ───────────────────────────────────────────────────
  // Hardpoints
  // All worldPos values are interactionOffset from TileItemPortEntries — direct from XML
  // ───────────────────────────────────────────────────
  hardpoints: [
    // ── TOP MODULE ───────────────────────────────────
    { id: 'top_P0', moduleId: 'top', roomId: 'top_bridge', kind: 'fire_extinguisher', gridBehavior: 'Interior', worldPos: [3.013, -2.039, 4.418], name: 'Gadget_Cabinet_kegr_fire_extinguisher_NG' },
    { id: 'top_P1', moduleId: 'top', roomId: 'top_bridge', kind: 'light_control', gridBehavior: 'Interior', worldPos: [-0.525, -1.542, 5.070], name: 'ChipSet_LightControl_int_top_bridge' },
    { id: 'top_P2', moduleId: 'top', roomId: 'top_bridge', kind: 'door_control', gridBehavior: 'Both', worldPos: [3.021, -1.722, 4.895], name: 'ControlPanel_Screen_DoorControl_Physical-048' },
    { id: 'top_P3', moduleId: 'top', roomId: 'top_bridge', kind: 'room_visarea', gridBehavior: 'Interior', worldPos: [-0.033, -0.157, 4.700], name: 'Room_RN_top_bridge' },
    { id: 'top_P4', moduleId: 'top', roomId: 'top_bridge', kind: 'light_group', gridBehavior: 'Interior', worldPos: [0, 1.478, 5.413], name: 'LightGroup_top_bridge_lighting' },
    { id: 'top_P5', moduleId: 'top', roomId: 'top_bridge', kind: 'door', gridBehavior: 'Interior', worldPos: [3.319, -1.906, 4.918], name: 'Door_RN_NoRoomConnector_Breachable_OpenReverse-006' },
    { id: 'top_P6', moduleId: 'top', roomId: 'top_captains_quarters_bathroom', kind: 'light_control', gridBehavior: 'Interior', worldPos: [-2.736, -21.389, 4.258], name: 'ChipSet_LightControl_top_captains_toilet' },
    { id: 'top_P7', moduleId: 'top', roomId: 'top_captains_quarters', kind: 'light_control', gridBehavior: 'Interior', worldPos: [-0.149, -16.042, 4.410], name: 'ChipSet_LightControl_int_top_captains_quarters' },
    { id: 'top_P8', moduleId: 'top', roomId: 'top_captains_quarters_bathroom', kind: 'control_panel', gridBehavior: 'Both', worldPos: [-2.532, -22.051, 4.318], name: 'int_top_captains_quarters_control_panel_toToilet_inToilet', linksTo: 'top_captains_quarters' },
    { id: 'top_P9', moduleId: 'top', roomId: 'top_captains_quarters', kind: 'light_control', gridBehavior: 'Interior', worldPos: [-0.005, -22.765, 3.999], name: 'ChipSet_LightControl_int_top_captains_quarters_bed' },
    { id: 'top_P10', moduleId: 'top', roomId: 'top_captains_quarters_bathroom', kind: 'misc', gridBehavior: 'Both', worldPos: [-3.617, -21.282, 4.205], name: 'int_top_captains_quarters_toilet_button' },
    { id: 'top_P15', moduleId: 'top', roomId: 'top_captains_quarters', kind: 'light_group', gridBehavior: 'Interior', worldPos: [0, -17.406, 4.478], name: 'LightGroup_top_captains_quarters_lighting' },
    { id: 'top_P29', moduleId: 'top', roomId: 'top_corridor', kind: 'light_group', gridBehavior: 'Interior', worldPos: [0, -7.314, 4.478], name: 'LightGroup_top_corridor_lighting' },

    // ── NOSE MODULE ──────────────────────────────────
    // Dual-sided turret control link: P0 = panel on turret side, P1 = panel on torpedo room side
    { id: 'nose_P0', moduleId: 'nose', roomId: 'nose_turret_entry', kind: 'control_panel', gridBehavior: 'Both', worldPos: [-0.995, 29.278, -0.976], name: 'int_nose_torpedo_room_control_panel_toTurret_inTurret', linksTo: 'nose_torpedo_room' },
    { id: 'nose_P1', moduleId: 'nose', roomId: 'nose_torpedo_room', kind: 'control_panel', gridBehavior: 'Both', worldPos: [0.996, 28.771, -0.975], name: 'int_nose_torpedo_room_control_panel_toTurret_inTorpedoRoom', linksTo: 'nose_turret_entry' },
    { id: 'nose_P2', moduleId: 'nose', roomId: 'nose_torpedo_room', kind: 'door_control', gridBehavior: 'Both', worldPos: [-2.044, 28.303, -0.702], name: 'int_nose_torpedo_room_door_control_left' },
    // Compbay doors — port/starboard torpedo launcher access
    { id: 'nose_P3', moduleId: 'nose', roomId: 'nose_torpedo_room', kind: 'door', gridBehavior: 'Interior', worldPos: [-2.260, 25.194, -1.790], name: 'int_nose_torpedo_room_compbay_door_left' },
    { id: 'nose_P12', moduleId: 'nose', roomId: 'nose_torpedo_room', kind: 'door', gridBehavior: 'Interior', worldPos: [2.257, 28.191, -1.799], name: 'int_nose_torpedo_room_compbay_door_right' },
    // Cargo connection doors (top centre, port lower, starboard lower)
    { id: 'nose_P4', moduleId: 'nose', roomId: 'nose_torpedo_room', kind: 'door', gridBehavior: 'Interior', worldPos: [0, 13.632, -2.314], name: 'int_nose_torpedo_room_door_toCargo_top', linksTo: 'cargo_bay' },
    { id: 'nose_P8', moduleId: 'nose', roomId: 'nose_torpedo_room', kind: 'door', gridBehavior: 'Interior', worldPos: [-6.031, 13.513, -5.461], name: 'int_nose_torpedo_room_door_toCargo_left', linksTo: 'cargo_bay' },
    { id: 'nose_P11', moduleId: 'nose', roomId: 'nose_torpedo_room', kind: 'door', gridBehavior: 'Interior', worldPos: [6.032, 13.533, -5.447], name: 'int_nose_torpedo_room_door_toCargo_right', linksTo: 'cargo_bay' },
    // Cargo control panels (panels in cargo bay and in torpedo room for each door)
    { id: 'nose_P5', moduleId: 'nose', roomId: 'nose_torpedo_room', kind: 'control_panel', gridBehavior: 'Both', worldPos: [3.717, 12.986, -4.599], name: 'int_nose_torpedo_room_control_panel_toCargo_inCargo_right', linksTo: 'cargo_bay' },
    { id: 'nose_P7', moduleId: 'nose', roomId: 'nose_torpedo_room', kind: 'control_panel', gridBehavior: 'Both', worldPos: [-3.719, 12.986, -4.601], name: 'int_nose_torpedo_room_control_panel_toCargo_inCargo_left', linksTo: 'cargo_bay' },
    { id: 'nose_P9', moduleId: 'nose', roomId: 'nose_torpedo_room', kind: 'control_panel', gridBehavior: 'Both', worldPos: [-0.139, 13.731, -1.009], name: 'int_nose_torpedo_room_control_panel_toCargo_inTorpedoRoom_top', linksTo: 'cargo_bay' },
    { id: 'nose_P14', moduleId: 'nose', roomId: 'nose_torpedo_room', kind: 'control_panel', gridBehavior: 'Both', worldPos: [-5.940, 13.656, -4.485], name: 'int_nose_torpedo_room_control_panel_toCargo_inTorpedoRoom_left', linksTo: 'cargo_bay' },
    { id: 'nose_P10', moduleId: 'nose', roomId: 'nose_torpedo_room', kind: 'door_control', gridBehavior: 'Both', worldPos: [2.042, 25.077, -0.705], name: 'int_nose_torpedo_room_door_control_right' },
    { id: 'nose_P6', moduleId: 'nose', roomId: 'nose_torpedo_room', kind: 'fire_extinguisher', gridBehavior: 'Interior', worldPos: [-1.099, 28.700, -0.915], name: 'Gadget_Cabinet_kegr_fire_extinguisher_NG-001' },
    { id: 'nose_P13', moduleId: 'nose', roomId: 'nose_torpedo_room', kind: 'light_control', gridBehavior: 'Interior', worldPos: [0.325, 20.548, -1.529], name: 'ChipSet_LightControl_int_nose_torpedo_room' },
    { id: 'nose_P18', moduleId: 'nose', roomId: 'nose_torpedo_room', kind: 'light_group', gridBehavior: 'Interior', worldPos: [0.117, 22.468, -0.635], name: 'LightGroup_nose_torpedo_room_lighting' },

    // ── BOTTOM MODULE ────────────────────────────────
    { id: 'bot_P0', moduleId: 'bottom', roomId: 'bottom_corridor', kind: 'light_control', gridBehavior: 'Interior', worldPos: [-0.259, -7.388, -5.033], name: 'int_bottom_corridor_ChipSet_LightControl' },
    { id: 'bot_P1', moduleId: 'bottom', roomId: 'bottom_corridor', kind: 'control_panel', gridBehavior: 'Both', worldPos: [2.667, -6.444, -4.664], name: 'int_bottom_corridor_control_panel_toLadder_inCorridor', linksTo: 'ladder' },
    { id: 'bot_P2', moduleId: 'bottom', roomId: 'bottom_corridor', kind: 'door_control', gridBehavior: 'Both', worldPos: [-1.777, -6.957, -4.705], name: 'int_bottom_corridor_compbay_door_control_left' },
    { id: 'bot_P3', moduleId: 'bottom', roomId: 'bottom_corridor', kind: 'control_panel', gridBehavior: 'Both', worldPos: [-1.090, -12.994, -3.477], name: 'int_bottom_corridor_control_panel_toGunner_inCorridor', linksTo: 'bottom_turret_entry' },
    { id: 'bot_P4', moduleId: 'bottom', roomId: 'bottom_corridor', kind: 'door_control', gridBehavior: 'Both', worldPos: [-1.780, -3.381, -4.701], name: 'int_bottom_corridor_compbay_door_control_right' },
    { id: 'bot_P5', moduleId: 'bottom', roomId: 'bottom_corridor', kind: 'door', gridBehavior: 'Interior', worldPos: [-1.016, -4.949, -6.126], name: 'int_bottom_corridor_compbay_door_right' },
    { id: 'bot_P6', moduleId: 'bottom', roomId: 'bottom_corridor', kind: 'door', gridBehavior: 'Interior', worldPos: [-1.022, -8.256, -6.121], name: 'int_bottom_corridor_compbay_door_left' },
    { id: 'bot_P7', moduleId: 'bottom', roomId: 'bottom_corridor', kind: 'door', gridBehavior: 'Interior', worldPos: [2.706, -3.809, -4.476], name: 'Door_RN_NoRoomConnector_Breachable_OpenReverse-005' },
    { id: 'bot_P8', moduleId: 'bottom', roomId: 'bottom_corridor', kind: 'door', gridBehavior: 'Interior', worldPos: [0, -2.631, -5.891], name: 'int_bottom_corridor_door_toCargo', linksTo: 'cargo_bay' },
    { id: 'bot_P9', moduleId: 'bottom', roomId: 'bottom_corridor', kind: 'control_panel', gridBehavior: 'Both', worldPos: [2.987, -4.437, -4.557], name: 'int_bottom_corridor_control_panel_toLadder_inLadder', linksTo: 'ladder' },
    { id: 'bot_P15', moduleId: 'bottom', roomId: 'bottom_corridor', kind: 'light_group', gridBehavior: 'Interior', worldPos: [0.117, -7.409, -4.091], name: 'LightGroup_bottom_corridor_lighting' },

    // ── CARGO MODULE ─────────────────────────────────
    { id: 'cargo_P0', moduleId: 'cargo', roomId: 'cargo_bay', kind: 'fire_extinguisher', gridBehavior: 'Interior', worldPos: [-6.249, -1.431, -0.906], name: 'Gadget_Cabinet_kegr_fire_extinguisher_NG-005' },
    { id: 'cargo_P1', moduleId: 'cargo', roomId: 'cargo_bay', kind: 'door_control', gridBehavior: 'Both', worldPos: [-3.633, 13.131, -0.878], name: 'ControlPanel_Screen_DoorControl_Physical-105' },
    { id: 'cargo_P2', moduleId: 'cargo', roomId: 'cargo_bay', kind: 'control_panel', gridBehavior: 'Both', worldPos: [-8.447, 9.191, -4.740], name: 'int_cargo_cargo_room_docking_collar_door_left_control_panel_in_cargo', linksTo: 'cargo_docking_collar_left' },
    { id: 'cargo_P3', moduleId: 'cargo', roomId: 'cargo_bay', kind: 'door_control', gridBehavior: 'Both', worldPos: [4.004, 13.132, -0.876], name: 'ControlPanel_Screen_DoorControl_Physical-000' },
    { id: 'cargo_P4', moduleId: 'cargo', roomId: 'cargo_bay', kind: 'fire_extinguisher', gridBehavior: 'Interior', worldPos: [-2.607, 12.689, -4.512], name: 'Gadget_Cabinet_kegr_fire_extinguisher_NG-004' },
    { id: 'cargo_P5', moduleId: 'cargo', roomId: 'cargo_bay', kind: 'door_control', gridBehavior: 'Both', worldPos: [-4.348, 13.039, -0.888], name: 'int_cargo_cargo_bay_door_control_port' },
    // Docking collar doors
    { id: 'cargo_P6', moduleId: 'cargo', roomId: 'cargo_bay', kind: 'door', gridBehavior: 'Interior', worldPos: [9.618, 6.483, -5.681], name: 'int_cargo_cargo_room_docking_collar_door_right', linksTo: 'cargo_docking_collar_right' },
    { id: 'cargo_P7', moduleId: 'cargo', roomId: 'cargo_bay', kind: 'door', gridBehavior: 'Interior', worldPos: [-9.608, 6.522, -5.677], name: 'int_cargo_cargo_room_docking_collar_door_left', linksTo: 'cargo_docking_collar_left' },
    { id: 'cargo_P8', moduleId: 'cargo', roomId: 'cargo_bay', kind: 'misc', gridBehavior: 'Interior', worldPos: [-4.875, 6.552, -2.250], name: 'int_cargo_cargo_bay_basketball_hoop_left' },
    { id: 'cargo_P9', moduleId: 'cargo', roomId: 'cargo_bay', kind: 'door_control', gridBehavior: 'Both', worldPos: [4.345, 13.029, -0.888], name: 'int_cargo_cargo_bay_door_control_starboard' },
    { id: 'cargo_P10', moduleId: 'cargo', roomId: 'cargo_bay', kind: 'door', gridBehavior: 'Interior', worldPos: [-7.448, 13.034, -2.002], name: 'int_cargo_cargo_bay_compbay_door_starboard' },
    // Docking collar interior controls
    { id: 'cargo_P11', moduleId: 'cargo', roomId: 'cargo_docking_collar_left', kind: 'control_panel', gridBehavior: 'Both', worldPos: [-10.438, 5.262, -4.251], name: 'int_cargo_cargo_room_docking_collar_door_left_control_panel_in_collar', linksTo: 'cargo_bay' },
    { id: 'cargo_P12', moduleId: 'cargo', roomId: 'cargo_docking_collar_right', kind: 'control_panel', gridBehavior: 'Both', worldPos: [9.441, 6.705, -4.412], name: 'int_cargo_cargo_room_docking_collar_door_right_control_panel_on_door', linksTo: 'cargo_bay' },
    { id: 'cargo_P13', moduleId: 'cargo', roomId: 'cargo_docking_collar_left', kind: 'control_panel', gridBehavior: 'Both', worldPos: [-9.433, 6.746, -4.404], name: 'int_cargo_cargo_room_docking_collar_door_left_control_panel_on_door', linksTo: 'cargo_bay' },
    { id: 'cargo_P14', moduleId: 'cargo', roomId: 'cargo_bay', kind: 'control_panel', gridBehavior: 'Both', worldPos: [8.447, 3.940, -4.741], name: 'int_cargo_cargo_room_docking_collar_door_right_control_panel_in_cargo', linksTo: 'cargo_docking_collar_right' },

    // ── HABS MODULE ──────────────────────────────────
    { id: 'habs_P0', moduleId: 'habs', roomId: 'habs_bunks', kind: 'control_panel', gridBehavior: 'Both', worldPos: [8.560, -9.891, 0.040], name: 'int_habs_bunks_control_panel_toCloset_inBunks', linksTo: 'habs_closet' },
    { id: 'habs_P1', moduleId: 'habs', roomId: 'habs_bunks', kind: 'light_control', gridBehavior: 'Interior', worldPos: [10.756, -12.970, 0.892], name: 'ChipSet_LightControl_habs_bunks_left_top' },
    { id: 'habs_P2', moduleId: 'habs', roomId: 'habs_bunks', kind: 'door', gridBehavior: 'Interior', worldPos: [7.515, -9.704, -1.250], name: 'int_habs_bunks_door_toCloset' },
    { id: 'habs_P3', moduleId: 'habs', roomId: 'habs_bunks', kind: 'light_control', gridBehavior: 'Interior', worldPos: [3.838, -12.868, 0.227], name: 'ChipSet_LightControl_habs_bunks_toilet' },
    { id: 'habs_P4', moduleId: 'habs', roomId: 'habs_bunks', kind: 'light_control', gridBehavior: 'Interior', worldPos: [10.945, -12.886, -0.334], name: 'ChipSet_LightControl_habs_bunks_left_bottom' },

    // ── ELEVATOR MODULE ──────────────────────────────
    { id: 'elev_P0', moduleId: 'elevator', roomId: 'elevator', kind: 'light_group', gridBehavior: 'Interior', worldPos: [3.723, -6.885, -4.336], name: 'LightGroup_elevator_lighting' },
    { id: 'elev_P1', moduleId: 'elevator', roomId: 'elevator', kind: 'light_control', gridBehavior: 'Interior', worldPos: [3.641, -7.228, -4.254], name: 'ChipSet_LightControl_elevator' },
  ],

  crewStations: [
    'Pilot',
    'Top Turret Gunner',
    'Bottom Turret Gunner',
    'Remote Turret Operator',
    'Engineer',
    'Torpedo Officer',
  ],

  // ───────────────────────────────────────────────────
  // Torpedo system
  // All positions from nose module TileItemPortEntries
  // ───────────────────────────────────────────────────
  torpedoSystem: {
    launchers: [
      {
        id: 'rack_port',
        label: 'Port Torpedo Rack',
        size: 5,
        side: 'port',
        // nose_P3: compbay door (X negative = port side)
        compbayDoorPos: [-2.260, 25.194, -1.790],
        // nose_P2: left door latch control
        doorControlPos: [-2.044, 28.303, -0.702],
      },
      {
        id: 'rack_starboard',
        label: 'Starboard Torpedo Rack',
        size: 5,
        side: 'starboard',
        // nose_P12: compbay door (X positive = starboard side)
        compbayDoorPos: [2.257, 28.191, -1.799],
        // nose_P10: right door latch control
        doorControlPos: [2.042, 25.077, -0.705],
      },
    ],
    operatorConsole: {
      // nose_P0: panel physically inside the turret bubble
      inTurretPos: [-0.995, 29.278, -0.976],
      // nose_P1: matching panel on the torpedo room side of the same dual link
      inTorpedoRoomPos: [0.996, 28.771, -0.975],
    },
    // nose_P13
    lightControlPos: [0.325, 20.548, -1.529],
    // nose_P18
    lightGroupPos: [0.117, 22.468, -0.635],
    // nose_P6
    fireExtinguisherPos: [-1.099, 28.700, -0.915],
    reservePerRack: 10,
    totalReserve: 20,
  },

  // ───────────────────────────────────────────────────
  // Relay links — confirmed inter-module door / control connections
  // Decoded from "to{X}" port name patterns
  // ───────────────────────────────────────────────────
  relayLinks: [
    // Nose ↔ Cargo Bay
    {
      id: 'nose_cargo_top',
      label: 'Torpedo Room → Cargo (top centre door)',
      fromRoomId: 'nose_torpedo_room',
      toRoomId: 'cargo_bay',
      fromModuleId: 'nose',
      toModuleId: 'cargo',
      linkType: 'door',
      worldPos: [0, 13.632, -2.314],
    },
    {
      id: 'nose_cargo_port',
      label: 'Torpedo Room → Cargo (port lower door)',
      fromRoomId: 'nose_torpedo_room',
      toRoomId: 'cargo_bay',
      fromModuleId: 'nose',
      toModuleId: 'cargo',
      linkType: 'door',
      worldPos: [-6.031, 13.513, -5.461],
    },
    {
      id: 'nose_cargo_stbd',
      label: 'Torpedo Room → Cargo (starboard lower door)',
      fromRoomId: 'nose_torpedo_room',
      toRoomId: 'cargo_bay',
      fromModuleId: 'nose',
      toModuleId: 'cargo',
      linkType: 'door',
      worldPos: [6.032, 13.533, -5.447],
    },
    // Nose ↔ Turret (operator console link — the panel in the turret is forward of module bounds)
    {
      id: 'nose_turret_console',
      label: 'Torpedo Room → Nose Turret (operator link)',
      fromRoomId: 'nose_torpedo_room',
      toRoomId: 'nose_turret_entry',
      fromModuleId: 'nose',
      toModuleId: 'nose',
      linkType: 'control_panel',
      worldPos: [-0.995, 29.278, -0.976],
    },
    // Bottom Corridor ↔ Cargo Bay
    {
      id: 'bottom_cargo',
      label: 'Bottom Corridor → Cargo Bay',
      fromRoomId: 'bottom_corridor',
      toRoomId: 'cargo_bay',
      fromModuleId: 'bottom',
      toModuleId: 'cargo',
      linkType: 'door',
      worldPos: [0, -2.631, -5.891],
    },
    // Bottom Corridor ↔ Bottom Turret
    {
      id: 'bottom_turret_console',
      label: 'Bottom Corridor → Bottom Turret (gunner station)',
      fromRoomId: 'bottom_corridor',
      toRoomId: 'bottom_turret_entry',
      fromModuleId: 'bottom',
      toModuleId: 'bottom',
      linkType: 'control_panel',
      worldPos: [-1.090, -12.994, -3.477],
    },
    // Cargo Bay ↔ Port Docking Collar
    {
      id: 'cargo_collar_port',
      label: 'Cargo Bay → Port Docking Collar',
      fromRoomId: 'cargo_bay',
      toRoomId: 'cargo_docking_collar_left',
      fromModuleId: 'cargo',
      toModuleId: 'cargo',
      linkType: 'door',
      worldPos: [-9.608, 6.522, -5.677],
    },
    // Cargo Bay ↔ Starboard Docking Collar
    {
      id: 'cargo_collar_stbd',
      label: 'Cargo Bay → Starboard Docking Collar',
      fromRoomId: 'cargo_bay',
      toRoomId: 'cargo_docking_collar_right',
      fromModuleId: 'cargo',
      toModuleId: 'cargo',
      linkType: 'door',
      worldPos: [9.618, 6.483, -5.681],
    },
  ],

  // ───────────────────────────────────────────────────
  // Elevator / SCTransit
  // Source: rsi_perseus_elevator.xml + rsi_perseus_elevator_car.xml
  // ───────────────────────────────────────────────────
  elevatorTransit: {
    shaftBounds: {
      min: [-1.591, -1.192, -2.035],
      max: [3.122, 7.188, 13.475],
    },
    // 209 m streaming radius — the shaft entity loads across the full ship height
    shaftRadius: 209.17,
    // elev_P0
    lightGroupPos: [3.723, -6.885, -4.336],
    // elev_P1
    lightControlPos: [3.641, -7.228, -4.254],
    components: [
      'SCTransitManager',
      'SCTransitGateway',
      'SCTransitDestination',
      'SCTransitNavSplineData',
      'SCTransitPeripheral',
    ],
    // CryXmlB binary — decode with cry-xml before reading spline points
    navSplineFile: 'rsi_perseus_elevator/rsi_perseus_elevator/metadata/sctransitnavsplinedata.xml',
    car: { radius: 7.44 },
  },

  // ───────────────────────────────────────────────────
  // Viewer nodes
  // Logical navigation graph for the ship viewer. adjacentNodeIds encodes
  // which nodes are directly reachable via a door or passage.
  // ───────────────────────────────────────────────────
  viewerNodes: [
    {
      id: 'bridge',
      label: 'Bridge',
      type: 'room',
      roomId: 'top_bridge',
      deckId: 'upper',
      token: 'BRG',
      adjacentNodeIds: ['captains_quarters', 'bridge_corridor'],
    },
    {
      id: 'captains_quarters',
      label: "Captain's Quarters",
      type: 'room',
      roomId: 'top_captains_quarters',
      deckId: 'upper',
      token: 'CQ',
      adjacentNodeIds: ['bridge', 'bridge_corridor'],
    },
    {
      id: 'bridge_corridor',
      label: 'Bridge Corridor',
      type: 'room',
      roomId: 'top_corridor',
      deckId: 'upper',
      token: 'CORR',
      adjacentNodeIds: ['bridge', 'captains_quarters', 'elevator'],
    },
    {
      id: 'torpedo_room',
      label: 'Torpedo Room',
      type: 'combat',
      roomId: 'nose_torpedo_room',
      deckId: 'main',
      token: 'TORP',
      adjacentNodeIds: ['nose_turret', 'cargo_bay'],
    },
    {
      id: 'nose_turret',
      label: 'Nose Turret',
      type: 'weapon',
      roomId: 'nose_turret_entry',
      deckId: 'main',
      token: 'N-TRT',
      adjacentNodeIds: ['torpedo_room'],
    },
    {
      id: 'cargo_bay',
      label: 'Cargo Bay',
      type: 'logistics',
      roomId: 'cargo_bay',
      deckId: 'main',
      token: 'CARGO',
      adjacentNodeIds: ['torpedo_room', 'bottom_corridor', 'collar_port', 'collar_stbd', 'elevator'],
    },
    {
      id: 'collar_port',
      label: 'Port Docking Collar',
      type: 'logistics',
      roomId: 'cargo_docking_collar_left',
      deckId: 'main',
      token: 'P-DK',
      adjacentNodeIds: ['cargo_bay'],
    },
    {
      id: 'collar_stbd',
      label: 'Starboard Docking Collar',
      type: 'logistics',
      roomId: 'cargo_docking_collar_right',
      deckId: 'main',
      token: 'S-DK',
      adjacentNodeIds: ['cargo_bay'],
    },
    {
      id: 'bottom_corridor',
      label: 'Bottom Corridor',
      type: 'room',
      roomId: 'bottom_corridor',
      deckId: 'main',
      token: 'BCORR',
      adjacentNodeIds: ['cargo_bay', 'bottom_turret', 'elevator'],
    },
    {
      id: 'bottom_turret',
      label: 'Bottom Turret',
      type: 'weapon',
      roomId: 'bottom_turret_entry',
      deckId: 'main',
      token: 'B-TRT',
      adjacentNodeIds: ['bottom_corridor'],
    },
    {
      id: 'elevator',
      label: 'Elevator',
      type: 'transit',
      roomId: 'elevator',
      deckId: 'main',
      token: 'ELV',
      adjacentNodeIds: ['bridge_corridor', 'cargo_bay', 'bottom_corridor', 'habs_corridor'],
    },
    {
      id: 'habs_corridor',
      label: 'Hab Corridor',
      type: 'room',
      roomId: 'habs_corridor',
      deckId: 'lower',
      token: 'HCORR',
      adjacentNodeIds: ['elevator', 'crew_bunks', 'engineering', 'mess'],
    },
    {
      id: 'crew_bunks',
      label: 'Crew Bunks',
      type: 'room',
      roomId: 'habs_bunks',
      deckId: 'lower',
      token: 'BUNKS',
      adjacentNodeIds: ['habs_corridor'],
    },
    {
      id: 'engineering',
      label: 'Engineering',
      type: 'system',
      roomId: 'habs_engineering',
      deckId: 'lower',
      token: 'ENG',
      adjacentNodeIds: ['habs_corridor'],
    },
    {
      id: 'mess',
      label: 'Mess Hall',
      type: 'room',
      roomId: 'habs_mess',
      deckId: 'lower',
      token: 'MESS',
      adjacentNodeIds: ['habs_corridor'],
    },
  ],

  sources: {
    extractedXml: true,
    buildChangelist: 11621005,
    totalStaticEntities: 649,
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Derived helpers — safe to import in components
// ─────────────────────────────────────────────────────────────────────────────

export const perseusRoomMap = Object.fromEntries(
  perseusShipData.rooms.map(r => [r.id, r])
) as Record<string, ShipRoom>

export const perseusHardpointsByRoom = perseusShipData.hardpoints.reduce<
  Record<string, ShipHardpoint[]>
>((acc, hp) => {
  ;(acc[hp.roomId] ??= []).push(hp)
  return acc
}, {})

export const perseusHardpointsByKind = perseusShipData.hardpoints.reduce<
  Record<HardpointKind, ShipHardpoint[]>
>((acc, hp) => {
  ;(acc[hp.kind] ??= []).push(hp)
  return acc
}, {} as Record<HardpointKind, ShipHardpoint[]>)

export const perseusViewerNodeMap = Object.fromEntries(
  perseusShipData.viewerNodes.map(n => [n.id, n])
) as Record<string, ViewerNode>

export const perseusDeckRooms = perseusShipData.rooms.reduce<
  Record<DeckId, ShipRoom[]>
>((acc, room) => {
  ;(acc[room.deckId] ??= []).push(room)
  return acc
}, {} as Record<DeckId, ShipRoom[]>)
