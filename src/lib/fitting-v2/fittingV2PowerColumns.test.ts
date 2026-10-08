import assert from "node:assert/strict";
import test from "node:test";
import type { PortBreakdownRow } from "../fitting/fittingPortGrouping";
import { buildFittingV2PowerColumns } from "./fittingV2PowerColumns";
import type { FittingComponentAllocation } from "../fitting/fittingApi";

function row(portId: string, componentCategory: string, name = portId): PortBreakdownRow {
  return {
    shipKey: "ship", portId, portName: name, portType: componentCategory, portSubtype: null,
    portCategory: componentCategory, ruleCategory: componentCategory, parentPortId: null, childPortIds: [],
    equippedComponentKey: `${portId}-component`, equippedComponentName: name, componentCategory,
    componentManufacturer: null, componentSize: 1, portExactSize: 1, portMinSize: 1, portMaxSize: 1,
    componentSubtype: null, compatibilityStatus: null, editable: true, bespoke: false, locked: false,
    warnings: [], confidence: null,
  };
}

test("power columns are installed-component aware and keep physical coolers separate", () => {
  const columns = buildFittingV2PowerColumns([
    row("weapon", "ship_weapon"), row("quantum", "quantum_drive"),
    row("cooler-b", "cooler"), row("cooler-a", "cooler"),
  ]);
  assert.deepEqual(columns.map((column) => column.key), ["weapons", "quantum", "cooler1", "cooler2"]);
});

test("QED and EMP are conditional and ordered between Quantum and Radar", () => {
  const columns = buildFittingV2PowerColumns([
    row("radar", "radar"), row("emp", "utility", "EMP device"), row("quantum", "quantum_drive"), row("qed", "utility", "QED dampener"),
  ]);
  assert.deepEqual(columns.map((column) => column.icon), ["quantum", "emp", "qed", "radar"]);
  assert.ok(columns.filter((column) => column.icon === "emp" || column.icon === "qed").every((column) => column.category === null));
});

test("multiple installed shields remain separate unavailable physical columns when distribution is unresolved", () => {
  const columns = buildFittingV2PowerColumns([row("shield-left", "shield"), row("shield-right", "shield")]);
  assert.deepEqual(columns.map((column) => column.label), ["Shield 1", "Shield 2"]);
  assert.ok(columns.every((column) => column.unavailableReason?.includes("distribution is unresolved")));
});

test("physical allocation contract preserves six shields, separate coolers, radar, and unsupported identity", () => {
  const rows = [
    ...Array.from({ length: 6 }, (_, index) => row(`shield-${index + 1}`, "shield", `Shield ${index + 1}`)),
    row("cooler-a", "cooler"), row("cooler-b", "cooler"), row("radar-main", "radar"), row("thruster-main", "thruster"),
  ];
  const allocations: FittingComponentAllocation[] = rows.map((entry) => ({
    portId: entry.portId, componentKey: entry.equippedComponentKey, componentType: entry.componentCategory!, displayName: entry.equippedComponentName,
    allocationStatus: ["shield", "cooler", "radar"].includes(entry.componentCategory!) ? "supported" : "unsupported",
    allocationReason: ["shield", "cooler", "radar"].includes(entry.componentCategory!) ? null : "component_family_not_segment_addressable",
    segmentAllocationSupported: ["shield", "cooler", "radar"].includes(entry.componentCategory!), minimumSegments: 1, maximumSegments: 6,
    powerRanges: [], provenance: {}, shieldHP: entry.componentCategory === "shield" ? 100 : undefined, regenRate: entry.componentCategory === "shield" ? 10 : undefined,
  }));
  const columns = buildFittingV2PowerColumns(rows, undefined, allocations);
  assert.equal(columns.filter((column) => column.icon === "shields").length, 6);
  assert.equal(columns.filter((column) => column.icon === "cooler").length, 2);
  assert.equal(columns.filter((column) => column.icon === "radar").length, 1);
  const unsupported = columns.find((column) => column.portId === "thruster-main");
  assert.equal(unsupported?.category, null);
  assert.match(unsupported?.unavailableReason ?? "", /not_segment_addressable/);
});
