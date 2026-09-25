import assert from "node:assert/strict";
import test from "node:test";
import { getCraftingBrowserLayoutMode } from "./craftingBrowserLayout";

test("uses the approved compact split boundaries", () => {
  assert.equal(getCraftingBrowserLayoutMode(980), "single");
  assert.equal(getCraftingBrowserLayoutMode(981), "compact-split");
  assert.equal(getCraftingBrowserLayoutMode(1599), "compact-split");
  assert.equal(getCraftingBrowserLayoutMode(1600), "wide-split");
});
