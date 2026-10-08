import test from "node:test";
import assert from "node:assert/strict";
import { buildOnexusGraph, fnv1a, relationEdgeId } from "../onexus-export.mjs";

const documents = [{ id: "document-001", name: "plans.pdf", size: 10, pageCount: 3, sha256: "ab".repeat(32) }];
const objects = [
  { id: "object-001", category: "security-devices", label: "CR-01" },
  { id: "object-002", category: "doors", label: "D-105" },
  { id: "object-003", category: "walls", label: "W-3" },
  { id: "object-004", category: "rooms", label: "105 Retail" },
];
const occurrences = [
  { id: "occurrence-001", objectId: "object-002", documentId: "document-001", page: 1 },
  { id: "occurrence-002", objectId: "object-002", documentId: "document-001", page: 3 },
];
const relations = [
  { id: "relation-001", type: "controls", from: "object-001", to: "object-002", label: "", createdAt: "2026-10-08T01:00:00.000Z" },
  { id: "relation-002", type: "hostedBy", from: "object-002", to: "object-003", label: "", origin: "revit" },
  { id: "relation-003", type: "takesDataFrom", from: "object-002", to: "object-004", label: "finish" },
  { id: "relation-004", type: "adjacentTo", from: "object-004", to: "object-003", label: "" },
];
const graph = (options = {}) => buildOnexusGraph({ documents, objects, occurrences, relations, exportedAt: "2026-10-08T02:00:00.000Z", ...options });

test("edge IDs use CDI's FNV-1a formula, so both tools mint the same ID", () => {
  // Expected values computed with CDI's source-adapters/export_relations_to_onexus.py relation_id().
  assert.equal(relationEdgeId("3f2a1c9e-1111-4b4b-9c9c-000000012345-0004d2e1", "hostedBy", "3f2a1c9e-1111-4b4b-9c9c-000000012345-0004c001"), "REL-C92D4F8F");
  assert.equal(relationEdgeId("門-01", "controls", "部屋-105"), "REL-93B217F3");
  assert.equal(fnv1a(""), 2166136261);
});

test("nodes use Revit UniqueIds when known and a marked local key otherwise", () => {
  const result = graph({ revitObjects: [{ objectId: "object-002", uniqueId: "uid-door" }, { objectId: "object-003", uniqueId: "uid-wall" }] });
  const byObject = new Map(result.elements.nodes.map((node) => [node.data.objdraw.objectId, node.data]));
  assert.equal(byObject.get("object-002").id, "uid-door");
  assert.equal(byObject.get("object-002").objdraw.identity, "revit");
  assert.equal(byObject.get("object-001").id, `objdraw:${"ab".repeat(6)}:object-001`);
  assert.equal(byObject.get("object-001").objdraw.identity, "local");
  assert.equal(byObject.get("object-004").nodeType, "Space");
  assert.equal(byObject.get("object-002").nodeType, "Component");
  assert.deepEqual(byObject.get("object-002").label, { en: "D-105" });
  assert.deepEqual(byObject.get("object-002").objdraw.places.map((place) => place.page), [1, 3]);
  assert.equal(result.meta.objdraw.counts.localNodes, 2);
  const hosted = result.elements.edges.find((edge) => edge.data.type === "hostedBy").data;
  assert.equal(hosted.id, relationEdgeId("uid-door", "hostedBy", "uid-wall"));
});

test("edges carry the onexus.relationship.v1 envelope without inventing dates or reviews", () => {
  const edges = new Map(graph().elements.edges.map((edge) => [edge.data.objdraw.relationId, edge.data]));
  const controls = edges.get("relation-001");
  assert.equal(controls.dimension, "System");
  assert.equal(controls.directional, true);
  assert.equal(controls.confidence, "Explicit");
  assert.equal(controls.relationship.contract, "onexus.relationship.v1");
  assert.equal(controls.relationship.truthClass, "project-defined");
  assert.equal(controls.relationship.provenance.observedAt, "2026-10-08T01:00:00.000Z");
  assert.equal(controls.relationship.review.status, "unreviewed");
  const hosted = edges.get("relation-002");
  assert.equal(hosted.relationship.truthClass, "source-native");
  assert.equal(hosted.dimension, "Spatial");
  assert.equal("observedAt" in hosted.relationship.provenance, false, "unknown age stays unknown");
  assert.equal(edges.get("relation-003").dimension, "Relation");
  assert.equal(edges.get("relation-003").notes, "finish · drawn by a person");
  assert.equal(edges.get("relation-004").directional, false);
});

test("a trace export keeps only traced objects and the relations between them", () => {
  const result = graph({ objectIds: ["object-001", "object-002"], scope: "trace" });
  assert.deepEqual(result.elements.nodes.map((node) => node.data.objdraw.objectId), ["object-001", "object-002"]);
  assert.deepEqual(result.elements.edges.map((edge) => edge.data.objdraw.relationId), ["relation-001"]);
  assert.equal(result.meta.objdraw.scope, "trace");
});

test("the graph meets ONEXUS's required fields", () => {
  const result = graph();
  assert.equal(result.meta.schema, "onexus-1.1");
  for (const node of result.elements.nodes) {
    for (const key of ["id", "nodeType", "label", "category"]) {
      assert.ok(node.data[key], `node ${node.data.id} lacks ${key}`);
    }
    assert.equal(typeof node.data.label.en, "string");
  }
  const ids = new Set(result.elements.nodes.map((node) => node.data.id));
  assert.equal(ids.size, result.elements.nodes.length, "node IDs are unique");
  for (const edge of result.elements.edges) {
    for (const key of ["id", "type", "dimension", "source", "target"]) {
      assert.ok(edge.data[key], `edge lacks ${key}`);
    }
    assert.equal(typeof edge.data.directional, "boolean");
    assert.ok(ids.has(edge.data.source) && ids.has(edge.data.target));
  }
});
