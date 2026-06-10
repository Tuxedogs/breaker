import { useEffect, useMemo, useState } from "react";
import type { KeyboardEvent } from "react";

import {
  BASE_REFINERY_YIELD,
  findBestSingleRefinery,
  optimizePerMaterial,
  scoreSingleRefinery,
} from "../../lib/refineryCalculations";
import { loadRefineryDataset, loadRefineryMaterialOptions } from "../../lib/refineryData";
import type {
  RefineryCanonicalMaterial,
  RefineryDataset,
  RefineryMaterialCalculation,
  RefineryMaterialId,
  RefineryTarget,
} from "../../types/refinery";
import "./refinery-planner.css";

type PlannerMode = "optimized" | "single" | "selected";

function formatScu(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return "Unavailable";
  return `${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SCU`;
}

function formatBonus(value: number | undefined, hasData = true): string {
  if (!hasData) return "No bonus data";
  if (value === undefined || !Number.isFinite(value)) return "--";
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
  const [materials, setMaterials] = useState<RefineryCanonicalMaterial[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [targets, setTargets] = useState<RefineryTarget[]>([]);
  const [selectedRefineryId, setSelectedRefineryId] = useState("");
  const [materialId, setMaterialId] = useState<RefineryMaterialId | "">("");
  const [materialQuery, setMaterialQuery] = useState("");
  const [isMaterialComboboxOpen, setIsMaterialComboboxOpen] = useState(false);
  const [activeMaterialIndex, setActiveMaterialIndex] = useState(0);
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<PlannerMode>("optimized");

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadRefineryDataset(), loadRefineryMaterialOptions()])
      .then(([loaded, loadedMaterials]) => {
        if (cancelled) return;
        const preferred = loaded.refineries.find((refinery) => refinery.name === "ARC-L1") ?? loaded.refineries[0];
        setDataset(loaded);
        setMaterials(loadedMaterials);
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

  const materialNames = useMemo(() => {
    const names = new Map(dataset?.materials.map((material) => [material.id, material.displayName]) ?? []);
    for (const material of materials) names.set(material.id, material.displayName);
    return names;
  }, [dataset, materials]);
  const refineryById = useMemo(
    () => new Map(dataset?.refineries.map((refinery) => [refinery.id, refinery]) ?? []),
    [dataset],
  );
  const hasBonusByMaterial = useMemo(() => {
    const bonusMap = new Map<string, boolean>();
    for (const material of materials) {
      bonusMap.set(
        material.id,
        Boolean(dataset?.refineries.some((refinery) => Number.isFinite(refinery.materialBonuses[material.id]))),
      );
    }
    return bonusMap;
  }, [dataset, materials]);
  const optimizedByMaterial = useMemo(() => calculationMap(comparisons?.optimized?.calculations), [comparisons]);
  const selectedByMaterial = useMemo(() => calculationMap(comparisons?.selected?.calculations), [comparisons]);
  const materialSuggestions = useMemo(() => {
    const query = materialQuery.trim().toLowerCase();
    if (!query) return materials;
    return materials.filter(
      (material) =>
        material.displayName.toLowerCase().includes(query) ||
        material.materialForm.toLowerCase().includes(query) ||
        material.id.toLowerCase().includes(query),
    );
  }, [materialQuery, materials]);
  const selectedRefinery = selectedRefineryId ? refineryById.get(selectedRefineryId) : undefined;
  const recommendedRefineryIds = new Set(
    comparisons?.optimized?.calculations.map((calculation) => calculation.refineryId) ?? [],
  );
  const recommendedSystems = new Set(
    [...recommendedRefineryIds].flatMap((id) => {
      const refinery = refineryById.get(id);
      return refinery ? [refinery.systemCode] : [];
    }),
  );
  const totalRawInput = targets.reduce((total, target) => total + target.rawInputScu, 0);
  const optimizedOutput = comparisons?.optimized?.totalRefinedOutputScu;
  const selectedOutput = comparisons?.selected?.totalRefinedOutputScu;
  const selectedDelta = selectedOutput !== undefined && optimizedOutput !== undefined ? selectedOutput - optimizedOutput : undefined;
  const selectedDeltaPercent = selectedDelta !== undefined && optimizedOutput ? (selectedDelta / optimizedOutput) * 100 : undefined;
  const rawInputScu = Number(amount);
  const canAddTarget = materialId !== "" && Number.isFinite(rawInputScu) && rawInputScu > 0;

  function selectMaterial(material: RefineryCanonicalMaterial) {
    setMaterialId(material.id);
    setMaterialQuery(material.displayName);
    setIsMaterialComboboxOpen(false);
    setActiveMaterialIndex(0);
  }

  function addTarget() {
    const selectedMaterialId = materialId;
    if (selectedMaterialId === "" || !Number.isFinite(rawInputScu) || rawInputScu <= 0) return;
    setTargets((current) => {
      const existing = current.find((target) => target.materialId === selectedMaterialId);
      if (!existing) return [...current, { materialId: selectedMaterialId, rawInputScu }];
      return current.map((target) =>
        target.materialId === selectedMaterialId
          ? { ...target, rawInputScu: target.rawInputScu + rawInputScu }
          : target,
      );
    });
  }

  function handleMaterialInputChange(value: string) {
    const exactMaterial = materials.find((material) => material.displayName.toLowerCase() === value.trim().toLowerCase());
    setMaterialQuery(value);
    setMaterialId(exactMaterial?.id ?? "");
    setIsMaterialComboboxOpen(true);
    setActiveMaterialIndex(0);
  }

  function handleMaterialKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsMaterialComboboxOpen(true);
      setActiveMaterialIndex((current) => Math.min(current + 1, Math.max(materialSuggestions.length - 1, 0)));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setIsMaterialComboboxOpen(true);
      setActiveMaterialIndex((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === "Enter") {
      if (!isMaterialComboboxOpen || materialSuggestions.length === 0) return;
      event.preventDefault();
      selectMaterial(materialSuggestions[activeMaterialIndex] ?? materialSuggestions[0]);
      return;
    }
    if (event.key === "Escape") {
      setIsMaterialComboboxOpen(false);
    }
  }

  if (loadError) {
    return <div className="rp-state rp-state--error">Unable to load Refinery Planner: {loadError}</div>;
  }
  if (!dataset) {
    return <div className="rp-state">Loading refinery yield data...</div>;
  }
  if (materials.length === 0 || dataset.refineries.length === 0) {
    return <div className="rp-state">No refinery yield records are available.</div>;
  }

  return (
    <main className="rp-page">
      <header className="rp-header">
        <div>
          <p className="rp-breadcrumb"><span>Industry</span><i>/</i><strong>Refinery</strong></p>
          <h1>Refinery Planner</h1>
          <p>Find the best refinery for each material and estimate refined output from raw input.</p>
        </div>
        <div className="rp-yield-callout">
          <span>Base refinery yield</span>
          <strong>{BASE_REFINERY_YIELD * 100}%</strong>
          <small>Refined output = raw input x 40% x (1 + bonus%)</small>
        </div>
      </header>

      <div className="rp-layout">
        <section className="rp-panel rp-target-panel">
          <div className="rp-panel-heading">
            <div><span>01</span><h2>Raw Input Builder</h2></div>
            <button type="button" onClick={() => setTargets([])} disabled={targets.length === 0}>Clear all</button>
          </div>
          <div className="rp-form">
            <label
              className="rp-combobox-field"
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setIsMaterialComboboxOpen(false);
                }
              }}
            >
              Material
              <div className="rp-combobox">
                <input
                  aria-activedescendant={
                    isMaterialComboboxOpen && materialSuggestions.length > 0
                      ? `rp-material-option-${materialSuggestions[activeMaterialIndex]?.id ?? materialSuggestions[0].id}`
                      : undefined
                  }
                  aria-autocomplete="list"
                  aria-controls="rp-material-suggestions"
                  aria-expanded={isMaterialComboboxOpen}
                  autoComplete="off"
                  placeholder="Search material"
                  role="combobox"
                  type="text"
                  value={materialQuery}
                  onChange={(event) => handleMaterialInputChange(event.target.value)}
                  onFocus={() => setIsMaterialComboboxOpen(true)}
                  onKeyDown={handleMaterialKeyDown}
                />
                {isMaterialComboboxOpen && (
                  <div className="rp-combobox-options" id="rp-material-suggestions" role="listbox">
                    {materialSuggestions.length === 0 ? (
                      <div className="rp-combobox-empty">No matching material</div>
                    ) : materialSuggestions.map((material, index) => (
                      <button
                        className={index === activeMaterialIndex ? "is-active" : ""}
                        id={`rp-material-option-${material.id}`}
                        key={material.id}
                        role="option"
                        type="button"
                        aria-selected={material.id === materialId}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => selectMaterial(material)}
                      >
                        <strong>{material.displayName}</strong>
                        <small>{hasBonusByMaterial.get(material.id) ? "Bonus data" : "No bonus data"}</small>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </label>
            <label>
              Raw Input (SCU)
              <input min="0.01" placeholder="25" step="0.01" type="number" value={amount} onChange={(event) => setAmount(event.target.value)} />
            </label>
            <button className="rp-primary-button" type="button" onClick={addTarget} disabled={!canAddTarget}>Add Target</button>
          </div>
          <div className="rp-target-list">
            {targets.length === 0 ? <p className="rp-empty">Add raw material input to begin.</p> : targets.map((target) => (
              <div className="rp-target-row" key={target.materialId}>
                <div><strong>{materialNames.get(target.materialId) ?? target.materialId}</strong><small>{hasBonusByMaterial.get(target.materialId) ? "Raw material" : "Raw material / no bonus data"}</small></div>
                <span>{formatScu(target.rawInputScu)}</span>
                <button type="button" aria-label={`Remove ${materialNames.get(target.materialId) ?? target.materialId}`} onClick={() => setTargets((current) => current.filter((item) => item.materialId !== target.materialId))}>x</button>
              </div>
            ))}
          </div>
          <div className="rp-panel-summary"><span>Total Raw Input</span><strong>{formatScu(totalRawInput)}</strong></div>
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
            <article className={mode === "optimized" ? "is-active is-positive" : "is-positive"}><span>Optimized Output</span><strong>{formatScu(optimizedOutput)}</strong><small>Best refinery for every material</small></article>
            <article className={mode === "single" ? "is-active" : ""}><span>Best Single Output</span><strong>{formatScu(comparisons?.single?.totalRefinedOutputScu)}</strong><small>{comparisons?.single?.refineryName ?? "No refinery available"}</small></article>
            <article className={mode === "selected" ? "is-active is-selected" : "is-selected"}><span>Selected Output</span><strong>{formatScu(selectedOutput)}</strong><small>{selectedDelta === undefined ? "Choose one refinery" : `${formatDelta(selectedDelta)} vs optimized`}</small></article>
          </div>
          <div className="rp-selected-comparison">
            <label htmlFor="rp-selected-refinery">Selected refinery comparison</label>
            <select id="rp-selected-refinery" value={selectedRefineryId} onChange={(event) => setSelectedRefineryId(event.target.value)}>
              {dataset.refineries.map((refinery) => <option key={refinery.id} value={refinery.id}>{refinery.name} / {refinery.systemCode}</option>)}
            </select>
            <span>{selectedDelta === undefined ? "Unavailable" : `${formatDelta(selectedDelta)} (${selectedDeltaPercent?.toFixed(1) ?? "0.0"}%) vs optimized`}</span>
          </div>
          <div className="rp-table-wrap">
            <table className="rp-table">
              <thead><tr><th>Material</th><th>Raw Input</th><th>Selected Refinery</th><th>Selected Bonus</th><th>Selected Refined Output</th></tr></thead>
              <tbody>
                {targets.length === 0 ? <tr><td colSpan={5} className="rp-empty">Add raw input to calculate refined output.</td></tr> : targets.map((target) => {
                  const selected = selectedByMaterial.get(target.materialId);
                  return (
                    <tr key={target.materialId}>
                      <td><strong>{materialNames.get(target.materialId) ?? target.materialId}</strong></td>
                      <td>{formatScu(target.rawInputScu)}</td>
                      <td>{selected?.refineryName ?? "--"}</td>
                      <td><span className={selected?.hasRefineryBonus === false ? "rp-bonus rp-bonus--missing" : "rp-bonus"}>{formatBonus(selected?.bonusPercent, selected?.hasRefineryBonus ?? true)}</span></td>
                      <td>{formatScu(selected?.refinedOutputScu)}</td>
                    </tr>
                  );
                })}
              </tbody>
              {targets.length > 0 && <tfoot><tr><td colSpan={4}>Selected refined output</td><td>{formatScu(selectedOutput)}</td></tr></tfoot>}
            </table>
          </div>
        </section>

        <aside className="rp-panel rp-recommendation-panel">
          <div className="rp-panel-heading"><div><span>03</span><h2>Best Refineries</h2></div></div>
          <div className="rp-recommendation-list">
            {targets.length === 0 ? <p className="rp-empty">Add raw input to see refinery recommendations.</p> : targets.map((target) => {
              const recommendation = optimizedByMaterial.get(target.materialId);
              const refinery = recommendation ? refineryById.get(recommendation.refineryId) : undefined;
              return (
                <article className="rp-recommendation-row" key={target.materialId}>
                  <div className="rp-recommendation-material">
                    <strong>{materialNames.get(target.materialId) ?? target.materialId}</strong>
                    <small>{formatScu(target.rawInputScu)} raw input</small>
                  </div>
                  <div className="rp-recommendation-refinery">
                    <strong>{recommendation?.refineryName ?? "Unavailable"}</strong>
                    <small>{refinery?.systemCode ?? "Unknown system"}</small>
                  </div>
                  <span className={recommendation?.hasRefineryBonus === false ? "rp-bonus rp-bonus--missing" : "rp-bonus"}>{formatBonus(recommendation?.bonusPercent, recommendation?.hasRefineryBonus ?? true)}</span>
                  <span>{formatScu(recommendation?.refinedOutputScu)}</span>
                </article>
              );
            })}
          </div>
          <h3 className="rp-recommendation-summary-title">Recommendation Summary</h3>
          <dl className="rp-recommendation-summary">
            <div><dt>Target materials</dt><dd>{targets.length}</dd></div>
            <div><dt>Recommended refineries</dt><dd>{recommendedRefineryIds.size}</dd></div>
            <div><dt>Systems covered</dt><dd>{recommendedSystems.size}</dd></div>
            <div className="is-positive"><dt>Optimized output</dt><dd>{formatScu(optimizedOutput)}</dd></div>
          </dl>
        </aside>
      </div>
    </main>
  );
}
