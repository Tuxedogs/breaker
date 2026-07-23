import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";

import FittingMockupShell from "../components/fitting/mockup/FittingMockupShell";
import PowerCardContent from "../components/fitting/mockup/PowerCardContent";
import { ComponentStatsDrawer } from "./FittingMockupPage";
import { getFittingSlotIcon } from "../lib/fitting/getFittingSlotIcon";
import type {
  FittingComponentDetail,
  FittingSimulationMetric,
  FittingSimulationResult,
  FittingWeaponSimulationResult,
} from "../lib/fitting/fittingApi";
import { buildResourceSummary } from "../lib/fitting/mockup/fittingMockupAdapters";
import type {
  EquipmentRowTone,
  StatCardView,
  SystemsGroupView,
  TopBarView,
} from "../lib/fitting/mockup/fittingMockupViewTypes";
import {
  DEFAULT_PIP_ASSIGNMENT,
  type PipAssignment,
  type PipCategory,
} from "../lib/fitting/fittingTerminalTypes";
import type { FittingSimulationState } from "../lib/fitting/useFittingSimulation";

const FIXTURE_PATH = "/fitting/__fixture";

type FixtureScenarioKey =
  | "energy-complete"
  | "ballistic"
  | "power-overload"
  | "missing-data"
  | "api-error";

type FixtureScenario = {
  key: FixtureScenarioKey;
  label: string;
  simulation: FittingSimulationState;
  assignment: PipAssignment;
  fittingValid: boolean;
  offensiveSubtitle: string;
  weaponName: string;
  statCards: Omit<StatCardView, "content">[];
};

function metric(value: number | null, formula: string | null = null): FittingSimulationMetric {
  return {
    value,
    provenance: value == null ? "unavailable" : "derived",
    formula: value == null ? null : formula,
    sources: [],
  };
}

function simulationState(input: {
  capacity: number | null;
  allocated: number | null;
  coolingCapacity: number | null;
  coolingDemand: number | null;
  dps: number | null;
  damage: number | null;
  shieldRegen?: number | null;
  error?: string | null;
  missingReason?: string;
}): FittingSimulationState {
  if (input.error) return { data: null, loading: false, error: input.error };
  const utilization = input.coolingCapacity != null
    && input.coolingDemand != null
    && input.coolingCapacity > 0
    ? input.coolingDemand / input.coolingCapacity * 100
    : null;
  const result: FittingSimulationResult = {
    modelVersion: "fitting-simulation-v1",
    durationSeconds: 60,
    power: {
      capacitySegments: metric(input.capacity, "sum(power capacity)"),
      weaponPoolCapacitySegments: metric(
        input.capacity == null ? null : 4,
        "fixture Foundry WeaponGun FixedPowerPool poolSize",
      ),
      allocatedSegments: metric(input.allocated, "sum(effective allocations)"),
      marginSegments: metric(
        input.capacity != null && input.allocated != null ? input.capacity - input.allocated : null,
        "capacity - allocated",
      ),
      allocatedByCategory: { ...DEFAULT_PIP_ASSIGNMENT },
    },
    cooling: {
      capacity: metric(input.coolingCapacity, "sum(cooler capacity)"),
      demand: metric(input.coolingDemand, "effective allocated demand"),
      utilizationPercent: metric(utilization, "demand / capacity * 100"),
    },
    shields: {
      maxRegenPerSecond: metric(1_204, "sum(active shield maximum regeneration)"),
      effectiveRegenPerSecond: metric(input.shieldRegen ?? null, "exact extracted shield regeneration at assigned allocation"),
    },
    weapons: [],
    weaponsSummary: {
      simulatedWeaponCount: metric(input.dps == null ? null : 3, "count(simulated weapons)"),
      totalDamage: metric(input.damage, "sum(weapon damage over 60 seconds)"),
      dps: metric(input.dps, "total damage / 60"),
    },
    provenance: { directInputs: [], derivedModel: "fitting-simulation-v1" },
    assumptions: [],
    missingInputs: input.missingReason
      ? [{ componentId: null, mountId: null, path: "powerAllocation", reason: input.missingReason }]
      : [],
  };
  return { data: result, loading: false, error: null };
}

