/** In-game Journal statements are reported habitats, never observed spawn or competition data. */
export type JournalHabitat = {
  category: "wildlife" | "foraged_item";
  name: string;
  system: string | null;
  bodyId: string | null;
  bodyName: string | null;
  biome: string | null;
  scope: "named_body" | "named_body_and_moons" | "named_place" | "system_caves_unexpanded";
  reportedLocation: string;
  localizationKey: "Journal_General_Wildlife_Content" | "Journal_General_Harvestables_Content";
  evidenceType: "reported_habitat";
  interactionStatus?: "unknown";
};

export type JournalHabitatDataset = {
  schemaVersion: 1;
  channel: "LIVE" | "PTU" | "TECH-PREVIEW";
  buildId: string;
  sourceBuildId: string;
  evidenceType: "in_game_journal_reported_habitat";
  source: {
    pathWithinSnapshot: "Data/Localization/english/global.ini";
    sha256: string;
    entries: ReadonlyArray<{key: string; sha256: string}>;
  };
  wildlife: JournalHabitat[];
  foraging: JournalHabitat[];
  semantics: {
    spawnConfirmed: false;
    interactionConfirmed: false;
    affectsMiningRanking: false;
    hasHudClutterWeights: false;
  };
};

export type JournalCatalogEvidence = {
  availability: "unknown" | "reported";
  source: {
    channel: string;
    buildId: string;
    sourceBuildId: string;
    localizationPath: string;
    localizationSha256: string;
  } | null;
  wildlife: ReadonlyArray<JournalHabitat>;
  foraging: ReadonlyArray<JournalHabitat>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error("Source Journal missing " + field);
  return value;
}

const SCOPES = new Set(["named_body", "named_body_and_moons", "named_place", "system_caves_unexpanded"]);
const forbiddenKeys = /probability|frequency|clutter|density|score|ranking|encounterRate/i;

/** Fail closed if an experimental journal file tries to provide quantitative clutter or spawn claims. */
export function validateJournalHabitatDataset(value: unknown): JournalHabitatDataset {
  if (!isRecord(value) || value.schemaVersion !== 1 || value.evidenceType !== "in_game_journal_reported_habitat") {
    throw new Error("Invalid Source Journal habitat schema.");
  }
  if (!["LIVE", "PTU", "TECH-PREVIEW"].includes(String(value.channel))) {
    throw new Error("Source Journal channel is invalid.");
  }
  requiredString(value.channel, "channel");
  requiredString(value.buildId, "buildId");
  requiredString(value.sourceBuildId, "sourceBuildId");
  const source = value.source;
  if (!isRecord(source) || source.pathWithinSnapshot !== "Data/Localization/english/global.ini" ||
      !/^[a-f0-9]{64}$/i.test(String(source.sha256)) || !Array.isArray(source.entries) ||
      source.entries.length !== 2 || source.entries.some((entry: unknown) =>
        !isRecord(entry) || typeof entry.key !== "string" || !/^[a-f0-9]{64}$/i.test(String(entry.sha256))
      )) {
    throw new Error("Source Journal is missing localization provenance.");
  }
  const keys = new Set((source.entries as Record<string, unknown>[]).map((entry) => entry.key));
  if (keys.size !== 2 || !keys.has("Journal_General_Wildlife_Content") ||
      !keys.has("Journal_General_Harvestables_Content")) {
    throw new Error("Journal localization entry keys are invalid.");
  }
  const semantics = value.semantics;
  if (!isRecord(semantics) || semantics.spawnConfirmed !== false ||
      semantics.interactionConfirmed !== false || semantics.affectsMiningRanking !== false ||
      semantics.hasHudClutterWeights !== false) {
    throw new Error("Journal cannot assert spawn, interaction, clutter, or mining ranking.");
  }
  for (const [collection, category, key] of [
    ["wildlife", "wildlife", "Journal_General_Wildlife_Content"],
    ["foraging", "foraged_item", "Journal_General_Harvestables_Content"],
  ] as const) {
    const rows = value[collection];
    if (!Array.isArray(rows)) throw new Error("Missing Source Journal " + collection + ".");
    for (const row of rows) {
      if (!isRecord(row) || row.category !== category || row.localizationKey !== key ||
          row.evidenceType !== "reported_habitat" || !SCOPES.has(String(row.scope))) {
        throw new Error("Invalid " + collection + " Journal evidence row.");
      }
      requiredString(row.name, "habitat name");
      requiredString(row.reportedLocation, "reportedLocation");
      if (Object.keys(row).some((field) => forbiddenKeys.test(field))) {
        throw new Error("Source Journal rows cannot contain ranking or clutter inputs.");
      }
      if (row.bodyId !== null && typeof row.bodyId !== "string") throw new Error("Invalid bodyId.");
      if (row.bodyName !== null && typeof row.bodyName !== "string") throw new Error("Invalid bodyName.");
      if (category === "foraged_item" && row.interactionStatus !== "unknown") {
        throw new Error("Journal text cannot establish a foraging interaction.");
      }
    }
  }
  return value as unknown as JournalHabitatDataset;
}

export function projectJournalHabitats(dataset?: JournalHabitatDataset): JournalCatalogEvidence {
  if (!dataset) return { availability: "unknown", source: null, wildlife: [], foraging: [] };
  const input = validateJournalHabitatDataset(dataset);
  return {
    availability: "reported",
    source: {
      channel: input.channel,
      buildId: input.buildId,
      sourceBuildId: input.sourceBuildId,
      localizationPath: input.source.pathWithinSnapshot,
      localizationSha256: input.source.sha256,
    },
    wildlife: input.wildlife,
    foraging: input.foraging,
  };
}
