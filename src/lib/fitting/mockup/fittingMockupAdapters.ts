import type { ReactNode } from "react";
import { getShipThumbnailCandidates } from "../../../tools/alpha-threshold/lib/ships/thumbnail";
import { derivedNum, extractedNum, valueOrUnavailable } from "../../../components/fitting/terminal/fittingPerformanceHelpers";
import type { FittingCalculateResult, FittingComponentMitigation } from "../fittingApi";
import { getFittingSlotIcon, type FittingSlotIconInput } from "../getFittingSlotIcon";
import {
  buildMockupOffensiveDisplayGroups,
  buildMockupSupportGroups,
  mockupComponentTitle,
  supportTypeLabel,
} from "../fittingMockupGroups";
import type { MockupWeaponSelection } from "../fittingMockupTurretGroups";
import { aggregateWeaponRowDisplay } from "../fittingWeaponStats";
import {
  formatAlphaWithDps,
  formatCombatValue,
  type MockupCombatStats,
} from "../useFittingMockupCombatStats";
import { computeMockupHpSummary } from "../fittingMockupSelectors";
import {
  formatNumber,
  inferControlMode,
  type FittingShipSummary,
  type PortBreakdownRow,
} from "../fittingPortGrouping";
import type { FittingMockupLoadoutState } from "../useFittingMockupLoadout";
import {
  buildMockupResistanceTable,
  buildShieldThresholdReadout,
} from "./fittingMockupDefensiveStats";
import {
  deriveDisplayManufacturer,
  deriveManufacturerCode,
  deriveShipModelName,
  wikiSlugAssetCandidates,
} from "./fittingMockupShipResolve";
import type {
  EquipmentRowTone,
  EquipmentRowView,
  HeroInspectView,
  ResourceBlockView,
  ResourceSummaryView,
  ShipHeroAssetView,
  StatCardView,
  SystemsGroupView,
  TopBarView,
} from "./fittingMockupViewTypes";

function sumNullableDps(...values: Array<number | null | undefined>): number | null {
  const nums = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (nums.length === 0) return null;
  return nums.reduce((sum, value) => sum + value, 0);
}

function formatResourceMargin(mw: number | null, pct: number | null): string {
  if (mw != null && pct != null) return `${formatNumber(mw)} MW (${pct}%)`;
  if (pct != null) return `${pct}%`;
  return "—";
}

function offensiveRowTone(groupKey: string, index = 0): EquipmentRowTone {
  switch (groupKey) {
    case "pilot-weapons":
      return "pilot";
    case "remote-turrets":
    case "manned-turrets":
      return index === 1 ? "turret-alt" : index === 2 ? "turret-alt-2" : "turret";
    case "missiles":
    case "torpedoes":
      return "missile";
    case "emp-qed":
      return "emp";
    default:
      return "utility";
  }
}

function defensiveRowTone(row: PortBreakdownRow): EquipmentRowTone {
  const text = `${row.ruleCategory ?? ""} ${row.portCategory ?? ""} ${row.componentCategory ?? ""}`.toLowerCase();
  if (text.includes("shield")) return "shield";
  if (text.includes("armor")) return "armor";
  if (text.includes("power")) return "power";
  return "support";
}

function offenseRowAside(selection: MockupWeaponSelection): string | null {
  const mode = selection.summary.controlMode;
  if (!selection.isTurretGroup || !mode || mode === "Locked" || mode === "Bespoke") return null;
  return `PILOT: ${mode.toUpperCase()}`;
}

function offenseRowMeta(selection: MockupWeaponSelection): string | null {
  const { summary } = selection;
  if (selection.isTurretGroup) {
    if (summary.manufacturer) return summary.manufacturer;
    if (summary.name && summary.name !== summary.turretLabel) return summary.name;
    return summary.type;
  }
  return summary.manufacturer ?? summary.type;
}

function slotIconForSelection(
  selection: MockupWeaponSelection,
): string {
  const row = selection.childRows[0];
  return resolveFittingIcon({
    slotKind: selection.isTurretGroup
      ? selection.groupKey === "manned-turrets" ? "manned turret group" : "remote turret group"
      : "weapon hardpoint",
    componentType: row?.componentCategory ?? row?.ruleCategory ?? row?.portCategory,
    hardpointType: row?.portSubtype,
    turretControlType: selection.groupKey === "remote-turrets" ? "remote turret" : row ? inferControlMode(row) : null,
    itemType: row?.componentSubtype,
    portType: row?.portType,
  });
}

