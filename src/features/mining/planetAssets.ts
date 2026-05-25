const BASE = "/assets/planetsandmoons";

interface PlanetAssetEntry {
  id: string;
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
  return s.toLowerCase().replace(/[\s'\-_.]/g, "");
}

let assetMap: Map<string, PlanetAsset> | null = null;
let loadPromise: Promise<Map<string, PlanetAsset>> | null = null;

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
        map.set(normalize(e.id), asset);
        map.set(normalize(e.id.replace(/-/g, "")), asset);
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

export function usePlanetAssets(): Map<string, PlanetAsset> | null {
  return assetMap;
}

export function getPlanetAsset(map: Map<string, PlanetAsset> | null, name: string): PlanetAsset | null {
  if (!map) return null;
  return map.get(normalize(name)) ?? null;
}

export { loadManifest };
