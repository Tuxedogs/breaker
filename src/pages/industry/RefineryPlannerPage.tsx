import { useEffect, useMemo, useState } from "react";

import {
  BASE_REFINERY_YIELD,
  findBestSingleRefinery,
  optimizePerMaterial,
  scoreSingleRefinery,
} from "../../lib/refineryCalculations";
import { loadRefineryDataset } from "../../lib/refineryData";
import type {
  RefineryDataset,
  RefineryMaterialCalculation,
  RefineryMaterialId,
  RefineryTarget,
} from "../../types/refinery";
import "./refinery-planner.css";

type PlannerMode = "optimized" | "single" | "selected";

const INITIAL_TARGETS: RefineryTarget[] = [
  { materialId: "agricium", desiredRefinedAmount: 100 },
  { materialId: "bexalite", desiredRefinedAmount: 200 },
  { materialId: "titanium", desiredRefinedAmount: 150 },
  { materialId: "quantanium", desiredRefinedAmount: 50 },
];

function formatScu(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return "Unavailable";
  return `${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SCU`;
}

function formatBonus(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${value}%`;
}

function formatDelta(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return "Unavailable";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SCU`;
}

function calculationMap(calculations: RefineryMaterialCalculation[] | undefined) {
  return new Map((calculations ?? []).map((calculation) => [calculation.materialId, calculation]));
}

