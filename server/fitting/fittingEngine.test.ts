import assert from "node:assert/strict";
import test from "node:test";
import { buildComponentAllocations, weaponFixedPowerPool } from "./fittingEngine.ts";

test("extracts the F7A Mk II WeaponGun FixedPowerPool maximum of six", () => {
  const result = weaponFixedPowerPool({
    resourceNetworkPowerPools: { fixed: [{ itemType: "WeaponGun", poolSize: 6 }] },
  });
  assert.equal(result?.value, 6);
});

test("extracts the F7C-M Super Hornet Mk II WeaponGun FixedPowerPool maximum of four", () => {
  const result = weaponFixedPowerPool({
    resourceNetworkPowerPools: { fixed: [{ itemType: "WeaponGun", poolSize: 4 }] },
  });
  assert.equal(result?.value, 4);
});

test("copies canonical component allocation provenance and unsupported status without reclassification", () => {
  const rows = buildComponentAllocations([
    { portId: "radar/main", componentId: "radar", fallbackType: "radar", row: {
      componentType: "radar", componentAllocation: {
        allocationStatus: "supported", segmentAllocationSupported: true, minimumSegments: 1, maximumSegments: 5,
        powerRanges: [], provenance: { powerRanges: "SOURCE GAP" },
      },
    } },
    { portId: "thruster/main", componentId: "thruster", fallbackType: "thruster", row: {
      componentType: "thruster", componentAllocation: {
        allocationStatus: "unsupported", allocationReason: "component_family_not_segment_addressable", segmentAllocationSupported: false,
        minimumSegments: null, maximumSegments: null, powerRanges: [], provenance: { contract: "DIRECT SOURCE" },
      },
    } },
  ]);
  assert.equal(rows[0]?.allocationStatus, "supported");
  assert.equal((rows[0]?.provenance as Record<string, string>).powerRanges, "SOURCE GAP");
  assert.equal(rows[1]?.allocationStatus, "unsupported");
  assert.equal(rows[1]?.allocationReason, "component_family_not_segment_addressable");
});
