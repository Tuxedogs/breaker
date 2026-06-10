import { readFile } from "node:fs/promises";
import path from "node:path";
import { apiPaths } from "../config/apiPaths";

type JsonObject = Record<string, unknown>;
type RouteResult = { status: number; body: unknown };

const CALCULATION_CONFIDENCE = "prototype-medium";
const UNSUPPORTED_MECHANICS = [
  "missile racks",
  "nested gimbals",
  "nested turrets",
  "bombs",
  "countermeasures",
  "jump drives",
  "support/interior items",
  "armor passthrough",
  "ballistic shield interaction",
  "distortion/component-disable mechanics",
];

const PROVENANCE_KEYS = new Set([
  "path",
  "sourcepath",
  "source",
  "xmlpath",
  "filepath",
  "foundrypath",
  "provenance",
  "debug",
]);

const registryCache = new Map<string, Promise<JsonObject[]>>();

function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function isProvenanceKey(key: string): boolean {
  return PROVENANCE_KEYS.has(key.replace(/^_+/, "").toLowerCase());
}

function sanitizeApiValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeApiValue);
  if (!isRecord(value)) return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !isProvenanceKey(key))
      .map(([key, nestedValue]) => [key, sanitizeApiValue(nestedValue)]),
  );
}

async function readJson(fileName: string): Promise<unknown> {
  return JSON.parse(await readFile(path.join(apiPaths.fittingRoot, fileName), "utf8")) as unknown;
}

async function readRegistry(fileName: string): Promise<JsonObject[]> {
  const cached = registryCache.get(fileName);
  if (cached) return cached;

  const promise = readJson(fileName).then((payload) => {
    if (Array.isArray(payload)) return payload.filter(isRecord);
    if (isRecord(payload)) return asArray(payload.records).filter(isRecord);
    return [];
  });
  registryCache.set(fileName, promise);
  return promise;
}

function keyOf(row: JsonObject): string | null {
  return asString(row.shipKey) ?? asString(row.componentKey);
}

function sameKey(row: JsonObject, key: string): boolean {
  return keyOf(row) === key;
}

function shapeShipSummary(ship: JsonObject): JsonObject {
  return {
    shipKey: ship.shipKey,
    name: ship.name,
    manufacturer: ship.manufacturer,
    role: ship.role,
    career: ship.career,
    movementClass: ship.movementClass,
    crewSize: ship.crewSize,
    isGroundVehicle: ship.isGroundVehicle,
    confidence: ship.confidence,
  };
}

function countPortCategories(nodes: unknown[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const node of nodes) {
    if (!isRecord(node)) continue;
    const category = asString(node.category) ?? "unknown";
    counts[category] = (counts[category] ?? 0) + 1;
    for (const [childCategory, count] of Object.entries(countPortCategories(asArray(node.children)))) {
      counts[childCategory] = (counts[childCategory] ?? 0) + count;
    }
  }
  return counts;
}

function buildPortInfoById(hardpoints: JsonObject | null): Map<string, JsonObject> {
  const ports = new Map<string, JsonObject>();
  const walk = (nodes: unknown[], parentPortId: string | null): void => {
    for (const node of nodes) {
      if (!isRecord(node)) continue;
      const portId = asString(node.id) ?? asString(node.portId) ?? asString(node.portName);
      const children = asArray(node.children).filter(isRecord);
      const childPortIds = children
        .map((child) => asString(child.id) ?? asString(child.portId) ?? asString(child.portName))
        .filter((childId): childId is string => Boolean(childId));
      if (portId) {
        ports.set(portId, {
          portId,
          portName: node.portName,
          portCategory: node.category,
          parentPortId,
          childPortIds,
        });
      }
      walk(children, portId);
    }
  };
  walk(asArray(hardpoints?.tree), null);
  return ports;
}

function shapeShipDetail(ship: JsonObject, hardpoints?: JsonObject, compatibility?: JsonObject): JsonObject {
  return {
    ...shapeShipSummary(ship),
    entityClass: ship.entityClass,
    className: ship.className,
    portCount: hardpoints?.portCount ?? null,
    topLevelPortCount: hardpoints?.topLevelPortCount ?? null,
    portCategoryCounts: hardpoints ? countPortCategories(asArray(hardpoints.tree)) : {},
    fittingRelevantPortCount: compatibility?.fittingRelevantPortCount ?? null,
    compatibleMappingCount: compatibility?.compatibleMappingCount ?? null,
    compatibilityCategoryCounts: compatibility?.categoryCounts ?? {},
  };
}

