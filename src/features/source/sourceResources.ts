/** Approved Source chip display names only, never inferred spawn evidence.
 * Mineral names come from the already-published Mining material index.
 * Reported habitats are served separately by /api/source/catalog.
 */
export const PLANT_LIFE_RESOURCE_NAMES = [
  "Amiant Pod", "Amioshi Plague", "Bluemoon Fungus", "Decari Pod",
  "Degnous Root", "Flareweed Stalk", "Fotia Seedpod", "Golden Medmon",
  "Heart Of The Woods", "Miner’s Horn", "Pingala Seeds", "Pitambu",
  "Prota", "Ranta Dung", "Revenant Pod", "Stone Bug Shell",
  "Sunset Berries", "Wuotan Seed",
] as const;
export const WILDLIFE_RESOURCE_NAMES = ["Kopion", "Marok", "Valakkar"] as const;
export type JournalCategory = "plant" | "wildlife";
export type JournalChipAvailability = "normal" | "muted" | "unknown";
export type JournalHabitatReport = {
  category: "wildlife" | "foraged_item";
  name: string;
  system: string | null;
  bodyName: string | null;
  biome: string | null;
  scope: "named_body" | "named_body_and_moons" | "named_place" | "system_caves_unexpanded";
  reportedLocation: string;
  evidenceType: "reported_habitat";
};
export type JournalEvidence = {
  availability: "reported" | "unknown";
  wildlife: JournalHabitatReport[];
  foraging: JournalHabitatReport[];
  source?: { channel: string; buildId: string } | null;
};
export const UNKNOWN_JOURNAL_EVIDENCE: JournalEvidence = {
  availability: "unknown", wildlife: [], foraging: [], source: null,
};
export function journalResourceKey(category: JournalCategory, name: string): string {
  return category + ":" + name;
}
export function keyForJournalReport(report: JournalHabitatReport): string {
  return journalResourceKey(report.category === "wildlife" ? "wildlife" : "plant", report.name);
}
export interface ReportedHabitatLocation {
  key: string;
  system: string;
  body: string;
  reports: JournalHabitatReport[];
}
export function reportedHabitatLocations(
  evidence: JournalEvidence,
  selected: ReadonlySet<string>,
  selectedSystems: ReadonlySet<string>,
  search = "",
): ReportedHabitatLocation[] {
  if (evidence.availability !== "reported" || selected.size === 0) return [];
  const result = new Map<string, ReportedHabitatLocation>();
  const searchTerm = search.trim().toLocaleLowerCase();
  for (const report of [...evidence.foraging, ...evidence.wildlife]) {
    if (!selected.has(keyForJournalReport(report)) || !report.system) continue;
    if (selectedSystems.size && !selectedSystems.has(report.system)) continue;
    const body = report.scope === "system_caves_unexpanded"
      ? report.system + " caves (system-wide)"
      : report.bodyName || report.reportedLocation;
    if (!body) continue;
    if (searchTerm && ![body, report.system, report.name, report.biome ?? ""]
      .some((value) => value.toLocaleLowerCase().includes(searchTerm))) continue;
    const key = report.system + ":" + body;
    const row = result.get(key) ?? { key, system: report.system, body, reports: [] };
    if (!row.reports.some((entry) => keyForJournalReport(entry) === keyForJournalReport(report) &&
      entry.biome === report.biome && entry.scope === report.scope)) row.reports.push(report);
    result.set(key, row);
  }
  return [...result.values()].sort((a, b) => a.body.localeCompare(b.body));
}
/** Passive co-reporting only. "Not reported" is never "absent"; no Journal chip is disabled. */
export function deriveJournalChipAvailability(
  evidence: JournalEvidence,
  selected: ReadonlySet<string>,
  selectedSystems: ReadonlySet<string>,
  allKeys: readonly string[],
): Map<string, JournalChipAvailability> {
  const result = new Map<string, JournalChipAvailability>();
  if (evidence.availability !== "reported") {
    for (const key of allKeys) result.set(key, "unknown");
    return result;
  }
  const rows = reportedHabitatLocations(evidence, new Set(allKeys), selectedSystems);
  const selectedKeys = [...selected];
  const coReported = selectedKeys.length
    ? rows.filter((row) => selectedKeys.every((key) => row.reports.some((report) => keyForJournalReport(report) === key)))
    : rows;
  const sharedKeys = new Set(coReported.flatMap((row) => row.reports.map(keyForJournalReport)));
  for (const key of allKeys) {
    result.set(key, selected.has(key) || !selectedKeys.length || sharedKeys.has(key) ? "normal" : "muted");
  }
  return result;
}
