import test from "node:test";
import assert from "node:assert/strict";
import {
  createNote,
  nextNoteId,
  removeNote,
  updateNote,
} from "../note-model.mjs";

test("notes have stable growing IDs and preserve useful line breaks", () => {
  assert.equal(nextNoteId([{ id: "note-004" }, { id: "other-999" }]), "note-005");
  assert.deepEqual(createNote([], {
    scope: "project",
    text: "  Check the drawing set.\r\nConfirm page order.  ",
    createdAt: "2026-10-07T00:00:00.000Z",
  }), {
    id: "note-001",
    scope: "project",
    objectId: null,
    occurrenceId: null,
    text: "Check the drawing set.\nConfirm page order.",
    createdAt: "2026-10-07T00:00:00.000Z",
    updatedAt: "2026-10-07T00:00:00.000Z",
  });
});

test("object and occurrence scopes require their exact targets", () => {
  assert.throws(() => createNote([], { scope: "object", text: "Check" }), /requires an object/);
  assert.throws(() => createNote([], { scope: "occurrence", text: "Check" }), /requires an occurrence/);
  assert.equal(createNote([], {
    scope: "object",
    objectId: "door-001",
    text: "Check object",
  }).objectId, "door-001");
  assert.equal(createNote([], {
    scope: "occurrence",
    occurrenceId: "occurrence-001",
    text: "Check mark",
  }).occurrenceId, "occurrence-001");
});

test("notes are editable and removable without changing identity", () => {
  const original = createNote([], {
    text: "First wording",
    createdAt: "2026-10-07T00:00:00.000Z",
  });
  const updated = updateNote([original], original.id, "Clearer wording", "2026-10-07T01:00:00.000Z")[0];
  assert.equal(updated.id, original.id);
  assert.equal(updated.createdAt, original.createdAt);
  assert.equal(updated.updatedAt, "2026-10-07T01:00:00.000Z");
  assert.equal(updated.text, "Clearer wording");
  assert.deepEqual(removeNote([updated], updated.id), []);
});