function shapeDefaultItem(defaultItem: unknown): JsonObject | null {
  if (!isRecord(defaultItem)) return null;
  return {
    ref: defaultItem.ref,
    resolved: defaultItem.resolved,
    guid: defaultItem.guid,
    className: defaultItem.className,
    displayName: defaultItem.displayName,
    attachType: defaultItem.attachType,
    attachSubType: defaultItem.attachSubType,
    attachSize: defaultItem.attachSize,
  };
}

function shapeComponent(component: JsonObject): JsonObject {
  const resources = isRecord(component.resources) ? component.resources : {};
  const stats = isRecord(component.categoryStats) ? component.categoryStats : {};
  return {
    componentKey: component.componentKey,
    entityClass: component.entityClass,
    className: component.className,
    displayName: component.displayName,
    category: component.category,
    type: component.type,
    subtype: component.subtype,
    size: component.size,
    grade: component.grade,
    class: component.class,
    manufacturer: component.manufacturer,
    health: isRecord(component.baseStats) ? component.baseStats.health ?? component.baseStats.hitpoints ?? null : null,
    mass: isRecord(component.baseStats) ? component.baseStats.mass ?? null : null,
    resources: {
      consumption: sanitizeApiValue(resources.consumption ?? {}),
      generation: sanitizeApiValue(resources.generation ?? {}),
    },
    stats: sanitizeApiValue(stats),
    confidence: component.confidence,
    missingFields: sanitizeApiValue(component.missingFields ?? []),
  };
}

function shapeCompatibleItem(item: unknown): JsonObject | null {
  if (!isRecord(item)) return null;
  return {
    componentKey: item.componentKey,
    displayName: item.displayName,
    category: item.category,
    componentCategory: item.componentCategory,
    type: item.type,
    subtype: item.subtype,
    size: item.size,
    confidence: item.confidence,
    matchReason: item.matchReason,
  };
}

function shapeCompatiblePort(port: JsonObject): JsonObject {
  return {
    shipKey: port.shipKey,
    shipName: port.shipName,
    portId: port.portId,
    portName: port.portName,
    parentPortId: port.parentPortId,
    depth: port.depth,
    portCategory: port.portCategory,
    ruleCategory: port.ruleCategory,
    portType: port.portType,
    portSubType: port.portSubType,
    minSize: port.minSize,
    maxSize: port.maxSize,
    allowedTypes: asArray(port.allowedTypes),
    defaultItem: shapeDefaultItem(port.defaultItem),
    compatibleItemCount: port.compatibleItemCount,
    confidenceSummary: port.confidenceSummary ?? {},
    compatibleItems: asArray(port.compatibleItems).map(shapeCompatibleItem).filter(isRecord),
  };
}

function shapeValidation(row: JsonObject): JsonObject {
  return {
    shipKey: row.shipKey,
    shipName: row.shipName,
    portId: row.portId,
    portName: row.portName,
    ruleCategory: row.ruleCategory,
    defaultItem: shapeDefaultItem(row.defaultItem),
    status: row.status,
    matchReason: row.matchReason,
    mismatchReason: row.mismatchReason,
    confidence: row.confidence,
  };
}

function shapePortBreakdown(row: unknown): JsonObject | null {
  if (!isRecord(row)) return null;
  return {
    shipKey: row.shipKey,
    portId: row.portId,
    portName: row.portName,
    portCategory: row.portCategory,
    ruleCategory: row.ruleCategory ?? row.portCategory,
    parentPortId: row.parentPortId,
    childPortIds: asArray(row.childPortIds),
    equippedComponentKey: row.equippedComponentKey,
    equippedComponentName: row.equippedComponentName,
    componentCategory: row.componentCategory,
    compatibilityStatus: row.compatibilityStatus,
    calculationContribution: row.calculationContribution ?? {},
    warnings: asArray(row.warnings),
    confidence: row.confidence,
  };
}