export default function RefineryPlannerPage() {
  const [dataset, setDataset] = useState<RefineryDataset | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [targets, setTargets] = useState<RefineryTarget[]>(INITIAL_TARGETS);
  const [selectedRefineryId, setSelectedRefineryId] = useState("");
  const [materialId, setMaterialId] = useState<RefineryMaterialId>("agricium");
  const [amount, setAmount] = useState("100");
  const [mode, setMode] = useState<PlannerMode>("optimized");

  useEffect(() => {
    let cancelled = false;
    loadRefineryDataset()
      .then((loaded) => {
        if (cancelled) return;
        const preferred = loaded.refineries.find((refinery) => refinery.name === "ARC-L1") ?? loaded.refineries[0];
        setDataset(loaded);
        setSelectedRefineryId(preferred?.id ?? "");
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "Unable to load refinery data.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const comparisons = useMemo(() => {
    if (!dataset) return null;
    return {
      optimized: optimizePerMaterial(dataset.refineries, targets),
      single: findBestSingleRefinery(dataset.refineries, targets),
      selected: selectedRefineryId
        ? scoreSingleRefinery(dataset.refineries.find((refinery) => refinery.id === selectedRefineryId)!, targets)
        : null,
    };
  }, [dataset, selectedRefineryId, targets]);

  const materialNames = useMemo(
    () => new Map(dataset?.materials.map((material) => [material.id, material.displayName]) ?? []),
    [dataset],
  );
  const refineryById = useMemo(
    () => new Map(dataset?.refineries.map((refinery) => [refinery.id, refinery]) ?? []),
    [dataset],
  );
  const optimizedByMaterial = useMemo(() => calculationMap(comparisons?.optimized?.calculations), [comparisons]);
  const singleByMaterial = useMemo(() => calculationMap(comparisons?.single?.calculations), [comparisons]);
  const selectedByMaterial = useMemo(() => calculationMap(comparisons?.selected?.calculations), [comparisons]);
  const selectedRefinery = selectedRefineryId ? refineryById.get(selectedRefineryId) : undefined;
  const recommendedRefineryIds = new Set(comparisons?.optimized?.calculations.map((calculation) => calculation.refineryId) ?? []);
  const recommendedSystems = new Set(
    [...recommendedRefineryIds].flatMap((id) => {
      const refinery = refineryById.get(id);
      return refinery ? [refinery.systemCode] : [];
    }),
  );
  const totalRefined = targets.reduce((total, target) => total + target.desiredRefinedAmount, 0);
  const optimizedRaw = comparisons?.optimized?.totalRawRequired;
  const selectedRaw = comparisons?.selected?.totalRawRequired;
  const selectedPenalty = selectedRaw !== undefined && optimizedRaw !== undefined ? selectedRaw - optimizedRaw : undefined;
  const selectedPenaltyPercent = selectedPenalty !== undefined && optimizedRaw ? (selectedPenalty / optimizedRaw) * 100 : undefined;

  function addTarget() {
    const desiredRefinedAmount = Number(amount);
    if (!Number.isFinite(desiredRefinedAmount) || desiredRefinedAmount <= 0) return;
    setTargets((current) => {
      const existing = current.find((target) => target.materialId === materialId);
      if (!existing) return [...current, { materialId, desiredRefinedAmount }];
      return current.map((target) =>
        target.materialId === materialId
          ? { ...target, desiredRefinedAmount: target.desiredRefinedAmount + desiredRefinedAmount }
          : target,
      );
    });
  }

  if (loadError) {
    return <div className="rp-state rp-state--error">Unable to load Refinery Planner: {loadError}</div>;
  }
  if (!dataset) {
    return <div className="rp-state">Loading refinery yield data...</div>;
  }
  if (dataset.materials.length === 0 || dataset.refineries.length === 0) {
    return <div className="rp-state">No refinery yield records are available.</div>;
  }

  return (
    <main className="rp-page">
      <header className="rp-header">
        <div>
          <p className="rp-breadcrumb"><span>Industry</span><i>/</i><strong>Refinery</strong></p>
          <h1>Refinery Planner</h1>
          <p>Find the best refinery for each material and calculate raw requirements.</p>
        </div>
        <div className="rp-yield-callout">
          <span>Base refinery yield</span>
          <strong>{BASE_REFINERY_YIELD * 100}%</strong>
          <small>Final yield = 40% × (1 + bonus%)</small>
        </div>
      </header>

      <div className="rp-layout">
        <section className="rp-panel rp-target-panel">
          <div className="rp-panel-heading">
            <div><span>01</span><h2>Refined Target Builder</h2></div>
            <button type="button" onClick={() => setTargets([])} disabled={targets.length === 0}>Clear all</button>
          </div>
          <div className="rp-form">
            <label>
              Material
              <select value={materialId} onChange={(event) => setMaterialId(event.target.value as RefineryMaterialId)}>
                {dataset.materials.map((material) => <option key={material.id} value={material.id}>{material.displayName}</option>)}
              </select>
            </label>
            <label>
              Refined target (SCU)
              <input min="0.01" step="0.01" type="number" value={amount} onChange={(event) => setAmount(event.target.value)} />
            </label>
            <button className="rp-primary-button" type="button" onClick={addTarget}>Add target</button>
          </div>
          <div className="rp-target-list">
            {targets.length === 0 ? <p className="rp-empty">Add a refined material target to begin.</p> : targets.map((target) => (
              <div className="rp-target-row" key={target.materialId}>
                <div><strong>{materialNames.get(target.materialId) ?? target.materialId}</strong><small>Refined material</small></div>
                <span>{formatScu(target.desiredRefinedAmount)}</span>
                <button type="button" aria-label={`Remove ${materialNames.get(target.materialId) ?? target.materialId}`} onClick={() => setTargets((current) => current.filter((item) => item.materialId !== target.materialId))}>×</button>
              </div>
            ))}
          </div>
          <div className="rp-panel-summary"><span>Total refined target</span><strong>{formatScu(totalRefined)}</strong></div>
        </section>

        <section className="rp-panel rp-comparison-panel">
          <div className="rp-panel-heading"><div><span>02</span><h2>Strategy Comparison</h2></div></div>
          <div className="rp-mode-tabs" role="tablist" aria-label="Refinery comparison mode">
            {([
              ["optimized", "Optimized Per Material", "Best refinery for each material"],
              ["single", "Best Single Refinery", comparisons?.single?.refineryName ?? "One refinery for all targets"],
              ["selected", "Selected Refinery", selectedRefinery?.name ?? "Choose one refinery to compare"],
            ] as const).map(([id, label, description]) => (
              <button type="button" role="tab" aria-selected={mode === id} className={mode === id ? "is-active" : ""} key={id} onClick={() => setMode(id)}>
                <strong>{label}</strong><small>{description}</small>
              </button>
            ))}
          </div>
          <div className="rp-summary-rail">
            <article className={mode === "optimized" ? "is-active is-positive" : "is-positive"}><span>Optimized Per Material</span><strong>{formatScu(optimizedRaw)}</strong><small>Best refinery for every material</small></article>
            <article className={mode === "single" ? "is-active" : ""}><span>Best Single Refinery</span><strong>{formatScu(comparisons?.single?.totalRawRequired)}</strong><small>{comparisons?.single?.refineryName ?? "No refinery available"}</small></article>
            <article className={mode === "selected" ? "is-active is-selected" : "is-selected"}><span>Selected Refinery</span><strong>{formatScu(selectedRaw)}</strong><small>{selectedPenalty === undefined ? "Choose one refinery" : `${formatDelta(selectedPenalty)} vs optimized`}</small></article>
          </div>
          <div className="rp-selected-comparison">
            <label htmlFor="rp-selected-refinery">Selected refinery comparison</label>
            <select id="rp-selected-refinery" value={selectedRefineryId} onChange={(event) => setSelectedRefineryId(event.target.value)}>
              {dataset.refineries.map((refinery) => <option key={refinery.id} value={refinery.id}>{refinery.name} / {refinery.systemCode}</option>)}
            </select>
            <span>{selectedPenalty === undefined ? "Unavailable" : `${formatDelta(selectedPenalty)} (${selectedPenaltyPercent?.toFixed(1) ?? "0.0"}%) vs optimized`}</span>
          </div>
          <div className="rp-table-wrap">
            <table className="rp-table">
              <thead><tr><th>Material</th><th>Refined target</th><th>Optimized refinery</th><th>Optimized bonus</th><th>Optimized raw</th><th>Best single bonus / raw</th><th>Selected refinery</th><th>Selected bonus</th><th>Selected raw</th></tr></thead>
              <tbody>
                {targets.length === 0 ? <tr><td colSpan={9} className="rp-empty">Add targets to calculate refinery requirements.</td></tr> : targets.map((target) => {
                  const optimized = optimizedByMaterial.get(target.materialId);
                  const single = singleByMaterial.get(target.materialId);
                  const selected = selectedByMaterial.get(target.materialId);
                  return (
                    <tr key={target.materialId}>
                      <td><strong>{materialNames.get(target.materialId) ?? target.materialId}</strong></td>
                      <td>{formatScu(target.desiredRefinedAmount)}</td>
                      <td>{optimized?.refineryName ?? "—"}</td>
                      <td><span className="rp-bonus">{formatBonus(optimized?.bonusPercent)}</span></td>
                      <td>{formatScu(optimized?.rawRequired)}</td>
                      <td><span className="rp-bonus">{formatBonus(single?.bonusPercent)}</span><small>{formatScu(single?.rawRequired)}</small></td>
                      <td>{selected?.refineryName ?? "—"}</td>
                      <td><span className="rp-bonus">{formatBonus(selected?.bonusPercent)}</span></td>
                      <td>{formatScu(selected?.rawRequired)}</td>
                    </tr>
                  );
                })}
              </tbody>
              {targets.length > 0 && <tfoot><tr><td colSpan={4}>Total raw required</td><td>{formatScu(optimizedRaw)}</td><td>{formatScu(comparisons?.single?.totalRawRequired)}</td><td colSpan={2}></td><td>{formatScu(selectedRaw)}</td></tr></tfoot>}
            </table>
          </div>
        </section>

        <aside className="rp-panel rp-recommendation-panel">
          <div className="rp-panel-heading"><div><span>03</span><h2>Best Refineries</h2></div></div>
          <div className="rp-recommendation-list">
            {targets.length === 0 ? <p className="rp-empty">Add targets to see refinery recommendations.</p> : targets.map((target) => {
              const recommendation = optimizedByMaterial.get(target.materialId);
              const refinery = recommendation ? refineryById.get(recommendation.refineryId) : undefined;
              return (
                <article className="rp-recommendation-row" key={target.materialId}>
                  <div className="rp-recommendation-material">
                    <strong>{materialNames.get(target.materialId) ?? target.materialId}</strong>
                    <small>{formatScu(target.desiredRefinedAmount)} refined</small>
                  </div>
                  <div className="rp-recommendation-refinery">
                    <strong>{recommendation?.refineryName ?? "Unavailable"}</strong>
                    <small>{refinery?.systemCode ?? "Unknown system"}</small>
                  </div>
                  <span className="rp-bonus">{formatBonus(recommendation?.bonusPercent)}</span>
                  <span>{formatScu(recommendation?.rawRequired)}</span>
                </article>
              );
            })}
          </div>
          <h3 className="rp-recommendation-summary-title">Recommendation Summary</h3>
          <dl className="rp-recommendation-summary">
            <div><dt>Target materials</dt><dd>{targets.length}</dd></div>
            <div><dt>Recommended refineries</dt><dd>{recommendedRefineryIds.size}</dd></div>
            <div><dt>Systems covered</dt><dd>{recommendedSystems.size}</dd></div>
            <div className="is-positive"><dt>Optimized raw required</dt><dd>{formatScu(optimizedRaw)}</dd></div>
          </dl>
        </aside>
      </div>
    </main>
  );
}
