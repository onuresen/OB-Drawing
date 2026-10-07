import test from "node:test";
import assert from "node:assert/strict";
import {
  LEGACY_REVIT_DATA_FORMAT,
  REVIT_DATA_FORMAT,
  revitObjectData,
  validateRevitData,
} from "../revit-data.mjs";

const projectObjects = [{ id: "object-001" }];
const projectDocuments = [{
  id: "document-001",
  name: "sample.pdf",
  size: 1234,
  pageCount: 1,
  sha256: "a".repeat(64),
}];

function fixture() {
  return {
    format: REVIT_DATA_FORMAT,
    projectFile: "sample.objdraw.json",
    exportedAt: "2026-10-07T12:00:00.000Z",
    revitDocument: "Safe playground",
    sourceDocument: { ...projectDocuments[0] },
    includesParameters: true,
    objects: [{
      objectId: "object-001",
      uniqueId: "unique-1",
      elementId: 42,
      familyName: "Single-Flush",
      typeName: "0915 x 2134mm",
      mark: "D-01",
      instanceParameters: [{
        sourceKey: "parameter:-1001203",
        name: "Mark",
        storageType: "string",
        rawValue: "D-01",
        displayValue: "D-01",
      }],
      typeParameters: [{
        sourceKey: "shared:12345678-1234-1234-1234-123456789abc",
        name: "Fire Rating",
        storageType: "string",
        rawValue: "60",
        displayValue: "60 min",
      }],
    }],
    occurrences: [],
    skipped: [],
  };
}

test("Revit parameter snapshots retain instance and type values", () => {
  const data = validateRevitData(fixture(), projectObjects, projectDocuments);
  const object = revitObjectData(data, "object-001");
  assert.equal(data.includesParameters, true);
  assert.equal(object.instanceParameters[0].displayValue, "D-01");
  assert.equal(object.typeParameters[0].rawValue, "60");
});

test("legacy identity adapters remain importable without parameters", () => {
  const legacy = fixture();
  legacy.format = LEGACY_REVIT_DATA_FORMAT;
  delete legacy.includesParameters;
  delete legacy.objects[0].instanceParameters;
  delete legacy.objects[0].typeParameters;
  const data = validateRevitData(legacy, projectObjects, projectDocuments);
  assert.equal(data.includesParameters, false);
  assert.deepEqual(data.objects[0].instanceParameters, []);
});

test("Revit data fails closed when object identity or parameter data is invalid", () => {
  const unknown = fixture();
  unknown.objects[0].objectId = "object-999";
  assert.throws(() => validateRevitData(unknown, projectObjects, projectDocuments), /not present in the current project/);

  const invalidParameter = fixture();
  invalidParameter.objects[0].instanceParameters[0].displayValue = "";
  assert.throws(() => validateRevitData(invalidParameter, projectObjects, projectDocuments), /displayValue cannot be empty/);

  const wrongPdf = fixture();
  wrongPdf.sourceDocument.sha256 = "b".repeat(64);
  assert.throws(() => validateRevitData(wrongPdf, projectObjects, projectDocuments), /does not match a PDF/);
});
