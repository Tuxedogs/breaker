import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Keeps the Vercel missions function bundle pointed at the active immutable
 * mission generation. Only `current.json` and that generation's runtime files
 * are bundled; inactive generations and shaping-only reports stay out, which
 * keeps the function under Vercel's size limit.
 *
 * Run after any pointer change (publication or rollback):
 *   npm run missions:vercel-bundle
 * `npm run api:check` fails when vercel.json and the pointer disagree.
 */

export const MISSIONS_FUNCTION = "api/missions/[...path].ts";

/** Root files in a generation that no API route reads (shaping inputs and reports). */
export const NON_RUNTIME_GENERATION_FILES = [
  "rewards",
  "offers",
  "families",
  "prerequisites",
  "concepts",
  "reputation",
  "unresolved_refs",
  "browse_groups",
  // Keep the glob under Vercel's 256-character excludeFiles limit.
  // Do not exclude graph_validation_report: it is needed by the runtime solver.
  "category*_report",
  "concept*_report",
  "browser*_report",
  "offer*_report",
] as const;

export type MissionFunctionBundle = { includeFiles: string; excludeFiles: string };

export function missionFunctionBundle(generationPath: string): MissionFunctionBundle {
  if (!/^generations\/[0-9a-f]{24}$/.test(generationPath)) {
    throw new Error(`Unexpected mission generation path: ${generationPath}`);
  }
  return {
    includeFiles: `server-data/missions/{current.json,${generationPath}/**}`,
    excludeFiles: `server-data/missions/${generationPath}/mission_{${NON_RUNTIME_GENERATION_FILES.join(",")}}.json`,
  };
}

type VercelConfig = { functions?: Record<string, Record<string, unknown>> };

function readPointerGenerationPath(repoRoot: string): string {
  const pointer = JSON.parse(readFileSync(path.join(repoRoot, "server-data", "missions", "current.json"), "utf8")) as { generationPath?: unknown };
  if (typeof pointer.generationPath !== "string") throw new Error("Mission pointer has no generationPath.");
  return pointer.generationPath;
}

/** Returns a reason string when vercel.json does not bundle the active generation, else null. */
export function checkVercelMissionBundle(repoRoot: string): string | null {
  const expected = missionFunctionBundle(readPointerGenerationPath(repoRoot));
  const config = JSON.parse(readFileSync(path.join(repoRoot, "vercel.json"), "utf8")) as VercelConfig;
  const actual = config.functions?.[MISSIONS_FUNCTION];
  if (!actual) return `vercel.json has no ${MISSIONS_FUNCTION} function entry.`;
  if (actual.includeFiles !== expected.includeFiles || actual.excludeFiles !== expected.excludeFiles) {
    return `vercel.json ${MISSIONS_FUNCTION} does not bundle the active mission generation. Run \`npm run missions:vercel-bundle\`.`;
  }
  return null;
}

/** Rewrites the missions function entry in vercel.json; returns true when it changed. */
export function syncVercelMissionBundle(repoRoot: string): boolean {
  const vercelPath = path.join(repoRoot, "vercel.json");
  const raw = readFileSync(vercelPath, "utf8");
  const config = JSON.parse(raw) as VercelConfig;
  const expected = missionFunctionBundle(readPointerGenerationPath(repoRoot));
  const current = config.functions?.[MISSIONS_FUNCTION] ?? {};
  if (current.includeFiles === expected.includeFiles && current.excludeFiles === expected.excludeFiles) return false;
  config.functions = { ...config.functions, [MISSIONS_FUNCTION]: { ...current, ...expected } };
  const newline = raw.includes("\r\n") ? "\r\n" : "\n";
  writeFileSync(vercelPath, `${JSON.stringify(config, null, 2)}\n`.replace(/\n/g, newline), "utf8");
  return true;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const changed = syncVercelMissionBundle(process.cwd());
  console.log(changed ? "vercel.json missions bundle updated to the active generation." : "vercel.json missions bundle already matches the active generation.");
}
