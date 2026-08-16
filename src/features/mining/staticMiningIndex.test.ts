import assert from "node:assert/strict";
import test from "node:test";

import { getStaticLocationDisplayName, type StaticMiningIndex } from "./staticMiningIndex";
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