function assignment(values: Partial<PipAssignment>): PipAssignment {
  return { ...DEFAULT_PIP_ASSIGNMENT, ...values };
}

function combatCard(rows: Array<{ label: string; value: string; tone?: "default" | "accent" | "muted" }>): StatCardView {
  return {
    key: "performance",
    title: "Ship Performance",
    sections: [{ title: "Combat", rows }],
  };
}

function commonCards(effectiveShieldRegen: string): Omit<StatCardView, "content">[] {
  const effectiveShieldRegenAvailable = !effectiveShieldRegen.startsWith("Unavailable");
  return [
  {
    key: "survivability",
    title: "Survivability",
    rows: [
      { label: "Vital HP", value: "2,134 HP", tone: "accent" },
      { label: "Total HP", value: "8,470 HP" },
      { label: "Armor HP", value: "Source unavailable", tone: "muted" },
      { label: "Shield HP", value: "6,336 HP", tone: "accent" },
      {
        label: "Shield Regen @ Allocation",
        value: effectiveShieldRegen,
        tone: effectiveShieldRegenAvailable ? "accent" : "muted",
      },
      { label: "Max Shield Regen", value: "1,204/s" },
    ],
  },
  {
    key: "signatures",
    title: "Signatures & Detection",
    rows: [
      { label: "Signature Sensitivity", value: "1", tone: "accent" },
      { label: "EM / IR Emissions", value: "Missing operational-state aggregation", tone: "muted" },
      { label: "Cross Section", value: "Source unavailable", tone: "muted" },
      { label: "Radar Range", value: "Requires target signature", tone: "muted" },
    ],
  },
  {
    key: "mobility",
    title: "Mobility",
    rows: [
      { label: "SCM / AB", value: "226 / 520 m/s", tone: "accent" },
      { label: "Nav Max", value: "1,193 m/s" },
      { label: "Boost Cap / Regen", value: "20 / 0.75" },
    ],
    sections: [{
      title: "P / Y / R Rates",
      rows: [],
      miniGrid: {
        columns: ["Normal", "Boosted"],
        rows: [
          { label: "Pitch", values: ["77 °/s", "Source unavailable"] },
          { label: "Yaw", values: ["200 °/s", "Source unavailable"] },
          { label: "Roll", values: ["55 °/s", "Source unavailable"] },
        ],
      },
    }],
  },
  ];
}

