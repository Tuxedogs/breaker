import { useState } from "react";
import PowerPipIcon from "../components/fitting/terminal/PowerPipIcons";
import type { SystemIconKind } from "../components/fitting/terminal/SystemIcon";
import PowerTower from "../components/fitting-v2/PowerTower";
import type { PipCategory } from "../lib/fitting/fittingTerminalTypes";
import "../components/fitting-v2/fitting-v2.css";

type FixtureColumn = { portId: string; label: string; category: PipCategory; icon: SystemIconKind; min: number; max: number; initial: number };
type FixtureScenario = { key: string; label: string; columns: FixtureColumn[]; output: number | null; outputReason: string };

const column = (portId: string, label: string, category: PipCategory, icon: SystemIconKind, min: number, max: number, initial = 0): FixtureColumn => ({ portId, label, category, icon, min, max, initial });
const scenarios: FixtureScenario[] = [
  { key: "single", label: "Single plant", columns: [column("shield-generator", "Shield Generator", "shields", "shields", 4, 6, 4), column("cooler", "Cooler", "cooler1", "cooler", 2, 6, 2), column("radar", "Radar", "radar", "radar", 2, 6, 2)], output: 18, outputReason: "Direct source generation from one installed power plant" },
  { key: "coolers", label: "Two physical coolers", columns: [column("cooler-left", "Cooler Left", "cooler1", "cooler", 2, 6, 2), column("cooler-right", "Cooler Right", "cooler2", "cooler", 3, 6)], output: 18, outputReason: "Direct source generation from one installed power plant" },
  { key: "shields", label: "More than two shields", columns: Array.from({ length: 4 }, (_, index) => column(`shield-${index + 1}`, `Shield ${index + 1}`, "shields", "shields", 4, 6)), output: 24, outputReason: "Direct source generation from one installed power plant" },
  { key: "radar", label: "Supported radar", columns: [column("radar-main", "Radar Main", "radar", "radar", 2, 6)], output: 12, outputReason: "Direct source generation from one installed power plant" },
  { key: "multi-plant", label: "Multiple plants", columns: [column("cooler-a", "Cooler A", "cooler1", "cooler", 2, 6, 2), column("cooler-b", "Cooler B", "cooler2", "cooler", 2, 6, 2)], output: null, outputReason: "Aggregate generation is unresolved for multiple installed power plants" },
];

const initialAllocations = (scenario: FixtureScenario) => Object.fromEntries(scenario.columns.map((item) => [item.portId, item.initial]));

export default function FittingV2PowerFixturePage() {
  const [scenarioKey, setScenarioKey] = useState(scenarios[0]!.key);
  const scenario = scenarios.find((item) => item.key === scenarioKey) ?? scenarios[0]!;
  const [allocations, setAllocations] = useState<Record<string, number>>(() => initialAllocations(scenario));
  const selectScenario = (key: string) => {
    const next = scenarios.find((item) => item.key === key) ?? scenarios[0]!;
    setScenarioKey(next.key);
    setAllocations(initialAllocations(next));
  };
  return <main className="fitv2-page"><section className="fitv2-power" aria-label="Fitting V2 physical power contract fixture">
    <header className="fitv2-power-heading"><div><span>Power systems</span><h2>Power allocation</h2></div><label className="fitv2-power-fixture-picker">Fixture <select aria-label="Power fixture scenario" value={scenario.key} onChange={(event) => selectScenario(event.target.value)}>{scenarios.map((item) => <option value={item.key} key={item.key}>{item.label}</option>)}</select></label></header>
    <div className="fitv2-power-console"><div className="fitv2-pip-grid fitv2-pip-stackl">{scenario.columns.map((item) => {
      const allocation = allocations[item.portId] ?? 0;
      const powered = allocation > 0;
      return <article className={`fitv2-pip-tower ${powered ? "is-powered" : "is-unpowered"}`} aria-label={`${item.label} power allocation`} data-port-id={item.portId} title={`${item.label} · ${item.portId}`} key={item.portId}>
        <div className="fitv2-pip-stack-group"><PowerTower label={item.label} maxPips={item.max} minPips={item.min} allocation={allocation} available interactive onRequestAllocation={(value) => setAllocations((current) => ({ ...current, [item.portId]: value }))} /></div>
        <button type="button" className="fitv2-pip-icon-button" aria-label={powered ? `Power off ${item.label}` : `Power ${item.label} to minimum`} onClick={() => setAllocations((current) => ({ ...current, [item.portId]: powered ? 0 : item.min }))}><PowerPipIcon category={item.category} kind={item.icon} className={`fitv2-pip-icon is-${item.icon}`} /></button>
        <em>{item.portId}</em>
      </article>;
    })}</div>
      <div className="fitv2-power-dock"><div className="fitv2-dock-signature" aria-hidden><i /><i /><i /></div><div className="fitv2-dock-cell is-output" title={scenario.outputReason}><span>OUTPUT</span><strong>{scenario.output ?? "—"}</strong></div><div className="fitv2-dock-divider" aria-hidden /><div className="fitv2-dock-cell is-battery"><span>BATTERY</span><strong>—</strong><b aria-hidden /></div></div>
    </div>
  </section></main>;
}
