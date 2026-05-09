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
    pyro1: "Pyro I",
    pyro2: "Pyro II",
    pyro3: "Pyro III",
    pyro4: "Pyro IV",
    pyro5: "Pyro V",
    pyro5a: "Pyro V-a (Ignis)",
    ignis: "Pyro V-a (Ignis)",
    pyro5b: "Pyro V-b (Vatra)",
    vatra: "Pyro V-b (Vatra)",
    pyro5d: "Pyro V-d (Fairo)",
    fairo: "Pyro V-d (Fairo)",
    pyro6: "Pyro VI (Terminus)",
    terminus: "Pyro VI (Terminus)",
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
    lagrangeb: "Lagrange B",
    arcl5: "Lagrange B",
    crul4: "Lagrange B",
    micl3: "Lagrange B",
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

  normalized = normalized.replace(/^pyro\s+([ivx]+)(?:\s+([abd]))?$/i, (_, roman: string, moon?: string) =>
    `pyro ${ROMAN_PLANET_ALIASES[roman.toLowerCase()] ?? roman}${moon ? moon.toLowerCase() : ""}`
  );
  normalized = normalized.replace(/^pyro\s+(\d)\s+([abd])$/, "pyro $1$2");
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
