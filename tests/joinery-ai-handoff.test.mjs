import test from "node:test";
import assert from "node:assert/strict";
import {
  canCreateJoineryAiHandoff,
  createJoineryAiHandoffIndex,
  createJoineryAiInstructions,
  JOINERY_AI_HANDOFF_FORMAT,
  joineryOpeningType,
} from "../joinery-ai-handoff.mjs";

const evidencePackage = {
  format: "obd-object-evidence-v1",
  subjects: [{ id: "door-001", kind: "physical-instance", category: "doors", label: "D-105" }],
  documents: [{ id: "document-001", name: "doors.pdf" }],
  occurrences: [{ id: "occurrence-001", subjectId: "door-001", documentId: "document-001", page: 4 }],
  observations: [{
    id: "observation-001",
    subjectId: "door-001",
    occurrenceId: "occurrence-001",
    topic: "Operation",
    value: "Single leaf",
    evidenceKind: "observation",
    reviewState: "confirmed",
  }],
};

const rendered = [{
  occurrenceId: "occurrence-001",
  cleanPath: "representations/clean/occurrence-001.png",
  markedPath: "representations/marked/occurrence-001.png",
  width: 520,
  height: 340,
}];

test("door and window subjects map to the Configurator without adding fields to OBD", () => {
  assert.equal(joineryOpeningType("doors"), "door");
  assert.equal(joineryOpeningType("windows"), "window");
  assert.equal(joineryOpeningType("walls"), null);
  assert.equal(canCreateJoineryAiHandoff(evidencePackage.subjects[0]), true);
  assert.equal(canCreateJoineryAiHandoff({ category: "walls" }), false);
});

test("handoff index preserves exact subject and representation provenance", () => {
  const result = createJoineryAiHandoffIndex({
    evidencePackage,
    renderedRepresentations: rendered,
    exportedAt: "2026-09-30T10:00:00.000Z",
  });
  assert.equal(result.format, JOINERY_AI_HANDOFF_FORMAT);
  assert.deepEqual(result.subject, { id: "door-001", category: "doors", label: "D-105" });
  assert.equal(result.target.openingType, "door");
  assert.equal(result.target.schemaVersion, "1.1");
  assert.deepEqual(result.representations.items[0], {
    occurrenceId: "occurrence-001",
    documentId: "document-001",
    documentName: "doors.pdf",
    page: 4,
    cleanPath: "representations/clean/occurrence-001.png",
    markedPath: "representations/marked/occurrence-001.png",
    width: 520,
    height: 340,
  });
});

test("AI instructions treat all representations as one object and retain evidence state", () => {
  const handoffIndex = createJoineryAiHandoffIndex({ evidencePackage, renderedRepresentations: rendered });
  const instructions = createJoineryAiInstructions({ evidencePackage, handoffIndex });
  assert.match(instructions, /same physical object/);
  assert.match(instructions, /Return exactly one raw JSON object/);
  assert.match(instructions, /Operation: Single leaf \[observation; confirmed; source occurrence-001\]/);
  assert.match(instructions, /doors\.pdf, page 4/);
});

test("handoff fails closed on unsupported, incomplete, duplicate, or unknown evidence", () => {
  assert.throws(() => createJoineryAiHandoffIndex({
    evidencePackage: { ...evidencePackage, subjects: [{ ...evidencePackage.subjects[0], category: "walls" }] },
    renderedRepresentations: rendered,
  }), /not supported/);
  assert.throws(() => createJoineryAiHandoffIndex({ evidencePackage, renderedRepresentations: [] }), /At least one/);
  assert.throws(() => createJoineryAiHandoffIndex({
    evidencePackage,
    renderedRepresentations: [...rendered, ...rendered],
  }), /Duplicate/);
  assert.throws(() => createJoineryAiHandoffIndex({
    evidencePackage,
    renderedRepresentations: [{ ...rendered[0], occurrenceId: "occurrence-999" }],
  }), /unknown occurrence/);
  assert.throws(() => createJoineryAiHandoffIndex({
    evidencePackage,
    renderedRepresentations: [{ ...rendered[0], width: 0 }],
  }), /positive image width/);
});

test("handoff points to the separately maintained Configurator prompt", () => {
  const result = createJoineryAiHandoffIndex({ evidencePackage, renderedRepresentations: rendered });
  assert.equal(result.target.promptFileName, "JoineryConfigurator_Photo_to_JSON_Prompt.md");
  assert.equal(result.target.promptIncluded, false);
  assert.equal(result.target.promptAuthority, "Joinery Configurator repository");
  const instructions = createJoineryAiInstructions({ evidencePackage, handoffIndex: result });
  assert.match(instructions, /not duplicated in this package/);
});
