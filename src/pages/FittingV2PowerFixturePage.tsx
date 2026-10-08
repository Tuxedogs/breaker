import { useMemo, useState } from "react";
import { FittingV2PowerSection } from "../components/fitting-v2/FittingV2Workspace";
import { EMPTY_PIP_DRAWS } from "../lib/fitting/fittingPipPower";
import { DEFAULT_PIP_ASSIGNMENT, type PipAssignment, type PipCategory } from "../lib/fitting/fittingTerminalTypes";
import { applyFittingV2ModeledPowerRequest, type FittingV2ModeledPowerAssignment } from "../lib/fitting-v2/fittingV2ModeledPower";
import { applyFittingV2PowerRequest } from "../lib/fitting-v2/fittingV2PowerState";
import type { FittingSimulationState } from "../lib/fitting/useFittingSimulation";
import type { FittingComponentAllocation } from "../lib/fitting/fittingApi";
import type { PortBreakdownRow } from "../lib/fitting/fittingPortGrouping";
import "../components/fitting-v2/fitting-v2.css";

const row = (portId: string, category: string, name = portId): PortBreakdownRow => ({ shipKey: "fixture", portId, portName: name, portType: category, portSubtype: null, portCategory: category, ruleCategory: category, parentPortId: null, childPortIds: [], equippedComponentKey: `${portId}-component`, equippedComponentName: name, componentCategory: category, componentManufacturer: null, componentSize: 1, portExactSize: 1, portMinSize: 1, portMaxSize: 1, componentSubtype: null, compatibilityStatus: null, editable: true, bespoke: false, locked: false, warnings: [], confidence: null });
const physical = (entry: PortBreakdownRow): FittingComponentAllocation => ({ portId: entry.portId, componentKey: entry.equippedComponentKey, componentType: entry.componentCategory!, displayName: entry.equippedComponentName, allocationStatus: "supported", allocationReason: null, segmentAllocationSupported: true, minimumSegments: 2, maximumSegments: 6, powerRanges: [], provenance: {} });
const rows = [row("weapon-pool", "ship_weapon", "Weapons"), row("engines", "thruster", "Engines"), row("quantum", "quantum_drive", "Quantum"), row("qed", "utility", "QED"), row("emp", "utility", "EMP"), row("radar", "radar", "Radar"), row("shield-a", "shield", "Shield A"), row("shield-b", "shield", "Shield B"), row("shield-c", "shield", "Shield C"), row("cooler-a", "cooler", "Cooler A"), row("cooler-b", "cooler", "Cooler B")];
const contracts = rows.filter((entry) => ["shield", "cooler", "radar"].includes(entry.componentCategory!)).map(physical);
const powerMetadata = (minimum: number | null, maximum: number | null, addressability = "selectable-pips") => ({
  minimumSegments: { value: minimum },
  nominalSegments: { value: minimum },
  maximumSegments: { value: maximum },
  exactAllocationCurve: [],
  unavailableReason: maximum == null ? "Fixture allocation maximum unavailable." : null,
  unitType: "PowerSegment",
  addressability,
  componentCount: maximum == null ? 0 : 1,
  perComponent: [],
});
const simulation = { data: { power: { categories: {
  weapons: powerMetadata(1, 4), engines: powerMetadata(1, 6), quantum: powerMetadata(3, 3), radar: powerMetadata(2, 6), shields: powerMetadata(2, 6), lifeSupport: powerMetadata(null, null, "bounds-unavailable"), cooler1: powerMetadata(2, 6), cooler2: powerMetadata(2, 6),
} } }, loading: false, error: null } as unknown as FittingSimulationState;

export default function FittingV2PowerFixturePage() {
  const [multiPlant, setMultiPlant] = useState(false);
  const [assignment, setAssignment] = useState<PipAssignment>({ ...DEFAULT_PIP_ASSIGNMENT, weapons: 2, shields: 2 });
  const [modeled, setModeled] = useState<FittingV2ModeledPowerAssignment>({});
  const [physicalAssignment, setPhysicalAssignment] = useState<Record<string, number>>({});
  const aggregate = useMemo(() => multiPlant ? { available: false, status: "unresolved_multi_power_plant_scaling", installedPlantCount: 2, generation: null, reason: "Aggregate generation is unresolved for multiple installed power plants." } : { available: true, status: "direct_source_single_plant", installedPlantCount: 1, generation: 24, reason: null }, [multiPlant]);
  return <main className="fitv2-page"><label className="fitv2-power-fixture-picker">Fixture <select aria-label="Power fixture scenario" value={multiPlant ? "multi" : "single"} onChange={(event) => setMultiPlant(event.target.value === "multi")}><option value="single">All channels · single plant</option><option value="multi">All channels · multiple plants</option></select></label><FittingV2PowerSection assignment={assignment} modeledPowerAssignment={modeled} physicalPowerAssignment={physicalAssignment} draws={EMPTY_PIP_DRAWS} ready={false} simulation={simulation} effects={[]} portRows={rows} componentAllocations={contracts} powerAggregateGeneration={aggregate} onChange={(category: PipCategory, value, bounds) => setAssignment((current) => applyFittingV2PowerRequest(current, category, value, bounds ?? { minimum: null, maximum: null }))} onModeledPowerChange={(key, value) => setModeled((current) => applyFittingV2ModeledPowerRequest(current, key, value))} onPhysicalPowerChange={(key, value) => setPhysicalAssignment((current) => ({ ...current, [key]: value }))} /></main>;
}
