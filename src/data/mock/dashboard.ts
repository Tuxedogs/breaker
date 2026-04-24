// Mock data for the dashboard shell (Phase 3).
// Replace with real API calls in Phase 5 — all types match the planned data models.

export const mockStats = {
  totalMaterials: { count: 11, label: "Unique Materials" },
  totalOwned: { value: 28.73, unit: "SCU", label: "Across All Locations" },
  totalNeeded: { value: 49.84, unit: "SCU", label: "For Selected Builds" },
  shortage: { value: 21.11, unit: "SCU", label: "Still Required" },
  buildQueue: { count: 5, label: "Items Queued" },
} as const;

export const mockInventory = {
  owned: 28.73,
  needed: 49.84,
  shortage: 21.11,
} as const;

export type MaterialRow = {
  id: string;
  name: string;
  owned: string;
  needed: string;
  shortage: string;
};

export const mockMaterialShortages: MaterialRow[] = [
  { id: "stileron", name: "Stileron", owned: "6.10 SCU", needed: "9.37 SCU", shortage: "3.27 SCU" },
  { id: "borase", name: "Borase", owned: "2.00 SCU", needed: "9.72 SCU", shortage: "7.72 SCU" },
  { id: "feynmaline", name: "Feynmaline", owned: "85x", needed: "248x", shortage: "163x" },
  { id: "tungsten", name: "Tungsten", owned: "1.50 SCU", needed: "2.50 SCU", shortage: "1.00 SCU" },
  { id: "savrilium", name: "Savrilium", owned: "0.86 SCU", needed: "1.39 SCU", shortage: "0.53 SCU" },
];

export type BuildQueueItem = {
  id: number;
  name: string;
  qty: number;
  progress: number; // 0–100; -1 = queued (not started)
  accentColor: string;
};

export const mockBuildQueue: BuildQueueItem[] = [
  { id: 1, name: "Avalanche Cooler", qty: 1, progress: 45, accentColor: "#a78bfa" },
  { id: 2, name: "TS-2 Quantum Drive", qty: 1, progress: 20, accentColor: "#38bdf8" },
  { id: 3, name: "VK-00 Quantum Drive", qty: 1, progress: 0, accentColor: "#6b7280" },
  { id: 4, name: "SnowBlind Cooler", qty: 1, progress: -1, accentColor: "#3d7ad6" },
  { id: 5, name: "Arbor Mining Laser", qty: 1, progress: -1, accentColor: "#f59e0b" },
];

export type LocationEntry = {
  id: string;
  name: string;
  scu: number;
  type: "station" | "city" | "outpost";
};

export const mockLocations: LocationEntry[] = [
  { id: "everus-harbor", name: "Everus Harbor", scu: 10.40, type: "station" },
  { id: "orison", name: "Orison", scu: 7.10, type: "city" },
  { id: "area18", name: "Area18", scu: 6.23, type: "city" },
  { id: "seraphim-station", name: "Seraphim Station", scu: 3.00, type: "station" },
];

export type UpdateEntry = {
  id: number;
  title: string;
  description: string;
  date: string;
  accentColor: string;
};

export const mockUpdates: UpdateEntry[] = [
  {
    id: 1,
    title: "Alpha 3.23.1 PTU",
    description: "Component balance and ship adjustments.",
    date: "May 23, 2025",
    accentColor: "#a78bfa",
  },
  {
    id: 2,
    title: "Economy Update",
    description: "Refinery prices and material values refreshed.",
    date: "May 22, 2025",
    accentColor: "#38bdf8",
  },
  {
    id: 3,
    title: "New Ship: Starlancer TAC",
    description: "Component and hardpoint data available.",
    date: "May 20, 2025",
    accentColor: "#f59e0b",
  },
];

export const mockSystemStatus = {
  overall: "All Systems Operational",
  dataUpdated: "2 min ago",
  apiStatus: "Operational",
  buildEngine: "Operational",
  database: "Operational",
} as const;

export type QuickAccessItem = {
  label: string;
  icon: string;
  to: string;
};

export const quickAccessItems: QuickAccessItem[] = [
  { label: "Inventory Overview", icon: "inventory", to: "/dashboard" },
  { label: "TS-2 Materials", icon: "materials", to: "/dashboard" },
  { label: "Mining Routes", icon: "mining", to: "/dashboard" },
  { label: "Perseus Loadout", icon: "ship", to: "/maps" },
  { label: "Build Queue", icon: "build", to: "/dashboard" },
  { label: "Favorite Ships", icon: "star", to: "/dashboard" },
];

export const popularToolItems: QuickAccessItem[] = [
  { label: "Weapons Matrix", icon: "weapons", to: "/tools/alpha-threshold" },
  { label: "Armor Threshold", icon: "armor", to: "/tools/alpha-threshold" },
  { label: "Ship Compare", icon: "compare", to: "/dashboard" },
  { label: "Mining Planner", icon: "mining", to: "/dashboard" },
  { label: "Refinery Calculator", icon: "refinery", to: "/dashboard" },
  { label: "Price Tracker", icon: "price", to: "/dashboard" },
];
