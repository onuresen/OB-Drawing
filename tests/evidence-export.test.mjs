import test from "node:test";
import assert from "node:assert/strict";
import {
  createEvidenceAssetIndex,
  EVIDENCE_ASSET_INDEX_FORMAT,
  evidenceExportStem,
} from "../evidence-export.mjs";

test("evidence filenames retain readable subject identity safely", () => {
  assert.equal(evidenceExportStem({ id: "door-001", label: "D-105 / East" }), "d-105-east-door-001");
});

test("asset index separates included previews from unavailable evidence", () => {
  const occurrences = [{ id: "occurrence-001" }, { id: "occurrence-002" }];
  const reasons = new Map([["occurrence-002", "source-pdf-missing"]]);
  const result = createEvidenceAssetIndex(occurrences, [{
    occurrenceId: "occurrence-001",
    path: "previews/occurrence-001.png",
    width: 520,
    height: 325,
  }], reasons);
  assert.equal(result.format, EVIDENCE_ASSET_INDEX_FORMAT);
  assert.deepEqual(result.items[0], {
    occurrenceId: "occurrence-001",
    path: "previews/occurrence-001.png",
    mediaType: "image/png",
    width: 520,
    height: 325,
  });
  assert.deepEqual(result.unavailable, [{ occurrenceId: "occurrence-002", reason: "source-pdf-missing" }]);
});

test("asset index rejects unknown and duplicate occurrence assets", () => {
  const occurrences = [{ id: "occurrence-001" }];
  assert.throws(() => createEvidenceAssetIndex(occurrences, [{
    occurrenceId: "occurrence-999",
    path: "previews/unknown.png",
    width: 1,
    height: 1,
  }]), /unknown occurrence/);
  assert.throws(() => createEvidenceAssetIndex(occurrences, [
    { occurrenceId: "occurrence-001", path: "one.png", width: 1, height: 1 },
    { occurrenceId: "occurrence-001", path: "two.png", width: 1, height: 1 },
  ]), /Duplicate asset/);
});
