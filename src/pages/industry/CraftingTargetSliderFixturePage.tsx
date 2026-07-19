import { useState } from "react";
import { Navigate } from "react-router-dom";

import { DetailMaterialQualityRow } from "@/components/industry/crafting/components/ComponentRecipeTable";
import "@/components/industry/crafting/recipe-browser.css";
import type { ComponentMaterial } from "@/components/industry/crafting/utils/craftingTypes";
import type { QualityBand } from "@/components/industry/crafting/utils/qualityBands";

const fixtureBands: QualityBand[] = [
  { start: 500, end: 500, mappedValue: 500 },
  { start: 860, end: 860, mappedValue: 860 },
  { start: 937, end: 937, mappedValue: 937 },
];

const fixtureMaterial: ComponentMaterial = {
  slot: "Armor plating",
  cost_type: "material",
  material_name: "Stileron",
  cost_id: "fixture-stileron",
  quantity: 8,
  qualityModifiers: [
    {
      component_type: "Armor",
      component_name: "Fixture armor",
      size: "S1",
      slot: "Armor plating",
      gameplay_property: "GPP_Health_MaxHealth",
      start_quality: 500,
      end_quality: 1000,
      modifier_start: 0,
      modifier_end: 0,
      modifier_start_percent: 2,
      modifier_end_percent: 16,
      gameplay_property_id: "fixture-health",
      blueprint_id: "fixture-crafting-target-slider",
    },
  ],
};

export default function CraftingTargetSliderFixturePage() {
  const [bandIndex, setBandIndex] = useState(1);

  if (!import.meta.env.DEV) {
    return <Navigate to="/industry/crafting" replace />;
  }

  return (
    <main className="craft-page craft-planner-shell craft-detail-page" data-crafting-target-slider-fixture="true">
      <section className="craft-detail-stage">
        <div className="craft-detail-crafting-panel">
          <div className="craft-summary-section-label">Material Requirements</div>
          <div className="craft-detail-material-table">
            <div className="craft-detail-material-table-head" aria-hidden="true">
              <span>Material</span>
              <span>Required</span>
              <span>Target</span>
              <span>Target quality</span>
              <span>Modifier</span>
            </div>
            <div className="craft-detail-material-table-body">
              <DetailMaterialQualityRow
                mat={fixtureMaterial}
                bandIndex={bandIndex}
                onBandChange={setBandIndex}
                getBandsForMaterial={() => fixtureBands}
              />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
