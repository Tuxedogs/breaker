import { useState } from "react";
import PowerPipIcon from "../components/fitting/terminal/PowerPipIcons";
import PowerTower from "../components/fitting-v2/PowerTower";
import type { PipCategory } from "../lib/fitting/fittingTerminalTypes";
import "../components/fitting-v2/fitting-v2.css";

const fixtures: Array<{ key: string; label: string; categories: Array<{ category: PipCategory; max: number; min: number; initial: number; available?: boolean; reason?: string }>; percentage: string }> = [
  { key: "weapons", label: "Weapons", categories: [{ category: "weapons", max: 6, min: 5, initial: 5 }], percentage: "50%" },
  { key: "engines", label: "Engines", categories: [{ category: "engines", max: 6, min: 4, initial: 6 }], percentage: "18%" },
  { key: "shields", label: "Shields", categories: [{ category: "shields", max: 6, min: 4, initial: 0, available: false, reason: "Fixture unavailable state" }], percentage: "0%" },
  { key: "quantum", label: "QT Drive", categories: [{ category: "quantum", max: 6, min: 3, initial: 0 }], percentage: "0%" },
  { key: "life", label: "Life Support", categories: [{ category: "lifeSupport", max: 6, min: 3, initial: 3 }], percentage: "8%" },
  { key: "coolers", label: "Coolers", categories: [{ category: "cooler1", max: 6, min: 2, initial: 2 }, { category: "cooler2", max: 6, min: 2, initial: 0 }], percentage: "12%" },
];

export default function FittingV2PowerFixturePage() {
  const [allocations, setAllocations] = useState<Record<string, number>>(() => Object.fromEntries(fixtures.flatMap((fixture) => fixture.categories.map((item) => [item.category, item.initial]))));
  return (
    <main className="fitv2-page">
      <section className="fitv2-power" aria-label="Fitting V2 authored power-tower fixture">
        <header className="fitv2-power-heading"><div><span>Power systems</span><h2>Power allocation</h2></div></header>
        <div className="fitv2-power-console">
          <div className="fitv2-pip-grid fitv2-pip-stackl">
            {fixtures.map((fixture) => {
              const powered = fixture.categories.some((item) => allocations[item.category] > 0);
              return <article className={`fitv2-pip-tower ${powered ? "is-powered" : "is-unpowered"}`} aria-label={`${fixture.label} power allocation`} title={fixture.label} key={fixture.key}>
                <div className={`fitv2-pip-stack-group ${fixture.categories.length > 1 ? "is-paired" : ""}`}>
                  {fixture.categories.map((item) => <PowerTower key={item.category} label={item.category} maxPips={item.max} minPips={item.min} allocation={allocations[item.category]} available={item.available !== false} interactive={item.available !== false} unavailableReason={item.reason} onRequestAllocation={(allocation) => setAllocations((current) => ({ ...current, [item.category]: allocation }))} />)}
                </div>
                <button type="button" className="fitv2-pip-icon-button" aria-label={powered ? `Power off ${fixture.label}` : `Power ${fixture.label} to minimum`} onClick={() => setAllocations((current) => Object.fromEntries(Object.entries(current).map(([key, value]) => [key, fixture.categories.some((item) => item.category === key) ? (powered ? 0 : fixture.categories.find((item) => item.category === key)!.min) : value])))}>
                  <PowerPipIcon category={fixture.categories[0]!.category} className="fitv2-pip-icon" />
                </button>
                <em>{fixture.percentage}</em>
              </article>;
            })}
          </div>
          <div className="fitv2-power-dock">
            <div className="fitv2-dock-signature" aria-hidden><i /><i /><i /></div>
            <div className="fitv2-dock-cell is-output" title="Direct source generation from one installed power plant"><span>OUTPUT</span><strong>18</strong></div>
            <div className="fitv2-dock-divider" aria-hidden />
            <div className="fitv2-dock-cell is-battery"><span>BATTERY</span><strong>—</strong><b aria-hidden /></div>
          </div>
        </div>
      </section>
    </main>
  );
}
