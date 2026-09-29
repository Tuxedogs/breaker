import assert from "node:assert/strict";
import test from "node:test";

import {
  getStaticLocationEnvironment,
  getStaticLocationDisplayName,
  type StaticMiningIndex,
} from "./staticMiningIndex";
import { groupStaticMiningBrowseRows } from "./recommenderAdapter";
import { configureStantonLagrangeGroupData } from "../locations/stantonLagrangeChildren";
import type { PublicLocationEntry } from "./types";

test("Lagrange group display names are not replaced by a physical child name", () => {
  const entry = {
    locationKey: "stanton::lagrange d",
    locationName: "Lagrange D",
    systemName: "Stanton",
  } as PublicLocationEntry;
  const physicalChildRow = {
    locationDisplayName: "ARC-L5",
  };
  const index = {
    resourcesByLocationJoinKey: new Map([
      ["stanton::lagrange d", [physicalChildRow]],
    ]),
    distributionByLocationJoinKey: new Map(),
    locationKeysByDisplayName: new Map(),
  } as unknown as StaticMiningIndex;

  assert.equal(getStaticLocationDisplayName(entry, index), "Lagrange D");
});

test("location environment resolves through canonical Pyro aliases without substituting missing fields", () => {
  const entry = {
    locationKey: "Pyro6",
    locationName: "Terminus",
    systemName: "Pyro",
  } as PublicLocationEntry;
  const distributionRow = {
    breathable: false,
    temperatureClassification: "cold",
    temperatureCelsius: null,
  };
  const index = {
    distributionByLocationJoinKey: new Map([
      ["pyro::pyro vi (terminus)", [distributionRow]],
    ]),
    locationKeysByDisplayName: new Map(),
  } as unknown as StaticMiningIndex;

  assert.deepEqual(getStaticLocationEnvironment(entry, index), {
    breathable: false,
    temperatureClassification: "cold",
    temperatureCelsius: null,
  });
});

test("Browse-mode static rows use generated Lagrange parents and retain member codes", () => {
  configureStantonLagrangeGroupData({
    groups: [{ label: "Lagrange B", letter: "B", locations: ["CRU-L1", "CRU-L2"] }],
  });

  const grouped = groupStaticMiningBrowseRows([
    { system: "Stanton", systemKey: "Stanton", location: "CRU-L1", locationKey: "CRU-L1", locationDisplayName: "CRU-L1" },
    { system: "Stanton", systemKey: "Stanton", location: "CRU-L2", locationKey: "CRU-L2", locationDisplayName: "CRU-L2" },
    { system: "Stanton", systemKey: "Stanton", location: "Hurston", locationKey: "Hurston", locationDisplayName: "Hurston" },
  ] as never);

  assert.deepEqual(grouped.map((group) => ({
    locationKey: group.locationKey,
    locationName: group.locationName,
    matchedLocationCodes: group.matchedLocationCodes,
    rowCount: group.rows.length,
  })), [
    { locationKey: "stanton|Lagrange B", locationName: "Lagrange B", matchedLocationCodes: ["CRU-L1", "CRU-L2"], rowCount: 2 },
    { locationKey: "Hurston", locationName: "Hurston", matchedLocationCodes: undefined, rowCount: 1 },
  ]);
});
