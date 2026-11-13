import assert from "node:assert/strict";
import test from "node:test";
import { buildRackPayloadPatch } from "./fittingRackPayload";
import type { FittingComponentSummary } from "./fittingApi";
import type { PortBreakdownRow } from "./fittingPortGrouping";
import type { SlotCompatibilityIndex } from "./fittingSlotCompatibility";

const item: FittingComponentSummary = { id: "torpedo-a", name: "Torpedo A", displayName: "Torpedo A", manufacturer: null, type: "missile", subtype: "Torpedo", size: 5, grade: "A", class: "military", confidence: "high" };
const row = (portId: string): PortBreakdownRow => ({ shipKey: "perseus", portId, portName: null, portType: "Missile", portSubtype: "Torpedo", portCategory: null, ruleCategory: null, parentPortId: "rack-left", childPortIds: [], equippedComponentKey: null, equippedComponentName: null, componentCategory: null, componentManufacturer: null, componentSize: 5, portExactSize: 5, portMinSize: 5, portMaxSize: 5, componentSubtype: null, compatibilityStatus: "known", editable: true, bespoke: false, locked: false, confidence: "high" });
const index = (portId: string, status: SlotCompatibilityIndex["status"] = "known"): SlotCompatibilityIndex => ({ portId, status, constraint: { type: "Missile", subtype: "Torpedo", minSize: 5, maxSize: 5, exactSize: 5, editable: true, bespoke: false }, compatibleComponentIds: new Set(["torpedo-a"]), unavailableReason: null });

test("rack payload patch validates every direct payload child before returning a patch", () => {
  const rows = [row("left/1"), row("left/2")];
  const result = buildRackPayloadPatch({ portIds: rows.map((entry) => entry.portId), item, rows, compatibilityIndexes: { "left/1": index("left/1"), "left/2": index("left/2") } });
  assert.deepEqual(result, { ok: true, componentId: "torpedo-a", patch: { "left/1": "torpedo-a", "left/2": "torpedo-a" } });
});

test("rack payload patch aborts without a partial patch when one child rejects the candidate", () => {
  const rows = [row("left/1"), row("left/2")];
  const result = buildRackPayloadPatch({ portIds: rows.map((entry) => entry.portId), item, rows, compatibilityIndexes: { "left/1": index("left/1"), "left/2": index("left/2", "none") } });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.reason, /No compatible items|compatible/i);
});
