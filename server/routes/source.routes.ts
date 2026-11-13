import { readFile } from "node:fs/promises";
import path from "node:path";

import { getMiningDataRoot } from "../config/miningDataRoot.js";
import { buildSourceCatalog } from "../sourceDiscovery/sourceCatalog.js";
import { validateJournalHabitatDataset } from "../sourceDiscovery/journalEvidence.js";

export type SourceRouteResult = {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
};

/** Source is read-only. An explicit SOURCE_JOURNAL_DATASET_PATH supports an isolated candidate during development. */
export async function handleSourceRoute(
  method: string,
  rawUrl: string,
  options: { miningRoot?: string; journalPath?: string } = {},
): Promise<SourceRouteResult | null> {
  if (new URL(rawUrl, "http://localhost").pathname.replace(/\/$/, "") !== "/api/source/catalog") return null;
  if (method !== "GET" && method !== "HEAD") {
    return { status: 405, body: { error: "Method not allowed" }, headers: { allow: "GET, HEAD" } };
  }
  const miningRoot = options.miningRoot ?? getMiningDataRoot();
  const registryPath = path.join(miningRoot, "recommender", "material-sources-quality-enriched.json");
  const miningGroups = JSON.parse(await readFile(registryPath, "utf8")) as Parameters<typeof buildSourceCatalog>[0];

  const configured = options.journalPath ?? process.env.SOURCE_JOURNAL_DATASET_PATH;
  const journalPath = configured || path.resolve("server-data/source/journal-habitats.json");
  let journal: ReturnType<typeof validateJournalHabitatDataset> | undefined;
  try {
    journal = validateJournalHabitatDataset(JSON.parse(await readFile(journalPath, "utf8")) as unknown);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT" || configured) throw error;
    // No accepted Journal data published: preserve unknown evidence rather than borrowing an arbitrary dump.
  }

  return {
    status: 200,
    body: buildSourceCatalog(miningGroups, journal),
    headers: { "cache-control": "no-store" },
  };
}
