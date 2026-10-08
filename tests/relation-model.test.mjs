import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  RELATION_TYPES,
  createRelation,
  findDuplicateRelation,
  nearestOccurrencePair,
  relationCurve,
  relationLanes,
  relationPhrase,
  relationTypeGroups,
  relationsForObject,
  removeRelation,
  removeRelationsByOrigin,
  removeRelationsForObject,
  suggestRelationType,
  updateRelation,
} from "../relation-model.mjs";
import {
  PROJECT_FORMAT,
  PROJECT_V5_FORMAT,
  createDocumentFingerprint,
  createSidecar,
  validateSidecar,
} from "../sidecar.mjs";
import { createObjectLayerSnapshot } from "../history.mjs";
import { objectLayerSignature } from "../session-state.mjs";

const document = createDocumentFingerprint({ name: "set.pdf", size: 1234, pageCount: 4, sha256: "c".repeat(64) });
const objects = [
  { id: "object-001", category: "security-devices", label: "CR-01" },
  { id: "object-002", category: "doors", label: "D-105" },
  { id: "object-003", category: "walls", label: "W-3" },
  { id: "object-004", category: "rooms", label: "105 Retail" },
];

function project(relations) {
  return createSidecar({
    documents: [document],
    exportedAt: "2026-10-08T00:00:00.000Z",
    objects,
    occurrences: [],
    relations,
  });
}

test("the card reader, door, wall and room example reads naturally from both ends", () => {
  let relations = [];
  for (const values of [
    { type: "controls", from: "object-001", to: "object-002" },
    { type: "hostedBy", from: "object-002", to: "object-003" },
    { type: "connectsTo", from: "object-002", to: "object-004" },
    { type: "takesDataFrom", from: "object-002", to: "object-004", label: "finish" },
  ]) {
    relations = [...relations, createRelation(relations, values)];
  }
  assert.deepEqual(relations.map((relation) => relation.id), ["relation-001", "relation-002", "relation-003", "relation-004"]);

  const door = relationsForObject(relations, "object-002");
  assert.deepEqual(door.map((entry) => entry.phrase), ["controlled by", "hosted on", "opens to", "takes data from"]);
  assert.equal(relationPhrase(relations[1], "object-003"), "hosts");
  assert.equal(relationPhrase(relations[3], "object-004"), "gives data to");
  assert.equal(relations[3].label, "finish");
});

test("relations fail closed on self links, unknown types and duplicates", () => {
  const first = createRelation([], { type: "controls", from: "object-001", to: "object-002" });
  assert.throws(() => createRelation([], { type: "controls", from: "object-001", to: "object-001" }), /itself/);
  assert.throws(() => createRelation([], { type: "isNear", from: "object-001", to: "object-002" }), /Unsupported/);
  assert.throws(() => createRelation([first], { type: "controls", from: "object-001", to: "object-002" }), /already exists/);
  // A directed type may run the other way; an undirected one may not.
  assert.ok(createRelation([first], { type: "controls", from: "object-002", to: "object-001" }));
  const near = createRelation([], { type: "adjacentTo", from: "object-003", to: "object-004" });
  assert.ok(findDuplicateRelation([near], { type: "adjacentTo", from: "object-004", to: "object-003" }));
});

test("editing keeps identity, rejects collisions, and unchanged edits return the same array", () => {
  const relations = [
    createRelation([], { type: "relatesTo", from: "object-001", to: "object-002" }),
  ];
  relations.push(createRelation(relations, { type: "controls", from: "object-001", to: "object-002" }));
  const edited = updateRelation(relations, "relation-001", { type: "hostedBy", label: "  frame   side " });
  assert.equal(edited[0].id, "relation-001");
  assert.equal(edited[0].label, "frame side");
  assert.equal(updateRelation(edited, "relation-001", { type: "hostedBy", label: "frame side" }), edited);
  assert.throws(() => updateRelation(relations, "relation-001", { type: "controls" }), /already exists/);
  assert.throws(() => updateRelation(relations, "relation-009", { type: "controls" }), /Unknown relation/);
});

test("removing an object removes only its relations", () => {
  let relations = [];
  relations = [...relations, createRelation(relations, { type: "controls", from: "object-001", to: "object-002" })];
  relations = [...relations, createRelation(relations, { type: "inside", from: "object-003", to: "object-004" })];
  assert.deepEqual(removeRelationsForObject(relations, "object-002").map((relation) => relation.id), ["relation-002"]);
  assert.deepEqual(removeRelation(relations, "relation-002").map((relation) => relation.id), ["relation-001"]);
});

