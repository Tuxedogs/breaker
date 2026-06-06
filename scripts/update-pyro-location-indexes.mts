import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type IndexRow = Record<string, any>;

const base = path.resolve("public/api/recommendations");

const activePyroLocations = new Map<string, string>([
  ["Pyro Deepspaceasteroids", "Pyro Deep Space Asteroids"],
  ["Pyro Deep Space Asteroids", "Pyro Deep Space Asteroids"],
  ["Pyro5a", "Pyro V-a (Ignis)"],
  ["Pyro V-a (Ignis)", "Pyro V-a (Ignis)"],
  ["Pyro5b", "Pyro V-b (Vatra)"],
  ["Pyro V-b (Vatra)", "Pyro V-b (Vatra)"],
  ["Pyro5c", "Pyro V-c (Adir)"],
  ["Pyro V-c (Adir)", "Pyro V-c (Adir)"],
  ["Pyro5d", "Pyro V-d (Fairo)"],
  ["Pyro V-d (Fairo)", "Pyro V-d (Fairo)"],
  ["Pyro5e", "Pyro V-e (Fuego)"],
  ["Pyro V-e (Fuego)", "Pyro V-e (Fuego)"],
  ["Pyro5f", "Pyro V-f (Vuur)"],
  ["Pyro V-f (Vuur)", "Pyro V-f (Vuur)"],
  ["Pyro6", "Pyro VI (Terminus)"],
  ["Terminus", "Pyro VI (Terminus)"],
  ["Pyro VI (Terminus)", "Pyro VI (Terminus)"],
  ["Terminus Ring", "Terminus Ring"],
]);

const limitedMaterials: Record<string, Set<string>> = {
  "Pyro Deep Space Asteroids": new Set([
    "Aluminum",
    "Corundum",
    "Quartz",
    "Riccite",
    "Stileron",
    "Tin",
    "Torite",
  ]),
  "Terminus Ring": new Set([
    "Copper",
    "Iron",
    "Ouratite",
    "Pressurized Ice",
    "Titanium",
  ]),
};

const providerNameByLocation: Record<string, string> = {
  "Pyro Deep Space Asteroids": "HPP_Pyro_DeepSpaceAsteroids",
  "Terminus Ring": "HPP_Pyro_TerminusRing",
  "Pyro V-a (Ignis)": "HPP_Pyro_Va_Ignis",
  "Pyro V-b (Vatra)": "HPP_Pyro_Vb_Vatra",
  "Pyro V-c (Adir)": "HPP_Pyro_Vc_Adir",
  "Pyro V-d (Fairo)": "HPP_Pyro_Vd_Fairo",
  "Pyro V-e (Fuego)": "HPP_Pyro_Ve_Fuego",
  "Pyro V-f (Vuur)": "HPP_Pyro_Vf_Vuur",
};

const providerPathByLocation: Record<string, string> = {
  "Pyro Deep Space Asteroids": "libs/foundry/records/harvestable/providerpresets/system/pyro/asteroidfield/hpp_pyro_deepspaceasteroids.xml",
  "Terminus Ring": "libs/foundry/records/harvestable/providerpresets/system/pyro/asteroidfield/hpp_pyro_terminusring.xml",
  "Pyro V-a (Ignis)": "libs/foundry/records/harvestable/providerpresets/system/pyro/hpp_pyro_va_ignis.xml",
  "Pyro V-b (Vatra)": "libs/foundry/records/harvestable/providerpresets/system/pyro/hpp_pyro_vb_vatra.xml",
  "Pyro V-c (Adir)": "libs/foundry/records/harvestable/providerpresets/system/pyro/hpp_pyro_vc_adir.xml",
  "Pyro V-d (Fairo)": "libs/foundry/records/harvestable/providerpresets/system/pyro/hpp_pyro_vd_fairo.xml",
  "Pyro V-e (Fuego)": "libs/foundry/records/harvestable/providerpresets/system/pyro/hpp_pyro_ve_fuego.xml",
  "Pyro V-f (Vuur)": "libs/foundry/records/harvestable/providerpresets/system/pyro/hpp_pyro_vf_vuur.xml",
};

const terminusMaterials = ["Copper", "Iron", "Ouratite", "Pressurized Ice", "Titanium"];

const templateLocationByMaterial: Record<string, [string, string]> = {
  Copper: ["Stanton", "Aaronhalo"],
  Iron: ["Stanton", "Stanton2c Belt"],
  Ouratite: ["Stanton", "Stanton2c Belt"],
  "Pressurized Ice": ["Nyx", "Nyx Glaciemring"],
  Titanium: ["Stanton", "Aaronhalo"],
};

function readRows(name: string): IndexRow[] {
  return JSON.parse(readFileSync(path.join(base, name), "utf8")) as IndexRow[];
}

function writeRows(name: string, rows: IndexRow[]): void {
  writeFileSync(path.join(base, name), `${JSON.stringify(rows, null, 2)}\n`);
}

function locationKey(row: IndexRow): string {
  return String(row.locationKey ?? row.location ?? row.locationDisplayName ?? "");
}

function canonicalPyroLocation(row: IndexRow): string | null {
  return activePyroLocations.get(locationKey(row)) ?? activePyroLocations.get(String(row.locationDisplayName ?? "")) ?? null;
}

function isPyro(row: IndexRow): boolean {
  return String(row.systemKey ?? row.system ?? "").toLowerCase() === "pyro";
}