function slotIconForRow(row: PortBreakdownRow): string {
  return resolveFittingIcon({
    slotKind: undefined,
    componentType: row.componentCategory ?? row.ruleCategory ?? row.portCategory,
    hardpointType: row.portSubtype,
    turretControlType: inferControlMode(row),
    itemType: row.componentSubtype,
    portType: row.portType,
  });
}

export function resolveFittingIcon(input: FittingSlotIconInput): string {
  return getFittingSlotIcon(input);
}

export function resolveShipHeroAsset(ship: {
  shipKey: string | null;
  manufacturer: string | null;
  name: string;
}): ShipHeroAssetView {
  const manufacturerCode = deriveManufacturerCode(ship.manufacturer, ship.name);
  const modelName = deriveShipModelName(ship.name) || ship.name;

  const thumbnailCandidates = getShipThumbnailCandidates({
    id: ship.shipKey ?? ship.name,
    manufacturer: manufacturerCode,
    name: modelName,
  })
    .filter((candidate) => candidate.source !== "placeholder")
    .map((candidate) => ({ src: candidate.src, alt: candidate.alt }));

  const slugCandidates = wikiSlugAssetCandidates(ship.name);

  const seen = new Set<string>();
  const candidates = [...thumbnailCandidates, ...slugCandidates].filter((candidate) => {
    if (seen.has(candidate.src)) return false;
    seen.add(candidate.src);
    return true;
  });

  return { candidates, fallback: "silhouette" };
}

type MockupDefensiveBucket = "shields" | "armor" | "hull" | "support";

const MOCKUP_DEFENSIVE_BUCKETS: Array<{ key: MockupDefensiveBucket; label: string }> = [
  { key: "shields", label: "Shields" },
  { key: "armor", label: "Armor" },
  { key: "hull", label: "Hull" },
  { key: "support", label: "Support Systems" },
];

function mockupDefensiveBucket(row: PortBreakdownRow): MockupDefensiveBucket {
  const text = `${row.ruleCategory ?? ""} ${row.portCategory ?? ""} ${row.componentCategory ?? ""} ${row.portName ?? ""}`.toLowerCase();
  if (text.includes("shield")) return "shields";
  if (text.includes("armor")) return "armor";
  if (text.includes("hull") && !text.includes("shield")) return "hull";
  return "support";
}

export function buildOffensiveGroups(
  loadout: Pick<FittingMockupLoadoutState, "portRows" | "selectedPortId">,
  combatStats: MockupCombatStats,
): SystemsGroupView[] {
  return buildMockupOffensiveDisplayGroups(loadout.portRows).map((group) => ({
    key: group.key,
    label: group.label,
    count: group.summaries.reduce((total, summary) => total + summary.quantity, 0),
    rows: group.selections.map((selection, index) => {
      const { summary } = selection;
      const display = aggregateWeaponRowDisplay({
        quantities: summary.rows.map(() => 1),
        sizes: summary.rows.map((row) => row.componentSize),
        names: summary.rows.map((row) => row.equippedComponentName ?? "Empty"),
        statsList: summary.rows.map((row) => (
          row.equippedComponentKey ? combatStats.statsByComponentId[row.equippedComponentKey] : null
        )),
      });
      const qtyLine = `${selection.isTurretGroup ? summary.quantity : display.quantity}x`;
      const nameLine = selection.isTurretGroup
        ? `${summary.size != null ? `S${summary.size} ` : ""}${summary.turretLabel ?? summary.name}`
        : `${display.size != null ? `S${display.size} ` : ""}${display.weaponName}`;

      return {
        id: selection.selectionPortId,
        iconSrc: slotIconForSelection(selection),
        quantity: qtyLine,
        title: nameLine,
        subtitle: offenseRowMeta(selection),
        tag: offenseRowAside(selection),
        tone: offensiveRowTone(selection.groupKey, index),
        selected: loadout.selectedPortId === selection.selectionPortId,
      } satisfies EquipmentRowView;
    }),
  }));
}

