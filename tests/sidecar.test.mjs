import test from "node:test";
import assert from "node:assert/strict";
import {
  compareDocumentFingerprint,
  createDocumentFingerprint,
  createSidecar,
  DOCUMENT_ID,
  LEGACY_SIDECAR_FORMAT,
  migrateLegacySidecar,
  migrateProjectV2,
  migrateProjectV3,
  MULTI_DOCUMENT_PROJECT_FORMAT,
  nextDocumentId,
  PREVIOUS_PROJECT_FORMAT,
  PROJECT_FORMAT,
  sha256Hex,
  SIDECAR_FORMAT,
  toRuntimeOccurrences,
  validateSidecar,
} from "../sidecar.mjs";

const document = createDocumentFingerprint({
  name: "set.pdf",
  size: 1234,
  pageCount: 4,
  sha256: "a".repeat(64),
});

const secondDocument = createDocumentFingerprint({
  id: "document-002",
  name: "details.pdf",
  size: 5678,
  pageCount: 8,
  sha256: "b".repeat(64),
});

function validProject() {
  return createSidecar({
    documents: [document, secondDocument],
    activeDocumentId: document.id,
    exportedAt: "2026-09-29T00:00:00.000Z",
    objects: [
      { id: "door-001", category: "doors", label: "D-105" },
      { id: "object-001", category: "windows", label: "W-201" },
    ],
    occurrences: [
      {
        id: "occurrence-001",
        objectId: "door-001",
        documentId: document.id,
        page: 2,
        bounds: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
      },
      {
        id: "occurrence-002",
        objectId: "door-001",
        documentId: secondDocument.id,
        page: 6,
        geometryType: "ellipse",
        bounds: { x: 0.4, y: 0.3, width: 0.2, height: 0.1 },
      },
      {
        id: "occurrence-003",
        objectId: null,
        documentId: secondDocument.id,
        page: 7,
        geometryType: "polygon",
        bounds: { x: 0.1, y: 0.1, width: 0.3, height: 0.4 },
        points: [{ x: 0.1, y: 0.1 }, { x: 0.4, y: 0.1 }, { x: 0.2, y: 0.5 }],
      },
    ],
  });
}

function legacySidecar() {
  return {
    format: LEGACY_SIDECAR_FORMAT,
    exportedAt: "2026-09-29T00:00:00.000Z",
    document: { ...document },
    objects: [{ id: "door-001", type: "Door", label: "D-105" }],
    occurrences: [{
      id: "occurrence-001",
      objectId: "door-001",
      documentId: DOCUMENT_ID,
      page: 2,
      bounds: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
    }],
  };
}