function shapeCalculation(example: JsonObject, ship?: JsonObject, unresolved: JsonObject[] = []): JsonObject {
  const shipKey = asString(example.shipKey);
  return {
    shipKey: example.shipKey,
    ship: {
      shipKey: example.shipKey,
      name: example.shipName ?? ship?.name,
      manufacturer: ship?.manufacturer ?? null,
    },
    summary: example.summary ?? {},
    warnings: asArray(example.warnings),
    confidence: example.confidence ?? CALCULATION_CONFIDENCE,
    calculationConfidence: CALCULATION_CONFIDENCE,
    unsupportedCategories: asArray(example.unsupportedExcluded),
    unsupportedMechanics: UNSUPPORTED_MECHANICS,
    unresolvedRefs: unresolved.filter((row) => row.shipKey === shipKey).map((row) => ({
      kind: row.kind,
      shipKey: row.shipKey,
      shipName: row.shipName,
      portId: row.portPath,
      ruleCategory: row.ruleCategory,
      status: row.status,
      reason: row.reason,
    })),
    defaultLoadoutValidation: example.defaultLoadoutValidation ?? {},
    portBreakdown: asArray(example.portBreakdown).map(shapePortBreakdown).filter(isRecord),
  };
}

async function findShip(shipKey: string): Promise<JsonObject | null> {
  const ships = await readRegistry("ships.json");
  return ships.find((ship) => sameKey(ship, shipKey)) ?? null;
}

async function findShipHardpoints(shipKey: string): Promise<JsonObject | null> {
  const hardpoints = await readRegistry("ship_hardpoints.json");
  return hardpoints.find((ship) => sameKey(ship, shipKey)) ?? null;
}

async function findShipCompatibility(shipKey: string): Promise<JsonObject | null> {
  const compatibleByShip = await readRegistry("compatible_items_by_ship.json");
  return compatibleByShip.find((ship) => sameKey(ship, shipKey)) ?? null;
}

async function findCalculation(shipKey: string): Promise<JsonObject | null> {
  const examples = await readRegistry("fitting_calculation_examples.json");
  return examples.find((example) => sameKey(example, shipKey)) ?? null;
}

function normalizeRequestedLoadout(body: unknown): JsonObject[] {
  if (!isRecord(body)) return [];
  const loadout = body.loadout ?? body.components;
  if (Array.isArray(loadout)) return loadout.filter(isRecord);
  if (!isRecord(loadout)) return [];
  return Object.entries(loadout).map(([portId, componentKey]) => ({ portId, componentKey }));
}

function buildCompatibilityLookup(ports: JsonObject[]): Map<string, JsonObject> {
  const lookup = new Map<string, JsonObject>();
  for (const port of ports) {
    const portId = asString(port.portId);
    if (portId) lookup.set(portId, port);
  }
  return lookup;
}

export async function listFittingShips(): Promise<RouteResult> {
  const [ships, calculations] = await Promise.all([
    readRegistry("ships.json"),
    readRegistry("fitting_calculation_examples.json"),
  ]);
  const calculatedShipKeys = new Set(calculations.map((row) => asString(row.shipKey)).filter((key): key is string => Boolean(key)));
  const records: JsonObject[] = ships.map((ship): JsonObject => ({
    ...shapeShipSummary(ship),
    hasPrototypeCalculation: calculatedShipKeys.has(asString(ship.shipKey) ?? ""),
  }));
  records.sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? "")));
  return {
    status: 200,
    body: {
      records,
      count: ships.length,
      confidence: CALCULATION_CONFIDENCE,
    },
  };
}

export async function getFittingShip(shipKey: string): Promise<RouteResult> {
  const ship = await findShip(shipKey);
  if (!ship) return { status: 404, body: { error: "Ship not found.", shipKey } };
  const [hardpoints, compatibility] = await Promise.all([
    findShipHardpoints(shipKey),
    findShipCompatibility(shipKey),
  ]);
  return {
    status: 200,
    body: {
      ship: shapeShipDetail(ship, hardpoints ?? undefined, compatibility ?? undefined),
      warnings: [],
      confidence: CALCULATION_CONFIDENCE,
    },
  };
}

