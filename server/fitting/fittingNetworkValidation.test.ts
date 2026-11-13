import assert from "node:assert/strict";
import test from "node:test";

import { handleFittingRoute } from "../routes/fitting.routes.ts";

/**
 * Phase 5 validation of the fitting resource network against the published
 * LIVE fitting build, pinned so the expectations stay deterministic when the
 * fitting pointer moves. These tests add no simulation rules; they prove how
 * the existing engine allocates, reacts to configuration changes, and reports
 * data it cannot derive.
 */

const BUILD = "channel=LIVE&buildId=4.10.191.2241-12519617-scintel.12";
const SHIPS = {
  gladius: "b6b59889-7226-458e-a6b0-1c9392128a3c",
  avengerTitan: "0079c5d5-1678-4f8c-85ba-18ca8f642af6",
  cutlassBlack: "b58f7735-9454-4a0a-b724-2bc8d61961d7",
  constellationAndromeda: "d95fb013-60d5-43ac-ab2d-daa082f45411",
  hammerhead: "d46f4de1-8dc1-473b-9739-88c9ba7e75a6",
  freelancerMax: "6c6e9731-3d70-4f1b-84c2-9dbf3c1f97c7",
} as const;

type Allocation = Record<"weapons" | "engines" | "quantum" | "radar" | "shields" | "lifeSupport" | "cooler1" | "cooler2", number>;
type Metric = { value: number | null; provenance: "derived" | "unavailable"; formula: string | null; sources: unknown[] };
type Simulation = {
  power: {
    capacitySegments: Metric;
    weaponPoolCapacitySegments: Metric;
    allocatedSegments: Metric;
    marginSegments: Metric;
    categories: Record<string, { addressability: string; componentCount: number }>;
  };
  cooling: { capacity: Metric; demand: Metric };
  shields: { effectiveRegenPerSecond: Metric };
  weapons: Array<{ componentId: string; mountId: string | null; mountTopology: string | null; dps: Metric; missingInputs: Array<{ path: string; reason: string }> }>;
  weaponsSummary: { simulatedWeaponCount: Metric; dps: Metric };
  missingInputs: Array<{ path: string; reason: string }>;
};

const NOMINAL: Allocation = { weapons: 2, engines: 0, quantum: 0, radar: 1, shields: 0, lifeSupport: 0, cooler1: 2, cooler2: 2 };

const hardpointPortsCache = new Map<string, Set<string>>();
async function hardpointPorts(shipId: string): Promise<Set<string>> {
  const cached = hardpointPortsCache.get(shipId);
  if (cached) return cached;
  const result = await handleFittingRoute("GET", `/api/v1/fitting/ships/${shipId}/hardpoints?${BUILD}`, "phase5");
  assert.equal(result?.status, 200);
  const ports = new Set<string>();
  const visit = (nodes: unknown): void => {
    if (!Array.isArray(nodes)) return;
    for (const node of nodes as Array<Record<string, unknown>>) {
      const id = node.portId ?? node.id;
      if (typeof id === "string") ports.add(id);
      visit(node.children);
    }
  };
  const data = (result?.body as { data: unknown }).data as Record<string, unknown> | unknown[];
  visit(Array.isArray(data) ? data : (data as Record<string, unknown>).tree ?? (data as Record<string, unknown>).hardpoints ?? (data as Record<string, unknown>).ports);
  hardpointPortsCache.set(shipId, ports);
  return ports;
}

/** The stock loadout restricted to the simulation hardpoint tree, as the Fitting UI sends it. */
async function stockLoadout(shipId: string): Promise<Record<string, string>> {
  const result = await handleFittingRoute("GET", `/api/v1/fitting/ships/${shipId}/loadout?${BUILD}`, "phase5");
  assert.equal(result?.status, 200);
  const entries = (result?.body as { data: { entries: Array<{ portId: string; componentId: string | null }> } }).data.entries;
  const ports = await hardpointPorts(shipId);
  return Object.fromEntries(entries.filter((e) => e.componentId && ports.has(e.portId)).map((e) => [e.portId, e.componentId as string]));
}