const scenarios: Record<FixtureScenarioKey, FixtureScenario> = {
  "energy-complete": {
    key: "energy-complete",
    label: "Energy · Complete",
    simulation: simulationState({ capacity: 17, allocated: 13.2, coolingCapacity: 48, coolingDemand: 13.2, dps: 820.125, damage: 49_207.5, shieldRegen: 1_204 }),
    assignment: assignment({ weapons: 6, shields: 6, cooler1: 1, cooler2: 1 }),
    fittingValid: true,
    offensiveSubtitle: "Energy Cannon",
    weaponName: "S3 Quarreler Cannon",
    statCards: [
      combatCard([
        { label: "Sustained DPS (60s)", value: "820.1", tone: "accent" },
        { label: "Damage over 60s", value: "49,207.5 dmg" },
        { label: "Burst Alpha", value: "656.1" },
        { label: "Pilot Alpha", value: "656.1" },
      ]),
      ...commonCards("1,204/s"),
    ],
  },
  ballistic: {
    key: "ballistic",
    label: "Ballistic Reserve",
    simulation: simulationState({ capacity: 17, allocated: 12, coolingCapacity: 48, coolingDemand: 12, dps: 301.5, damage: 18_090, shieldRegen: 602 }),
    assignment: assignment({ weapons: 3, quantum: 2, radar: 1, shields: 3, cooler1: 1, cooler2: 1 }),
    fittingValid: true,
    offensiveSubtitle: "Ballistic Gatling",
    weaponName: "S3 Mantis GT-220 Gatling",
    statCards: [
      combatCard([
        { label: "Sustained DPS (60s)", value: "301.5", tone: "accent" },
        { label: "Damage over 60s", value: "18,090 dmg" },
        { label: "Reserve exhausted", value: "42.6 s" },
        { label: "Reloads", value: "Not applicable", tone: "muted" },
      ]),
      ...commonCards("602/s"),
    ],
  },
  "power-overload": {
    key: "power-overload",
    label: "Power Overload",
    simulation: simulationState({ capacity: 17, allocated: 22, coolingCapacity: 48, coolingDemand: 22, dps: null, damage: null }),
    assignment: assignment({ weapons: 6, engines: 3, quantum: 2, radar: 1, shields: 6, cooler1: 2, cooler2: 2 }),
    fittingValid: false,
    offensiveSubtitle: "Energy Cannon",
    weaponName: "S3 Quarreler Cannon",
    statCards: [
      combatCard([
        { label: "Sustained DPS (60s)", value: "Unavailable · allocation exceeds capacity", tone: "muted" },
        { label: "Damage over 60s", value: "Unavailable", tone: "muted" },
        { label: "Requested allocation", value: "22 segments" },
        { label: "Reactor capacity", value: "17 segments" },
      ]),
      ...commonCards("Unavailable · allocation exceeds capacity"),
    ],
  },
  "missing-data": {
    key: "missing-data",
    label: "Missing Inputs",
    simulation: simulationState({
      capacity: 17,
      allocated: null,
      coolingCapacity: 48,
      coolingDemand: null,
      dps: null,
      damage: null,
      missingReason: "A powered component has no extracted allocation category.",
    }),
    assignment: assignment({ weapons: 3, shields: 3, cooler1: 1, cooler2: 1 }),
    fittingValid: false,
    offensiveSubtitle: "Energy Cannon",
    weaponName: "S3 Quarreler Cannon",
    statCards: [
      combatCard([
        { label: "Sustained DPS (60s)", value: "Unavailable · missing power category", tone: "muted" },
        { label: "Damage over 60s", value: "Unavailable", tone: "muted" },
        { label: "Heat interruptions", value: "Missing thermal dependencies", tone: "muted" },
        { label: "Available direct alpha", value: "656.1" },
      ]),
      ...commonCards("Unavailable · missing allocation rule"),
    ],
  },
  "api-error": {
    key: "api-error",
    label: "API Error",
    simulation: simulationState({ capacity: null, allocated: null, coolingCapacity: null, coolingDemand: null, dps: null, damage: null, error: "Fixture API request failed." }),
    assignment: assignment({}),
    fittingValid: false,
    offensiveSubtitle: "Source unavailable",
    weaponName: "Component data unavailable",
    statCards: [
      combatCard([
        { label: "Sustained DPS (60s)", value: "Simulation unavailable", tone: "muted" },
        { label: "Damage over 60s", value: "Simulation unavailable", tone: "muted" },
      ]),
      ...commonCards("Unavailable · API error"),
    ],
  },
};

const fixtureQuarrelerDetail: FittingComponentDetail = {
  id: "cfacea3e-afbc-405c-b220-2d1d3b6e20b1",
  name: "KRIG_LaserCannon_S3",
  displayName: "Quarreler Cannon",
  manufacturer: "Kruger Intergalactic",
  type: "ship_weapon",
  subtype: "LaserCannon",
  size: 3,
  grade: null,
  class: null,
  confidence: "high",
  stats: {
    alphaDamage: 218.7,
    damageEnergy: 218.7,
    theoreticalDps: 546.75,
    fireRateRpm: 150,
    projectileSpeed: 1_184,
    calculatedRange: 2_403.52,
    maxAmmoLoad: 25,
    ammoCostPerShot: 1,
    maxRegenPerSec: 3,
    regenerationCooldown: 1.76,
    heatPerShot: 0,
    spreadMin: 0.45,
    spreadMax: 0.45,
    spreadFirstAttack: 0.025,
    spreadPerAttack: 0.025,
    spreadDecay: 0.05,
    powerInputMaximum: 1.73,
    powerInputMinimum: 0,
    emSignatureNominal: 649,
    emSignatureDecayRate: 0.15,
    selfRepairMaxCount: 1,
    selfRepairTime: 48,
    selfRepairHealthRatio: 0.2,
    selfRepairBaselineHp: 570,
    repairRestoreRatio: 0.1,
    health: 2_850,
  },
  mitigation: {
    kind: "weapon_projectile",
    damage: { physical: 0, energy: 218.7, distortion: 0, thermal: 0, biochemical: 0, stun: 0 },
    ammoPenetration: null,
    basePenetrationDistance: 0.22,
    maxPenetrationThickness: null,
    penetrationParams: null,
  },
};

