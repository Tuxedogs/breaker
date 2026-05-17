export type CarrierId = "ironclad" | "polaris" | "idrisP";
export type CarrierMode = "mainOnly" | "all" | "cargoRoomsOnly";
export type ServiceShipId = "gladius" | "hornet" | "f8c";
export type CommodityKey = "ammoS2" | "ammoS3" | "ammoS4" | "noise" | "decoy" | "rmc";

export type CargoRoom = {
  id: string;
  label: string;
  scu: number;
  fillOrder: number;
  mode: "all" | "mainOnly" | "secure" | "cargoRoomsOnly" | "hangar" | "additionalStorage";
};

export type CarrierCargoLayout = {
  carrierId: CarrierId;
  rooms: CargoRoom[];
};

export type CarrierPreset = {
  id: CarrierId;
  label: string;
  capacityScu: number;
  mainOnlyScu?: number;
  cargoRoomOnlyScu?: number;
};

export type ShipServiceProfile = {
  id: ServiceShipId;
  label: string;
  rearm: Record<Exclude<CommodityKey, "rmc">, number>;
  repair: {
    hullHp: number;
    fullRepairRmcScu: number;
  };
};

export type ShipServiceState = {
  count: number;
  repairPercent: number;
};

export type ResourceLoad = {
  commodity: CommodityKey;
  label: string;
  exactConsumedScu: number;
  recommendedLoadedScu: number;
  userLoadedScu: number;
  reserveScu: number;
};

export type CargoRoomFillSegment = {
  commodity: CommodityKey;
  label: string;
  scu: number;
  percentOfRoom: number;
};

export type CargoRoomPlan = {
  roomId: string;
  roomLabel: string;
  capacityScu: number;
  usedScu: number;
  remainingScu: number;
  fillPercent: number;
  segments: CargoRoomFillSegment[];
};

export const CARRIER_PRESETS: CarrierPreset[] = [
  {
    id: "ironclad",
    label: "Drake Ironclad",
    capacityScu: 2200,
    mainOnlyScu: 2160,
  },
  {
    id: "polaris",
    label: "RSI Polaris",
    capacityScu: 576,
  },
  {
    id: "idrisP",
    label: "AEGS Idris-P",
    capacityScu: 1374,
    cargoRoomOnlyScu: 302,
  },
];

export const SHIP_PROFILES: ShipServiceProfile[] = [
  {
    id: "gladius",
    label: "Gladius",
    rearm: {
      ammoS2: 0,
      ammoS3: 0.228642,
      ammoS4: 0,
      noise: 0.002515,
      decoy: 0.024144,
    },
    repair: {
      hullHp: 2134,
      fullRepairRmcScu: 0.9484444444,
    },
  },
  {
    id: "hornet",
    label: "Hornet F7C Mk2",
    rearm: {
      ammoS2: 0,
      ammoS3: 0,
      ammoS4: 1.00284,
      noise: 0.00503,
      decoy: 0.048288,
    },
    repair: {
      hullHp: 3557.75,
      fullRepairRmcScu: 1.5812222222,
    },
  },
  {
    id: "f8c",
    label: "F8C Lightning",
    rearm: {
      ammoS2: 0.328962,
      ammoS3: 0.88128,
      ammoS4: 0,
      noise: 0.002515,
      decoy: 0.024144,
    },
    repair: {
      hullHp: 10665,
      fullRepairRmcScu: 4.74,
    },
  },
];

export const COMMODITY_LABELS: Record<CommodityKey, string> = {
  ammoS2: "S2 Ammo",
  ammoS3: "S3 Ammo",
  ammoS4: "S4 Ammo",
  noise: "Noise / Chaff",
  decoy: "Decoy / Flare",
  rmc: "RMC / Repair",
};

export const COMMODITY_SHORT_LABELS: Record<CommodityKey, string> = {
  ammoS2: "S2",
  ammoS3: "S3",
  ammoS4: "S4",
  noise: "Noise",
  decoy: "Decoy",
  rmc: "RMC",
};

export const COMMODITY_ORDER: CommodityKey[] = [
  "ammoS2",
  "ammoS3",
  "ammoS4",
  "noise",
  "decoy",
  "rmc",
];

export const CRATE_SIZES = [32, 24, 16, 8, 4, 2, 1];

export const CARRIER_CARGO_LAYOUTS: CarrierCargoLayout[] = [
  {
    carrierId: "ironclad",
    rooms: [
      { id: "ironclad-fl",  label: "Front Left Hold",       scu: 720, fillOrder: 1, mode: "mainOnly" },
      { id: "ironclad-fr",  label: "Front Right Hold",      scu: 720, fillOrder: 2, mode: "mainOnly" },
      { id: "ironclad-rl",  label: "Rear Left Hold",        scu: 360, fillOrder: 3, mode: "mainOnly" },
      { id: "ironclad-rr",  label: "Rear Right Hold",       scu: 360, fillOrder: 4, mode: "mainOnly" },
      { id: "ironclad-sfl", label: "Secure Front Left",     scu: 8,   fillOrder: 5, mode: "secure" },
      { id: "ironclad-sfm", label: "Secure Front Middle",   scu: 8,   fillOrder: 6, mode: "secure" },
      { id: "ironclad-sfr", label: "Secure Front Right",    scu: 8,   fillOrder: 7, mode: "secure" },
      { id: "ironclad-srl", label: "Secure Rear Left",      scu: 8,   fillOrder: 8, mode: "secure" },
      { id: "ironclad-srr", label: "Secure Rear Right",     scu: 8,   fillOrder: 9, mode: "secure" },
    ],
  },
  {
    carrierId: "polaris",
    rooms: [
      { id: "polaris-left",  label: "Left Cargo Grid",  scu: 288, fillOrder: 1, mode: "all" },
      { id: "polaris-right", label: "Right Cargo Grid", scu: 288, fillOrder: 2, mode: "all" },
    ],
  },
  {
    carrierId: "idrisP",
    rooms: [
      { id: "idris-hangar",     label: "Hangar Cargo Grids",        scu: 1024, fillOrder: 1,  mode: "hangar" },
      { id: "idris-front-med",  label: "Cargo Room Front Medium",   scu: 10,   fillOrder: 2,  mode: "cargoRoomsOnly" },
      { id: "idris-front-s1",   label: "Cargo Room Front Small 1",  scu: 4,    fillOrder: 3,  mode: "cargoRoomsOnly" },
      { id: "idris-front-s2",   label: "Cargo Room Front Small 2",  scu: 4,    fillOrder: 4,  mode: "cargoRoomsOnly" },
      { id: "idris-front",      label: "Cargo Room Front",          scu: 140,  fillOrder: 5,  mode: "cargoRoomsOnly" },
      { id: "idris-back",       label: "Cargo Room Back",           scu: 144,  fillOrder: 6,  mode: "cargoRoomsOnly" },
      { id: "idris-add-fl",     label: "Additional Storage Front Left",  scu: 12, fillOrder: 7,  mode: "additionalStorage" },
      { id: "idris-add-fr",     label: "Additional Storage Front Right", scu: 12, fillOrder: 8,  mode: "additionalStorage" },
      { id: "idris-add-rl",     label: "Additional Storage Rear Left",   scu: 12, fillOrder: 9,  mode: "additionalStorage" },
      { id: "idris-add-rr",     label: "Additional Storage Rear Right",  scu: 12, fillOrder: 10, mode: "additionalStorage" },
    ],
  },
];
