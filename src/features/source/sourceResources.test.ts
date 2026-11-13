import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  PLANT_LIFE_RESOURCE_NAMES,
  WILDLIFE_RESOURCE_NAMES,
  UNKNOWN_JOURNAL_EVIDENCE,
  deriveJournalChipAvailability,
  journalResourceKey,
  reportedHabitatLocations,
  type JournalEvidence,
  type JournalHabitatReport,
} from "./sourceResources.js";

const report = (
  category: JournalHabitatReport["category"],
  name: string,
  bodyName: string | null,
  biome: string | null,
  scope: JournalHabitatReport["scope"] = "named_body",
): JournalHabitatReport => ({
  category, name, system: "Stanton", bodyName, biome, scope,
  reportedLocation: bodyName || "Stanton caves", evidenceType: "reported_habitat",
});

const evidence: JournalEvidence = {
  availability: "reported",
  foraging: [
    report("foraged_item", "Prota", "Hurston", "grasslands"),
    report("foraged_item", "Golden Medmon", "Hurston", "grasslands"),
    report("foraged_item", "Golden Medmon", "microTech", "tundras"),
  ],
  wildlife: [
    report("wildlife", "Kopion", "Hurston", "caves"),
    report("wildlife", "Kopion", "microTech", "forests"),
    report("wildlife", "Valakkar", "Daymar", "deserts"),
    report("wildlife", "Marok", null, "caves", "system_caves_unexpanded"),
  ],
};
const keys = [
  journalResourceKey("plant", "Prota"),
  journalResourceKey("plant", "Golden Medmon"),
  journalResourceKey("wildlife", "Kopion"),
  journalResourceKey("wildlife", "Valakkar"),
  journalResourceKey("wildlife", "Marok"),
];

test("approved Source selector names remain 18 Plant Life and 3 Wildlife, all full names", () => {
  assert.equal(PLANT_LIFE_RESOURCE_NAMES.length, 18);
  assert.equal(WILDLIFE_RESOURCE_NAMES.length, 3);
  const registry = JSON.parse(readFileSync("server-data/mining/recommender/material-sources-quality-enriched.json", "utf8")) as unknown[];
  assert.equal(registry.length, 33);
  assert.equal(33 + PLANT_LIFE_RESOURCE_NAMES.length + WILDLIFE_RESOURCE_NAMES.length, 54);
  assert.equal(new Set([...PLANT_LIFE_RESOURCE_NAMES, ...WILDLIFE_RESOURCE_NAMES]).size, 21);
});

test("mixed Journal selections use the same body list without numerical ranking", () => {
  const selected = new Set([journalResourceKey("plant", "Prota"), journalResourceKey("wildlife", "Kopion")]);
  const locations = reportedHabitatLocations(evidence, selected, new Set());
  assert.deepEqual(locations.map((entry) => entry.body), ["Hurston", "microTech"]);
  assert.deepEqual(locations.find((entry) => entry.body === "Hurston")?.reports.map((row) => row.name), ["Prota", "Kopion"]);
  assert.equal("score" in locations[0], false);
  assert.equal("spawnProbability" in locations[0], false);
});

test("passive Journal muting keeps co-reported resources active and never disables", () => {
  const selected = new Set([journalResourceKey("plant", "Prota")]);
  const state = deriveJournalChipAvailability(evidence, selected, new Set(["Stanton"]), keys);
  assert.equal(state.get(journalResourceKey("plant", "Golden Medmon")), "normal");
  assert.equal(state.get(journalResourceKey("wildlife", "Kopion")), "normal");
  assert.equal(state.get(journalResourceKey("wildlife", "Valakkar")), "muted");
  assert.equal(state.get(journalResourceKey("plant", "Prota")), "normal");
  assert.ok(![...state.values()].includes("disabled" as never));
});

test("an unpublished Journal does not dim or disable chips as if habitat were absent", () => {
  const selected = new Set([journalResourceKey("wildlife", "Valakkar")]);
  const state = deriveJournalChipAvailability(UNKNOWN_JOURNAL_EVIDENCE, selected, new Set(["Pyro"]), keys);
  assert.ok([...state.values()].every((value) => value === "unknown"));
  assert.deepEqual(reportedHabitatLocations(UNKNOWN_JOURNAL_EVIDENCE, selected, new Set()), []);
});

test("system filter and search are passive, not state mutations", () => {
  const selected = new Set([journalResourceKey("wildlife", "Kopion")]);
  assert.deepEqual(reportedHabitatLocations(evidence, selected, new Set(["Pyro"])), []);
  assert.deepEqual(reportedHabitatLocations(evidence, selected, new Set(), "microTech").map((x) => x.body), ["microTech"]);
  assert.ok(selected.has(journalResourceKey("wildlife", "Kopion")));
});

test("broad cave evidence remains system-wide instead of assigning an arbitrary moon", () => {
  const selected = new Set([journalResourceKey("wildlife", "Marok")]);
  const locations = reportedHabitatLocations(evidence, selected, new Set());
  assert.deepEqual(locations.map((row) => row.body), ["Stanton caves (system-wide)"]);
  assert.ok(!locations.some((row) => row.body === "Hurston" || row.body === "Daymar"));
});