function materialAllowed(row: IndexRow, locationName: string): boolean {
  const allowed = limitedMaterials[locationName];
  return !allowed || allowed.has(String(row.materialName ?? ""));
}

function setLocation(row: IndexRow, locationName: string): IndexRow {
  row.system = "Pyro";
  row.systemKey = "Pyro";
  row.systemDisplayName = "Pyro";
  row.location = locationName;
  row.locationKey = locationName;
  row.locationDisplayName = locationName;
  row.parents = [];
  row.parentDisplayNames = [];

  if (locationName === "Terminus Ring") {
    row.resolvedMineableClass = "Orbitborne";
    row.locationClassDistributionShare = 1.0;
    row.methodFit = 1.0;
  }

  if (Array.isArray(row.sources)) {
    row.sources = row.sources.map((source) => setLocation({ ...source }, locationName));
  }

  if (typeof row.providerName === "string" && providerNameByLocation[locationName]) {
    row.providerName = providerNameByLocation[locationName];
  }
  if (typeof row.providerPath === "string" && providerPathByLocation[locationName]) {
    row.providerPath = providerPathByLocation[locationName];
  }

  if (locationName === "Terminus Ring" && Array.isArray(row.sources)) {
    row.sources = row.sources.map((source) => ({
      ...source,
      providerName: providerNameByLocation[locationName],
      providerPath: providerPathByLocation[locationName],
      resolvedMineableClass: "Orbitborne",
      resolvedMineableClassReason: "active Pyro Terminus Ring asteroid composition override",
      resolvedMineableConfidence: "medium",
      methodFit: 1.0,
    }));
  }

  return row;
}

function transformPyroRows(rows: IndexRow[]): IndexRow[] {
  return rows.flatMap((row) => {
    if (!isPyro(row)) return [row];
    const locationName = canonicalPyroLocation(row);
    if (!locationName || !materialAllowed(row, locationName)) return [];
    return [setLocation(row, locationName)];
  });
}

function findTemplate(rows: IndexRow[], materialName: string): IndexRow {
  const preferred = templateLocationByMaterial[materialName];
  const template = rows.find((row) =>
    row.materialName === materialName &&
    row.systemKey === preferred?.[0] &&
    row.locationKey === preferred?.[1]
  ) ?? rows.find((row) =>
    row.materialName === materialName &&
    row.resolvedMineableClass === "Orbitborne"
  ) ?? rows.find((row) => row.materialName === materialName);

  if (!template) throw new Error(`Missing template row for ${materialName}`);
  return structuredClone(template);
}

function addMissingTerminusRows(rows: IndexRow[]): IndexRow[] {
  const existing = new Set(rows
    .filter((row) => row.systemKey === "Pyro" && row.locationKey === "Terminus Ring")
    .map((row) => row.materialName));

  for (const materialName of terminusMaterials) {
    if (existing.has(materialName)) continue;
    rows.push(setLocation(findTemplate(rows, materialName), "Terminus Ring"));
  }

  return rows;
}

function sortMaterialRows(rows: IndexRow[]): IndexRow[] {
  return rows.sort((left, right) =>
    String(left.systemKey).localeCompare(String(right.systemKey)) ||
    String(left.locationKey).localeCompare(String(right.locationKey)) ||
    String(left.materialName ?? "").localeCompare(String(right.materialName ?? "")) ||
    String(left.resolvedMineableClass ?? "").localeCompare(String(right.resolvedMineableClass ?? ""))
  );
}

function transformMaterialFile(name: string): void {
  const rows = addMissingTerminusRows(transformPyroRows(readRows(name)));
  writeRows(name, sortMaterialRows(rows));
}

function transformDistributionFile(): void {
  const rows = readRows("location_distribution_index.json").flatMap((row) => {
    if (!isPyro(row)) return [row];
    const locationName = canonicalPyroLocation(row);
    if (!locationName) return [];

    const next = setLocation(row, locationName);
    if (locationName === "Pyro Deep Space Asteroids" || locationName === "Terminus Ring") {
      const edgeCount = locationName === "Terminus Ring" ? 5 : 7;
      const totalSourceProbability = locationName === "Terminus Ring" ? 0.001 : next.totalSourceProbability;
      next.distribution = {
        Handborne: 0,
        Geoborne: 0,
        Shipborne: 0,
        Orbitborne: 1,
        Harvestable: 0,
        Unclassified: 0,
      };
      next.probabilityTotals = {
        Handborne: 0,
        Geoborne: 0,
        Shipborne: 0,
        Orbitborne: totalSourceProbability,
        Harvestable: 0,
        Unclassified: 0,
      };
      next.edgeCounts = {
        Handborne: 0,
        Geoborne: 0,
        Shipborne: 0,
        Orbitborne: edgeCount,
        Harvestable: 0,
        Unclassified: 0,
      };
      next.totalEdges = edgeCount;
      next.totalSourceProbability = totalSourceProbability;
    }

    return [next];
  });

  writeRows("location_distribution_index.json", rows.sort((left, right) =>
    String(left.systemKey).localeCompare(String(right.systemKey)) ||
    String(left.locationKey).localeCompare(String(right.locationKey))
  ));
}

transformMaterialFile("location_material_index.json");
transformMaterialFile("material_quality_index.json");
transformMaterialFile("material_encounter_rankings.json");
transformDistributionFile();