export async function getFittingLoadout(shipKey: string): Promise<RouteResult> {
  const ship = await findShip(shipKey);
  if (!ship) return { status: 404, body: { error: "Ship not found.", shipKey } };

  const [loadouts, validations, calculation, unresolved, hardpoints] = await Promise.all([
    readRegistry("default_loadouts.json"),
    readRegistry("default_loadout_validation.json"),
    findCalculation(shipKey),
    readRegistry("fitting_calculation_unresolved_refs.json"),
    findShipHardpoints(shipKey),
  ]);
  const loadout = loadouts.find((row) => sameKey(row, shipKey));
  const validationRows = validations.filter((row) => row.shipKey === shipKey);
  const portInfoById = buildPortInfoById(hardpoints);
  if (calculation) {
    return { status: 200, body: shapeCalculation(calculation, ship, unresolved) };
  }

  return {
    status: 200,
    body: {
      shipKey,
      ship: {
        shipKey,
        name: ship.name,
        manufacturer: ship.manufacturer,
      },
      summary: null,
      warnings: ["prototype_calculation_example_missing"],
      confidence: "low",
      calculationConfidence: CALCULATION_CONFIDENCE,
      unsupportedCategories: [],
      unsupportedMechanics: UNSUPPORTED_MECHANICS,
      unresolvedRefs: [],
      defaultLoadoutValidation: validationRows.reduce<Record<string, number>>((counts, row) => {
        const status = asString(row.status) ?? "unknown";
        counts[status] = (counts[status] ?? 0) + 1;
        return counts;
      }, {}),
      portBreakdown: asArray(loadout?.entries).map((entry) => {
        if (!isRecord(entry)) return null;
        const validation = validationRows.find((row) => row.portId === entry.portPath);
        const portInfo = portInfoById.get(asString(entry.portPath) ?? "");
        return {
          shipKey,
          portId: entry.portPath,
          portName: entry.portName ?? portInfo?.portName,
          portCategory: portInfo?.portCategory ?? validation?.ruleCategory ?? null,
          ruleCategory: validation?.ruleCategory ?? null,
          parentPortId: portInfo?.parentPortId ?? null,
          childPortIds: asArray(portInfo?.childPortIds),
          equippedComponentKey: isRecord(entry.defaultItem) ? entry.defaultItem.guid : null,
          equippedComponentName: isRecord(entry.defaultItem) ? entry.defaultItem.displayName : null,
          componentCategory: null,
          compatibilityStatus: validation?.status ?? "unresolved",
          calculationContribution: {},
          warnings: ["calculation_not_available_for_this_ship_in_phase4_examples"],
          confidence: "low",
        };
      }).filter(isRecord),
    },
  };
}

export async function listFittingComponents(): Promise<RouteResult> {
  const components = await readRegistry("components.json");
  const categoryCounts = components.reduce<Record<string, number>>((counts, component) => {
    const category = asString(component.category) ?? "unknown";
    counts[category] = (counts[category] ?? 0) + 1;
    return counts;
  }, {});
  return {
    status: 200,
    body: {
      records: components.map(shapeComponent),
      count: components.length,
      categoryCounts,
      confidence: CALCULATION_CONFIDENCE,
    },
  };
}

export async function getCompatibleItems(url: URL): Promise<RouteResult> {
  const shipKey = url.searchParams.get("shipKey");
  const portId = url.searchParams.get("portId");
  const category = url.searchParams.get("category");

  if (shipKey) {
    const shipCompatibility = await findShipCompatibility(shipKey);
    if (!shipCompatibility) return { status: 404, body: { error: "Ship compatibility not found.", shipKey } };
    const ports = asArray(shipCompatibility.ports).filter(isRecord)
      .filter((port) => !portId || port.portId === portId)
      .filter((port) => !category || port.ruleCategory === category)
      .map(shapeCompatiblePort);
    return {
      status: 200,
      body: {
        shipKey,
        shipName: shipCompatibility.shipName,
        ports,
        count: ports.length,
        warnings: [],
        confidence: CALCULATION_CONFIDENCE,
      },
    };
  }

  const ports = await readRegistry("compatible_items_by_port.json");
  const filtered = ports
    .filter((port) => !portId || port.portId === portId)
    .filter((port) => !category || port.ruleCategory === category)
    .slice(0, 250)
    .map(shapeCompatiblePort);
  return {
    status: 200,
    body: {
      records: filtered,
      count: filtered.length,
      warnings: ports.length > filtered.length ? ["compatible list capped at 250 records; pass shipKey to retrieve a ship-specific map"] : [],
      confidence: CALCULATION_CONFIDENCE,
    },
  };
}