const fixtureQuarrelerSimulation: FittingWeaponSimulationResult = {
  componentId: fixtureQuarrelerDetail.id,
  mountId: "weapon-1",
  mountTopology: "pilot",
  ammunitionModel: "energy",
  allocationRatio: metric(1, "assigned weapon segments / summed nominal demand"),
  effectiveAmmo: metric(25, "round(maxAmmoLoad * allocationRatio)"),
  effectiveRegenPerSecond: metric(3, "maxRegenPerSecond * allocationRatio"),
  capacitorFillTimeSeconds: metric(25 / 3, "effectiveAmmo / effectiveRegenPerSecond"),
  capacitorFullRechargeTimeSeconds: metric(1.76 + 25 / 3, "regen cooldown + capacitor fill"),
  triggerTimeSeconds: metric(30, "sum active firing intervals inside 60 seconds"),
  maxShotsBeforeOverheat: metric(null),
  overheatInterruptions: metric(0, "heatPerShot is zero"),
  overheatTimeSeconds: metric(0, "heatPerShot is zero"),
  shotsFired: metric(75, "count shot timestamps inside 60 seconds"),
  damage: metric(16_402.5, "shotsFired * alphaDamage"),
  dps: metric(273.375, "damage / 60"),
  completeMagazinesFired: 3,
  magazineStartTimesSeconds: [0, 20.093, 40.187],
  directInputs: [],
  assumptions: ["Fixture mirrors the source-backed Quarreler pilot-capacitor model."],
  missingInputs: [],
};

function equipmentRow(input: {
  id: string;
  title: string;
  subtitle: string;
  tone: EquipmentRowTone;
  selected: boolean;
  slotKind: string;
}) {
  return {
    id: input.id,
    iconSrc: getFittingSlotIcon({ componentType: input.slotKind, slotKind: input.slotKind }),
    quantity: "1×",
    title: input.title,
    subtitle: input.subtitle,
    tag: input.slotKind === "ship_weapon" ? "Pilot" : null,
    tone: input.tone,
    selected: input.selected,
  };
}

