import type { Confidence, DatasetSelection } from "./fitting.types.ts";
import { FittingHttpError } from "./fitting.types.ts";
import { canonicalId, componentStats, componentSummary, componentType } from "./fitting.service.ts";
import { loadRegistry } from "./registryStore.ts";

type Row = Record<string, unknown>;

const FITTING_PORT_TYPES = new Set([
  "PowerPlant",
  "Cooler",
  "Shield",
  "QuantumDrive",
  "Radar",
  "WeaponGun",
  "WeaponMissile",
  "WeaponDefensive",
]);

const PORT_TYPE_TO_COMPONENT_TYPES: Record<string, string[]> = {
  PowerPlant: ["power_plant"],
  Cooler: ["cooler"],
  Shield: ["shield"],
  QuantumDrive: ["quantum_drive"],
  Radar: ["radar"],
  WeaponGun: ["ship_weapon"],
  WeaponMissile: ["ship_weapon"],
  WeaponDefensive: ["ship_weapon"],
};

export interface FittingLoadoutInput {
  shipId: string;
  loadout: Record<string, string | null>;
  options?: { compareToStock?: boolean };
}

interface ComponentLookup {
  byId: Map<string, { row: Row; fallbackType: string }>;
}

interface PortContext {
  id: string;
  type: string | null;
  editable: boolean;
  locked: boolean;
  bespoke: boolean;
  defaultComponentId: string | null;
}

