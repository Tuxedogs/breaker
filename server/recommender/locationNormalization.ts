const ROMAN_PLANET_ALIASES: Record<string, string> = {
  i: "1",
  ii: "2",
  iii: "3",
  iv: "4",
  v: "5",
  vi: "6",
};

const CANONICAL_LOCATION_ALIASES: Record<string, Record<string, string>> = {
  pyro: {
    pyrodeepspaceasteroids: "Pyro Deep Space Asteroids",
    deepspaceasteroids: "Pyro Deep Space Asteroids",
    pyrodeepspace: "Pyro Deep Space Asteroids",
    deepspace: "Pyro Deep Space Asteroids",
    pyro5: "Pyro V",
    pyro5a: "Pyro V-a (Ignis)",
    ignis: "Pyro V-a (Ignis)",
    pyro5b: "Pyro V-b (Vatra)",
    vatra: "Pyro V-b (Vatra)",
    pyro5c: "Pyro V-c (Adir)",
    adir: "Pyro V-c (Adir)",
    pyro5d: "Pyro V-d (Fairo)",
    fairo: "Pyro V-d (Fairo)",
    pyro5e: "Pyro V-e (Fuego)",
    fuego: "Pyro V-e (Fuego)",
    pyro5f: "Pyro V-f (Vuur)",
    vuur: "Pyro V-f (Vuur)",
    pyro6: "Terminus Ring",
    terminus: "Terminus Ring",
    terminusring: "Terminus Ring",
  },
  stanton: {
    stanton1: "Hurston",
    hurston: "Hurston",
    stanton2: "Crusader",
    crusader: "Crusader",
    stanton3: "ArcCorp",
    arccorp: "ArcCorp",
    stanton4: "microTech",
    microtech: "microTech",
    stanton3a: "Lyria",
    lyria: "Lyria",
    stanton3b: "Wala",
    wala: "Wala",
  },
  lagrange: {
    lagrangea: "Lagrange A",
    hurl1: "Lagrange A",
    hurl4: "Lagrange A",
    lagrangeb: "Lagrange B",
    arcl5: "Lagrange B",
    crul4: "Lagrange B",
    micl3: "Lagrange B",
    lagrangec: "Lagrange C",
    hurl5: "Lagrange C",
    micl1: "Lagrange C",
    micl2: "Lagrange C",
    micl5: "Lagrange C",
    crul3: "Lagrange C",
    lagranged: "Lagrange D",
    arcl3: "Lagrange D",
    crul5: "Lagrange D",
    micl4: "Lagrange D",
    lagrangee: "Lagrange E",
    crul1: "Lagrange E",
    crul2: "Lagrange E",
    hurl3: "Lagrange E",
    lagrangef: "Lagrange F",
    hurl2: "Lagrange F",
    arcl1: "Lagrange F",
    arcl2: "Lagrange F",
    arcl4: "Lagrange F",
  },
};

function comparisonKey(system: string, name: string): string {
  let normalized = name.trim().toLowerCase();
  const normalizedSystem = system.trim().toLowerCase();

  normalized = normalized.replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  if (normalizedSystem && normalized.endsWith(normalizedSystem)) {
    normalized = normalized.slice(0, -normalizedSystem.length).trim();
  }

  normalized = normalized.replace(/^pyro\s+([ivx]+)(?:\s+([a-f]))?$/i, (_, roman: string, moon?: string) =>
    `pyro ${ROMAN_PLANET_ALIASES[roman.toLowerCase()] ?? roman}${moon ? moon.toLowerCase() : ""}`
  );
  normalized = normalized.replace(/^pyro\s+(\d)\s+([a-f])$/, "pyro $1$2");
  normalized = normalized.replace(/^stanton\s+(\d)\s+([ab])$/, "stanton $1$2");

  return normalized.replace(/\s+/g, "");
}

function normalizeSystemKey(system: string): string {
  const key = system.trim().toLowerCase();
  if (key === "pyro") return "pyro";
  if (key === "stanton") return "stanton";
  if (key === "lagrange") return "lagrange";
  return key;
}

export function normalizeMiningLocationName(system: string, name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;

  const key = comparisonKey(system, trimmed);
  const systemKey = normalizeSystemKey(system);
  const direct = CANONICAL_LOCATION_ALIASES[systemKey]?.[key];
  if (direct) return direct;

  const lagrange = CANONICAL_LOCATION_ALIASES.lagrange[key];
  if (lagrange) return lagrange;

  return trimmed;
}

export function normalizedMiningSystemName(system: string): string {
  return system.trim();
}

export function miningLocationMergeKey(systemName: string, locationName: string): string {
  return `${normalizedMiningSystemName(systemName).toLowerCase()}|${locationName}`;
}

const ACTIVE_PYRO_LOCATION_NAMES = new Set([
  "Pyro Deep Space Asteroids",
  "Terminus Ring",
  "Pyro V-a (Ignis)",
  "Pyro V-b (Vatra)",
  "Pyro V-c (Adir)",
  "Pyro V-d (Fairo)",
  "Pyro V-e (Fuego)",
  "Pyro V-f (Vuur)",
]);

const ACTIVE_STANTON_LAGRANGE_LOCATION_NAMES = new Set([
  "Lagrange A",
  "Lagrange B",
  "Lagrange C",
  "Lagrange D",
  "Lagrange E",
  "Lagrange F",
]);

const PYRO_LOCATION_MATERIALS: Record<string, Set<string>> = {
  "Pyro Deep Space Asteroids": new Set([
    "aluminum",
    "corundum",
    "quartz",
    "riccite",
    "stileron",
    "tin",
    "torite",
  ]),
  "Terminus Ring": new Set([
    "copper",
    "iron",
    "ouratite",
    "pressurized ice",
    "titanium",
  ]),
};

export function isActivePyroMiningLocation(systemName: string, locationName: string): boolean {
  return normalizeSystemKey(systemName) !== "pyro" ||
    ACTIVE_PYRO_LOCATION_NAMES.has(normalizeMiningLocationName(systemName, locationName));
}

export function isActiveStantonLagrangeMiningLocation(systemName: string, locationName: string): boolean {
  if (normalizeSystemKey(systemName) !== "stanton") return true;
  const normalizedName = normalizeMiningLocationName(systemName, locationName);
  return !normalizedName.toLowerCase().startsWith("lagrange ") ||
    ACTIVE_STANTON_LAGRANGE_LOCATION_NAMES.has(normalizedName);
}

export function isMaterialActiveAtPyroLocation(
  systemName: string,
  locationName: string,
  materialName: string | undefined,
): boolean {
  if (normalizeSystemKey(systemName) !== "pyro") return true;
  const allowedMaterials = PYRO_LOCATION_MATERIALS[normalizeMiningLocationName(systemName, locationName)];
  if (!allowedMaterials) return true;
  return allowedMaterials.has((materialName ?? "").trim().toLowerCase());
}