export function buildDefensiveGroups(
  loadout: Pick<FittingMockupLoadoutState, "portRows" | "selectedPortId">,
): SystemsGroupView[] {
  const buckets = new Map<MockupDefensiveBucket, PortBreakdownRow[]>(
    MOCKUP_DEFENSIVE_BUCKETS.map((bucket) => [bucket.key, []]),
  );

  for (const group of buildMockupSupportGroups(loadout.portRows)) {
    for (const row of group.rows) {
      const bucket = mockupDefensiveBucket(row);
      buckets.get(bucket)?.push(row);
    }
  }

  return MOCKUP_DEFENSIVE_BUCKETS
    .map((bucket) => {
      const rows = buckets.get(bucket.key) ?? [];
      return {
        key: bucket.key,
        label: bucket.label,
        count: rows.length,
        rows: rows.map((row) => ({
          id: row.portId,
          iconSrc: slotIconForRow(row),
          quantity: "1x",
          title: mockupComponentTitle(row),
          subtitle: row.componentManufacturer ?? supportTypeLabel(row),
          tag: row.componentSize != null ? `S${row.componentSize}` : null,
          tone: defensiveRowTone(row),
          selected: loadout.selectedPortId === row.portId,
        })),
      };
    })
    .filter((group) => group.rows.length > 0);
}

export type MockupComputedStatsInput = {
  loadout: Pick<FittingMockupLoadoutState, "calculateResult" | "shipDetail">;
  combatStats: MockupCombatStats;
  armorMitigations: Array<Extract<FittingComponentMitigation, { kind: "armor" }>>;
  shieldMitigations: Array<Extract<FittingComponentMitigation, { kind: "shield" }>>;
  powerPipsFooter: ReactNode;
};

