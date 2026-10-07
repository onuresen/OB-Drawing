import test from "node:test";
import assert from "node:assert/strict";
import {
  boundsAreEqual,
  createObjectLayerSnapshot,
  ObjectLayerHistory,
} from "../history.mjs";

function snapshot(label = "D-101", x = 0.1) {
  return createObjectLayerSnapshot({
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
  });
}

test("undo and redo restore complete object-layer snapshots", () => {
  const history = new ObjectLayerHistory();
  const before = snapshot();
  const after = snapshot("D-101A", 0.25);

  history.record(before, "Rename D-101");
  const undone = history.undo(after);
  assert.equal(undone.label, "Rename D-101");
  assert.deepEqual(undone.snapshot, before);
  assert.equal(history.canRedo, true);

  const redone = history.redo(undone.snapshot);
  assert.deepEqual(redone.snapshot, after);
  assert.equal(history.canUndo, true);
});

test("recording a new mutation clears the redo branch", () => {
  const history = new ObjectLayerHistory();
  history.record(snapshot(), "First change");
  history.undo(snapshot("D-102"));
  assert.equal(history.canRedo, true);

  history.record(snapshot("D-103"), "New branch");
  assert.equal(history.canRedo, false);
  assert.equal(history.undoLabel, "New branch");
});

test("history is bounded and snapshots are cloned", () => {
  const history = new ObjectLayerHistory(2);
  const first = snapshot("D-101", 0.1);
  history.record(first, "First");
  first.occurrences[0].bounds.x = 0.9;
  history.record(snapshot("D-102", 0.2), "Second");
  history.record(snapshot("D-103", 0.3), "Third");

  assert.equal(history.undo(snapshot("D-104")).label, "Third");
  const oldestRetained = history.undo(snapshot("D-103"));
  assert.equal(oldestRetained.label, "Second");
  assert.equal(history.undo(snapshot("D-102")), null);
});

test("history deeply clones polygon vertices", () => {
  const history = new ObjectLayerHistory();
  const polygon = snapshot();
  polygon.occurrences[0].geometryType = "polygon";
  polygon.occurrences[0].points = [{ x: 0.1, y: 0.2 }, { x: 0.4, y: 0.2 }, { x: 0.2, y: 0.5 }];
  history.record(polygon, "Edit polygon");
  polygon.occurrences[0].points[0].x = 0.9;
  assert.equal(history.undo(snapshot()).snapshot.occurrences[0].points[0].x, 0.1);
});

test("history restores editable notes", () => {
  const history = new ObjectLayerHistory();
  const before = snapshot();
  before.notes.push({
    id: "note-001",
    scope: "occurrence",
    objectId: null,
    occurrenceId: "occurrence-001",
    text: "Check the clear width.",
    createdAt: "2026-09-30T00:00:00.000Z",
    updatedAt: "2026-09-30T00:00:00.000Z",
  });
  const after = structuredClone(before);
  after.notes[0].text = "Clear width checked.";
  history.record(before, "edit note-001");
  const restored = history.undo(after).snapshot;
  assert.equal(restored.notes[0].text, "Check the clear width.");
});

test("bounds equality detects a completed move", () => {
  const original = { x: 0.1, y: 0.2, width: 0.3, height: 0.4 };
  assert.equal(boundsAreEqual(original, { ...original }), true);
  assert.equal(boundsAreEqual(original, { ...original, x: 0.11 }), false);
});
