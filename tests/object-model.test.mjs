import test from "node:test";
import assert from "node:assert/strict";
import {
  createObject,
  createOccurrence,
  deleteObjectPreservingOccurrences,
  getObjectOccurrences,
  linkOccurrence,
  nextEntityId,
  normalizeLabel,
  removeOccurrence,
  renameObject,
  updateObjectDetails,
} from "../object-model.mjs";

test("labels are human-readable evidence, not generated identity", () => {
  assert.equal(normalizeLabel("  D-105   East  "), "D-105 East");

  const firstObject = createObject([], "doors", "D-105");
  const secondObject = createObject([firstObject], "windows", "D-105");
  assert.equal(firstObject.id, "object-001");
  assert.equal(secondObject.id, "object-002");
  assert.equal(firstObject.label, secondObject.label);
  assert.equal(secondObject.category, "windows");
});

test("entity IDs continue after gaps and ignore unrelated IDs", () => {
  assert.equal(
    nextEntityId([{ id: "door-002" }, { id: "other-900" }, { id: "door-007" }], "door"),
    "door-008",
  );
});

test("an occurrence remains unlinked until an explicit link action", () => {
  const occurrence = createOccurrence(
    [],
    12,
    { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
    null,
    "document-002",
  );
  assert.equal(occurrence.id, "occurrence-001");
  assert.equal(occurrence.objectId, null);
  assert.equal(occurrence.documentId, "document-002");
  assert.equal(occurrence.geometryType, "rectangle");

  const linked = linkOccurrence([occurrence], occurrence.id, "door-001");
  assert.equal(linked[0].objectId, "door-001");
  assert.equal(occurrence.objectId, null);
});

test("an occurrence cannot be created without a document identity", () => {
  assert.throws(
    () => createOccurrence([], 1, { x: 0.1, y: 0.1, width: 0.2, height: 0.2 }),
    /document ID/,
  );
});

test("polygon occurrences retain independent normalized vertices", () => {
  const points = [{ x: 0.1, y: 0.1 }, { x: 0.4, y: 0.1 }, { x: 0.2, y: 0.4 }];
  const occurrence = createOccurrence(
    [], 1, { x: 0.1, y: 0.1, width: 0.3, height: 0.3 }, null, "document-001", "polygon", points,
  );
  points[0].x = 0.9;
  assert.equal(occurrence.geometryType, "polygon");
  assert.equal(occurrence.points[0].x, 0.1);
});

test("renaming preserves identity and occurrence links", () => {
  const objects = [{ id: "door-001", category: "doors", label: "D-105" }];
  const occurrences = [{ id: "occurrence-001", objectId: "door-001", page: 1, bounds: {} }];
  const renamed = renameObject(objects, "door-001", "D-105A");

  assert.equal(renamed[0].id, "door-001");
  assert.equal(renamed[0].label, "D-105A");
  assert.equal(getObjectOccurrences(occurrences, "door-001").length, 1);
});

test("changing category preserves legacy identity and occurrence links", () => {
  const objects = [{ id: "door-001", category: "doors", label: "D-105" }];
  const updated = updateObjectDetails(objects, "door-001", { category: "windows", label: "W-105" });
  assert.deepEqual(updated[0], { id: "door-001", category: "windows", label: "W-105" });
  assert.throws(
    () => updateObjectDetails(objects, "door-001", { category: "not-real", label: "D-105" }),
    /supported object category/,
  );
});

test("deleting an object preserves its occurrences as unlinked evidence", () => {
  const result = deleteObjectPreservingOccurrences(
    [
      { id: "door-001", category: "doors", label: "D-105" },
      { id: "door-002", category: "doors", label: "D-106" },
    ],
    [
      { id: "occurrence-001", objectId: "door-001", page: 1, bounds: {} },
      { id: "occurrence-002", objectId: "door-002", page: 2, bounds: {} },
    ],
    "door-001",
  );

  assert.deepEqual(result.objects.map((object) => object.id), ["door-002"]);
  assert.equal(result.occurrences[0].objectId, null);
  assert.equal(result.occurrences[1].objectId, "door-002");
});

test("removing one occurrence does not remove its object", () => {
  const occurrences = [
    { id: "occurrence-001", objectId: "door-001" },
    { id: "occurrence-002", objectId: "door-001" },
  ];
  assert.deepEqual(
    removeOccurrence(occurrences, "occurrence-001").map((occurrence) => occurrence.id),
    ["occurrence-002"],
  );
});
