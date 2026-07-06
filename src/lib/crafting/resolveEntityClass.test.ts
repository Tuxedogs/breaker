import assert from "node:assert/strict";
import test from "node:test";
import { resolveEntityClassForCraftingItem } from "./resolveEntityClass.ts";

const blueprintId = "a1b5c9ef-be2e-4077-ba67-4a3028970c49";
const entityClass = "7db13b34-c8b1-4e1a-9aba-3dcd7087e995";

test("resolveEntityClassForCraftingItem prefers recipe output_entityClass", () => {
  const result = resolveEntityClassForCraftingItem({
    recipe: {
      blueprint_id: blueprintId,
      output_entityClass: entityClass,
    },
    cardBridge: {
      id: blueprintId,
      entityClass: "11111111-1111-4111-8111-111111111111",
    },
  });

  assert.equal(result.entityClass, entityClass);
  assert.equal(result.source, "recipe");
  assert.equal(result.confidence, "high");
});

test("resolveEntityClassForCraftingItem falls back to card entityClass bridge", () => {
  const result = resolveEntityClassForCraftingItem({
    recipe: {
      blueprint_id: blueprintId,
      output_entityClass: "",
    },
    cardBridge: {
      id: blueprintId,
      entityClass,
    },
  });

  assert.equal(result.entityClass, entityClass);
  assert.equal(result.source, "card_bridge");
  assert.equal(result.confidence, "medium");
});

test("resolveEntityClassForCraftingItem rejects mismatched card bridge ids", () => {
  const result = resolveEntityClassForCraftingItem({
    recipe: {
      blueprint_id: blueprintId,
      output_entityClass: "",
    },
    cardBridge: {
      id: "bde33318-8438-4fdf-a181-4536963a600a",
      entityClass,
    },
  });

  assert.equal(result.entityClass, null);
  assert.equal(result.source, "unresolved");
});

test("resolveEntityClassForCraftingItem reports unresolved when no ids exist", () => {
  const result = resolveEntityClassForCraftingItem({
    recipe: {
      blueprint_id: blueprintId,
      output_entityClass: "",
    },
    cardBridge: {
      id: blueprintId,
      entityClass: null,
    },
  });

  assert.equal(result.entityClass, null);
  assert.equal(result.source, "unresolved");
});
