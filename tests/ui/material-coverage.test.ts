import React from "react";
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import MaterialCoverageChips, { MaterialCoverageProfile } from "../../src/components/industry/mining/MaterialCoverageChips";

test("coverage chips retain distinct statuses and profile groups, including empty states", () => {
  const materials = [
    { key: "beryl", name: "Beryl", coverage: "Covered" },
    { key: "quantanium", name: "Quantanium", coverage: "Indexed ? Not eligible" },
    { key: "taranite", name: "Taranite", coverage: "Not present" },
    { key: "stileron", name: "Stileron", coverage: "Unknown" },
  ];
  const html = renderToStaticMarkup(React.createElement(MaterialCoverageProfile, { materials }));
  assert.match(html, /Covered materials/);
  assert.match(html, /Not covered materials/);
  for (const item of materials) assert.ok(html.includes(`${item.name}: ${item.coverage}`));
  assert.equal((html.match(/tabindex="0"/g) ?? []).length, 4);
  assert.equal((renderToStaticMarkup(React.createElement(MaterialCoverageProfile, { materials: [] })).match(/None/g) ?? []).length, 2);
  assert.match(renderToStaticMarkup(React.createElement(MaterialCoverageChips, { materials: [] })), /No selected materials/);
});