interface CompatRule {
  portType: string | null;
  portSubType: string | null;
  minSize: number | null;
  maxSize: number | null;
  exactSize: number | null;
  bespoke: boolean;
  editable: boolean;
  compatibilityStatus: string | null;
  compatibleKeys: Set<string>;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function booleanValue(value: unknown): boolean {
  return value === true;
}

function confidenceValue(value: unknown): Confidence {
  return value === "high" || value === "medium" ? value : "low";
}

function lowestConfidence(values: Confidence[]): Confidence {
  if (values.includes("low")) return "low";
  if (values.includes("medium")) return "medium";
  return "high";
}

async function componentLookup(selection: DatasetSelection): Promise<ComponentLookup> {
  const families = [
    ["ship_weapons.json", "ship_weapon"],
    ["shields.json", "shield"],
    ["power_plants.json", "power_plant"],
    ["coolers.json", "cooler"],
    ["quantum_drives.json", "quantum_drive"],
    ["radars.json", "radar"],
    ["thrusters.json", "thruster"],
  ] as const;
  const byId = new Map<string, { row: Row; fallbackType: string }>();
  for (const [fileName, fallbackType] of families) {
    const payload = await loadRegistry(selection, fileName);
    for (const row of payload.records) {
      const id = canonicalId(row.entityClass ?? row.componentKey ?? row.thrusterKey);
      if (id) byId.set(id, { row, fallbackType });
    }
  }
  return { byId };
}

function flattenHardpointTree(tree: Row[]): PortContext[] {
  const output: PortContext[] = [];
  for (const row of tree) {
    const id = text(row.portId ?? row.id);
    if (!id) continue;
    const defaultItem = row.defaultItem && typeof row.defaultItem === "object" ? row.defaultItem as Row : {};
    output.push({
      id,
      type: text(row.portType ?? row.type),
      editable: row.editable !== false,
      locked: booleanValue(row.locked),
      bespoke: booleanValue(row.bespoke),
      defaultComponentId: canonicalId(row.resolvedDefaultComponentKey ?? defaultItem.resolvedComponentKey),
    });
    const children = Array.isArray(row.children) ? row.children.filter((item): item is Row => !!item && typeof item === "object") : [];
    output.push(...flattenHardpointTree(children));
  }
  return output;
}

function compatRuleFromRow(rule: Row): CompatRule {
  const keys = Array.isArray(rule.compatibleComponentKeys) ? rule.compatibleComponentKeys : [];
  return {
    portType: text(rule.portType),
    portSubType: text(rule.portSubType),
    minSize: numberValue(rule.minSize),
    maxSize: numberValue(rule.maxSize),
    exactSize: numberValue(rule.exactSize),
    bespoke: booleanValue(rule.bespoke),
    editable: rule.editable !== false,
    compatibilityStatus: text(rule.compatibilityStatus),
    compatibleKeys: new Set(keys.map(canonicalId).filter((id): id is string => id !== null)),
  };
}

function isFittingPortType(portType: string | null): boolean {
  return portType !== null && FITTING_PORT_TYPES.has(portType);
}

function parseLoadoutInput(body: unknown): FittingLoadoutInput {
  if (!body || typeof body !== "object") {
    throw new FittingHttpError(400, "INVALID_REQUEST", "Invalid request", "Request body must be a JSON object.");
  }
  const payload = body as Row;
  const shipId = canonicalId(payload.shipId);
  if (!shipId) {
    throw new FittingHttpError(400, "INVALID_REQUEST", "Invalid request", "shipId must be a canonical UUID.", [
      { path: "shipId", code: "INVALID_VALUE", message: "Expected a canonical or underscore UUID." },
    ]);
  }
  if (!payload.loadout || typeof payload.loadout !== "object" || Array.isArray(payload.loadout)) {
    throw new FittingHttpError(400, "INVALID_REQUEST", "Invalid request", "loadout must be an object mapping portId to componentId or null.", [
      { path: "loadout", code: "INVALID_VALUE", message: "Expected an object." },
    ]);
  }
  const loadout: Record<string, string | null> = {};
  for (const [portId, value] of Object.entries(payload.loadout as Row)) {
    if (typeof portId !== "string" || portId.length === 0 || portId.length > 1024) {
      throw new FittingHttpError(400, "INVALID_REQUEST", "Invalid request", "loadout keys must be non-empty port identifiers.", [
        { path: "loadout", code: "INVALID_VALUE", message: "Invalid portId key." },
      ]);
    }
    if (value === null) {
      loadout[portId] = null;
      continue;
    }
    if (typeof value !== "string") {
      throw new FittingHttpError(400, "INVALID_REQUEST", "Invalid request", "loadout values must be component UUID strings or null.", [
        { path: `loadout.${portId}`, code: "INVALID_VALUE", message: "Expected string or null." },
      ]);
    }
    const componentId = canonicalId(value);
    if (!componentId) {
      throw new FittingHttpError(400, "INVALID_REQUEST", "Invalid request", "loadout component identifiers must be canonical UUIDs.", [
        { path: `loadout.${portId}`, code: "INVALID_VALUE", message: "Expected a canonical or underscore UUID." },
      ]);
    }
    loadout[portId] = componentId;
  }
  const options = payload.options && typeof payload.options === "object" ? payload.options as Row : {};
  const compareToStock = options.compareToStock !== false;
  return { shipId, loadout, options: { compareToStock } };
}

function sizeMismatch(rule: CompatRule, componentSize: number | null): string | null {
  if (componentSize === null) return null;
  if (rule.exactSize !== null && componentSize !== rule.exactSize) return `Component size ${componentSize} does not match port exact size ${rule.exactSize}.`;
  if (rule.minSize !== null && componentSize < rule.minSize) return `Component size ${componentSize} is below port minimum ${rule.minSize}.`;
  if (rule.maxSize !== null && componentSize > rule.maxSize) return `Component size ${componentSize} exceeds port maximum ${rule.maxSize}.`;
  return null;
}

function typeMismatch(rule: CompatRule, componentRow: Row, fallbackType: string): string | null {
  const portType = rule.portType;
  if (!portType) return null;
  const expected = PORT_TYPE_TO_COMPONENT_TYPES[portType];
  if (!expected) return null;
  const actual = componentType(componentRow, fallbackType);
  if (!expected.includes(actual)) return `Component type ${actual} is not compatible with port type ${portType}.`;
  return null;
}

export async function validateFittingLoadout(selection: DatasetSelection, body: unknown): Promise<unknown> {
  const input = parseLoadoutInput(body);
  const [ships, hardpoints, loadouts, compatibility, lookup] = await Promise.all([
    loadRegistry(selection, "ships.json"),
    loadRegistry(selection, "ship_hardpoints.json"),
    loadRegistry(selection, "default_loadouts.json"),
    loadRegistry(selection, "compatible_items_by_port.json"),
    componentLookup(selection),
  ]);

  const shipRow = ships.records.find((item) => canonicalId(item.entityClass ?? item.shipKey) === input.shipId);
  if (!shipRow) throw new FittingHttpError(404, "RESOURCE_NOT_FOUND", "Resource not found", "No fitting ship matched the supplied identifier.");

  const hardpointRow = hardpoints.records.find((item) => canonicalId(item.shipKey) === input.shipId);
  const tree = hardpointRow && Array.isArray(hardpointRow.tree) ? hardpointRow.tree.filter((item): item is Row => !!item && typeof item === "object") : [];
  const portContexts = flattenHardpointTree(tree);
  const portById = new Map(portContexts.map((port) => [port.id, port]));

  const stockRow = loadouts.records.find((item) => canonicalId(item.shipKey) === input.shipId);
  const stockRequired = new Map<string, string>();
  if (stockRow && Array.isArray(stockRow.entries)) {
    for (const entry of stockRow.entries) {
      if (!entry || typeof entry !== "object") continue;
      const portId = text((entry as Row).portPath ?? (entry as Row).portName);
      const componentId = canonicalId((entry as Row).resolvedDefaultComponentKey);
      if (portId && componentId) stockRequired.set(portId, componentId);
    }
  }

  const compatShip = compatibility.records.find((item) => canonicalId(item.shipKey) === input.shipId);
  const compatPorts = compatShip?.ports && typeof compatShip.ports === "object" ? compatShip.ports as Row : {};
  const compatByPort = new Map<string, CompatRule>();
  for (const [portId, value] of Object.entries(compatPorts)) {
    if (value && typeof value === "object") compatByPort.set(portId, compatRuleFromRow(value as Row));
  }

  const missingRequiredPorts: string[] = [];
  const emptyOptionalPorts: string[] = [];
  const incompatibleItems: Array<{ portId: string; componentId: string; reason: string; confidence: Confidence }> = [];
  const lockedBespokePorts: string[] = [];
  const unknownItemIds: Array<{ portId: string; componentId: string }> = [];
  const unknownPortIds: string[] = [];
  const mismatchReasons: Array<{ portId: string; componentId: string; kind: string; message: string; confidence: Confidence }> = [];
  const unresolvedReferences: Array<{ kind: string; message: string; confidence: Confidence }> = [];
  const confidenceLevels: Confidence[] = [];

  const portsChecked = Object.keys(input.loadout).length;
  for (const [portId, componentId] of Object.entries(input.loadout)) {
    const port = portById.get(portId);
    const compat = compatByPort.get(portId);
    if (!port && !compat) {
      unknownPortIds.push(portId);
      confidenceLevels.push("low");
      continue;
    }

    const portType = port?.type ?? compat?.portType ?? null;
    const editable = port ? port.editable : compat?.editable ?? true;
    const locked = port?.locked ?? false;
    const bespoke = port?.bespoke ?? compat?.bespoke ?? false;

    if (componentId === null) {
      if (stockRequired.has(portId)) missingRequiredPorts.push(portId);
      else if (isFittingPortType(portType)) emptyOptionalPorts.push(portId);
      continue;
    }

    const found = lookup.byId.get(componentId);
    if (!found) {
      unknownItemIds.push({ portId, componentId });
      confidenceLevels.push("medium");
      continue;
    }

    if (locked || bespoke || !editable) {
      lockedBespokePorts.push(portId);
      confidenceLevels.push("high");
    }

    if (compat) {
      if (compat.compatibilityStatus === "known" && compat.compatibleKeys.size > 0 && !compat.compatibleKeys.has(componentId)) {
        incompatibleItems.push({
          portId,
          componentId,
          reason: "Component is not listed in the published compatible-items registry for this port.",
          confidence: "high",
        });
        confidenceLevels.push("high");
      } else if (compat.compatibilityStatus !== "known") {
        unresolvedReferences.push({
          kind: "compatibility_status_unknown",
          message: `Compatibility status for port ${portId} is not known; list-based validation was skipped.`,
          confidence: "low",
        });
        confidenceLevels.push("low");
      }

      const componentSize = numberValue(found.row.size ?? found.row.attachSize);
      const sizeReason = sizeMismatch(compat, componentSize);
      if (sizeReason) {
        mismatchReasons.push({ portId, componentId, kind: "size_mismatch", message: sizeReason, confidence: "high" });
        confidenceLevels.push("high");
      }

      const typeReason = typeMismatch(compat, found.row, found.fallbackType);
      if (typeReason) {
        mismatchReasons.push({ portId, componentId, kind: "type_mismatch", message: typeReason, confidence: "high" });
        confidenceLevels.push("high");
      }
    } else {
      unresolvedReferences.push({
        kind: "compatibility_rule_missing",
        message: `No compatibility rule was found for port ${portId}; port-level validation is incomplete.`,
        confidence: "low",
      });
      confidenceLevels.push("low");
    }
  }

  for (const [portId] of stockRequired) {
    if (!(portId in input.loadout)) missingRequiredPorts.push(portId);
  }

  const valid = missingRequiredPorts.length === 0
    && incompatibleItems.length === 0
    && unknownPortIds.length === 0
    && unknownItemIds.length === 0
    && mismatchReasons.length === 0
    && lockedBespokePorts.length === 0;

  return {
    data: {
      valid,
      shipId: input.shipId,
      portsChecked,
      missingRequiredPorts: [...new Set(missingRequiredPorts)].sort(),
      emptyOptionalPorts: [...new Set(emptyOptionalPorts)].sort(),
      incompatibleItems,
      lockedBespokePorts: [...new Set(lockedBespokePorts)].sort(),
      unknownItemIds,
      unknownPortIds: [...new Set(unknownPortIds)].sort(),
      mismatchReasons,
      confidence: lowestConfidence(confidenceLevels.length > 0 ? confidenceLevels : ["high"]),
      unresolvedReferences,
    },
  };
}

function sumNullable(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((total, value) => total + value, 0);
}

function buildCategory(
  available: boolean,
  confidence: Confidence,
  derived: Row,
  extracted: Row,
  unavailableReason: string | null,
  missingFields: unknown[],
  warnings: string[],
): Record<string, unknown> {
  return {
    available,
    confidence,
    unavailableReason,
    derived,
    extracted,
    missingFields,
    warnings,
  };
}

function statNumber(stats: Record<string, number | null>, key: string): number | null {
  const value = stats[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function calculateFittingLoadout(selection: DatasetSelection, body: unknown): Promise<unknown> {
  const input = parseLoadoutInput(body);
  const [ships, performance, stockCalcs, lookup] = await Promise.all([
    loadRegistry(selection, "ships.json"),
    loadRegistry(selection, "ship_performance.json"),
    loadRegistry(selection, "stock_loadout_calculations.json"),
    componentLookup(selection),
  ]);

  const shipRow = ships.records.find((item) => canonicalId(item.entityClass ?? item.shipKey) === input.shipId);
  if (!shipRow) throw new FittingHttpError(404, "RESOURCE_NOT_FOUND", "Resource not found", "No fitting ship matched the supplied identifier.");

  const fitted: Array<{ portId: string; componentId: string; row: Row; fallbackType: string }> = [];
  const unknownItemIds: string[] = [];
  const unresolvedReferences: Array<{ kind: string; message: string; confidence: Confidence }> = [];
  const warnings: string[] = [
    "Custom loadout calculations use extracted component stats only; excluded mechanics remain unmodeled (armor thresholds, ballistic passthrough, shield penetration, distortion/disable).",
  ];
  const missingStats: Array<{ portId: string; componentId: string; fields: string[]; confidence: Confidence }> = [];

  for (const [portId, componentId] of Object.entries(input.loadout)) {
    if (!componentId) continue;
    const found = lookup.byId.get(componentId);
    if (!found) {
      unknownItemIds.push(componentId);
      unresolvedReferences.push({
        kind: "unknown_component",
        message: `Component ${componentId} on port ${portId} was not found in published component registries.`,
        confidence: "medium",
      });
      continue;
    }
    fitted.push({ portId, componentId, row: found.row, fallbackType: found.fallbackType });
  }

  const componentCountsByType: Record<string, number> = {};
  for (const item of fitted) {
    const type = componentType(item.row, item.fallbackType);
    componentCountsByType[type] = (componentCountsByType[type] ?? 0) + 1;
  }

  const powerGeneratedValues: number[] = [];
  const powerRequiredValues: number[] = [];
  const coolingGeneratedValues: number[] = [];
  const coolingRequiredValues: number[] = [];
  const shieldHpValues: number[] = [];
  const regenValues: number[] = [];
  const weaponAlphaValues: number[] = [];
  const signatureValues: number[] = [];

  const quantumComponents: Row[] = [];
  const radarComponents: Row[] = [];

  for (const item of fitted) {
    const stats = componentStats(item.row);
    const type = componentType(item.row, item.fallbackType);

    if (statNumber(stats, "powerGenerated") !== null) powerGeneratedValues.push(statNumber(stats, "powerGenerated")!);
    if (statNumber(stats, "powerDraw") !== null) powerRequiredValues.push(statNumber(stats, "powerDraw")!);
    if (statNumber(stats, "coolingGenerated") !== null) coolingGeneratedValues.push(statNumber(stats, "coolingGenerated")!);
    if (statNumber(stats, "coolingDraw") !== null) coolingRequiredValues.push(statNumber(stats, "coolingDraw")!);
    if (statNumber(stats, "shieldHp") !== null) shieldHpValues.push(statNumber(stats, "shieldHp")!);
    if (statNumber(stats, "regenRate") !== null) regenValues.push(statNumber(stats, "regenRate")!);
    if (statNumber(stats, "alphaDamage") !== null) weaponAlphaValues.push(statNumber(stats, "alphaDamage")!);
    if (statNumber(stats, "signatureSensitivity") !== null) signatureValues.push(statNumber(stats, "signatureSensitivity")!);

    if (type === "quantum_drive") quantumComponents.push({ portId: item.portId, componentId: item.componentId, stats, summary: componentSummary(item.row, item.fallbackType) });
    if (type === "radar") radarComponents.push({ portId: item.portId, componentId: item.componentId, stats, summary: componentSummary(item.row, item.fallbackType) });

    const missing: string[] = [];
    if (type === "shield" && statNumber(stats, "shieldHp") === null) missing.push("shieldHp");
    if (type === "shield" && statNumber(stats, "regenRate") === null) missing.push("regenRate");
    if (type === "power_plant" && statNumber(stats, "powerGenerated") === null) missing.push("powerGenerated");
    if (type === "cooler" && statNumber(stats, "coolingGenerated") === null) missing.push("coolingGenerated");
    if (type === "ship_weapon" && statNumber(stats, "alphaDamage") === null) missing.push("alphaDamage");
    if (missing.length > 0) missingStats.push({ portId: item.portId, componentId: item.componentId, fields: missing, confidence: "medium" });
  }

  const totalPowerGenerated = sumNullable(powerGeneratedValues);
  const totalPowerRequired = sumNullable(powerRequiredValues);
  const totalCoolingGenerated = sumNullable(coolingGeneratedValues);
  const totalCoolingRequired = sumNullable(coolingRequiredValues);
  const powerMargin = totalPowerGenerated !== null && totalPowerRequired !== null ? totalPowerGenerated - totalPowerRequired : null;
  const coolingMargin = totalCoolingGenerated !== null && totalCoolingRequired !== null ? totalCoolingGenerated - totalCoolingRequired : null;

  if (coolingRequiredValues.length === 0 && fitted.some((item) => numberValue(item.row.heatGenerated) !== null)) {
    unresolvedReferences.push({
      kind: "cooling_required_unmodeled",
      message: "Cooling demand from heatGenerated is not aggregated; only explicit coolingDraw values are summed.",
      confidence: "low",
    });
  }

  const categories: Record<string, unknown> = {
    power: buildCategory(
      totalPowerGenerated !== null || totalPowerRequired !== null,
      powerGeneratedValues.length > 0 && powerRequiredValues.length > 0 ? "high" : "medium",
      {
        totalPowerGenerated,
        totalPowerRequired,
        powerSurplus: powerMargin,
        powerDeficit: powerMargin !== null ? -powerMargin : null,
      },
      {
        powerGeneratedValuesAvailable: powerGeneratedValues.length,
        powerRequiredValuesAvailable: powerRequiredValues.length,
        modeledConsumers: powerRequiredValues.length,
      },
      null,
      [],
      [],
    ),
    cooling: buildCategory(
      totalCoolingGenerated !== null || totalCoolingRequired !== null,
      coolingGeneratedValues.length > 0 ? "high" : "medium",
      {
        totalCoolingGenerated,
        totalCoolingRequired,
        coolingSurplus: coolingMargin,
        coolingDeficit: coolingMargin !== null ? -coolingMargin : null,
      },
      {
        coolingGeneratedValuesAvailable: coolingGeneratedValues.length,
        coolingRequiredValuesAvailable: coolingRequiredValues.length,
      },
      null,
      [],
      [],
    ),
    shields: buildCategory(
      shieldHpValues.length > 0 || regenValues.length > 0,
      regenValues.length > 0 ? "high" : shieldHpValues.length > 0 ? "medium" : "low",
      {
        totalShieldHP: sumNullable(shieldHpValues),
        totalRegenRate: sumNullable(regenValues),
      },
      {
        shieldHpValuesAvailable: shieldHpValues.length,
        regenValuesAvailable: regenValues.length,
      },
      null,
      missingStats.filter((entry) => entry.fields.includes("shieldHp") || entry.fields.includes("regenRate")),
      [],
    ),
    weapons: buildCategory(
      weaponAlphaValues.length > 0,
      weaponAlphaValues.length > 0 ? "high" : "low",
      {
        weaponAlphaTotal: sumNullable(weaponAlphaValues),
        weaponDpsTotal: null,
        weaponCount: weaponAlphaValues.length,
      },
      {
        weaponAlphaValuesAvailable: weaponAlphaValues.length,
        dpsPolicy: "not_modeled_by_choice: DPS is not calculated from alpha damage or weapon cadence.",
      },
      weaponAlphaValues.length === 0 ? "No weapon alpha damage values were available for the supplied loadout." : null,
      [],
      ["DPS and fire-rate cadence are intentionally excluded from runtime custom calculations."],
    ),
    quantum: buildCategory(
      quantumComponents.length > 0,
      quantumComponents.length > 0 ? "medium" : "low",
      {},
      { componentCount: quantumComponents.length, components: quantumComponents },
      quantumComponents.length === 0 ? "No quantum drive components were present in the supplied loadout." : null,
      [],
      [],
    ),
    radar: buildCategory(
      radarComponents.length > 0,
      radarComponents.length > 0 ? "medium" : "low",
      {
        maxSignatureSensitivity: signatureValues.length > 0 ? Math.max(...signatureValues) : null,
      },
      { componentCount: radarComponents.length, components: radarComponents },
      radarComponents.length === 0 ? "No radar components were present in the supplied loadout." : null,
      [],
      [],
    ),
  };

  const performanceRow = performance.records.find((item) => canonicalId(item.shipKey) === input.shipId) ?? {};
  categories.performance = buildCategory(
    true,
    confidenceValue(performanceRow.confidence),
    {},
    {
      scmSpeed: numberValue(performanceRow.scmSpeed),
      maxSpeed: numberValue(performanceRow.maxSpeed),
      pitchRate: numberValue(performanceRow.pitchRate),
      yawRate: numberValue(performanceRow.yawRate),
      rollRate: numberValue(performanceRow.rollRate),
      boostSpeedForward: numberValue(performanceRow.boostSpeedForward),
      boostSpeedBackward: numberValue(performanceRow.boostSpeedBackward),
      boostCapacity: numberValue(performanceRow.boostCapacity),
      boostRegen: numberValue(performanceRow.boostRegen),
    },
    null,
    [],
    ["Performance values are ship-level extracted stats and do not change with component loadout."],
  );

  let stockComparison: Record<string, unknown> | undefined;
  if (input.options?.compareToStock) {
    const stockRow = stockCalcs.records.find((item) => canonicalId(item.shipKey) === input.shipId);
    if (!stockRow) {
      stockComparison = { available: false, reason: "No stock loadout calculations were found for this ship." };
    } else {
      const stockCategories = stockRow.categories && typeof stockRow.categories === "object" ? stockRow.categories as Row : {};
      const deltas: Record<string, Record<string, number | null>> = {};
      for (const [categoryName, categoryValue] of Object.entries(categories)) {
        const customDerived = (categoryValue as Row).derived && typeof (categoryValue as Row).derived === "object" ? (categoryValue as Row).derived as Row : {};
        const stockCategory = stockCategories[categoryName] && typeof stockCategories[categoryName] === "object" ? stockCategories[categoryName] as Row : null;
        const stockDerived = stockCategory?.derived && typeof stockCategory.derived === "object" ? stockCategory.derived as Row : {};
        const categoryDeltas: Record<string, number | null> = {};
        for (const [key, value] of Object.entries(customDerived)) {
          if (typeof value !== "number") continue;
          const stockValue = numberValue(stockDerived[key]);
          categoryDeltas[key] = stockValue !== null ? value - stockValue : null;
        }
        if (Object.keys(categoryDeltas).length > 0) deltas[categoryName] = categoryDeltas;
      }
      stockComparison = { available: true, scope: "stock_default_loadout", deltas };
    }
  }

  const resolutionStatus = unknownItemIds.length > 0 ? "partial" : fitted.length > 0 ? "resolved" : "empty";
  const confidence = lowestConfidence([
    unknownItemIds.length > 0 ? "medium" : "high",
    missingStats.length > 0 ? "medium" : "high",
    unresolvedReferences.some((entry) => entry.confidence === "low") ? "low" : "high",
  ]);

  const summary = {
    firepower: {
      weaponAlphaTotal: sumNullable(weaponAlphaValues),
      weaponDpsTotal: null,
      weaponCount: weaponAlphaValues.length,
      confidence: weaponAlphaValues.length > 0 ? "high" : "low",
      inferred: false,
    },
    shields: {
      totalShieldHP: sumNullable(shieldHpValues),
      totalRegenRate: sumNullable(regenValues),
      confidence: regenValues.length > 0 ? "high" : shieldHpValues.length > 0 ? "medium" : "low",
      inferred: false,
    },
    power: {
      produced: totalPowerGenerated,
      required: totalPowerRequired,
      margin: powerMargin,
      confidence: powerGeneratedValues.length > 0 && powerRequiredValues.length > 0 ? "high" : "medium",
      inferred: true,
    },
    cooling: {
      produced: totalCoolingGenerated,
      required: totalCoolingRequired,
      margin: coolingMargin,
      confidence: coolingGeneratedValues.length > 0 ? "high" : "medium",
      inferred: true,
    },
    quantum: {
      componentCount: quantumComponents.length,
      confidence: quantumComponents.length > 0 ? "medium" : "low",
      inferred: false,
    },
    radar: {
      componentCount: radarComponents.length,
      maxSignatureSensitivity: signatureValues.length > 0 ? Math.max(...signatureValues) : null,
      confidence: radarComponents.length > 0 ? "medium" : "low",
      inferred: false,
    },
  };

  return {
    data: {
      shipId: input.shipId,
      scope: "custom_loadout",
      resolutionStatus,
      componentCountsByType,
      categories,
      summary,
      warnings,
      confidence,
      unresolvedReferences,
      missingStats,
      unknownItemIds,
      stockComparison,
    },
  };
}
