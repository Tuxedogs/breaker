import assert from "node:assert/strict";
import test from "node:test";
import { COMPONENT_IMAGE_ENTRIES, REPRESENTATIVE_COMPONENT_ART, resolveComponentImageUrl } from "./componentImageResolver";

test("resolves the same component image from entity class, component ID, and canonical blueprint key", () => {
  const expected = "/assets/fitting/components/representative/shields/s1/shld-godi-military-s01-fr66.webp";

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

test("resolves exact representative Crafting art before family fallback", () => {
  assert.equal(REPRESENTATIVE_COMPONENT_ART.length, 10);
  assert.equal(
    resolveComponentImageUrl({ componentName: "Atlas", componentType: "quantumdrive", size: 1, className: "civilian" }),
    "/assets/fitting/components/representative/quantum-drives/s1/qdrv-rsi-civilian-s01-atlas.webp",
  );
});

test("falls back to representative art by family, size, and class", () => {
  assert.equal(
    resolveComponentImageUrl({ componentName: "Unrendered Drive", componentType: "quantum_drive", size: "1", className: "military" }),
    "/assets/fitting/components/representative/quantum-drives/s1/qdrv-wetk-military-s01-vk00.webp",
  );
  assert.equal(
    resolveComponentImageUrl({ componentName: "Unrendered Shield", componentType: "shield", size: 1, className: "stealth" }),
    "/assets/fitting/components/representative/shields/s1/shld-asas-stealth-s01-mirage.webp",
  );
  assert.equal(
    resolveComponentImageUrl({ componentName: "Unknown", componentType: "shield", size: 2, className: "stealth" }),
    null,
  );
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
