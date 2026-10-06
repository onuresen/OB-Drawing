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

import { applyDisplayPreferences, compareObjects, displayPreferences } from "../display-filter.mjs";

const pageObjects = [
  { id: "object-001", category: "doors", label: "D-10" },
  { id: "object-002", category: "doors", label: "D-9" },
  { id: "object-003", category: "windows", label: "W-1" },
  { id: "object-004", category: "windows", label: "W-2" },
];
const pageOccurrences = [
  { id: "occurrence-001", objectId: "object-001", documentId: "document-001", page: 2 },
  { id: "occurrence-002", objectId: "object-002", documentId: "document-001", page: 1 },
  { id: "occurrence-003", objectId: "object-001", documentId: "document-001", page: 1 },
  { id: "occurrence-004", objectId: "object-003", documentId: "document-002", page: 1 },
  { id: "occurrence-005", objectId: null, documentId: "document-001", page: 1 },
];
const pageDocuments = [{ id: "document-001", name: "plans.pdf" }, { id: "document-002", name: "details.pdf" }];

test("labels sort naturally inside a group", () => {
  const [doors] = groupObjectsForBrowser(pageObjects);
  assert.deepEqual(doors.objects.map((object) => object.label), ["D-9", "D-10"]);
  assert.ok(compareObjects({ id: "a", label: "3810" }, { id: "b", label: "4055" }) < 0);
});

test("grouping by page lists an object on every page it appears, in PDF and page order", () => {
  const groups = groupObjectsForBrowser(pageObjects, "", {
    groupBy: "page", occurrences: pageOccurrences, documents: pageDocuments,
  });
  assert.deepEqual(groups.map((group) => group.label), ["plans.pdf · p. 1", "plans.pdf · p. 2", "details.pdf · p. 1", "Not marked yet"]);
  assert.deepEqual(groups[0].objects.map((object) => object.label), ["D-9", "D-10"]);
  assert.deepEqual(groups[3].objects.map((object) => object.id), ["object-004"]);
  assert.equal(groups[0].category, undefined, "page groups carry no category toggle");
});

test("a single PDF names pages without the file", () => {
  const groups = groupObjectsForBrowser(pageObjects.slice(0, 2), "", {
    groupBy: "page", occurrences: pageOccurrences, documents: pageDocuments.slice(0, 1),
  });
  assert.deepEqual(groups.map((group) => group.label), ["Page 1", "Page 2"]);
});

test("no grouping gives one flat, naturally sorted group", () => {
  const groups = groupObjectsForBrowser(pageObjects, "", { groupBy: "none" });
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].objects.map((object) => object.label), ["D-9", "D-10", "W-1", "W-2"]);
});

test("this-page-only keeps objects marked on the current page", () => {
  const groups = groupObjectsForBrowser(pageObjects, "", {
    occurrences: pageOccurrences,
    currentPage: { documentId: "document-001", page: 2 },
  });
  assert.deepEqual(groups.flatMap((group) => group.objects.map((object) => object.id)), ["object-001"]);
  assert.equal(groups[0].total, 2, "the group still reports its full size");
});

test("no-marks mode hides every mark, the selected object's too", () => {
  const display = createDisplayState();
  display.markFocus = "none";
  assert.equal(occurrenceVisibility({ objectId: "object-002" }, objectsById, display, "object-002"), "hidden");
  assert.equal(occurrenceVisibility({ objectId: null }, objectsById, display, null), "hidden");
});

test("only viewer preferences are remembered, and bad stored values are ignored", () => {
  const display = createDisplayState();
  display.groupBy = "page";
  display.showLabels = true;
  display.query = "secret";
  display.hiddenCategories.add("doors");
  const stored = displayPreferences(display);
  assert.deepEqual(Object.keys(stored).sort(), ["currentPageOnly", "groupBy", "markFocus", "showLabels"]);
  const restored = applyDisplayPreferences(createDisplayState(), { ...stored, groupBy: "nonsense", markFocus: "none" });
  assert.equal(restored.groupBy, "category");
  assert.equal(restored.markFocus, "none");
  assert.equal(restored.showLabels, true);
  assert.equal(applyDisplayPreferences(createDisplayState(), null).groupBy, "category");
});