export function buildStatCards(input: MockupComputedStatsInput): StatCardView[] {
  const { loadout, combatStats, armorMitigations, shieldMitigations, powerPipsFooter } = input;
  const ship = loadout.shipDetail?.ship;
  const calculateResult = loadout.calculateResult;

  const shieldHp = derivedNum(calculateResult, "shields", "totalShieldHP");
  const shieldRegen = derivedNum(calculateResult, "shields", "totalRegenRate");
  const hullHP = loadout.shipDetail?.hullHP ?? loadout.shipDetail?.mitigation?.hullHp ?? null;
  const hpSummary = computeMockupHpSummary({ hullHP, shieldHp, armorMitigations });

  const scmSpeed = ship?.scmSpeed ?? extractedNum(calculateResult, "performance", "scmSpeed");
  const maxSpeed = ship?.maxSpeed ?? extractedNum(calculateResult, "performance", "maxSpeed");
  const boostSpeed = ship?.boostSpeedForward ?? extractedNum(calculateResult, "performance", "boostSpeedForward");
  const pitch = ship?.pitchRate ?? extractedNum(calculateResult, "performance", "pitchRate");
  const yaw = ship?.yawRate ?? extractedNum(calculateResult, "performance", "yawRate");
  const roll = ship?.rollRate ?? extractedNum(calculateResult, "performance", "rollRate");
  const boostPitch = extractedNum(calculateResult, "performance", "boostPitchRate");
  const boostYaw = extractedNum(calculateResult, "performance", "boostYawRate");
  const boostRoll = extractedNum(calculateResult, "performance", "boostRollRate");
  const boostCapacity = extractedNum(calculateResult, "performance", "boostCapacity");
  const boostRegen = extractedNum(calculateResult, "performance", "boostRegen");

  const resistanceRows = buildMockupResistanceTable({ shieldMitigations, armorMitigations });
  const thresholdReadout = buildShieldThresholdReadout(shieldHp);

  const formatRate = (value: number | null, suffix = " °/s") => (
    value != null ? `${formatNumber(value)}${suffix}` : "Not calculated yet"
  );

  const powerProduced = derivedNum(calculateResult, "power", "totalPowerGenerated");
  const powerRequired = derivedNum(calculateResult, "power", "totalPowerRequired");
  const powerMarginMw = powerProduced != null && powerRequired != null ? powerProduced - powerRequired : null;
  const powerMarginPct = powerProduced != null && powerRequired != null && powerProduced > 0
    ? Math.round(((powerProduced - powerRequired) / powerProduced) * 100)
    : null;

  const sustainedDps = sumNullableDps(combatStats.pilotDps, combatStats.turretDps, combatStats.crewDps);
  const burstAlpha = sumNullableDps(combatStats.pilotAlpha, combatStats.turretAlpha, combatStats.crewAlpha);
  const signatureSensitivity = derivedNum(calculateResult, "radar", "maxSignatureSensitivity");

  return [
    {
      key: "performance",
      title: "Ship Performance",
      actionLabel: "View Full Weapon Stats",
      sections: [{
        title: "Combat",
        rows: [
          { label: "Sustained DPS", value: formatCombatValue(sustainedDps, combatStats.loading), tone: "accent" },
          { label: "Burst Alpha", value: formatCombatValue(burstAlpha, combatStats.loading) },
          { label: "Pilot Alpha", value: formatAlphaWithDps(combatStats.pilotAlpha, combatStats.pilotDps, combatStats.loading) },
          {
            label: "Turret Alpha",
            value: combatStats.turretAlpha != null
              ? formatAlphaWithDps(combatStats.turretAlpha, combatStats.turretDps, combatStats.loading)
              : "Not applicable",
            tone: combatStats.turretAlpha == null ? "muted" : "default",
          },
          {
            label: "Crew Alpha",
            value: combatStats.crewAlpha != null
              ? formatAlphaWithDps(combatStats.crewAlpha, combatStats.crewDps, combatStats.loading)
              : "Not applicable",
            tone: combatStats.crewAlpha == null ? "muted" : "default",
          },
        ],
      }],
    },
    {
      key: "power",
      title: "Power Assignment",
      rows: [
        { label: "Reactor Output", value: valueOrUnavailable(powerProduced, " MW") },
        { label: "Total Draw", value: valueOrUnavailable(powerRequired, " MW") },
        {
          label: "Margin",
          value: formatResourceMargin(powerMarginMw, powerMarginPct),
          tone: powerMarginPct != null && powerMarginPct >= 0 ? "accent" : "default",
        },
      ],
      footer: powerPipsFooter,
    },
    {
      key: "survivability",
      title: "Survivability",
      rows: [
        { label: "Vital HP", value: valueOrUnavailable(hpSummary.vitalHp, " HP"), tone: "accent" },
        { label: "Total HP", value: valueOrUnavailable(hpSummary.totalHp, " HP") },
        { label: "Armor HP", value: valueOrUnavailable(hpSummary.armorHp, " HP") },
        { label: "Shield HP", value: valueOrUnavailable(shieldHp, " HP"), tone: "accent" },
        { label: "Shield Regen", value: valueOrUnavailable(shieldRegen, "/s") },
      ],
      sections: [
        ...(thresholdReadout ? [{
          title: thresholdReadout.label,
          rows: [],
          thresholdReadout,
        }] : []),
        {
          title: "Resistances",
          rows: [],
          resistanceGrid: {
            title: "Resistances",
            columns: ["Energy", "Kinetic", "EMP", "Thermal"],
            rows: resistanceRows,
          },
        },
      ],
    },
    {
      key: "signatures",
      title: "Signatures & Detection",
      rows: [
        {
          label: "Signature Sensitivity",
          value: valueOrUnavailable(signatureSensitivity),
          tone: signatureSensitivity != null ? "accent" : "muted",
        },
        { label: "EM / IR Emissions", value: "Not calculated yet", tone: "muted" },
        { label: "Cross Section", value: "Not calculated yet", tone: "muted" },
        { label: "Radar Range", value: "Not calculated yet", tone: "muted" },
      ],
    },
    {
      key: "mobility",
      title: "Mobility",
      rows: [
        {
          label: "SCM / AB",
          value: scmSpeed != null && boostSpeed != null
            ? `${formatNumber(scmSpeed)} / ${formatNumber(boostSpeed)} m/s`
            : valueOrUnavailable(scmSpeed, " m/s"),
          tone: "accent",
        },
        { label: "Nav Max", value: valueOrUnavailable(maxSpeed, " m/s") },
        {
          label: "Boost Cap / Regen",
          value: boostCapacity != null || boostRegen != null
            ? `${boostCapacity != null ? formatNumber(boostCapacity) : "—"} / ${boostRegen != null ? formatNumber(boostRegen) : "—"}`
            : "Not calculated yet",
          tone: "muted",
        },
      ],
      sections: [{
        title: "P / Y / R Rates",
        rows: [],
        miniGrid: {
          columns: ["Normal", "Boosted"],
          rows: [
            { label: "Pitch", values: [formatRate(pitch), formatRate(boostPitch)] },
            { label: "Yaw", values: [formatRate(yaw), formatRate(boostYaw)] },
            { label: "Roll", values: [formatRate(roll), formatRate(boostRoll)] },
          ],
        },
      }],
    },
  ];
}

