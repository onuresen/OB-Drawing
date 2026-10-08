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

test("selected subject exports include its object and occurrence notes", () => {
  const notes = [{
    id: "note-001",
    scope: "occurrence",
    objectId: "door-001",
    occurrenceId: "occurrence-001",
    text: "Clear width: 900 mm",
    createdAt: "2026-09-30T00:00:00.000Z",
    updatedAt: "2026-09-30T01:00:00.000Z",
  }, {
    id: "note-002",
    scope: "object",
    objectId: "door-002",
    occurrenceId: null,
    text: "Material: Steel",
    createdAt: "2026-09-30T00:00:00.000Z",
    updatedAt: "2026-09-30T00:00:00.000Z",
  }];
  const result = createObjectEvidencePackage({
    documents,
    objects,
    occurrences,
    notes,
    selectedObjectIds: ["door-001"],
  });
  assert.equal(result.producer.projectFormat, "objdraw-project-v6");
  assert.deepEqual(result.notes.map((entry) => entry.id), ["note-001"]);
  assert.equal(result.notes[0].subjectId, "door-001");
});

test("a subject's relations travel with it, and the other ends come as identity only", () => {
  const allObjects = [
    ...objects,
    { id: "object-003", category: "walls", label: "W-3" },
    { id: "object-004", category: "rooms", label: "105 Retail" },
  ];
  const relations = [
    { id: "relation-001", type: "hostedBy", from: "door-001", to: "object-003", label: "", origin: "revit" },
    { id: "relation-002", type: "connectsTo", from: "door-001", to: "object-004", label: "from room" },
    { id: "relation-003", type: "inside", from: "door-002", to: "object-004", label: "" },
  ];
  const result = createObjectEvidencePackage({
    documents,
    objects: allObjects,
    occurrences,
    relations,
    selectedObjectIds: ["door-001"],
    exportedAt: "2026-10-08T00:00:00.000Z",
  });
  assert.equal(result.format, OBJECT_EVIDENCE_FORMAT);
  assert.deepEqual(result.objectRelations.map((relation) => relation.id), ["relation-001", "relation-002"]);
  assert.equal(result.objectRelations[0].origin, "revit");
  assert.deepEqual(result.relatedObjects, [
    { id: "object-003", category: "walls", label: "W-3" },
    { id: "object-004", category: "rooms", label: "105 Retail" },
  ]);
  // Related objects bring no drawings of their own.
  assert.ok(result.occurrences.every((occurrence) => occurrence.subjectId === "door-001"));
  assert.ok(result.relationships.every((relationship) => relationship.kind === "instanceOf"));
});

test("relation fields are optional, and broken relations fail closed", () => {
  const base = createObjectEvidencePackage({ documents, objects, occurrences, selectedObjectIds: ["door-001"], exportedAt: "2026-10-08T00:00:00.000Z" });
  const { relatedObjects: _r, objectRelations: _o, ...older } = base;
  assert.deepEqual(validateObjectEvidencePackage(older).objectRelations, [], "packages without the fields stay valid");
  const related = [{ id: "object-004", category: "rooms", label: "105 Retail" }];
  const relation = { id: "relation-001", type: "connectsTo", from: "door-001", to: "object-004", label: "" };
  for (const [patch, message] of [
    [{ relatedObjects: related, objectRelations: [{ ...relation, type: "nextDoor" }] }, /unsupported relation type/],
    [{ relatedObjects: [], objectRelations: [relation] }, /not exported/],
    [{ relatedObjects: related, objectRelations: [] }, /no relation uses it/],
    [{ relatedObjects: [{ id: "object-005", category: "rooms", label: "R" }, ...related], objectRelations: [{ ...relation, from: "object-005" }] }, /does not touch an exported subject/],
  ]) {
    assert.throws(() => validateObjectEvidencePackage({ ...base, ...patch }), message);
  }
});