export default function FittingFixturePage() {
  const navigate = useNavigate();
  const { scenario: scenarioParam } = useParams();
  const scenarioKey = scenarioParam && scenarioParam in scenarios
    ? scenarioParam as FixtureScenarioKey
    : "energy-complete";
  const scenario = scenarios[scenarioKey];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pipState, setPipState] = useState<{ scenario: FixtureScenarioKey; assignment: PipAssignment }>({
    scenario: scenario.key,
    assignment: scenario.assignment,
  });
  const activeAssignment = pipState.scenario === scenario.key ? pipState.assignment : scenario.assignment;

  if (!import.meta.env.DEV) return <Navigate to="/fitting" replace />;

  const offensiveGroups: SystemsGroupView[] = [
    {
      key: "pilot-weapons",
      label: "Pilot Weapons",
      count: 3,
      rows: Array.from({ length: 3 }, (_, index) => equipmentRow({
        id: `weapon-${index + 1}`,
        title: scenario.weaponName,
        subtitle: scenario.offensiveSubtitle,
        tone: "pilot",
        selected: selectedId === `weapon-${index + 1}`,
        slotKind: "ship_weapon",
      })),
    },
    {
      key: "rockets",
      label: "Rockets",
      count: 2,
      rows: Array.from({ length: 2 }, (_, index) => equipmentRow({
        id: `rocket-${index + 1}`,
        title: "S3 Jericho XL Rocket Pod",
        subtitle: "Rocket · 18 rounds · 45 DPS over 60s",
        tone: "pilot",
        selected: selectedId === `rocket-${index + 1}`,
        slotKind: "ship_weapon",
      })),
    },
    {
      key: "bombs",
      label: "Bombs",
      count: 1,
      rows: [equipmentRow({
        id: "bomb-1",
        title: "S5 A2 Hercules Bomb",
        subtitle: "Bomb · 46,702 payload damage",
        tone: "missile",
        selected: selectedId === "bomb-1",
        slotKind: "bomb",
      })],
    },
  ];
  const defensiveGroups: SystemsGroupView[] = [
    {
      key: "shields",
      label: "Shields",
      count: 2,
      rows: [equipmentRow({ id: "shield-1", title: "S1 AllStop", subtitle: "Shield", tone: "shield", selected: selectedId === "shield-1", slotKind: "shield" })],
    },
    {
      key: "support",
      label: "Support Systems",
      count: 3,
      rows: [
        equipmentRow({ id: "power-1", title: "S1 JS-300", subtitle: "Power Plant", tone: "power", selected: selectedId === "power-1", slotKind: "power_plant" }),
        equipmentRow({ id: "cooler-1", title: "S1 SnowBlind", subtitle: "Cooler", tone: "support", selected: selectedId === "cooler-1", slotKind: "cooler" }),
        equipmentRow({ id: "radar-1", title: "S1 Ecouter", subtitle: "Radar", tone: "support", selected: selectedId === "radar-1", slotKind: "radar" }),
      ],
    },
  ];

  const topBar: TopBarView = {
    manufacturer: "Aegis",
    shipName: "Aegis Gladius",
    roleLine: `Development fixture · ${scenario.label}`,
    activeTab: "Overview",
    tabs: ["Overview"],
    ships: Object.values(scenarios).map((entry) => ({ shipKey: entry.key, name: entry.label })),
    selectedShipKey: scenario.key,
    shipsLoading: false,
    isModified: false,
  };

  const statCards: StatCardView[] = [
    scenario.statCards[0]!,
    {
      key: "power",
      title: "",
      content: (
        <PowerCardContent
          pipAssignment={activeAssignment}
          simulation={scenario.simulation}
          onPipChange={(category: PipCategory, value: number) => {
            setPipState((current) => ({
              scenario: scenario.key,
              assignment: { ...(current.scenario === scenario.key ? current.assignment : scenario.assignment), [category]: value },
            }));
          }}
        />
      ),
    },
    ...scenario.statCards.slice(1),
  ];

  return (
    <FittingMockupShell
      topBar={topBar}
      offensiveGroups={offensiveGroups}
      defensiveGroups={defensiveGroups}
      heroAsset={{ candidates: [{ src: "/ships/wiki/gladius.jpg", alt: "Aegis Gladius fixture" }], fallback: "silhouette" }}
      heroInspect={{
        slotTitle: selectedId,
        itemName: selectedId ? [...offensiveGroups, ...defensiveGroups].flatMap((group) => group.rows).find((row) => row.id === selectedId)?.title ?? null : null,
        pilotTag: selectedId?.startsWith("weapon") ? "Pilot" : null,
        meta: selectedId ? "Development fixture component" : null,
        selectorOpen: false,
      }}
      statCards={statCards}
      resourceSummary={buildResourceSummary(scenario.simulation, scenario.fittingValid)}
      errorMessage={scenario.key === "api-error" ? "Fixture API failure: the fitting page remains usable and reports unavailable values." : null}
      debugNode={<div className="fm-fixture-banner">Development fixture · static expected response</div>}
      selectedDetail={selectedId?.startsWith("weapon") ? (
        <div className="fm-selected-detail is-open">
          <ComponentStatsDrawer
            detail={fixtureQuarrelerDetail}
            loading={false}
            weaponSimulation={fixtureQuarrelerSimulation}
            simulationLoading={false}
          />
        </div>
      ) : selectedId ? <div className="fm-fixture-selected">Selected fixture component: {selectedId}</div> : null}
      onSelectShip={(key) => {
        setSelectedId(null);
        const next = scenarios[key as FixtureScenarioKey];
        if (next) setPipState({ scenario: next.key, assignment: next.assignment });
        navigate(`${FIXTURE_PATH}/${key}`);
      }}
      onSelectOffensiveRow={setSelectedId}
      onSelectDefensiveRow={setSelectedId}
      onExitInspect={() => setSelectedId(null)}
      onViewHeroDetails={() => undefined}
    />
  );
}
