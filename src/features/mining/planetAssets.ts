const BASE = "/assets/planetsandmoons";

interface PlanetAssetEntry {
  id: string;
  label: string;
  thumbnail: string;
  thumbnail2x: string;
  main: string;
  main2x: string;
}

export interface PlanetAsset {
  thumbnail: string;
  thumbnail2x: string;
  main: string;
  main2x: string;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[\s'\-_.()]/g, "");
}

const LOCATION_ASSET_ALIASES: Record<string, string> = {
  aaronhalo: "aaronhalo",
  keeger: "keegerbelt",
  keegerbelt: "keegerbelt",
  nyxkeegerbelt: "keegerbelt",
  pyroi: "pyro1",
  pyrovbvatra: "vatra",
  pyrovcaadir: "adir",
  pyrovdfairo: "fairo",
  pyrovefuego: "fuego",
  pyroviaterminus: "terminus",
  pyroiimonox: "monox",
  pyroiiimonox: "monox",
  pyroiiibloom: "bloom",
  pyroiv: "pyroiv",
};

function registerAssetKey(map: Map<string, PlanetAsset>, key: string, asset: PlanetAsset) {
  const normalized = normalize(key);
  if (!normalized) return;
  map.set(normalized, asset);
}

async function loadManifest(): Promise<Map<string, PlanetAsset>> {
  if (assetMap) return assetMap;
  if (loadPromise) return loadPromise;
  loadPromise = fetch(`${BASE}/manifest.json`)
    .then((r) => r.json() as Promise<PlanetAssetEntry[]>)
    .then((entries) => {
      const map = new Map<string, PlanetAsset>();
      for (const e of entries) {
        const asset: PlanetAsset = {
          thumbnail: `${BASE}/${e.thumbnail}`,
          thumbnail2x: `${BASE}/${e.thumbnail2x}`,
          main: `${BASE}/${e.main}`,
          main2x: `${BASE}/${e.main2x}`,
        };
        registerAssetKey(map, e.id, asset);
        registerAssetKey(map, e.id.replace(/-/g, ""), asset);
        registerAssetKey(map, e.label, asset);
      }

      for (const [alias, targetId] of Object.entries(LOCATION_ASSET_ALIASES)) {
        const asset = map.get(targetId);
        if (asset) map.set(alias, asset);
      }

      assetMap = map;
      return map;
    })
    .catch(() => {
      assetMap = new Map();
      return assetMap;
    });
  return loadPromise;
}

let assetMap: Map<string, PlanetAsset> | null = null;
let loadPromise: Promise<Map<string, PlanetAsset>> | null = null;

export function usePlanetAssets(): Map<string, PlanetAsset> | null {
  return assetMap;
}

export function getPlanetAsset(map: Map<string, PlanetAsset> | null, name: string): PlanetAsset | null {
  if (!map || !name.trim()) return null;

  const direct = map.get(normalize(name));
  if (direct) return direct;

  const parenMatch = name.match(/\(([^)]+)\)\s*$/);
  if (parenMatch) {
    const fromParen = map.get(normalize(parenMatch[1]));
    if (fromParen) return fromParen;
  }

  return null;
}

export { loadManifest };