async function simulate(shipId: string, loadout: Record<string, string | null>, allocation: Allocation): Promise<Simulation> {
  const result = await handleFittingRoute("POST", `/api/v1/fitting/calculate?${BUILD}`, "phase5", undefined, {
    shipId,
    loadout,
    options: { compareToStock: false },
    simulation: { modelVersion: "fitting-simulation-v1", durationSeconds: 60, powerAllocation: allocation },
  });
  assert.equal(result?.status, 200, JSON.stringify(result?.body).slice(0, 300));
  return (result?.body as { data: { simulation: Simulation } }).data.simulation;
}

function metrics(value: unknown, out: Metric[] = []): Metric[] {
  if (!value || typeof value !== "object") return out;
  const record = value as Record<string, unknown>;
  if ("provenance" in record && "value" in record && "sources" in record) {
    out.push(record as unknown as Metric);
    return out;
  }
  for (const child of Object.values(record)) metrics(child, out);
  return out;
}

test("every reported metric is either derived from sources or explicitly unavailable, never invented", async () => {
  for (const shipId of Object.values(SHIPS)) {
    const sim = await simulate(shipId, await stockLoadout(shipId), NOMINAL);
    for (const metric of metrics(sim)) {
      if (metric.provenance === "unavailable") assert.equal(metric.value, null, `${shipId}: unavailable metric carries a value`);
      else {
        assert.equal(metric.provenance, "derived");
        assert.ok(typeof metric.value === "number" && Number.isFinite(metric.value), `${shipId}: derived metric is not finite`);
        assert.ok(metric.sources.length > 0 || metric.formula, `${shipId}: derived metric has neither sources nor formula`);
      }
    }
    for (const missing of sim.missingInputs) assert.ok(missing.reason.length > 0, `${shipId}: missing input without a reason`);
  }
});

test("Gladius allocates its single-pool network within reactor capacity at nominal weapon demand", async () => {
  const sim = await simulate(SHIPS.gladius, await stockLoadout(SHIPS.gladius), NOMINAL);
  assert.equal(sim.power.capacitySegments.value, 16);
  assert.equal(sim.power.weaponPoolCapacitySegments.value, 4);
  assert.ok((sim.power.allocatedSegments.value ?? Infinity) <= 16);
  assert.equal(sim.power.marginSegments.value, 16 - (sim.power.allocatedSegments.value ?? 0));
  assert.equal(sim.weapons.length, 3);
  assert.ok(sim.weapons.every((weapon) => weapon.mountTopology === "pilot"));
  assert.equal(sim.weaponsSummary.dps.provenance, "derived");
  assert.ok((sim.weaponsSummary.dps.value ?? 0) > 0);
  assert.equal(sim.power.categories.lifeSupport?.addressability, "no-component-installed");
  assert.equal(sim.power.categories.engines?.addressability, "bounds-unavailable");
  assert.equal(sim.power.categories.quantum?.addressability, "non-pip-unit");
});

test("allocating weapons above nominal demand is reported, not extrapolated", async () => {
  // Gladius stock weapons have a nominal demand of 2 pips; 3 is above nominal.
  const sim = await simulate(SHIPS.gladius, await stockLoadout(SHIPS.gladius), { ...NOMINAL, weapons: 3 });
  assert.equal(sim.weaponsSummary.dps.value, null);
  assert.equal(sim.weaponsSummary.dps.provenance, "unavailable");
  assert.ok(sim.missingInputs.some((m) => m.path === "powerAllocation" && /exceeds nominal demand/.test(m.reason)));
});

