import type {
  CarrierId,
  CarrierMode,
  CarrierPreset,
  CargoRoom,
  CommodityKey,
  ServiceShipId,
  ResourceLoad,
  CargoRoomPlan,
  CargoRoomFillSegment,
  ShipServiceProfile,
} from "./carrierLogisticsData";
import {
  CARRIER_PRESETS,
  CARRIER_CARGO_LAYOUTS,
  CRATE_SIZES,
  COMMODITY_LABELS,
  COMMODITY_ORDER,
} from "./carrierLogisticsData";

export function getCarrierPreset(id: CarrierId): CarrierPreset {
  return CARRIER_PRESETS.find((p) => p.id === id)!;
}

export function getCarrierCapacity(
  preset: CarrierPreset,
  mode: CarrierMode,
  manualOverride: number | null
): number {
  if (manualOverride !== null) return manualOverride;
  if (mode === "mainOnly" && preset.mainOnlyScu != null) return preset.mainOnlyScu;
  if (mode === "cargoRoomsOnly" && preset.cargoRoomOnlyScu != null) return preset.cargoRoomOnlyScu;
  return preset.capacityScu;
}

export function getActiveRooms(carrierId: CarrierId, mode: CarrierMode): CargoRoom[] {
  const layout = CARRIER_CARGO_LAYOUTS.find((l) => l.carrierId === carrierId);
  if (!layout) return [];

  return layout.rooms
    .filter((r) => {
      if (r.mode === "all") return true;
      if (r.mode === "mainOnly") return mode === "mainOnly" || mode === "all";
      if (r.mode === "secure") return mode === "all";
      if (r.mode === "cargoRoomsOnly") return mode === "cargoRoomsOnly" || mode === "all";
      if (r.mode === "hangar") return mode === "all";
      if (r.mode === "additionalStorage") return mode === "all";
      return true;
    })
    .sort((a, b) => a.fillOrder - b.fillOrder);
}

export function calculateCommodityTotals(
  shipStates: { profile: ShipServiceProfile; count: number; repairPercent: number }[]
): Record<CommodityKey, number> {
  const totals: Record<CommodityKey, number> = {
    ammoS2: 0, ammoS3: 0, ammoS4: 0, noise: 0, decoy: 0, rmc: 0,
  };
  for (const { profile, count, repairPercent } of shipStates) {
    const keys: Exclude<CommodityKey, "rmc">[] = ["ammoS2", "ammoS3", "ammoS4", "noise", "decoy"];
    for (const k of keys) totals[k] += profile.rearm[k] * count;
    totals.rmc += count * profile.repair.fullRepairRmcScu * (repairPercent / 100);
  }
  return totals;
}

export function splitIntoCrates(requiredScu: number, crateSizes: number[]): number[] {
  const crates: number[] = [];
  let remaining = requiredScu;
  for (const size of crateSizes) {
    while (remaining >= size) {
      crates.push(size);
      remaining -= size;
    }
  }
  return crates;
}

export function buildRecommendedLoadPlan(
  totals: Record<CommodityKey, number>,
  userLoads: Record<CommodityKey, number>
): ResourceLoad[] {
  return COMMODITY_ORDER.map((key) => {
    const exact = totals[key];
    const recommended = exact > 0 ? Math.ceil(exact) : 0;
    const userLoaded = userLoads[key] ?? 0;
    return {
      commodity: key,
      label: COMMODITY_LABELS[key],
      exactConsumedScu: exact,
      recommendedLoadedScu: recommended,
      userLoadedScu: userLoaded,
      reserveScu: userLoaded - exact,
    };
  });
}

export function getTotalUserLoadedScu(userLoads: Record<CommodityKey, number>): number {
  return Object.values(userLoads).reduce((s, v) => s + v, 0);
}

export function getRemainingCapacity(capacity: number, totalLoaded: number): number {
  return capacity - totalLoaded;
}

export function getOverloadedScu(capacity: number, totalLoaded: number): number {
  return Math.max(0, totalLoaded - capacity);
}

