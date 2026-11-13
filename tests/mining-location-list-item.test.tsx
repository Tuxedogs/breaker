import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { configureStantonLagrangeGroupData } from "../src/features/locations/stantonLagrangeChildren";
import type { PublicLocationEntry } from "../src/features/mining/types";
import { LocationListItem } from "../src/components/industry/mining/LocationListItem";

// Node's TSX test transform uses React.createElement for imported JSX modules.
Object.assign(globalThis, { React });

function renderRow(name: string, codes?: string[]) {
  const entry = { locationKey: name, locationName: name, systemName: "Stanton", matchedLocationCodes: codes, materials: [], nearbyStations: [], locationKind: "", spawnType: "", score: 0 } as PublicLocationEntry;
  return renderToStaticMarkup(<LocationListItem entry={entry} selectedMaterials={new Set()} buildQueueMaterialKeys={new Set()} locationMaterialKeys={[]} staticMiningIndex={null} planetAssetMap={null} starred={false} selected={false} showSystemBadge onSelect={() => {}} onToggleStar={() => {}} />);
}

test("group rows retain their identity and physical children across metadata loading", async () => {
  const codes = ["CRU-L3", "MIC-L1", "MIC-L2", "MIC-L5"];
  const before = renderRow("Lagrange E", codes);
  assert.match(before, /Select Lagrange E mining location/);
  assert.doesNotMatch(before, /mlist-item-name|mlist-system-badge/);
  for (const code of codes) assert.match(before, new RegExp(`>${code}<`));
  const unresolved = renderRow("Lagrange A");
  assert.match(unresolved, /Locations unavailable/);
  assert.doesNotMatch(unresolved, /mlist-item-name|mlist-system-badge/);
  const groups = JSON.parse(await readFile("server-data/mining/locations/lagrange-groups.json", "utf8"));
  configureStantonLagrangeGroupData(groups);
  assert.equal(renderRow("Lagrange E", codes), before);
  assert.match(renderRow("Lagrange A"), />HUR-L3</);
  for (const name of ["Hurston", "Everus Harbor", "HUR-L3"]) {
    const row = renderRow(name);
    assert.match(row, /mlist-item-name/);
    assert.match(row, /mlist-system-badge/);
    assert.doesNotMatch(row, /mloc-lagrange-children/);
  }
});