export async function validateFittingLoadout(body: unknown): Promise<RouteResult> {
  const shipKey = isRecord(body) ? asString(body.shipKey) : null;
  if (!shipKey) return { status: 400, body: { error: "shipKey is required." } };

  const shipCompatibility = await findShipCompatibility(shipKey);
  if (!shipCompatibility) return { status: 404, body: { error: "Ship compatibility not found.", shipKey } };

  const requested = normalizeRequestedLoadout(body);
  if (!requested.length) {
    const validations = (await readRegistry("default_loadout_validation.json"))
      .filter((row) => row.shipKey === shipKey)
      .map(shapeValidation);
    return {
      status: 200,
      body: {
        shipKey,
        shipName: shipCompatibility.shipName,
        mode: "default-loadout",
        validations,
        counts: validations.reduce<Record<string, number>>((counts, row) => {
          const status = asString(row.status) ?? "unknown";
          counts[status] = (counts[status] ?? 0) + 1;
          return counts;
        }, {}),
        warnings: [],
        confidence: CALCULATION_CONFIDENCE,
      },
    };
  }

  const ports = asArray(shipCompatibility.ports).filter(isRecord);
  const byPort = buildCompatibilityLookup(ports);
  const validations = requested.map((entry) => {
    const portId = asString(entry.portId);
    const componentKey = asString(entry.componentKey);
    const port = portId ? byPort.get(portId) : undefined;
    const compatibleItem = port && componentKey
      ? asArray(port.compatibleItems).filter(isRecord).find((item) => item.componentKey === componentKey)
      : undefined;
    return {
      shipKey,
      portId,
      componentKey,
      status: compatibleItem ? "compatible" : port ? "mismatch" : "unresolved",
      matchReason: compatibleItem?.matchReason ?? null,
      ruleCategory: port?.ruleCategory ?? null,
      confidence: compatibleItem?.confidence ?? "low",
      warnings: compatibleItem ? [] : [port ? "component_not_in_phase3_compatible_items" : "port_not_found_in_phase3_compatibility"],
    };
  });

  return {
    status: 200,
    body: {
      shipKey,
      shipName: shipCompatibility.shipName,
      mode: "requested-loadout",
      validations,
      counts: validations.reduce<Record<string, number>>((counts, row) => {
        counts[row.status] = (counts[row.status] ?? 0) + 1;
        return counts;
      }, {}),
      warnings: ["prototype validation uses Phase 3 compatibility outputs only"],
      confidence: CALCULATION_CONFIDENCE,
    },
  };
}

export async function calculateFittingLoadout(body: unknown): Promise<RouteResult> {
  const shipKey = isRecord(body) ? asString(body.shipKey) : null;
  if (!shipKey) return { status: 400, body: { error: "shipKey is required." } };

  const ship = await findShip(shipKey);
  if (!ship) return { status: 404, body: { error: "Ship not found.", shipKey } };

  const requested = normalizeRequestedLoadout(body);
  if (requested.length) {
    return {
      status: 422,
      body: {
        shipKey,
        error: "Custom loadout calculation is not supported by the Phase 4 prototype data.",
        warnings: ["use POST /api/fitting/validate for requested loadout compatibility checks"],
        confidence: "low",
        unsupportedMechanics: UNSUPPORTED_MECHANICS,
      },
    };
  }

  const [calculation, unresolved] = await Promise.all([
    findCalculation(shipKey),
    readRegistry("fitting_calculation_unresolved_refs.json"),
  ]);
  if (!calculation) {
    return {
      status: 422,
      body: {
        shipKey,
        ship: {
          shipKey,
          name: ship.name,
          manufacturer: ship.manufacturer,
        },
        summary: null,
        warnings: ["prototype_calculation_example_missing"],
        confidence: "low",
        calculationConfidence: CALCULATION_CONFIDENCE,
        unsupportedMechanics: UNSUPPORTED_MECHANICS,
        unresolvedRefs: [],
        portBreakdown: [],
      },
    };
  }

  return { status: 200, body: shapeCalculation(calculation, ship, unresolved) };
}
