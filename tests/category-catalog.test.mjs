import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_OBJECT_CATEGORY,
  filterObjectCategoryGroups,
  isObjectCategoryKey,
  OBJECT_CATEGORIES,
  objectCategoryCode,
  objectCategoryLabel,
} from "../category-catalog.mjs";

test("catalog provides a broad stable physical-model category set", () => {
  assert.ok(OBJECT_CATEGORIES.length >= 70);
  assert.equal(DEFAULT_OBJECT_CATEGORY, "doors");
  assert.equal(objectCategoryLabel("doors"), "Doors");
  assert.equal(objectCategoryCode("structural-framing"), "SF");
  assert.equal(isObjectCategoryKey("mechanical-equipment"), true);
  assert.equal(isObjectCategoryKey("invented-category"), false);
  assert.equal(new Set(OBJECT_CATEGORIES.map((category) => category.key)).size, OBJECT_CATEGORIES.length);
});

test("category search matches labels, stable keys, and group names", () => {
  assert.deepEqual(
    filterObjectCategoryGroups("sprink").flatMap((group) => group.categories.map((category) => category.key)),
    ["sprinklers"],
  );
  assert.ok(filterObjectCategoryGroups("electrical").flatMap((group) => group.categories).length >= 10);
  assert.deepEqual(filterObjectCategoryGroups("not-a-real-category"), []);
});

test("display names read like type names and never show the ID", async () => {
  const { objectCategorySingular, objectDisplayName } = await import("../category-catalog.mjs");
  assert.equal(objectCategorySingular("doors"), "Door");
  assert.equal(objectCategorySingular("assemblies"), "Assembly");
  assert.equal(objectCategorySingular("masses"), "Mass");
  assert.equal(objectCategorySingular("furniture"), "Furniture");
  assert.equal(objectCategorySingular("other"), "Object");
  assert.equal(objectDisplayName({ id: "object-007", category: "doors", label: "577" }), "Door 577");
  assert.equal(objectDisplayName({ id: "object-008", category: "doors", label: "Door D-2" }), "Door D-2");
  assert.equal(objectDisplayName({ id: "object-009", category: "rooms", label: "" }), "Room");
});
