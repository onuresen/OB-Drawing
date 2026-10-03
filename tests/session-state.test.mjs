import test from "node:test";
import assert from "node:assert/strict";
import {
  objectLayerSignature,
  ObjectLayerSaveState,
} from "../session-state.mjs";

function layer(label = "D-101", x = 0.1) {
  return {
    documents: [{
      id: "document-001",
      name: "set.pdf",
      size: 1234,
      pageCount: 4,
      sha256: "a".repeat(64),
    }],
    activeDocumentId: "document-001",
    objects: [{ id: "door-001", category: "doors", label }],
    occurrences: [{
      id: "occurrence-001",
      objectId: "door-001",
      documentId: "document-001",
      page: 1,
      geometryType: "rectangle",
      bounds: { x, y: 0.2, width: 0.3, height: 0.4 },
    }],
    selectedObjectId: "door-001",
    selectedOccurrenceId: "occurrence-001",
  };
}

test("selection changes do not make the object layer dirty", () => {
  const original = layer();
  const selectionChanged = {
    ...original,
    activeDocumentId: "document-002",
    selectedObjectId: null,
    selectedOccurrenceId: null,
  };
  assert.equal(objectLayerSignature(original), objectLayerSignature(selectionChanged));
});

test("document membership and occurrence document links are saved content", () => {
  const original = layer();
  const renamedDocument = {
    ...original,
    documents: [{ ...original.documents[0], name: "renamed.pdf" }],
  };
  const movedOccurrence = {
    ...original,
    occurrences: [{ ...original.occurrences[0], documentId: "document-002" }],
  };
  assert.notEqual(objectLayerSignature(original), objectLayerSignature(renamedDocument));
  assert.notEqual(objectLayerSignature(original), objectLayerSignature(movedOccurrence));
});

test("object and occurrence mutations are detected", () => {
  const saveState = new ObjectLayerSaveState();
  saveState.markSaved(layer());

  assert.equal(saveState.isDirty(layer("D-101A")), true);
  assert.equal(saveState.isDirty(layer("D-101", 0.25)), true);
});

test("evidence additions and review decisions are saved content", () => {
  const original = layer();
  const withEvidence = structuredClone(original);
  withEvidence.observations = [{
    id: "observation-001",
    objectId: "door-001",
    occurrenceId: "occurrence-001",
    topic: "Width",
    value: "900 mm",
    evidenceKind: "observation",
    reviewState: "unreviewed",
    createdAt: "2026-09-30T00:00:00.000Z",
    updatedAt: "2026-09-30T00:00:00.000Z",
  }];
  assert.notEqual(objectLayerSignature(original), objectLayerSignature(withEvidence));
  const reviewed = structuredClone(withEvidence);
  reviewed.observations[0].reviewState = "confirmed";
  assert.notEqual(objectLayerSignature(withEvidence), objectLayerSignature(reviewed));
});

test("polygon vertex edits are detected as saved content", () => {
  const original = layer();
  original.occurrences[0].geometryType = "polygon";
  original.occurrences[0].points = [{ x: 0.1, y: 0.2 }, { x: 0.4, y: 0.2 }, { x: 0.2, y: 0.5 }];
  const edited = structuredClone(original);
  edited.occurrences[0].points[2].x = 0.3;
  assert.notEqual(objectLayerSignature(original), objectLayerSignature(edited));
});

test("returning to the saved snapshot becomes clean again", () => {
  const saveState = new ObjectLayerSaveState();
  const saved = layer();
  saveState.markSaved(saved);

  assert.equal(saveState.isDirty(layer("D-102")), true);
  assert.equal(saveState.isDirty(saved), false);
});

test("a reset save state has no dirty baseline", () => {
  const saveState = new ObjectLayerSaveState();
  saveState.markSaved(layer());
  saveState.reset();

  assert.equal(saveState.hasBaseline, false);
  assert.equal(saveState.isDirty(layer("D-102")), false);
});