test("removing a weapon changes the network and derived statistics deterministically", async () => {
  // Both configurations use the same one-pip weapon allocation, so only the hardware differs.
  const loadout = await stockLoadout(SHIPS.gladius);
  const sameAllocation = { ...NOMINAL, weapons: 1 };
  const full = await simulate(SHIPS.gladius, loadout, sameAllocation);
  const dps = (sim: Simulation) => sim.weapons.map((weapon) => Math.round((weapon.dps.value ?? Number.NaN) * 10) / 10);
  // Stock: the nose gun stays offline below its extracted minimum power input;
  // the two wing guns share the pool.
  assert.deepEqual(dps(full), [0, 183.3, 183.3]);
  assert.equal(Math.round((full.weaponsSummary.dps.value ?? 0) * 100) / 100, 366.66);

  const removedPort = "hardpoint_gun_nose/hardpoint_class_2";
  assert.ok(removedPort in loadout);
  const reduced = await simulate(SHIPS.gladius, { ...loadout, [removedPort]: null }, sameAllocation);
  assert.equal(reduced.weapons.length, full.weapons.length - 1);
  assert.equal(reduced.power.categories.weapons?.componentCount, (full.power.categories.weapons?.componentCount ?? 0) - 1);
  // Without the nose consumer the remaining guns receive more of the same pool.
  assert.deepEqual(dps(reduced), [193.5, 193.5]);
  assert.equal(reduced.weaponsSummary.dps.provenance, "derived");
  assert.equal(Math.round((reduced.weaponsSummary.dps.value ?? 0) * 100) / 100, 387.03);

  const again = await simulate(SHIPS.gladius, { ...loadout, [removedPort]: null }, sameAllocation);
  assert.deepEqual(again, reduced, "identical requests produce identical results");
});

test("a zero power margin is reported as zero, distinct from missing", async () => {
  const sim = await simulate(SHIPS.avengerTitan, await stockLoadout(SHIPS.avengerTitan), {
    weapons: 4, engines: 2, quantum: 0, radar: 1, shields: 3, lifeSupport: 1, cooler1: 2, cooler2: 2,
  });
  assert.equal(sim.power.capacitySegments.value, 15);
  assert.equal(sim.power.allocatedSegments.value, 15);
  assert.equal(sim.power.marginSegments.value, 0);
  assert.equal(sim.power.marginSegments.provenance, "derived");
});

test("turret mounts are identified from port ancestry and never reuse pilot capacitor values", async () => {
  for (const [name, shipId, expectTurrets] of [
    ["Cutlass Black", SHIPS.cutlassBlack, 2],
    ["Constellation Andromeda", SHIPS.constellationAndromeda, 4],
    ["Hammerhead", SHIPS.hammerhead, 24],
    ["Freelancer MAX", SHIPS.freelancerMax, 6],
  ] as const) {
    const sim = await simulate(shipId, await stockLoadout(shipId), NOMINAL);
    const turrets = sim.weapons.filter((weapon) => weapon.mountTopology === "turret");
    assert.equal(turrets.length, expectTurrets, `${name} turret weapon count`);
    for (const weapon of turrets) {
      assert.equal(weapon.dps.value, null, `${name}: turret DPS must not be derived without the turret power-ratio multiplier`);
      assert.ok(weapon.missingInputs.some((m) => m.path.includes("powerRatioMultiplier")), `${name}: turret gap is named`);
    }
    // Ship-wide allocation depends on the same unextracted multiplier and stays unavailable.
    assert.equal(sim.power.allocatedSegments.provenance, "unavailable");
    assert.ok(sim.missingInputs.some((m) => m.path.includes("powerRatioMultiplier") || /reactor capacity is unavailable/i.test(m.reason)));
  }
});

test("simulation rejects ports outside the ship's hardpoint tree", async () => {
  const result = await handleFittingRoute("POST", `/api/v1/fitting/calculate?${BUILD}`, "phase5", undefined, {
    shipId: SHIPS.gladius,
    loadout: { not_a_real_port: "b6b59889-7226-458e-a6b0-1c9392128a3c" },
    options: { compareToStock: false },
    simulation: { modelVersion: "fitting-simulation-v1", durationSeconds: 60, powerAllocation: NOMINAL },
  });
  assert.equal(result?.status, 400);
});
