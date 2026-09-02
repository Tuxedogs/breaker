import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  transformPyroDistributionRows,
  transformPyroRows,
} from "./update-pyro-location-indexes.mts";

type Publication = {
  source: string;
  target: string;
  shape: "array" | "object";
  optional?: boolean;
};

const configuredSourceRoot = process.env.SCINTEL_API_ROOT?.trim();
if (!configuredSourceRoot) {
  throw new Error(
    "SCINTEL_API_ROOT is required and must point to an accepted Scintel datasets directory.",
  );
}
const sourceBuildId = process.env.SCINTEL_SOURCE_BUILD_ID?.trim();
if (!sourceBuildId) {
  throw new Error("SCINTEL_SOURCE_BUILD_ID is required and must name the immutable accepted Scintel source build.");
}

const sourceRoot = path.resolve(configuredSourceRoot);
const targetRoot = path.resolve(process.env.MINING_DATA_ROOT ?? "server-data/mining");

const publications: Publication[] = [
  { source: "recommendations/location_material_index.json", target: "indexes/location-material.json", shape: "array" },
  { source: "recommendations/material_encounter_rankings.json", target: "indexes/material-encounter-rankings.json", shape: "array" },
  { source: "recommendations/material_quality_index.json", target: "indexes/material-quality.json", shape: "array" },
  { source: "recommendations/location_distribution_index.json", target: "indexes/location-distribution.json", shape: "array" },
  { source: "recommendations/location_hierarchy_index.json", target: "indexes/location-hierarchy.json", shape: "object" },
  { source: "recommendations/material_source_scores.json", target: "recommender/material-source-scores.json", shape: "object" },
  { source: "mining/material_sources_quality_enriched.json", target: "recommender/material-sources-quality-enriched.json", shape: "array" },
  { source: "recommendations/location_metadata.json", target: "recommender/location-metadata.json", shape: "object", optional: true },
  { source: "lagrange-groups.generated.json", target: "locations/lagrange-groups.json", shape: "object" },
];

function validateShape(value: unknown, publication: Publication): void {
  if (publication.shape === "array" && !Array.isArray(value)) {
    throw new Error(`${publication.source} must contain a JSON array.`);
  }
  if (publication.shape === "object" && (typeof value !== "object" || value === null || Array.isArray(value))) {
    throw new Error(`${publication.source} must contain a JSON object.`);
  }
}

function stableJson(value: unknown): string {
  return `${JSON.stringify(value)}\n`;
}

const manifestFiles: Array<{
  source: string;
  target: string;
  sha256: string;
  bytes: number;
  records: number | null;
}> = [];

function countEnrichedTraceDetails(value: unknown): number {
  if (!Array.isArray(value)) return 0;
  return value.reduce((total, material) => {
    if (typeof material !== "object" || material === null) return total;
    const sources = (material as { sources?: unknown }).sources;
    if (!Array.isArray(sources)) return total;
    return total + sources.reduce((sourceTotal, source) => {
      if (typeof source !== "object" || source === null) return sourceTotal;
      const details = (source as { traceMaterialDetails?: unknown }).traceMaterialDetails;
      return sourceTotal + (Array.isArray(details) ? details.length : 0);
    }, 0);
  }, 0);
}

function countIndexTraceDetails(value: unknown): number {
  if (!Array.isArray(value)) return 0;
  return value.reduce((total, row) => {
    if (typeof row !== "object" || row === null) return total;
    const details = (row as { traceMaterialDetails?: unknown }).traceMaterialDetails;
    return total + (Array.isArray(details) ? details.length : 0);
  }, 0);
}

const enrichedSourcePreview = JSON.parse(
  await readFile(path.join(sourceRoot, "mining", "material_sources_quality_enriched.json"), "utf8"),
) as unknown;
const enrichedTraceDetailCount = countEnrichedTraceDetails(enrichedSourcePreview);

