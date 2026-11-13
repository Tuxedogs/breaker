import assert from "node:assert/strict";
import test from "node:test";

import { missionVariantUrl, safeInternalReturnPath } from "./missionUrls";

test("return paths are limited to in-app paths", () => {
  assert.equal(safeInternalReturnPath("/industry/crafting?preview=abc"), "/industry/crafting?preview=abc");
  for (const unsafe of ["https://evil.example/", "//evil.example/x", "/\\evil", "javascript:alert(1)", "industry/crafting", "", null]) {
    assert.equal(safeInternalReturnPath(unsafe), null, String(unsafe));
  }
});

test("variant links carry the stable contract ID and an optional safe return path", () => {
  const url = new URL(missionVariantUrl("f81b133e-6043-469c-97e6-7524cad5eca5", "/industry/crafting?preview=x"), "http://local");
  assert.equal(url.pathname, "/industry/missions");
  assert.equal(url.searchParams.get("variant"), "f81b133e-6043-469c-97e6-7524cad5eca5");
  assert.equal(url.searchParams.get("return"), "/industry/crafting?preview=x");
  assert.equal(new URL(missionVariantUrl("id", "https://evil.example"), "http://local").searchParams.get("return"), null);
});
