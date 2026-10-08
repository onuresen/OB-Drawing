// Object relations as an ONEXUS graph (onexus-1.1, onexus.relationship.v1 edges).
// Pure: no DOM. One-way: ONEXUS never writes back.
//
// The mapping copies CDI's exporter (CDI docs/44, source-adapters/export_relations_to_onexus.py),
// so the same door, wall, and relation exported by either tool become the same node and edge.

import { objectCategoryLabel } from "./category-catalog.mjs";
import { relationType } from "./relation-model.mjs";

export const ONEXUS_IMPORTER = "objdraw-relations-v1";
const SPACE_CATEGORIES = new Set(["rooms", "spaces", "areas", "zones"]);

// CDI's DIMENSIONS table, limited to the types this app has. Anything else is "Relation", as in CDI.
const DIMENSIONS = {
  inside: "Spatial",
  hostedBy: "Spatial",
  supportedBy: "Spatial",
  fixedTo: "Spatial",
  adjacentTo: "Spatial",
  controls: "System",
  communicatesWith: "System",
};

// CDI's FNV-1a over `from|type|to`, so both tools mint the same edge ID.
export function fnv1a(value) {
  let digest = 2166136261;
  for (const character of String(value)) {
    digest ^= character.codePointAt(0);
    digest = Math.imul(digest, 16777619) >>> 0;
  }
  return digest >>> 0;
}

export function relationEdgeId(fromId, type, toId) {
  return `REL-${fnv1a(`${fromId}|${type}|${toId}`).toString(16).toUpperCase().padStart(8, "0")}`;
}

// Revit UniqueId when the companion file is loaded, so nodes merge with CDI's.
// Otherwise a local key scoped by the first PDF's fingerprint: visible, but it will not merge.
export function onexusNodeId(object, { revitUniqueIds, localScope }) {
  const uniqueId = revitUniqueIds.get(object.id);
  return uniqueId ? uniqueId : `objdraw:${localScope}:${object.id}`;
}

export function buildOnexusGraph({
  documents,
  objects,
  occurrences,
  relations,
  revitObjects = [],
  objectIds = null,
  scope = "project",
  projectName = "Object-Centric Drawing",
  exportedAt = new Date().toISOString(),
}) {
  const inScope = objectIds ? new Set(objectIds) : new Set(objects.map((object) => object.id));
  const revitUniqueIds = new Map(revitObjects.map((entry) => [entry.objectId, entry.uniqueId]));
  const localScope = (documents[0]?.sha256 ?? "project").slice(0, 12);
  const documentsById = new Map(documents.map((document) => [document.id, document]));
  const nodeIdByObject = new Map();
  const nodes = [];

  for (const object of objects) {
    if (!inScope.has(object.id)) {
      continue;
    }
    const nodeId = onexusNodeId(object, { revitUniqueIds, localScope });
    nodeIdByObject.set(object.id, nodeId);
    const places = occurrences
      .filter((occurrence) => occurrence.objectId === object.id)
      .map((occurrence) => ({
        documentId: occurrence.documentId,
        document: documentsById.get(occurrence.documentId)?.name ?? occurrence.documentId,
        page: occurrence.page,
      }));
    nodes.push({
      data: {
        id: nodeId,
        nodeType: SPACE_CATEGORIES.has(object.category) ? "Space" : "Component",
        category: objectCategoryLabel(object.category),
        label: { en: object.label },
        objdraw: {
          objectId: object.id,
          category: object.category,
          identity: revitUniqueIds.has(object.id) ? "revit" : "local",
          places,
        },
      },
    });
  }

  const edges = [];
  const usedIds = new Set();
  for (const relation of relations) {
    const source = nodeIdByObject.get(relation.from);
    const target = nodeIdByObject.get(relation.to);
    if (!source || !target) {
      continue;
    }
    let edgeId = relationEdgeId(source, relation.type, target);
    while (usedIds.has(edgeId)) {
      edgeId = relationEdgeId(source, `${relation.type}+`, target);
    }
    usedIds.add(edgeId);
    const fromRevit = relation.origin === "revit";
    const notes = [relation.label, fromRevit ? "from the Revit export" : "drawn by a person"].filter(Boolean).join(" · ");
    edges.push({
      data: {
        id: edgeId,
        type: relation.type,
        dimension: DIMENSIONS[relation.type] ?? "Relation",
        source,
        target,
        directional: relationType(relation.type).directed,
        confidence: "Explicit",
        notes,
        relationship: {
          contract: "onexus.relationship.v1",
          truthClass: fromRevit ? "source-native" : "project-defined",
          source: { system: fromRevit ? "Revit via Object-Centric Drawing" : "Object-Centric Drawing", recordId: relation.id },
          // A relation without a date has an unknown age; no date is invented for it.
          provenance: {
            method: fromRevit ? "import" : "human capture",
            evidenceIds: [],
            ...(relation.createdAt ? { observedAt: relation.createdAt } : {}),
          },
          confidence: "Explicit",
          validity: { ...(relation.createdAt ? { from: relation.createdAt } : {}), status: "active" },
          review: { status: "unreviewed" },
          lifecycle: { deleted: false },
        },
        objdraw: { relationId: relation.id, label: relation.label, ...(relation.origin ? { origin: relation.origin } : {}) },
      },
    });
  }

  const localNodes = nodes.filter((node) => node.data.objdraw.identity === "local").length;
  return {
    meta: {
      schema: "onexus-1.1",
      project: projectName,
      timestamp: exportedAt,
      languageDefault: "en",
      importer: ONEXUS_IMPORTER,
      sourceSystem: "Object-Centric Drawing",
      objdraw: {
        scope,
        documents: documents.map((document) => ({ id: document.id, name: document.name, sha256: document.sha256 })),
        counts: { nodes: nodes.length, edges: edges.length, localNodes },
        readOnly: true,
      },
    },
    elements: { nodes, edges },
  };
}
