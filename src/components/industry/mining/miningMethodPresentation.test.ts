import assert from "node:assert/strict";
import test from "node:test";

import { miningMethodPresentation } from "./miningMethodPresentation";

test("does not assign the ship icon to an unknown delivered mining method", () => {
  assert.deepEqual(miningMethodPresentation("Shipwreck"), {
    iconKey: null,
    visibleLabel: "Shipwreck",
  });
});

test("keeps recognized mining methods icon-only", () => {
  assert.deepEqual(miningMethodPresentation("Surface Ship"), {
    iconKey: "ship",
    visibleLabel: null,
  });
});

test("maps the formatter-owned Orbitborne alias to the ship icon", () => {
  assert.deepEqual(miningMethodPresentation("Orbitborne"), {
    iconKey: "ship",
    visibleLabel: null,
  });
});
