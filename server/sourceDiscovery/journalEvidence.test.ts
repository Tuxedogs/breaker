import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { validateJournalHabitatDataset, projectJournalHabitats } from "./journalEvidence.js";
import { buildSourceCatalog } from "./sourceCatalog.js";
import { handleSourceRoute } from "../routes/source.routes.js";

function fixture() {
  return {
    schemaVersion: 1,
    channel: "PTU",
    buildId: "5.0-test",
    sourceBuildId: "5.0-test",
    evidenceType: "in_game_journal_reported_habitat",
    source: {
      pathWithinSnapshot: "Data/Localization/english/global.ini",
      sha256: "a".repeat(64),
      entries: [
        { key: "Journal_General_Wildlife_Content", sha256: "b".repeat(64) },
        { key: "Journal_General_Harvestables_Content", sha256: "c".repeat(64) },
      ],
    },
    wildlife: [{
      category: "wildlife",
      name: "Valakkar",
      system: "Stanton",
      bodyId: "Stanton1b",
      bodyName: "Aberdeen",
      biome: "deserts",
      scope: "named_body",
      reportedLocation: "Deserts of Aberdeen (Stanton 1b)",
      localizationKey: "Journal_General_Wildlife_Content",
      evidenceType: "reported_habitat",
    }],
    foraging: [{
      category: "foraged_item",
      name: "Ranta Dung",
      system: "Pyro",
      bodyId: null,
      bodyName: null,
      biome: "caves",
      scope: "system_caves_unexpanded",
      reportedLocation: "Caves on all of Pyro's Planets and Moons",
      localizationKey: "Journal_General_Harvestables_Content",
      evidenceType: "reported_habitat",
      interactionStatus: "unknown",
    }],
    semantics: {
      spawnConfirmed: false,
      interactionConfirmed: false,
      affectsMiningRanking: false,
      hasHudClutterWeights: false,
    },
  } as const;
}

test("Journal shows reported habitat independently of quantified mining", () => {
  const journal = validateJournalHabitatDataset(fixture());
  const catalog = buildSourceCatalog([], journal);
  assert.equal(catalog.journal.availability, "reported");
  assert.equal(catalog.journal.wildlife[0]?.bodyId, "Stanton1b");
  assert.equal(catalog.journal.foraging[0]?.scope, "system_caves_unexpanded");
  assert.equal(catalog.categories.wildlife.availability, "unknown");
  assert.equal(catalog.categories.hand_harvestable.availability, "unknown");
  assert.equal(catalog.records.length, 0);
  assert.equal(projectJournalHabitats().availability, "unknown");
});

test("journal validation rejects inferred spawn and quantitative clutter", () => {
  const base = structuredClone(fixture()) as Record<string, unknown>;
  const corrupted = structuredClone(base) as Record<string, unknown>;
  (corrupted.semantics as Record<string, unknown>).affectsMiningRanking = true;
  assert.throws(() => validateJournalHabitatDataset(corrupted), /cannot assert spawn/);
  const weighted = structuredClone(base) as Record<string, unknown>;
  ((weighted.wildlife as Record<string, unknown>[])[0]).clutterPenalty = 0.2;
  assert.throws(() => validateJournalHabitatDataset(weighted), /cannot contain ranking or clutter/);
  const interaction = structuredClone(base) as Record<string, unknown>;
  ((interaction.foraging as Record<string, unknown>[])[0]).interactionStatus = "confirmed";
  assert.throws(() => validateJournalHabitatDataset(interaction), /cannot establish a foraging interaction/);
});

test("read-only Source API exposes a versioned candidate explicitly, never guesses another source", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "breaker-journal-test-"));
  try {
    const miningRoot = path.join(root, "mining");
    await mkdir(path.join(miningRoot, "recommender"), { recursive: true });
    await writeFile(path.join(miningRoot, "recommender", "material-sources-quality-enriched.json"), "[]");
    const journalPath = path.join(root, "journal-habitats.json");
    await writeFile(journalPath, JSON.stringify(fixture()));
    const result = await handleSourceRoute("GET", "/api/source/catalog", { miningRoot, journalPath });
    assert.equal(result?.status, 200);
    const catalog = result?.body as ReturnType<typeof buildSourceCatalog>;
    assert.equal(catalog.journal.foraging.length, 1);
    assert.equal(catalog.journal.wildlife.length, 1);
    assert.equal(catalog.journal.source?.sourceBuildId, "5.0-test");
    assert.equal(catalog.records.length, 0);
    assert.equal((await handleSourceRoute("POST", "/api/source/catalog", { miningRoot }))?.status, 405);
    assert.equal(await handleSourceRoute("GET", "/api/source/unknown", { miningRoot }), null);
    await assert.rejects(
      handleSourceRoute("GET", "/api/source/catalog", { miningRoot, journalPath: path.join(root, "missing.json") }),
      { code: "ENOENT" },
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
