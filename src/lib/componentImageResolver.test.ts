import assert from "node:assert/strict";
import test from "node:test";
import { COMPONENT_IMAGE_ENTRIES, resolveComponentImageUrl } from "./componentImageResolver";

test("resolves the same component image from entity class, component ID, and canonical blueprint key", () => {
  const expected = "/images/component-thumbnails/mil1shield.png";

  assert.equal(resolveComponentImageUrl({ entityClass: "0baaf20a-460e-4668-84f2-d09f9d31b492" }), expected);
  assert.equal(resolveComponentImageUrl({ componentId: "db3f4c97-8d40-4b36-b397-452dea1594fc" }), expected);
  assert.equal(resolveComponentImageUrl({ blueprintId: "db3f4c97-8d40-4b36-b397-452dea1594fc" }), expected);
  assert.equal(resolveComponentImageUrl({ canonicalKey: "BP_CRAFT_SHLD_GODI_S01_FR66_SCItem" }), expected);
});

test("matches identifiers case-insensitively without display-name matching", () => {
  assert.equal(
    resolveComponentImageUrl({ canonicalKey: "bp_craft_powr_acom_s02_luxcore_scitem" }),
    "/images/component-thumbnails/comp2power.png",
  );
  assert.equal(resolveComponentImageUrl({ canonicalKey: "LuxCore" }), null);
});

test("keeps the existing fallback path available when no component image matches", () => {
  assert.equal(resolveComponentImageUrl({ entityClass: "00000000-0000-0000-0000-000000000000" }), null);
  assert.equal(resolveComponentImageUrl({}), null);
});

test("does not assign one stable identifier to multiple component images", () => {
  const owners = new Map<string, string>();

  for (const entry of COMPONENT_IMAGE_ENTRIES) {
    for (const identifier of entry.identifiers) {
      const normalized = identifier.toLowerCase();
      assert.equal(owners.get(normalized), undefined, `${identifier} is assigned to more than one image`);
      owners.set(normalized, entry.filename);
    }
  }
});
