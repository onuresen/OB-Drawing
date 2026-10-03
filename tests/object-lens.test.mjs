import test from "node:test";
import assert from "node:assert/strict";
import {
  objectLensContextBounds,
  sortObjectRepresentations,
  summarizeObjectLens,
} from "../object-lens.mjs";

test("Object Lens summarizes representations across documents and pages", () => {
  const occurrences = [
    { documentId: "document-001", page: 2 },
    { documentId: "document-001", page: 2 },
    { documentId: "document-002", page: 6 },
  ];
  assert.deepEqual(summarizeObjectLens(occurrences, ["document-001"]), {
    occurrenceCount: 3,
    documentCount: 2,
    pageCount: 2,
    missingDocumentCount: 1,
  });
});

test("Object Lens context expands small marks and stays within the page", () => {
  const context = objectLensContextBounds(
    { x: 0.92, y: 0.88, width: 0.04, height: 0.06 },
    0.75,
  );
  assert.ok(context.width >= 0.32);
  assert.ok(context.height >= 0.22);
  assert.ok(context.x >= 0 && context.y >= 0);
  assert.ok(context.x + context.width <= 1);
  assert.ok(context.y + context.height <= 1);
  assert.ok(Math.abs((context.width * 0.75) / context.height - 1.6) < 1e-12);
});

test("Object Lens context preserves large occurrences without clipping", () => {
  const context = objectLensContextBounds(
    { x: 0.05, y: 0.08, width: 0.85, height: 0.78 },
    1.4,
  );
  assert.ok(context.x <= 0.05);
  assert.ok(context.y <= 0.08);
  assert.ok(context.x + context.width >= 0.9);
  assert.ok(context.y + context.height >= 0.86);
});

test("representation board order follows the document manifest, then page and identity", () => {
  const occurrences = [
    { id: "occurrence-010", documentId: "document-002", page: 2 },
    { id: "occurrence-003", documentId: "document-001", page: 8 },
    { id: "occurrence-002", documentId: "document-001", page: 8 },
    { id: "occurrence-004", documentId: "document-001", page: 3 },
  ];
  const sorted = sortObjectRepresentations(occurrences, [
    { id: "document-001" },
    { id: "document-002" },
  ]);
  assert.deepEqual(sorted.map((occurrence) => occurrence.id), [
    "occurrence-004",
    "occurrence-002",
    "occurrence-003",
    "occurrence-010",
  ]);
  assert.deepEqual(occurrences.map((occurrence) => occurrence.id), [
    "occurrence-010",
    "occurrence-003",
    "occurrence-002",
    "occurrence-004",
  ]);
});
