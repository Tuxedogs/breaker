import assert from "node:assert/strict";
import test from "node:test";

import type { PortBreakdownRow } from "./fittingPortGrouping.ts";
import { aggregatePipSystemDraws, mapRowToPipCategory, pipAssignmentFromDraws } from "./fittingPipPower.ts";

function shieldRow(): PortBreakdownRow {
  return {
    shipKey: "ship",
    portId: "shield/main",
    portName: "Shield Generator",
    portType: "Shield",
    portSubtype: null,
    portCategory: "shield",
    ruleCategory: "shield",
    parentPortId: null,
    childPortIds: [],
    equippedComponentKey: "shield-component",
    equippedComponentName: "AllStop",
    componentCategory: "shield",
    componentManufacturer: null,
    componentSize: 1,
    portExactSize: 1,
    portMinSize: 1,
    portMaxSize: 1,
    componentSubtype: null,
    compatibilityStatus: null,
    editable: true,
    bespoke: false,
    locked: false,
    warnings: [],
    confidence: "high",
  };
}

test("maps extracted shield power demand into the shields allocation channel", () => {
  const row = shieldRow();
  assert.equal(mapRowToPipCategory(row, []), "shields");

  const draws = aggregatePipSystemDraws([row], {
    "shield-component": { powerDraw: 3 },
  });
  assert.equal(draws.shields, 3);
  assert.equal(pipAssignmentFromDraws(draws).shields, 3);
});
