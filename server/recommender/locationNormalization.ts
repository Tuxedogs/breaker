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
    pyroakirocluster: "Akiro Cluster",
    akirocluster: "Akiro Cluster",
    akiro: "Akiro Cluster",
    pyro1: "Pyro I",
    pyroi: "Pyro I",
    pyro2: "Monox",
    pyroii: "Monox",
    monox: "Monox",
    pyroiimonox: "Monox",
    pyro3: "Bloom",
    pyroiii: "Bloom",
    bloom: "Bloom",
    pyroiiibloom: "Bloom",
    pyroiiimonox: "Monox",
    pyro4: "Pyro IV",
    pyroiv: "Pyro IV",
    pyro5: "Pyro V",
    pyro5a: "Pyro V-a (Ignis)",
    pyrovaignis: "Pyro V-a (Ignis)",
    ignis: "Pyro V-a (Ignis)",
    pyro5b: "Pyro V-b (Vatra)",
    pyrovbvatra: "Pyro V-b (Vatra)",
    vatra: "Pyro V-b (Vatra)",
    pyro5c: "Pyro V-c (Adir)",
    pyrovcadir: "Pyro V-c (Adir)",
    adir: "Pyro V-c (Adir)",
    pyro5d: "Pyro V-d (Fairo)",
    pyrovdfairo: "Pyro V-d (Fairo)",
    fairo: "Pyro V-d (Fairo)",
    pyro5e: "Pyro V-e (Fuego)",
    pyrovefuego: "Pyro V-e (Fuego)",
    fuego: "Pyro V-e (Fuego)",
    pyro5f: "Pyro V-f (Vuur)",
    pyrovfvuur: "Pyro V-f (Vuur)",
    vuur: "Pyro V-f (Vuur)",
    pyro6: "Pyro VI (Terminus)",
    terminus: "Pyro VI (Terminus)",
    terminusvi: "Pyro VI (Terminus)",
    pyroviterminus: "Pyro VI (Terminus)",
    terminusring: "Terminus Ring",
    pyrocool01: "Pyro Cool01",
    cool01: "Pyro Cool01",
    pyrocool02: "Pyro Cool02",
    cool02: "Pyro Cool02",
    pyrowarm01: "Pyro Warm01",
    warm01: "Pyro Warm01",
    pyrowarm02: "Pyro Warm02",
    warm02: "Pyro Warm02",
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
    hurl3: "Lagrange A",
    lagrangeb: "Lagrange B",
    crul1: "Lagrange B",
    crul2: "Lagrange B",
    lagrangec: "Lagrange C",
    crul5: "Lagrange C",
    lagranged: "Lagrange D",
    arcl5: "Lagrange D",
    lagrangee: "Lagrange E",
    crul3: "Lagrange E",
    micl1: "Lagrange E",
    micl2: "Lagrange E",
    micl5: "Lagrange E",
    lagrangef: "Lagrange F",
    crul4: "Lagrange F",
    lagrangeg: "Lagrange G",
    arcl1: "Lagrange G",
    arcl2: "Lagrange G",
    hurl2: "Lagrange G",
    lagrangeh: "Lagrange H",
    hurl1: "Lagrange H",
    hurl4: "Lagrange H",
    hurl5: "Lagrange H",
    lagrangei: "Lagrange I",
    micl4: "Lagrange I",
    lagrangej: "Lagrange J",
    arcl3: "Lagrange J",
    lagrangek: "Lagrange K",
    arcl4: "Lagrange K",
    lagrangel: "Lagrange L",
    micl3: "Lagrange L",
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

  if (systemKey === "pyro" && /^pyro(?:rab|rmb)/.test(key)) {
    return "Pyro Deep Space Asteroids";
  }

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

const ACTIVE_STANTON_LAGRANGE_LOCATION_NAMES = new Set([
  "Lagrange A",
  "Lagrange B",
  "Lagrange C",
  "Lagrange D",
  "Lagrange E",
  "Lagrange F",
  "Lagrange G",
  "Lagrange H",
  "Lagrange I",
  "Lagrange J",
  "Lagrange K",
  "Lagrange L",
]);

const EXCLUDED_PYRO_LOCATION_NAMES = new Set([
  "Pyro Cool01",
  "Pyro Cool02",
  "Pyro Warm01",
  "Pyro Warm02",
]);

export function isActivePyroMiningLocation(systemName: string, locationName: string): boolean {
  if (normalizeSystemKey(systemName) !== "pyro") return true;
  const normalizedName = normalizeMiningLocationName(systemName, locationName);
  return normalizedName.trim().length > 0 && !EXCLUDED_PYRO_LOCATION_NAMES.has(normalizedName);
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
  void systemName;
  void locationName;
  void materialName;
  return true;
}