export function buildResourceSummary(
  calculateResult: FittingCalculateResult | null,
  fittingValid: boolean,
): ResourceSummaryView {
  const powerProduced = derivedNum(calculateResult, "power", "totalPowerGenerated");
  const powerRequired = derivedNum(calculateResult, "power", "totalPowerRequired");
  const coolingProduced = derivedNum(calculateResult, "cooling", "totalCoolingGenerated");
  const coolingRequired = derivedNum(calculateResult, "cooling", "totalCoolingRequired");

  const powerMarginMw = powerProduced != null && powerRequired != null ? powerProduced - powerRequired : null;
  const coolingMarginMw = coolingProduced != null && coolingRequired != null ? coolingProduced - coolingRequired : null;
  const powerMarginPct = powerProduced != null && powerRequired != null && powerProduced > 0
    ? Math.round(((powerProduced - powerRequired) / powerProduced) * 100)
    : null;
  const coolingMarginPct = coolingProduced != null && coolingRequired != null && coolingProduced > 0
    ? Math.round(((coolingProduced - coolingRequired) / coolingProduced) * 100)
    : null;

  const blocks: ResourceBlockView[] = [
    {
      key: "power",
      title: "Power",
      metrics: [
        { label: "Output", value: valueOrUnavailable(powerProduced, " MW") },
        { label: "Used", value: valueOrUnavailable(powerRequired, " MW") },
        { label: "Margin", value: formatResourceMargin(powerMarginMw, powerMarginPct), highlighted: true },
      ],
      barFillPct: powerProduced != null && powerRequired != null && powerProduced > 0
        ? Math.min(100, (powerRequired / powerProduced) * 100)
        : 0,
      barKind: "power",
    },
    {
      key: "cooling",
      title: "Cooling",
      metrics: [
        { label: "Output", value: valueOrUnavailable(coolingProduced) },
        { label: "Used", value: valueOrUnavailable(coolingRequired) },
        { label: "Margin", value: formatResourceMargin(coolingMarginMw, coolingMarginPct), highlighted: true },
      ],
      barFillPct: coolingProduced != null && coolingRequired != null && coolingProduced > 0
        ? Math.min(100, (coolingRequired / coolingProduced) * 100)
        : 0,
      barKind: "cooling",
    },
    {
      key: "fuel",
      title: "Fuel",
      stacked: true,
      metrics: [
        { label: "Capacity", value: "Not calculated yet" },
        { label: "Usage", value: "Not calculated yet" },
        { label: "Quantum Range", value: "Not calculated yet" },
        { label: "Quantum Fuel Time", value: "Not calculated yet" },
      ],
    },
  ];

  return { fittingValid, blocks };
}

export function buildTopBarView(
  ship: FittingShipSummary | undefined,
  loadout: Pick<FittingMockupLoadoutState, "ships" | "selectedShipKey" | "shipsLoading" | "isModified" | "loading">,
  activeTab: string,
  tabs: string[],
): TopBarView {
  const shipMeta = [ship?.role ?? ship?.career, ship?.movementClass].filter(Boolean).join(" · ");
  return {
    manufacturer: deriveDisplayManufacturer(ship?.manufacturer ?? null, ship?.name ?? ""),
    shipName: ship?.name ?? "Loading ship…",
    roleLine: shipMeta || (loadout.loading ? "Loading…" : "Source unavailable"),
    activeTab,
    tabs,
    ships: loadout.ships.map((entry) => ({ shipKey: entry.shipKey, name: entry.name })),
    selectedShipKey: loadout.selectedShipKey,
    shipsLoading: loadout.shipsLoading,
    isModified: loadout.isModified,
  };
}

export function buildHeroInspectView(input: {
  selectedWeaponSelection: MockupWeaponSelection | null;
  selectedRow: PortBreakdownRow | null;
  selectorOpen: boolean;
  slotTitle: (row: PortBreakdownRow) => string;
  drawerSlotLabel: (selection: MockupWeaponSelection) => string;
}): HeroInspectView {
  const { selectedWeaponSelection, selectedRow, selectorOpen, slotTitle, drawerSlotLabel } = input;
  const heroSlotTitle = selectedWeaponSelection
    ? drawerSlotLabel(selectedWeaponSelection)
    : selectedRow ? slotTitle(selectedRow) : null;
  const heroItemName = selectedRow ? mockupComponentTitle(selectedRow) : null;
  const heroInspectPilot = selectedWeaponSelection ? offenseRowAside(selectedWeaponSelection) : null;

  return {
    slotTitle: heroSlotTitle,
    itemName: heroItemName,
    pilotTag: heroInspectPilot,
    meta: selectedRow
      ? `${selectedRow.componentManufacturer ?? supportTypeLabel(selectedRow)}${selectedRow.componentSize != null ? ` · Size ${selectedRow.componentSize}` : ""}`
      : null,
    selectorOpen,
  };
}
