import type { InventoryLocation } from "../../types/logistics";

/**
 * Canonical inventory storage locations shipped with the app.
 * Always available in production builds — not derived from user inventory rows.
 */
export const canonicalInventoryLocations: InventoryLocation[] = [
  // Stanton refinery locations
  { id: "arc-l1", name: "ARC-L1", category: "refinery", system: "Stanton", type: "station" },
  { id: "arc-l2", name: "ARC-L2", category: "refinery", system: "Stanton", type: "station" },
  { id: "arc-l4", name: "ARC-L4", category: "refinery", system: "Stanton", type: "station" },
  { id: "cru-l1", name: "CRU-L1", category: "refinery", system: "Stanton", type: "station" },
  { id: "hur-l1", name: "HUR-L1", category: "refinery", system: "Stanton", type: "station" },
  { id: "hur-l2", name: "HUR-L2", category: "refinery", system: "Stanton", type: "station" },
  { id: "mic-l1", name: "MIC-L1", category: "refinery", system: "Stanton", type: "station" },
  { id: "mic-l2", name: "MIC-L2", category: "refinery", system: "Stanton", type: "station" },
  { id: "mic-l5", name: "MIC-L5", category: "refinery", system: "Stanton", type: "station" },
  { id: "nyx-gateway-stanton", name: "Nyx Gateway (Stanton)", category: "station", system: "Stanton", type: "station" },
  { id: "pyro-gateway-stanton", name: "Pyro Gateway (Stanton)", category: "station", system: "Stanton", type: "station" },
  { id: "terra-gateway-stanton", name: "Terra Gateway (Stanton)", category: "station", system: "Stanton", type: "station" },

  // Pyro refinery locations
  { id: "checkmate", name: "Checkmate", category: "refinery", system: "Pyro", type: "station" },
  { id: "orbituary", name: "Orbituary", category: "refinery", system: "Pyro", type: "station" },
  { id: "ruin-station", name: "Ruin Station", category: "refinery", system: "Pyro", type: "station" },
  { id: "nyx-gateway-pyro", name: "Nyx Gateway (Pyro)", category: "station", system: "Pyro", type: "station" },
  { id: "stanton-gateway-pyro", name: "Stanton Gateway (Pyro)", category: "station", system: "Pyro", type: "station" },

  // Nyx refinery locations
  { id: "levski", name: "Levski", category: "city", system: "Nyx", type: "city" },
  { id: "pyro-gateway-nyx", name: "Pyro Gateway (Nyx)", category: "station", system: "Nyx", type: "station" },
  { id: "stanton-gateway-nyx", name: "Stanton Gateway (Nyx)", category: "station", system: "Nyx", type: "station" },

  // Major non-refinery inventory hubs
  { id: "area18", name: "Area18", category: "city", system: "Stanton", type: "city" },
  { id: "orison", name: "Orison", category: "city", system: "Stanton", type: "city" },
  { id: "lorville", name: "Lorville", category: "city", system: "Stanton", type: "city" },
  { id: "new-babbage", name: "New Babbage", category: "city", system: "Stanton", type: "city" },
  { id: "everus-harbor", name: "Everus Harbor", category: "station", system: "Stanton", type: "station" },
  { id: "baijini-point", name: "Baijini Point", category: "station", system: "Stanton", type: "station" },
  { id: "port-tressler", name: "Port Tressler", category: "station", system: "Stanton", type: "station" },
  { id: "seraphim-station", name: "Seraphim Station", category: "station", system: "Stanton", type: "station" },
];

/** Normalized alias input -> canonical location id */
export const inventoryLocationAliasIds: Record<string, string> = {
  levksi: "levski",
};
