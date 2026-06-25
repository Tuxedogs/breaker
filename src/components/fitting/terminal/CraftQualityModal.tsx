import { useEffect, useState } from "react";
import { MaterialQualityRow } from "../../industry/crafting/components/ComponentRecipeTable";
import {
  DEFAULT_BAND_INDEX,
  FALLBACK_QUALITY_BANDS,
  type QualityBand,
} from "../../industry/crafting/utils/qualityBands";
import { getMaterialQualityKey } from "../../industry/crafting/utils/materialQuality";
import {
  computeTotalModifiers,
  deriveFinalProductQuality,
} from "../../industry/crafting/utils/recipeQuality";
import type { ComponentRecipe } from "../../industry/crafting/utils/craftingTypes";
import { getFittingComponent } from "../../../lib/fitting/fittingApi";
import { getCraftingItemByBlueprintGuid } from "../../../lib/craftingData";
import type { CraftQualityOverride } from "../../../lib/fitting/fittingTerminalTypes";
import type { PortBreakdownRow } from "../../../lib/fitting/fittingPortGrouping";
import "../../../components/industry/crafting/recipe-browser.css";

type MaterialQuantization = {
  material_name?: string;
  materialName?: string;
  bands?: QualityBand[];
  qualityOptions?: Array<string | number>;
};

function normalizeMaterialLookup(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function bandsForQuantEntry(entry: MaterialQuantization | undefined): QualityBand[] {
  if (!entry) return FALLBACK_QUALITY_BANDS;
  if (entry.qualityOptions?.length) {
    return entry.qualityOptions.map((value) => ({ start: value, end: value, mappedValue: value }));
  }
  if (entry.bands?.length) return entry.bands;
  return FALLBACK_QUALITY_BANDS;
}

type CraftQualityModalProps = {
  portRow: PortBreakdownRow | null;
  existingOverride: CraftQualityOverride | null;
  onClose: () => void;
  onApply: (override: CraftQualityOverride) => void;
  onReset: () => void;
};

export default function CraftQualityModal({
  portRow,
  existingOverride,
  onClose,
  onApply,
  onReset,
}: CraftQualityModalProps) {
  const [recipe, setRecipe] = useState<ComponentRecipe | null>(null);
  const [baseStats, setBaseStats] = useState<Record<string, number | null>>({});
  const [quantByMaterial, setQuantByMaterial] = useState<Map<string, MaterialQuantization>>(new Map());
  const [materialQualities, setMaterialQualities] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState<string | null>(null);

  useEffect(() => {
    if (!portRow?.equippedComponentKey) return;
    const componentId = portRow.equippedComponentKey;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setLoading(true);
      setUnavailable(null);
    });

    Promise.all([
      getCraftingItemByBlueprintGuid(componentId),
      getFittingComponent(componentId, controller.signal),
      fetch("/api/crafting/material_quality_quantization.json").then((response) => response.json()),
    ])
      .then(([craftRecipe, componentDetail, quantizationRaw]) => {
        if (controller.signal.aborted) return;
        if (!craftRecipe) {
          setUnavailable("No crafting recipe found for this component.");
          setRecipe(null);
          return;
        }
        setRecipe(craftRecipe);
        setBaseStats(componentDetail.stats);
        const quantRows = Array.isArray(quantizationRaw) ? quantizationRaw as MaterialQuantization[] : [];
        const quantMap = new Map<string, MaterialQuantization>();
        for (const row of quantRows) {
          const name = row.material_name ?? row.materialName;
          if (name) quantMap.set(normalizeMaterialLookup(name), row);
        }
        setQuantByMaterial(quantMap);
        const qualities: Record<string, number> = {};
        for (const [index, material] of craftRecipe.materials.entries()) {
          const key = getMaterialQualityKey(craftRecipe, material, index);
          qualities[key] = existingOverride?.materialQualities[key] ?? DEFAULT_BAND_INDEX;
        }
        setMaterialQualities(qualities);
      })
      .catch(() => {
        if (!controller.signal.aborted) setUnavailable("Failed to load crafting data.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [portRow?.equippedComponentKey, existingOverride]);

  const getBandIndex = (key: string) => materialQualities[key] ?? DEFAULT_BAND_INDEX;
  const getBandsForMaterial = (materialName: string): QualityBand[] =>
    bandsForQuantEntry(quantByMaterial.get(normalizeMaterialLookup(materialName)));

  const totalModifiers = recipe
    ? computeTotalModifiers(recipe, getBandsForMaterial, getBandIndex)
    : [];
  const finalQuality = recipe ? deriveFinalProductQuality(recipe, getBandIndex) : null;

  if (!portRow) return null;

  return (
    <div className="fit-term-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="fit-term-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Craft quality tuning"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="fit-term-modal-head">
          <div>
            <span className="fit-term-kicker">Craft Quality</span>
            <h2>{portRow.equippedComponentName ?? "Component"}</h2>
            <p>{portRow.portName ?? portRow.portId}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">×</button>
        </header>

        {loading && <p className="fit-term-empty">Loading crafting data…</p>}
        {!loading && unavailable && <p className="fit-term-unavail">{unavailable}</p>}

        {!loading && recipe && (
          <>
            <section className="fit-term-modal-section">
              <h3>Base Stats</h3>
              <dl className="fit-term-kv fit-term-kv--compact">
                {Object.entries(baseStats).slice(0, 8).map(([key, value]) => (
                  <div key={key}><dt>{key}</dt><dd>{value != null ? String(value) : "—"}</dd></div>
                ))}
              </dl>
            </section>

            <section className="fit-term-modal-section">
              <h3>Materials</h3>
              <ul className="fit-term-material-list">
                {recipe.materials.map((material) => (
                  <li key={material.material_name}>{material.material_name} × {material.quantity}</li>
                ))}
              </ul>
            </section>

            <section className="fit-term-modal-section">
              <h3>Quality</h3>
              {recipe.materials.map((material, index) => {
                const key = getMaterialQualityKey(recipe, material, index);
                return (
                  <MaterialQualityRow
                    key={key}
                    recipe={recipe}
                    mat={material}
                    bandIndex={getBandIndex(key)}
                    onBandChange={(next) => setMaterialQualities((current) => ({ ...current, [key]: next }))}
                    getBandsForMaterial={getBandsForMaterial}
                    totalModifiers={totalModifiers}
                  />
                );
              })}
              {finalQuality && (
                <p className="fit-term-note">Final product quality: Band {finalQuality.band}</p>
              )}
            </section>
          </>
        )}

        <footer className="fit-term-modal-foot">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="button" onClick={onReset} disabled={!existingOverride}>Reset</button>
          <button
            type="button"
            className="fit-term-primary-btn"
            disabled={!recipe || !portRow.equippedComponentKey}
            onClick={() => {
              if (!portRow.equippedComponentKey) return;
              onApply({
                portId: portRow.portId,
                componentId: portRow.equippedComponentKey,
                materialQualities,
                appliedAt: Date.now(),
              });
            }}
          >
            Apply to Fitting
          </button>
        </footer>
      </section>
    </div>
  );
}