export function allocateUserLoadsToRooms(
  userLoads: Record<CommodityKey, number>,
  rooms: CargoRoom[]
): CargoRoomPlan[] {
  // Build an ordered list of (commodity, scu) chunks to fill
  type Chunk = { commodity: CommodityKey; label: string; remaining: number };
  const chunks: Chunk[] = [];
  for (const key of COMMODITY_ORDER) {
    const scu = userLoads[key] ?? 0;
    if (scu > 0) {
      chunks.push({ commodity: key, label: key, remaining: scu });
    }
  }

  let chunkIdx = 0;

  return rooms.map((room) => {
    const segments: CargoRoomFillSegment[] = [];
    let roomRemaining = room.scu;

    while (roomRemaining > 0 && chunkIdx < chunks.length) {
      const chunk = chunks[chunkIdx];
      const placed = Math.min(chunk.remaining, roomRemaining);
      segments.push({
        commodity: chunk.commodity,
        label: chunk.label,
        scu: placed,
        percentOfRoom: (placed / room.scu) * 100,
      });
      chunk.remaining -= placed;
      roomRemaining -= placed;
      if (chunk.remaining <= 0) chunkIdx++;
    }

    const usedScu = room.scu - roomRemaining;
    return {
      roomId: room.id,
      roomLabel: room.label,
      capacityScu: room.scu,
      usedScu,
      remainingScu: roomRemaining,
      fillPercent: (usedScu / room.scu) * 100,
      segments,
    };
  });
}

export function buildCrateList(userLoads: Record<CommodityKey, number>): Record<CommodityKey, number[]> {
  const result = {} as Record<CommodityKey, number[]>;
  for (const key of COMMODITY_ORDER) {
    const scu = userLoads[key] ?? 0;
    result[key] = scu > 0 ? splitIntoCrates(scu, CRATE_SIZES) : [];
  }
  return result;
}

export type ShipServiceCapability = {
  shipId: ServiceShipId;
  label: string;
  ammoReloads: number;
  noiseReloads: number;
  decoyReloads: number;
  repairs: number;
  fullRearms: number;
  fullServices: number;
};

function floorDiv(loaded: number, req: number): number {
  if (req <= 0) return 0;
  return Math.floor(loaded / req);
}

export function calculateServiceCapability(
  profiles: ShipServiceProfile[],
  userLoads: Record<CommodityKey, number>
): ShipServiceCapability[] {
  return profiles.map((profile) => {
    // Ammo: min across non-zero ammo requirements only
    const ammoKeys: Exclude<CommodityKey, "rmc" | "noise" | "decoy">[] = ["ammoS2", "ammoS3", "ammoS4"];
    const ammoLimits = ammoKeys
      .filter((k) => profile.rearm[k] > 0)
      .map((k) => (userLoads[k] ?? 0) / profile.rearm[k]);
    const ammoReloads = ammoLimits.length > 0 ? Math.floor(Math.min(...ammoLimits)) : 0;

    // Noise and Decoy individually
    const noiseReloads = floorDiv(userLoads.noise ?? 0, profile.rearm.noise);
    const decoyReloads = floorDiv(userLoads.decoy ?? 0, profile.rearm.decoy);

    // Repairs via RMC
    const repairs = floorDiv(userLoads.rmc ?? 0, profile.repair.fullRepairRmcScu);

    // Full Rearm: all rearm categories that ship needs must be non-zero
    // Collect limits only for categories the ship actually requires
    const rearmLimits: number[] = [];
    if (ammoLimits.length > 0) rearmLimits.push(...ammoLimits);
    if (profile.rearm.noise > 0) rearmLimits.push((userLoads.noise ?? 0) / profile.rearm.noise);
    if (profile.rearm.decoy > 0) rearmLimits.push((userLoads.decoy ?? 0) / profile.rearm.decoy);
    const fullRearms = rearmLimits.length > 0 ? Math.floor(Math.min(...rearmLimits)) : 0;

    // Full Service: rearm + repair
    const serviceLimits = [...rearmLimits];
    if (profile.repair.fullRepairRmcScu > 0) {
      serviceLimits.push((userLoads.rmc ?? 0) / profile.repair.fullRepairRmcScu);
    }
    const fullServices = serviceLimits.length > 0 ? Math.floor(Math.min(...serviceLimits)) : 0;

    return {
      shipId: profile.id as ServiceShipId,
      label: profile.label,
      ammoReloads,
      noiseReloads,
      decoyReloads,
      repairs,
      fullRearms,
      fullServices,
    };
  });
}