test("SHA-256 fingerprints are stable", async () => {
  assert.equal(
    await sha256Hex(new TextEncoder().encode("abc")),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});

test("a v4 project keeps categorized objects linked across multiple documents", () => {
  const project = validProject();
  assert.equal(project.format, PROJECT_FORMAT);
  assert.equal(project.format, SIDECAR_FORMAT);
  assert.equal(project.activeDocumentId, DOCUMENT_ID);
  assert.deepEqual(project.documents.map((item) => item.id), ["document-001", "document-002"]);
  assert.deepEqual(project.objects.map((item) => item.category), ["doors", "windows"]);
  assert.deepEqual(project.occurrences.map((item) => item.documentId), ["document-001", "document-002", "document-002"]);
  assert.deepEqual(project.occurrences.map((item) => item.geometry.type), ["rectangle", "ellipse", "polygon"]);
  assert.deepEqual(project.occurrences[2].geometry.points, [
    { x: 0.1, y: 0.1 }, { x: 0.4, y: 0.1 }, { x: 0.2, y: 0.5 },
  ]);
  assert.equal("bounds" in project.occurrences[2].geometry, false);
});

test("runtime conversion retains document identity and typed geometry", () => {
  assert.deepEqual(toRuntimeOccurrences(validProject().occurrences), [
    {
      id: "occurrence-001",
      objectId: "door-001",
      documentId: "document-001",
      page: 2,
      geometryType: "rectangle",
      bounds: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
    },
    {
      id: "occurrence-002",
      objectId: "door-001",
      documentId: "document-002",
      page: 6,
      geometryType: "ellipse",
      bounds: { x: 0.4, y: 0.3, width: 0.2, height: 0.1 },
    },
    {
      id: "occurrence-003",
      objectId: null,
      documentId: "document-002",
      page: 7,
      geometryType: "polygon",
      bounds: { x: 0.1, y: 0.1, width: 0.30000000000000004, height: 0.4 },
      points: [{ x: 0.1, y: 0.1 }, { x: 0.4, y: 0.1 }, { x: 0.2, y: 0.5 }],
    },
  ]);
});

test("legacy v1 sidecars migrate to a single-document v4 project without changing IDs", () => {
  const migrated = migrateLegacySidecar(legacySidecar());
  assert.equal(migrated.format, PROJECT_FORMAT);
  assert.equal(migrated.activeDocumentId, DOCUMENT_ID);
  assert.equal(migrated.documents.length, 1);
  assert.deepEqual(migrated.objects[0], { id: "door-001", category: "doors", label: "D-105" });
  assert.equal(migrated.occurrences[0].geometry.type, "rectangle");
  assert.equal("bounds" in migrated.occurrences[0], false);
  assert.deepEqual(validateSidecar(legacySidecar()), migrated);
});

test("v2 projects migrate to v4 with categories and an empty governed evidence layer", () => {
  const previous = validProject();
  previous.format = MULTI_DOCUMENT_PROJECT_FORMAT;
  previous.objects = [{ id: "door-001", type: "Door", label: "D-105" }];
  delete previous.observations;
  const migrated = migrateProjectV2(previous);
  assert.equal(migrated.format, PROJECT_FORMAT);
  assert.deepEqual(migrated.objects[0], { id: "door-001", category: "doors", label: "D-105" });
  assert.deepEqual(migrated.observations, []);
  assert.deepEqual(validateSidecar(previous), migrated);
});

test("v3 projects migrate to v4 without changing object or evidence identity", () => {
  const previous = validProject();
  previous.format = PREVIOUS_PROJECT_FORMAT;
  previous.objects = [{ id: "door-001", type: "Door", label: "D-105" }];
  previous.observations.push({
    id: "observation-001",
    objectId: "door-001",
    occurrenceId: "occurrence-001",
    topic: "Clear width",
    value: "900 mm",
    evidenceKind: "observation",
    reviewState: "confirmed",
    createdAt: "2026-09-30T00:00:00.000Z",
    updatedAt: "2026-09-30T00:00:00.000Z",
  });
  const migrated = migrateProjectV3(previous);
  assert.equal(migrated.format, PROJECT_FORMAT);
  assert.deepEqual(migrated.objects[0], { id: "door-001", category: "doors", label: "D-105" });
  assert.equal(migrated.observations[0].id, "observation-001");
  assert.deepEqual(validateSidecar(previous), migrated);
});

test("v4 observations retain exact object and source-occurrence identity", () => {
  const project = validProject();
  project.observations.push({
    id: "observation-001",
    objectId: "door-001",
    occurrenceId: "occurrence-001",
    topic: "Clear width",
    value: "900 mm",
    evidenceKind: "observation",
    reviewState: "confirmed",
    createdAt: "2026-09-30T00:00:00.000Z",
    updatedAt: "2026-09-30T01:00:00.000Z",
  });
  assert.deepEqual(validateSidecar(project).observations, project.observations);
});

test("observations fail closed on unknown or mismatched source identity", () => {
  const unknownSource = validProject();
  unknownSource.observations.push({
    id: "observation-001",
    objectId: "door-001",
    occurrenceId: "occurrence-999",
    topic: "Width",
    value: "900 mm",
    evidenceKind: "observation",
    reviewState: "unreviewed",
    createdAt: "2026-09-30T00:00:00.000Z",
    updatedAt: "2026-09-30T00:00:00.000Z",
  });
  assert.throws(() => validateSidecar(unknownSource), /unknown occurrence/);

  const objectLevelObservation = validProject();
  objectLevelObservation.observations.push({
    ...unknownSource.observations[0],
    occurrenceId: null,
  });
  assert.throws(() => validateSidecar(objectLevelObservation), /requires an exact source occurrence/);
});

test("document IDs can grow without depending on array order", () => {
  assert.equal(nextDocumentId([]), "document-001");
  assert.equal(nextDocumentId([{ id: "document-004" }, { id: "document-002" }]), "document-005");
});

test("duplicate object and document identities are rejected", () => {
  const duplicateObject = validProject();
  duplicateObject.objects.push({ ...duplicateObject.objects[0] });
  assert.throws(() => validateSidecar(duplicateObject), /Duplicate object ID/);

  const duplicateDocument = validProject();
  duplicateDocument.documents.push({ ...secondDocument });
  assert.throws(() => validateSidecar(duplicateDocument), /Duplicate document ID/);
});

test("duplicate document fingerprints are rejected even when names and IDs differ", () => {
  const project = validProject();
  project.documents[1] = {
    ...project.documents[0],
    id: "document-002",
    name: "renamed-copy.pdf",
  };
  assert.throws(() => validateSidecar(project), /Duplicate document fingerprint/);
});

test("active and occurrence document references must exist", () => {
  const inactive = validProject();
  inactive.activeDocumentId = "document-999";
  assert.throws(() => validateSidecar(inactive), /activeDocumentId/);

  const unknown = validProject();
  unknown.occurrences[0].documentId = "document-999";
  assert.throws(() => validateSidecar(unknown), /unknown document/);
});

test("occurrence pages are checked against their own document", () => {
  const project = validProject();
  project.occurrences[0].page = 5;
  assert.throws(() => validateSidecar(project), /document-001/);

  const validOnSecondDocument = validProject();
  validOnSecondDocument.occurrences[1].page = 8;
  assert.equal(validateSidecar(validOnSecondDocument).occurrences[1].page, 8);
});

test("geometry bounds and supported types are validated", () => {
  const outsidePage = validProject();
  outsidePage.occurrences[0].geometry.bounds.x = 0.9;
  assert.throws(() => validateSidecar(outsidePage), /page width/);

  const unsupported = validProject();
  unsupported.occurrences[0].geometry.type = "freehand";
  assert.throws(() => validateSidecar(unsupported), /unsupported geometry type/);
});

test("polygon geometry requires normalized vertices enclosing an area", () => {
  const project = validProject();
  project.occurrences[2].geometry.points[0].x = 1.2;
  assert.throws(() => validateSidecar(project), /outside the page/);

  const flat = validProject();
  flat.occurrences[2].geometry.points = [{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 }, { x: 0.3, y: 0.3 }];
  assert.throws(() => validateSidecar(flat), /enclose an area/);
});

test("an occurrence cannot link to an unknown object", () => {
  const project = validProject();
  project.occurrences[0].objectId = "door-999";
  assert.throws(() => validateSidecar(project), /unknown object/);
});

test("unsupported object categories are rejected", () => {
  const project = validProject();
  project.objects[0].category = "not-a-category";
  assert.throws(() => validateSidecar(project), /unsupported object category/);
});

test("same bytes under a renamed PDF still match", () => {
  const activeDocument = { ...document, name: "renamed.pdf" };
  assert.deepEqual(compareDocumentFingerprint(document, activeDocument), { matches: true, reasons: [] });
});

test("a changed PDF reports fingerprint, size, and page-count differences", () => {
  const activeDocument = {
    ...document,
    size: 1400,
    pageCount: 5,
    sha256: "c".repeat(64),
  };
  const comparison = compareDocumentFingerprint(document, activeDocument);
  assert.equal(comparison.matches, false);
  assert.deepEqual(comparison.reasons, [
    "SHA-256 fingerprint differs",
    "file size differs",
    "page count differs",
  ]);
});
