import test from "node:test";
import assert from "node:assert/strict";
import {
  canRemoveDocument,
  chooseObjectOccurrence,
  findDocumentByFingerprint,
  fingerprintsMatch,
  occurrenceCountForDocument,
} from "../project-documents.mjs";

const documents = [
  { id: "document-001", name: "plans.pdf", size: 100, pageCount: 4, sha256: "a".repeat(64) },
  { id: "document-002", name: "details.pdf", size: 200, pageCount: 8, sha256: "b".repeat(64) },
];

const occurrences = [
  { id: "occurrence-001", objectId: "door-001", documentId: "document-001", page: 2 },
  { id: "occurrence-002", objectId: "door-001", documentId: "document-002", page: 5 },
  { id: "occurrence-003", objectId: "door-002", documentId: "document-002", page: 6 },
];

test("fingerprints match independently of filename", () => {
  assert.equal(fingerprintsMatch(documents[0], { ...documents[0], name: "renamed.pdf" }), true);
  assert.equal(fingerprintsMatch(documents[0], { ...documents[0], size: 101 }), false);
  assert.equal(findDocumentByFingerprint(documents, { ...documents[1], id: "temporary" }).id, "document-002");
  assert.equal(findDocumentByFingerprint(documents, { ...documents[1], sha256: "c".repeat(64) }), null);
});

test("documents with occurrences cannot be removed from the manifest", () => {
  assert.equal(occurrenceCountForDocument(occurrences, "document-002"), 2);
  assert.equal(canRemoveDocument(occurrences, "document-002"), false);
  assert.equal(canRemoveDocument(occurrences, "document-003"), true);
});

test("object navigation prefers the visible page, then attached documents", () => {
  assert.equal(chooseObjectOccurrence({
    occurrences,
    objectId: "door-001",
    activeDocumentId: "document-001",
    activePage: 2,
    attachedDocumentIds: ["document-001", "document-002"],
  }).id, "occurrence-001");

  assert.equal(chooseObjectOccurrence({
    occurrences,
    objectId: "door-001",
    activeDocumentId: "document-003",
    activePage: 1,
    attachedDocumentIds: ["document-002"],
  }).id, "occurrence-002");

  assert.equal(chooseObjectOccurrence({
    occurrences,
    objectId: "door-999",
    activeDocumentId: "document-001",
    activePage: 1,
    attachedDocumentIds: [],
  }), null);
});