test("suggestions are only a starting choice, and they may flip the picked direction", () => {
  assert.deepEqual(suggestRelationType("doors", "walls"), { type: "hostedBy", swap: false });
  assert.deepEqual(suggestRelationType("walls", "doors"), { type: "hostedBy", swap: true });
  assert.deepEqual(suggestRelationType("security-devices", "doors"), { type: "controls", swap: false });
  assert.deepEqual(suggestRelationType("doors", "rooms"), { type: "connectsTo", swap: false });
  assert.deepEqual(suggestRelationType("rooms", "rooms"), { type: "adjacentTo", swap: false });
  assert.deepEqual(suggestRelationType("furniture", "signage"), { type: "relatesTo", swap: false });
});

test("every type belongs to one listed family and keys stay in the CDI vocabulary", () => {
  const grouped = relationTypeGroups().flatMap((group) => group.types.map((type) => type.key));
  assert.deepEqual(grouped.sort(), RELATION_TYPES.map((type) => type.key).sort());
  const cdiKeys = new Set([
    "inside", "contains", "adjacentTo", "hosts", "hostedBy", "connectsTo", "controls", "communicatesWith",
    "serves", "servedBy", "managedFrom", "dependsOn", "penetrates", "belongsToSystem", "hasMember", "near",
    "classifiedWith", "touches", "intersects", "restsOn", "installedIn", "supportedBy", "fixedTo", "bearsOn", "groupedWith",
  ]);
  // Two local types have no CDI equivalent yet; everything else must keep CDI's exact key.
  const local = RELATION_TYPES.map((type) => type.key).filter((key) => !cdiKeys.has(key));
  assert.deepEqual(local.sort(), ["relatesTo", "takesDataFrom"]);
});

test("a curve leaves each mark at its edge and its arrow keeps a pixel size", () => {
  const curve = relationCurve(
    { x: 0.1, y: 0.1, width: 0.1, height: 0.1 },
    { x: 0.7, y: 0.1, width: 0.1, height: 0.1 },
    { width: 1000, height: 500 },
    { gap: 0, arrowSize: 10 },
  );
  assert.ok(Math.abs(curve.start.x - 0.2) < 1e-9);
  assert.ok(Math.abs(curve.end.x - 0.7) < 1e-9);
  const [tip, left] = curve.arrow;
  const length = Math.hypot((tip.x - left.x) * 1000, (tip.y - left.y) * 500);
  assert.ok(length > 9 && length < 13, `arrow side is ${length}px`);
  assert.equal(relationCurve({ x: 0.1, y: 0.1, width: 0.1, height: 0.1 }, { x: 0.1, y: 0.1, width: 0.1, height: 0.1 }, { width: 100, height: 100 }), null);
  assert.equal(relationCurve({ x: 0.1, y: 0.1, width: 0.1, height: 0.1 }, { x: 0.5, y: 0.5, width: 0.1, height: 0.1 }, { width: 100, height: 100 }, { directed: false }).arrow, null);
});

test("the nearest pair of marks is drawn when an object appears more than once", () => {
  const mark = (id, x) => ({ id, bounds: { x, y: 0.5, width: 0.02, height: 0.02 } });
  const pair = nearestOccurrencePair([mark("a", 0.1), mark("b", 0.6)], [mark("c", 0.7), mark("d", 0.95)]);
  assert.deepEqual([pair.from.id, pair.to.id], ["b", "c"]);
  assert.equal(nearestOccurrencePair([], [mark("c", 0.7)]), null);
});

test("v6 projects round-trip relations and reject broken ones", () => {
  const relations = [{ id: "relation-001", type: "controls", from: "object-001", to: "object-002", label: "" }];
  const saved = project(relations);
  assert.equal(saved.format, PROJECT_FORMAT);
  assert.equal(PROJECT_FORMAT, "objdraw-project-v6");
  assert.deepEqual(validateSidecar(JSON.parse(JSON.stringify(saved))).relations, relations);

  for (const [broken, message] of [
    [{ ...relations[0], to: "object-009" }, /unknown object/],
    [{ ...relations[0], to: "object-001" }, /itself/],
    [{ ...relations[0], type: "isNear" }, /unsupported relation type/],
    [{ ...relations[0], label: "x".repeat(61) }, /label/],
    [{ ...relations[0], id: "link-1" }, /Invalid relation ID/],
  ]) {
    assert.throws(() => validateSidecar({ ...saved, relations: [broken] }), message);
  }
  assert.throws(
    () => validateSidecar({ ...saved, relations: [relations[0], { ...relations[0], id: "relation-002" }] }),
    /duplicates/,
  );
  const { relations: _missing, ...withoutRelations } = saved;
  assert.throws(() => validateSidecar(withoutRelations), /Relations must be an array/);
});

