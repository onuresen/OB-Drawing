import test from "node:test";
import assert from "node:assert/strict";
import {
  conflictsForObject,
  createObservation,
  evidenceSummary,
  nextObservationId,
  updateObservationReviewState,
} from "../evidence-model.mjs";

test("evidence IDs grow independently and creation normalizes human text", () => {
  assert.equal(nextObservationId([{ id: "observation-004" }, { id: "other-999" }]), "observation-005");
  assert.deepEqual(createObservation([], {
    objectId: "door-001",
    occurrenceId: "occurrence-001",
    topic: "  Clear   width ",
    value: " 900   mm ",
    createdAt: "2026-09-30T00:00:00.000Z",
  }), {
    id: "observation-001",
    objectId: "door-001",
    occurrenceId: "occurrence-001",
    topic: "Clear width",
    value: "900 mm",
    evidenceKind: "observation",
    reviewState: "unreviewed",
    createdAt: "2026-09-30T00:00:00.000Z",
    updatedAt: "2026-09-30T00:00:00.000Z",
  });
});

test("observations require exact source occurrences while assumptions may be object-level", () => {
  assert.throws(() => createObservation([], {
    objectId: "door-001",
    topic: "Material",
    value: "Steel",
  }), /exact source occurrence/);
  assert.equal(createObservation([], {
    objectId: "door-001",
    topic: "Operation",
    value: "Likely single swing",
    evidenceKind: "assumption",
  }).occurrenceId, null);
});

test("review changes preserve entry identity and timestamps", () => {
  const original = createObservation([], {
    objectId: "door-001",
    occurrenceId: "occurrence-001",
    topic: "Width",
    value: "900 mm",
    createdAt: "2026-09-30T00:00:00.000Z",
  });
  const updated = updateObservationReviewState(
    [original],
    original.id,
    "confirmed",
    "2026-09-30T01:00:00.000Z",
  )[0];
  assert.equal(updated.id, original.id);
  assert.equal(updated.createdAt, original.createdAt);
  assert.equal(updated.updatedAt, "2026-09-30T01:00:00.000Z");
  assert.equal(updated.reviewState, "confirmed");
});

test("conflicts derive from different active values for the same normalized topic", () => {
  const entries = [
    { id: "observation-001", objectId: "door-001", topic: "Width", value: "900 mm", reviewState: "confirmed" },
    { id: "observation-002", objectId: "door-001", topic: " width ", value: "950 mm", reviewState: "needs-confirmation" },
    { id: "observation-003", objectId: "door-001", topic: "WIDTH", value: "900 MM", reviewState: "unreviewed" },
    { id: "observation-004", objectId: "door-002", topic: "Width", value: "800 mm", reviewState: "confirmed" },
  ];
  assert.deepEqual(conflictsForObject(entries, "door-001"), [{
    topic: "Width",
    values: ["900 mm", "950 mm"],
    observationIds: ["observation-001", "observation-002", "observation-003"],
  }]);
});

test("rejecting a competing value resolves the derived conflict without deleting evidence", () => {
  const entries = [
    { id: "observation-001", objectId: "door-001", topic: "Width", value: "900 mm", evidenceKind: "observation", reviewState: "confirmed" },
    { id: "observation-002", objectId: "door-001", topic: "Width", value: "950 mm", evidenceKind: "assumption", reviewState: "rejected" },
  ];
  assert.deepEqual(conflictsForObject(entries, "door-001"), []);
  assert.deepEqual(evidenceSummary(entries, "door-001"), {
    total: 2,
    observations: 1,
    assumptions: 1,
    needsConfirmation: 0,
    confirmed: 1,
    rejected: 1,
    conflictCount: 0,
  });
});
