import assert from "node:assert/strict";
import { test } from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import InventoryWorkspace from "../../src/components/logistics/InventoryWorkspace";
import type { InventoryLocation } from "../../src/types/logistics";

// The Node tsx test loader emits classic JSX for imported application components.
// Vite uses automatic JSX in the deployed app.
Object.assign(globalThis, { React });

const { createElement } = React;
const location: InventoryLocation = {
  id: "test-location",
  name: "Staging Test Location",
  system: "Stanton",
  source: "custom",
};

test("Add Item remains actionable while existing-stock mutations are read-only", () => {
  const markup = renderToStaticMarkup(createElement(InventoryWorkspace, {
    entries: [],
    locations: [location],
    materials: [],
    buildQueue: [],
    selectedLocationId: location.id,
    selectedLotId: null,
    readOnly: true,
    viewMode: "grid",
    sortKey: "material",
    sortDir: "asc",
    onGlobalSearchChange: () => {},
    onViewModeChange: () => {},
    onSortKeyChange: () => {},
    onSortDirChange: () => {},
    onOpenFilters: () => {},
    onSelectLocation: () => {},
    onSelectLot: () => {},
    onEdit: () => {},
    onMoveRequest: () => {},
    onDelete: () => {},
    onMoveLot: async () => {},
    onAddAtLocation: () => {},
  }));
  const addButton = markup.match(/<button\b[^>]*class="logi-inv-workspace-add"[^>]*>/)?.[0];
  assert.ok(addButton, "Add Item must be rendered for the selected location");
  assert.doesNotMatch(addButton, /\sdisabled(?:=|\s|>)/, "stale inventory must not disable creation");
});
