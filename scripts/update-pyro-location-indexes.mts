import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

type IndexRow = Record<string, any>;

const base = path.resolve(process.env.RECOMMENDATIONS_BASE ?? "public/api/recommendations");
const foundryRecordsRoot = process.env.FOUNDRY_RECORDS_ROOT ?? "D:/scintel/libs/foundry/records";
const localizationRoot = process.env.SCINTEL_LOCALIZATION_ROOT ?? "D:/scintel/data/Data/Localization/english";
const pyroProviderRoot = path.join(foundryRecordsRoot, "harvestable/providerpresets/system/pyro");
const localizationPath = path.join(localizationRoot, "global.ini");

const providerBackedCanonicalOverrides: Record<string, string> = {
  pyro1: "Pyro I",
  pyro2: "Monox",
  pyro3: "Bloom",
  pyro4: "Pyro IV",
  pyro5a: "Pyro V-a (Ignis)",
  pyro5b: "Pyro V-b (Vatra)",
  pyro5c: "Pyro V-c (Adir)",
  pyro5d: "Pyro V-d (Fairo)",
  pyro5e: "Pyro V-e (Fuego)",
  pyro5f: "Pyro V-f (Vuur)",
  pyro6: "Pyro VI (Terminus)",
  pyroakirocluster: "Akiro Cluster",
  pyrodeepspaceasteroids: "Pyro Deep Space Asteroids",
  pyrocool01: "Pyro Cool01",
  pyrocool02: "Pyro Cool02",
  pyrowarm01: "Pyro Warm01",
  pyrowarm02: "Pyro Warm02",
};

const excludedPyroLocationNames = new Set([
  "Pyro Cool01",
  "Pyro Cool02",
  "Pyro Warm01",
  "Pyro Warm02",
]);

const explicitAliases: Record<string, string> = {
  "Pyro I": "Pyro I",
  "Pyro II": "Monox",
  Monox: "Monox",
  "Pyro II Monox": "Monox",
  "Pyro II (Monox)": "Monox",
  "Pyro III": "Bloom",
  Bloom: "Bloom",
  "Pyro III Bloom": "Bloom",
  "Pyro III (Bloom)": "Bloom",
  "Pyro III Monox": "Monox",
  "Pyro III (Monox)": "Monox",
  "Pyro IV": "Pyro IV",
  Terminus: "Pyro VI (Terminus)",
  "Pyro VI": "Pyro VI (Terminus)",
  "Pyro VI Terminus": "Pyro VI (Terminus)",
  "Pyro VI (Terminus)": "Pyro VI (Terminus)",
  "Pyro V-a": "Pyro V-a (Ignis)",
  Ignis: "Pyro V-a (Ignis)",
  "Pyro V-b": "Pyro V-b (Vatra)",
  Vatra: "Pyro V-b (Vatra)",
  "Pyro V-c": "Pyro V-c (Adir)",
  Adir: "Pyro V-c (Adir)",
  "Pyro V-d": "Pyro V-d (Fairo)",
  Fairo: "Pyro V-d (Fairo)",
  "Pyro V-e": "Pyro V-e (Fuego)",
  Fuego: "Pyro V-e (Fuego)",
  "Pyro V-f": "Pyro V-f (Vuur)",
  Vuur: "Pyro V-f (Vuur)",
  "Akiro Cluster": "Akiro Cluster",
  "Pyro Akirocluster": "Akiro Cluster",
  "Pyro_AkiroCluster": "Akiro Cluster",
  "Pyro Deep Space Asteroids": "Pyro Deep Space Asteroids",
  "Pyro Deepspaceasteroids": "Pyro Deep Space Asteroids",
};

function readRows(name: string): IndexRow[] {
  return JSON.parse(readFileSync(path.join(base, name), "utf8")) as IndexRow[];
}

function writeRows(name: string, rows: IndexRow[]): void {
  writeFileSync(path.join(base, name), `${JSON.stringify(rows, null, 2)}\n`);
}

function norm(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function locationKey(row: IndexRow): string {
  return String(row.locationKey ?? row.location ?? row.locationDisplayName ?? "");
}

function loadLocalization(): Map<string, string> {
  const labels = new Map<string, string>();
  if (!existsSync(localizationPath)) return labels;

  for (const line of readFileSync(localizationPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (!match) continue;
    labels.set(match[1].trim(), match[2].trim());
  }
  return labels;
}

function findXmlFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(root, entry.name);
    if (entry.isDirectory()) return findXmlFiles(child);
    return entry.isFile() && entry.name.toLowerCase().endsWith(".xml") ? [child] : [];
  });
}

function titleFromProviderStem(stem: string): string {
  return stem
    .replace(/^hpp[_-]?/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

function providerKeyFromFile(file: string): string {
  return path.basename(file, ".xml").replace(/^hpp[_-]?/i, "");
}

function buildProviderBackedPyroLocationMap(): Map<string, string> {
  const labels = loadLocalization();
  const aliases = new Map<string, string>();

  for (const file of findXmlFiles(pyroProviderRoot)) {
    const providerKey = providerKeyFromFile(file);
    const canonical = providerBackedCanonicalOverrides[norm(providerKey)]
      ?? labels.get(providerKey)
      ?? titleFromProviderStem(providerKey);
    const sourceName = titleFromProviderStem(providerKey);

    for (const alias of [
      providerKey,
      sourceName,
      labels.get(providerKey),
      canonical,
      `HPP_${providerKey}`,
      `HPP_${providerKey.replace(/([A-Z])/g, "_$1").replace(/^_/, "")}`,
    ]) {
      if (alias) aliases.set(norm(alias), canonical);
    }
  }

  for (const [alias, canonical] of Object.entries(explicitAliases)) {
    aliases.set(norm(alias), canonical);
  }

  return aliases;
}

const activePyroLocations = buildProviderBackedPyroLocationMap();
const unresolvedPyroLocationKeys = new Set<string>();

function canonicalPyroLocation(row: IndexRow): string | null {
  for (const candidate of [
    locationKey(row),
    String(row.locationDisplayName ?? ""),
    String(row.providerName ?? "").replace(/^HPP_/i, ""),
  ]) {
    const canonical = activePyroLocations.get(norm(candidate));
    if (canonical) return canonical;
  }

  const key = locationKey(row);
  if (key) unresolvedPyroLocationKeys.add(key);
  return null;
}

function isPyro(row: IndexRow): boolean {
  return String(row.systemKey ?? row.system ?? "").toLowerCase() === "pyro";
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

  if (Array.isArray(row.sources)) {
    row.sources = row.sources.map((source) => setLocation({ ...source }, locationName));
  }

  return row;
}

function transformPyroRows(rows: IndexRow[]): IndexRow[] {
  return rows.flatMap((row) => {
    if (!isPyro(row)) return [row];
    const locationName = canonicalPyroLocation(row);
    if (!locationName) return [];
    if (excludedPyroLocationNames.has(locationName)) return [];
    return [setLocation(row, locationName)];
  });
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
  const rows = transformPyroRows(readRows(name));
  writeRows(name, sortMaterialRows(rows));
}

function transformDistributionFile(): void {
  const rows = readRows("location_distribution_index.json").flatMap((row) => {
    if (!isPyro(row)) return [row];
    const locationName = canonicalPyroLocation(row);
    if (!locationName) return [];
    if (excludedPyroLocationNames.has(locationName)) return [];

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

if (unresolvedPyroLocationKeys.size > 0) {
  console.warn("[mining] unresolved Pyro provider/location keys were dropped", [...unresolvedPyroLocationKeys].sort());
}
