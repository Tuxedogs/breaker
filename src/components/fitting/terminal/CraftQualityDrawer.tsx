import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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
import type { FittingComponentDetail } from "../../../lib/fitting/fittingApi";
import { loadVehicleFittingComponent } from "../../../lib/fitting/fittingComponentStore";
import { getCraftingItemByBlueprintGuid } from "../../../lib/craftingData";
import { getMaterialQualityQuantizationFromApi } from "../../../lib/craftingReferenceApi";
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

function formatModifierValue(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

export type CraftQualityDrawerProps = {
  side: "left" | "right";
  portRow: PortBreakdownRow;
  existingOverride: CraftQualityOverride | null;
  onClose: () => void;
  onApply: (override: CraftQualityOverride) => void;
  onReset: () => void;
};

export default function CraftQualityDrawer({
  side,
  portRow,
  existingOverride,
  onClose,
  onApply,
  onReset,
}: CraftQualityDrawerProps) {
  const [recipe, setRecipe] = useState<ComponentRecipe | null>(null);
  const [fittingDetail, setFittingDetail] = useState<FittingComponentDetail | null>(null);
  const [quantByMaterial, setQuantByMaterial] = useState<Map<string, MaterialQuantization>>(new Map());
  const [materialQualities, setMaterialQualities] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState<string | null>(null);

  useEffect(() => {
    if (!portRow.equippedComponentKey) return;
    const componentId = portRow.equippedComponentKey;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setLoading(true);
      setUnavailable(null);
    });

    Promise.all([
      getCraftingItemByBlueprintGuid(componentId),
      loadVehicleFittingComponent(componentId),
      getMaterialQualityQuantizationFromApi(),
    ])
      .then(([craftRecipe, componentDetail, quantizationRaw]) => {
        if (cancelled) return;
        if (!craftRecipe) {
          setUnavailable("Requires recipe data");
          setRecipe(null);
          return;
        }
        setRecipe(craftRecipe);
        setFittingDetail(componentDetail);
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
        if (!cancelled) setUnavailable("Requires recipe data");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [portRow.equippedComponentKey, existingOverride]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const getBandIndex = (key: string) => materialQualities[key] ?? DEFAULT_BAND_INDEX;
  const getBandsForMaterial = (materialName: string): QualityBand[] =>
    bandsForQuantEntry(quantByMaterial.get(normalizeMaterialLookup(materialName)));

  const totalModifiers = recipe
    ? computeTotalModifiers(recipe, getBandsForMaterial, getBandIndex)
    : [];
  const finalQuality = recipe ? deriveFinalProductQuality(recipe, getBandIndex) : null;
  const baseQuality = recipe ? deriveFinalProductQuality(recipe, () => DEFAULT_BAND_INDEX) : null;
  const recipeHref = recipe?.blueprint_id ? `/industry/crafting/${recipe.blueprint_id}` : null;
  const slotLabel = portRow.portName ?? portRow.portId;

  return (
    <aside
      className={["fit-term-craft-drawer", `fit-term-craft-drawer--${side}`].join(" ")}
      role="dialog"
      aria-label="Craft component quality simulation"
    >
      <header className="fit-term-craft-drawer-head">
        <div>
          <span className="fit-term-kicker">Craft Component</span>
          <h2>{portRow.equippedComponentName ?? "Component"}</h2>
          <p className="fit-term-craft-drawer-sub">Simulate Quality · {slotLabel}</p>
        </div>
        <button type="button" className="fit-term-craft-drawer-close" onClick={onClose} aria-label="Close">×</button>
      </header>

      <div className="fit-term-craft-drawer-body">
        {loading && <p className="fit-term-empty">Loading crafting data…</p>}
        {!loading && unavailable && <p className="fit-term-unavail">{unavailable}</p>}

        {!loading && recipe && (
          <>
            <section className="fit-term-craft-drawer-section">
              <h3>Quality Target</h3>
              <dl className="fit-term-kv fit-term-kv--compact">
                <div>
                  <dt>Current / Base</dt>
                  <dd>{baseQuality ? `Band ${baseQuality.band}` : "Requires recipe data"}</dd>
                </div>
                <div>
                  <dt>Target</dt>
                  <dd>{finalQuality ? `Band ${finalQuality.band}` : "Not calculated yet"}</dd>
                </div>
              </dl>
            </section>

            <section className="fit-term-craft-drawer-section">
              <h3>Material Inputs</h3>
              {recipe.materials.length === 0 ? (
                <p className="fit-term-unavail">Requires recipe data</p>
              ) : (
                recipe.materials.map((material, index) => {
                  const key = getMaterialQualityKey(recipe, material, index);
                  return (
                    <MaterialQualityRow
                      key={key}
                      mat={material}
                      bandIndex={getBandIndex(key)}
                      onBandChange={(next) => setMaterialQualities((current) => ({ ...current, [key]: next }))}
                      getBandsForMaterial={getBandsForMaterial}
                      totalModifiers={totalModifiers}
                      fittingDetail={fittingDetail}
                    />
                  );
                })
              )}
            </section>

            <section className="fit-term-craft-drawer-section">
              <h3>Modifiers</h3>
              {totalModifiers.length > 0 ? (
                <ul className="fit-term-craft-mod-list">
                  {totalModifiers.map((row) => (
                    <li key={`${row.property}-${row.modifierMode ?? ""}`}>
                      <span>{row.property}</span>
                      <strong>{formatModifierValue(row.totalValue)}</strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="fit-term-unavail">Not calculated yet</p>
              )}
            </section>

            <section className="fit-term-craft-drawer-section">
              <h3>Live Preview</h3>
              {fittingDetail && Object.keys(fittingDetail.stats).length > 0 ? (
                <dl className="fit-term-kv fit-term-kv--compact">
                  {Object.entries(fittingDetail.stats).slice(0, 6).map(([key, value]) => (
                    <div key={key}>
                      <dt>{key}</dt>
                      <dd>{value != null ? String(value) : "—"}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="fit-term-unavail">Not calculated yet</p>
              )}
              {finalQuality && (
                <p className="fit-term-note">
                  Simulated product quality: Band {finalQuality.band}
                  {finalQuality.rarity ? ` · ${finalQuality.rarity}` : ""}
                </p>
              )}
            </section>
          </>
        )}

        {!loading && !recipe && !unavailable && (
          <p className="fit-term-unavail">Requires recipe data</p>
        )}
      </div>

      <footer className="fit-term-craft-drawer-foot">
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
          Apply to Fit
        </button>
        <button type="button" className="fit-term-ghost-btn" disabled title="Session-only in prototype">
          Save to Loadout
        </button>
        {recipeHref ? (
          <Link to={recipeHref} className="fit-term-link-btn">Open Full Recipe</Link>
        ) : (
          <button type="button" className="fit-term-link-btn" disabled>Open Full Recipe</button>
        )}
      </footer>
      <p className="fit-term-craft-drawer-note">Fitting simulation only — does not consume inventory or reserve materials.</p>
    </aside>
  );
}