test("v5 projects import with an empty relation layer", () => {
  const { relations: _unused, ...v5 } = project([]);
  const migrated = validateSidecar({ ...v5, format: PROJECT_V5_FORMAT });
  assert.equal(migrated.format, PROJECT_FORMAT);
  assert.deepEqual(migrated.relations, []);
  assert.equal(migrated.objects.length, objects.length);
});

test("relations enter undo snapshots and the unsaved-changes signature", () => {
  const relation = { id: "relation-001", type: "controls", from: "object-001", to: "object-002", label: "" };
  const source = { objects, occurrences: [], notes: [], relations: [relation] };
  const snapshot = createObjectLayerSnapshot(source);
  assert.deepEqual(snapshot.relations, [relation]);
  assert.notEqual(snapshot.relations[0], relation, "snapshots copy relations");
  assert.notEqual(
    objectLayerSignature({ ...source, relations: [] }),
    objectLayerSignature(source),
  );
  assert.notEqual(
    objectLayerSignature({ ...source, relations: [{ ...relation, label: "main entrance" }] }),
    objectLayerSignature(source),
  );
});

test("the Revit add-in writes an empty relation list in the v6 project", () => {
  const schema = readFileSync(new URL("../revit-addin/ProjectSchema.cs", import.meta.url), "utf8");
  assert.match(schema, /List<object> Notes,\s*List<ProjectRelation> Relations\);/);
});

test("relations between the same two objects get separate arcs, whatever their direction", () => {
  const lanes = relationLanes([
    { id: "relation-001", from: "object-002", to: "object-004" },
    { id: "relation-002", from: "object-002", to: "object-004" },
    { id: "relation-003", from: "object-004", to: "object-002" },
    { id: "relation-004", from: "object-001", to: "object-002" },
  ]);
  assert.deepEqual([...lanes.values()], [1, -1, -2, 1]);
  const box = (x) => ({ x, y: 0.4, width: 0.05, height: 0.05 });
  const size = { width: 800, height: 600 };
  const a = relationCurve(box(0.1), box(0.6), size, { lane: lanes.get("relation-001") });
  const b = relationCurve(box(0.1), box(0.6), size, { lane: lanes.get("relation-002") });
  const c = relationCurve(box(0.6), box(0.1), size, { lane: lanes.get("relation-003") });
  const offsets = [a, b, c].map((curve) => curve.mid.y - 0.425);
  assert.ok(offsets[0] * offsets[1] < 0, "first two bend to opposite sides");
  assert.ok(Math.abs(offsets[2]) > Math.abs(offsets[0]) && offsets[2] * offsets[0] > 0, "third bends further out");
});

test("Revit relations keep their origin until a person changes them, and can be removed as one group", () => {
  const relations = [
    { id: "relation-001", type: "hostedBy", from: "object-002", to: "object-003", label: "", origin: "revit" },
    { id: "relation-002", type: "controls", from: "object-001", to: "object-002", label: "" },
  ];
  assert.equal(updateRelation(relations, "relation-001", { type: "hostedBy", label: "" }), relations, "no change keeps origin");
  const edited = updateRelation(relations, "relation-001", { type: "fixedTo" });
  assert.equal(edited[0].origin, undefined);
  assert.equal(relations[0].origin, "revit", "the original array is not mutated");
  assert.deepEqual(removeRelationsByOrigin(relations, "revit").map((relation) => relation.id), ["relation-002"]);
});

test("origin is optional in v6 files: absent stays absent, revit round-trips, unknown fails closed", () => {
  const relations = [
    { id: "relation-001", type: "hostedBy", from: "object-002", to: "object-003", label: "", origin: "revit" },
    { id: "relation-002", type: "controls", from: "object-001", to: "object-002", label: "" },
  ];
  const saved = validateSidecar(JSON.parse(JSON.stringify(project(relations))));
  assert.equal(saved.relations[0].origin, "revit");
  assert.equal("origin" in saved.relations[1], false);
  assert.throws(
    () => validateSidecar({ ...saved, relations: [{ ...relations[0], origin: "ai" }] }),
    /unsupported origin/,
  );
  assert.notEqual(
    objectLayerSignature({ objects, occurrences: [], notes: [], relations: [relations[1]] }),
    objectLayerSignature({ objects, occurrences: [], notes: [], relations: [{ ...relations[1], origin: "revit" }] }),
  );
});
