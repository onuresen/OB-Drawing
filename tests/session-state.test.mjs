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

test("note additions and edits are saved content", () => {
  const original = layer();
  const withNote = structuredClone(original);
  withNote.notes = [{
    id: "note-001",
    scope: "occurrence",
    objectId: null,
    occurrenceId: "occurrence-001",
    text: "Check the clear width.",
    createdAt: "2026-09-30T00:00:00.000Z",
    updatedAt: "2026-09-30T00:00:00.000Z",
  }];
  assert.notEqual(objectLayerSignature(original), objectLayerSignature(withNote));
  const edited = structuredClone(withNote);
  edited.notes[0].text = "Clear width checked.";
  assert.notEqual(objectLayerSignature(withNote), objectLayerSignature(edited));
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
