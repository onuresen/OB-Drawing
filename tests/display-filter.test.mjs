import test from "node:test";
import assert from "node:assert/strict";
import {
  createDisplayState,
  groupObjectsForBrowser,
  occurrenceVisibility,
  toggleSetMember,
} from "../display-filter.mjs";

const objects = [
  { id: "object-001", category: "windows", label: "3810" },
  { id: "object-002", category: "doors", label: "2538" },
  { id: "object-003", category: "doors", label: "D-105" },
  { id: "object-004", category: "walls", label: "W1" },
];
const objectsById = new Map(objects.map((object) => [object.id, object]));

test("objects are grouped by category in catalogue order", () => {
  const groups = groupObjectsForBrowser(objects);
  assert.deepEqual(groups.map((group) => group.category), ["doors", "windows", "walls"]);
  assert.deepEqual(groups[0].objects.map((object) => object.id), ["object-002", "object-003"]);
  assert.equal(groups[0].label, "Doors");
});

test("search filters by label, id or category and drops empty groups", () => {
  assert.deepEqual(
    groupObjectsForBrowser(objects, "d-1").flatMap((group) => group.objects.map((object) => object.id)),
    ["object-003"],
  );
  assert.deepEqual(groupObjectsForBrowser(objects, "object-004").map((group) => group.category), ["walls"]);
  assert.deepEqual(groupObjectsForBrowser(objects, "  WINDOWS ").map((group) => group.category), ["windows"]);
  assert.deepEqual(groupObjectsForBrowser(objects, "zzz"), []);
});

test("a filtered group still reports its full size", () => {
  const [doors] = groupObjectsForBrowser(objects, "2538");
  assert.equal(doors.objects.length, 1);
  assert.equal(doors.total, 2);
});

test("hidden categories hide their marks", () => {
  const display = createDisplayState();
  display.hiddenCategories.add("doors");
  assert.equal(occurrenceVisibility({ objectId: "object-002" }, objectsById, display, null), "hidden");
  assert.equal(occurrenceVisibility({ objectId: "object-001" }, objectsById, display, null), "shown");
});

test("focus modes dim or hide other objects only when something is selected", () => {
  const display = createDisplayState();
  display.markFocus = "dim-others";
  assert.equal(occurrenceVisibility({ objectId: "object-001" }, objectsById, display, "object-002"), "dimmed");
  assert.equal(occurrenceVisibility({ objectId: "object-001" }, objectsById, display, null), "shown");
  display.markFocus = "selected-only";
  assert.equal(occurrenceVisibility({ objectId: "object-001" }, objectsById, display, "object-002"), "hidden");
});

test("the selected object and unlinked marks are never hidden", () => {
  const display = createDisplayState();
  display.hiddenCategories.add("doors");
  display.markFocus = "selected-only";
  assert.equal(occurrenceVisibility({ objectId: "object-002" }, objectsById, display, "object-002"), "shown");
  assert.equal(occurrenceVisibility({ objectId: null }, objectsById, display, "object-002"), "shown");
});

test("toggling a set member returns a new set", () => {
  const original = new Set(["doors"]);
  const removed = toggleSetMember(original, "doors");
  assert.equal(removed.has("doors"), false);
  assert.equal(original.has("doors"), true);
  assert.equal(toggleSetMember(removed, "walls").has("walls"), true);
});
