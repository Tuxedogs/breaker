import assert from "node:assert/strict";
import test from "node:test";
import type { DetailStatRow } from "./craftingDetailStats.ts";
import { getModifierStatBindingLabel } from "./craftingDetailStats.ts";
import type { DetailStatGroup } from "./detailStatGroups.ts";
import { modifierDetailStatLabelKeys } from "../fitting/fittingStatProjection.ts";
import {
  buildDetailStatScanSections,
  formatDetailStatSectionTitle,
  splitDetailStatScanColumns,
} from "./detailStatPresentation.ts";

const stat = (label: string, value: string): DetailStatRow => ({ label, value });

test("nested weapon statistics remain distinct scan sections", () => {
  const groups: DetailStatGroup[] = [{
    title: "Ballistics / Damage",
    kind: "nested",
    subclusters: [
      { title: "Damage Output", stats: [stat("Alpha Damage", "0"), stat("Damage Over 60s", "1,200"), stat("Fire Rate", "750 rpm")] },
      { title: "Projectile", stats: [stat("Projectile Speed", "1,500 m/s")] },
      { title: "Handling", stats: [stat("Recoil Kick", "-8.9%")] },
    ],
  }];

  const sections = buildDetailStatScanSections(groups);

  assert.deepEqual(sections.map((section) => section.title), [
    "Damage Output",
    "Projectile",
    "Handling",
  ]);
  assert.equal(sections[0]?.kind, "stats");
  assert.equal(sections[0]?.kind === "stats" ? sections[0].stats[0]?.label : null, "Alpha");
  assert.equal(sections[0]?.kind === "stats" ? sections[0].stats.map((entry) => entry.label).includes("Damage Over 60s") : true, false);
  assert.equal(sections[0]?.kind === "stats" ? sections[0].stats[0]?.value : null, "0");
  assert.equal(sections[1]?.kind === "stats" ? sections[1].stats[0]?.label : null, "Speed");
});

test("flat groups and resistance matrices retain their source semantics", () => {
  const groups: DetailStatGroup[] = [
    { title: "Power & Thermal", kind: "flat", stats: [stat("Power Draw", "12 MW")] },
    {
      title: "Resistance / Absorption",
      kind: "matrix",
      columns: ["Resistance", "Absorption"],
      rows: [{ label: "Physical", values: ["20%", "80%"] }],
    },
  ];

  const sections = buildDetailStatScanSections(groups);

  assert.equal(sections[0]?.kind, "stats");
  assert.equal(sections[1]?.kind, "matrix");
  assert.deepEqual(sections[1]?.kind === "matrix" ? sections[1].columns : [], [
    "Resistance",
    "Absorption",
  ]);
  assert.equal(formatDetailStatSectionTitle("Power & Thermal"), "Power and Thermal");
  assert.equal(formatDetailStatSectionTitle("Resistance / Absorption"), "Resistance and Absorption");
});

test("scan sections balance deterministically without dropping sparse groups", () => {
  const sections = buildDetailStatScanSections([
    { title: "Primary", kind: "flat", stats: [stat("A", "1"), stat("B", "2"), stat("C", "3")] },
    { title: "Secondary", kind: "flat", stats: [stat("D", "4")] },
    { title: "Sparse", kind: "flat", stats: [stat("Available", "0")] },
  ]);

  const columns = splitDetailStatScanColumns(sections, 2);

  assert.equal(columns.length, 2);
  assert.deepEqual(columns.flat().map((section) => section.title).sort(), [
    "Primary",
    "Secondary",
    "Sparse",
  ]);
  assert.deepEqual(columns.flat().map((section) => section.title), [
    "Primary",
    "Secondary",
    "Sparse",
  ]);
});

test("items without a subtype definition use the same intentional scan structure", () => {
  const sections = buildDetailStatScanSections([], [
    stat("Component HP", "0"),
    stat("Mass", "12"),
  ]);

  assert.equal(sections.length, 1);
  assert.equal(sections[0]?.title, "Core Statistics");
  assert.equal(sections[0]?.kind === "stats" ? sections[0].stats[0]?.value : null, "0");
});

test("source modifier aliases attach to their canonical projected statistic", () => {
  assert.deepEqual(modifierDetailStatLabelKeys("Quantum Fuel Req."), [
    "quantumfuelreq",
    "fuelrequirement",
  ]);
  assert.equal(getModifierStatBindingLabel("GPP_Armor_DamageMitigation"), "Damage Mitigation");
});