async function resolveLagrangeRefIndex(): Promise<string> {
  if (process.env.SCINTEL_REF_INDEX) return path.resolve(process.env.SCINTEL_REF_INDEX);

  const liveRoot = path.join(path.dirname(sourceRoot), "out", "LIVE");
  const candidates: Array<{ filePath: string; modifiedAt: number }> = [];
  for (const entry of await readdir(liveRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const filePath = path.join(liveRoot, entry.name, "datasets", "ref_index.json");
    try {
      candidates.push({ filePath, modifiedAt: (await stat(filePath)).mtimeMs });
    } catch {
      // Builds without a ref index are not publication candidates.
    }
  }
  candidates.sort((left, right) => right.modifiedAt - left.modifiedAt);
  if (!candidates[0]) {
    throw new Error(`No LIVE ref_index.json was found below ${liveRoot}. Set SCINTEL_REF_INDEX explicitly.`);
  }
  return candidates[0].filePath;
}

async function resolveLagrangeGenerator(): Promise<string> {
  let current = sourceRoot;
  while (true) {
    const candidate = path.join(current, "scripts", "locations", "generate-lagrange-children.mjs");
    try {
      if ((await stat(candidate)).isFile()) return candidate;
    } catch {
      // Continue toward the Scintel repository root.
    }

    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  throw new Error(
    `Could not locate scripts/locations/generate-lagrange-children.mjs above ${sourceRoot}.`,
  );
}

for (const publication of publications) {
  const sourcePath = path.join(sourceRoot, publication.source);
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(sourcePath, "utf8")) as unknown;
  } catch (error) {
    if (!publication.optional) throw error;
    parsed = {};
    console.warn(`[mining:publish] Optional source is unavailable; publishing an empty object: ${publication.source}`);
  }
  validateShape(parsed, publication);

  if (Array.isArray(parsed)) {
    if (publication.source === "recommendations/location_distribution_index.json") {
      parsed = transformPyroDistributionRows(parsed);
    } else if (
      publication.source === "recommendations/location_material_index.json" ||
      publication.source === "recommendations/material_encounter_rankings.json" ||
      publication.source === "recommendations/material_quality_index.json"
    ) {
      parsed = transformPyroRows(parsed);
    }
  }

  if (
    publication.source === "recommendations/location_material_index.json" &&
    enrichedTraceDetailCount > 0 &&
    countIndexTraceDetails(parsed) === 0
  ) {
    throw new Error(
      `Refusing to publish a trace-empty location material index from an enriched source containing ${enrichedTraceDetailCount} trace details.`,
    );
  }

  const serialized = stableJson(parsed);
  const targetPath = path.join(targetRoot, publication.target);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, serialized);
  manifestFiles.push({
    source: publication.source,
    target: publication.target,
    sha256: createHash("sha256").update(serialized).digest("hex"),
    bytes: Buffer.byteLength(serialized),
    records: Array.isArray(parsed) ? parsed.length : null,
  });
}

const lagrangeRefIndex = await resolveLagrangeRefIndex();
const lagrangeChildrenTarget = path.join(targetRoot, "locations", "lagrange-children.json");
const lagrangeGenerator = await resolveLagrangeGenerator();
await mkdir(path.dirname(lagrangeChildrenTarget), { recursive: true });
const generation = spawnSync(
  process.execPath,
  [
    lagrangeGenerator,
    "--input", lagrangeRefIndex,
    "--output", lagrangeChildrenTarget,
    "--source-build-id", sourceBuildId,
  ],
  { encoding: "utf8", shell: false },
);
if (generation.status !== 0) {
  throw new Error(`Lagrange child generation failed: ${generation.stderr || generation.stdout}`);
}
const lagrangeChildren = JSON.parse(await readFile(lagrangeChildrenTarget, "utf8")) as unknown;
const lagrangeChildrenPublication: Publication = {
  source: path.relative(path.dirname(sourceRoot), lagrangeRefIndex).replaceAll("\\", "/"),
  target: "locations/lagrange-children.json",
  shape: "object",
};
validateShape(lagrangeChildren, lagrangeChildrenPublication);
const lagrangeChildrenSerialized = stableJson(lagrangeChildren);
await writeFile(lagrangeChildrenTarget, lagrangeChildrenSerialized);
manifestFiles.push({
  source: lagrangeChildrenPublication.source,
  target: lagrangeChildrenPublication.target,
  sha256: createHash("sha256").update(lagrangeChildrenSerialized).digest("hex"),
  bytes: Buffer.byteLength(lagrangeChildrenSerialized),
  records: null,
});

await writeFile(
  path.join(targetRoot, "manifest.json"),
  `${JSON.stringify({ schemaVersion: 1, source: "scintel-api", files: manifestFiles }, null, 2)}\n`,
);

console.log(`Published ${manifestFiles.length} Mining server artifacts to ${targetRoot}.`);
