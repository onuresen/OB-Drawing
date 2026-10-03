import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDrawingMap,
  occurrenceDensity,
  summarizeDrawingMap,
} from "../drawing-map.mjs";

const documents = [
  { id: "document-001", name: "plans.pdf", pageCount: 3 },
  { id: "document-002", name: "details.pdf", pageCount: 2 },
];

const occurrences = [
  { id: "occurrence-001", documentId: "document-001", page: 2, objectId: "door-001" },
  { id: "occurrence-002", documentId: "document-001", page: 2, objectId: "door-002" },
  { id: "occurrence-003", documentId: "document-002", page: 1, objectId: "door-001" },
];

test("drawing map groups occurrence density and object coverage by page", () => {
  const map = buildDrawingMap(documents, occurrences);
  assert.equal(map[0].occurrenceCount, 2);
  assert.deepEqual(map[0].pages[1], {
    page: 2,
    occurrenceCount: 2,
    density: "medium",
    objectIds: ["door-001", "door-002"],
  });
  assert.deepEqual(map[1].pages[0].objectIds, ["door-001"]);
  assert.equal(map[1].pages[1].density, "none");
});

test("drawing map summary counts all pages and missing documents", () => {
  assert.deepEqual(summarizeDrawingMap(documents, occurrences, ["document-001"]), {
    documentCount: 2,
    pageCount: 5,
    occurrenceCount: 3,
    missingDocumentCount: 1,
  });
});

test("density levels remain compact and deterministic", () => {
  assert.equal(occurrenceDensity(0), "none");
  assert.equal(occurrenceDensity(1), "low");
  assert.equal(occurrenceDensity(3), "medium");
  assert.equal(occurrenceDensity(4), "high");
});
