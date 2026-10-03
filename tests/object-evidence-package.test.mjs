import test from "node:test";
import assert from "node:assert/strict";
import {
  createObjectEvidencePackage,
  OBJECT_EVIDENCE_FORMAT,
  validateObjectEvidencePackage,
} from "../object-evidence-package.mjs";

const documents = [
  { id: "document-001", name: "plans.pdf", size: 1000, pageCount: 3, sha256: "a".repeat(64) },
  { id: "document-002", name: "joinery.pdf", size: 2000, pageCount: 5, sha256: "b".repeat(64) },
  { id: "document-003", name: "unrelated.pdf", size: 3000, pageCount: 2, sha256: "c".repeat(64) },
];

const objects = [
  { id: "door-001", category: "doors", label: "D-105" },
  { id: "door-002", category: "doors", label: "D-105" },
];

const occurrences = [
  {
    id: "occurrence-001",
    objectId: "door-001",
    documentId: "document-001",
    page: 2,
    geometryType: "rectangle",
    bounds: { x: 0.1, y: 0.2, width: 0.2, height: 0.3 },
  },
  {
    id: "occurrence-002",
    objectId: "door-001",
    documentId: "document-002",
    page: 4,
    geometryType: "polygon",
    points: [{ x: 0.2, y: 0.2 }, { x: 0.4, y: 0.2 }, { x: 0.3, y: 0.5 }],
  },
  {
    id: "occurrence-003",
    objectId: "door-002",
    documentId: "document-001",
    page: 3,
    geometryType: "ellipse",
    bounds: { x: 0.6, y: 0.4, width: 0.1, height: 0.2 },
  },
];

test("an evidence package contains only explicitly selected subjects and their source evidence", () => {
  const result = createObjectEvidencePackage({
    documents,
    objects,
    occurrences,
    selectedObjectIds: ["door-001"],
    exportedAt: "2026-09-30T00:00:00.000Z",
  });
  assert.equal(result.format, OBJECT_EVIDENCE_FORMAT);
  assert.deepEqual(result.subjects, [{
    id: "door-001",
    kind: "physical-instance",
    category: "doors",
    label: "D-105",
  }]);
  assert.deepEqual(result.documents.map((document) => document.id), ["document-001", "document-002"]);
  assert.deepEqual(result.occurrences.map((occurrence) => occurrence.id), ["occurrence-001", "occurrence-002"]);
  assert.equal(result.occurrences[1].geometry.type, "polygon");
});

test("duplicate visible labels remain separate physical subjects", () => {
  const result = createObjectEvidencePackage({
    documents,
    objects,
    occurrences,
    selectedObjectIds: ["door-001", "door-002"],
  });
  assert.deepEqual(result.subjects.map((subject) => subject.id), ["door-001", "door-002"]);
  assert.deepEqual(result.subjects.map((subject) => subject.label), ["D-105", "D-105"]);
  assert.deepEqual(result.relationships, []);
});

test("instance-to-configuration identity exists only through an explicit relationship", () => {
  const configurations = [{ id: "configuration-001", category: "doors", label: "D-105 Type" }];
  const relationships = [{
    kind: "instanceOf",
    subjectId: "door-001",
    configurationId: "configuration-001",
  }];
  const result = createObjectEvidencePackage({
    documents,
    objects,
    occurrences,
    selectedObjectIds: ["door-001"],
    configurations,
    relationships,
  });
  assert.deepEqual(result.configurations, configurations);
  assert.deepEqual(result.relationships, relationships);
});

test("same labels never create an implicit configuration relationship", () => {
  const result = createObjectEvidencePackage({
    documents,
    objects,
    occurrences,
    selectedObjectIds: ["door-001"],
    configurations: [{ id: "configuration-001", category: "doors", label: "D-105" }],
  });
  assert.deepEqual(result.configurations, []);
  assert.deepEqual(result.relationships, []);
});

test("unknown subjects, unrepresented subjects, and invalid configuration links fail closed", () => {
  assert.throws(() => createObjectEvidencePackage({
    documents,
    objects,
    occurrences,
    selectedObjectIds: ["door-999"],
  }), /Unknown selected object/);

  assert.throws(() => createObjectEvidencePackage({
    documents,
    objects: [...objects, { id: "door-003", category: "doors", label: "D-106" }],
    occurrences,
    selectedObjectIds: ["door-003"],
  }), /no exported source occurrence/);

  const result = createObjectEvidencePackage({
    documents,
    objects,
    occurrences,
    selectedObjectIds: ["door-001"],
  });
  result.configurations.push({ id: "configuration-001", category: "windows", label: "W-01" });
  result.relationships.push({ kind: "instanceOf", subjectId: "door-001", configurationId: "configuration-001" });
  assert.throws(() => validateObjectEvidencePackage(result), /different categories/);
});

test("source page and geometry validation remain part of the portable boundary", () => {
  const result = createObjectEvidencePackage({
    documents,
    objects,
    occurrences,
    selectedObjectIds: ["door-001"],
  });
  result.occurrences[0].page = 99;
  assert.throws(() => validateObjectEvidencePackage(result), /invalid page number/);

  const invalidGeometry = createObjectEvidencePackage({
    documents,
    objects,
    occurrences,
    selectedObjectIds: ["door-001"],
  });
  invalidGeometry.occurrences[0].geometry.bounds.width = 2;
  assert.throws(() => validateObjectEvidencePackage(invalidGeometry), /past the page width/);
});

test("selected subject exports include its reviewed source-linked evidence", () => {
  const observations = [{
    id: "observation-001",
    objectId: "door-001",
    occurrenceId: "occurrence-001",
    topic: "Clear width",
    value: "900 mm",
    evidenceKind: "observation",
    reviewState: "confirmed",
    createdAt: "2026-09-30T00:00:00.000Z",
    updatedAt: "2026-09-30T01:00:00.000Z",
  }, {
    id: "observation-002",
    objectId: "door-002",
    occurrenceId: "occurrence-003",
    topic: "Material",
    value: "Steel",
    evidenceKind: "observation",
    reviewState: "unreviewed",
    createdAt: "2026-09-30T00:00:00.000Z",
    updatedAt: "2026-09-30T00:00:00.000Z",
  }];
  const result = createObjectEvidencePackage({
    documents,
    objects,
    occurrences,
    observations,
    selectedObjectIds: ["door-001"],
  });
  assert.equal(result.producer.projectFormat, "obd-project-v4");
  assert.deepEqual(result.observations.map((entry) => entry.id), ["observation-001"]);
  assert.equal(result.observations[0].subjectId, "door-001");
});
