import { NOTE_SCOPES } from "./note-model.mjs";
import { DEFAULT_OBJECT_CATEGORY, isObjectCategoryKey } from "./category-catalog.mjs";
import {
  MAXIMUM_RELATION_LABEL_LENGTH,
  RELATION_ORIGINS,
  RELATION_SIDES,
  findDuplicateRelation,
  isRelationType,
  relationType,
} from "./relation-model.mjs";

export const PROJECT_FORMAT = "objdraw-project-v6";
export const PROJECT_V5_FORMAT = "objdraw-project-v5";
export const PREVIOUS_PROJECT_FORMAT = "objdraw-project-v4";
export const RENAMED_PROJECT_FORMAT = "obd-project-v4";
export const PROJECT_V3_FORMAT = "obd-project-v3";
export const MULTI_DOCUMENT_PROJECT_FORMAT = "obd-project-v2";
export const LEGACY_SIDECAR_FORMAT = "obd-object-layer-v1";
export const SIDECAR_FORMAT = PROJECT_FORMAT;
export const DOCUMENT_ID = "document-001";

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const DOCUMENT_ID_PATTERN = /^document-\d+$/;
const LEGACY_DOOR_ID_PATTERN = /^door-\d+$/;
const OBJECT_ID_PATTERN = /^(?:door|object)-\d+$/;
const OCCURRENCE_ID_PATTERN = /^occurrence-\d+$/;
const NOTE_ID_PATTERN = /^note-\d+$/;
const RELATION_ID_PATTERN = /^relation-\d+$/;
const OBSERVATION_ID_PATTERN = /^observation-\d+$/;
const SUPPORTED_GEOMETRY_TYPES = new Set(["rectangle", "ellipse", "polygon"]);
const BOUNDS_EPSILON = 1e-9;

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requireCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function validateUniqueIds(items, pattern, label) {
  const ids = new Set();
  for (const item of items) {
    requireCondition(isRecord(item), `Every ${label} must be an object.`);
    requireCondition(typeof item.id === "string" && pattern.test(item.id), `Invalid ${label} ID.`);
    requireCondition(!ids.has(item.id), `Duplicate ${label} ID: ${item.id}.`);
    ids.add(item.id);
  }
  return ids;
}

function validateBounds(bounds, occurrenceId) {
  requireCondition(isRecord(bounds), `${occurrenceId} has invalid bounds.`);
  for (const key of ["x", "y", "width", "height"]) {
    requireCondition(Number.isFinite(bounds[key]), `${occurrenceId} bounds.${key} must be a number.`);
  }
  requireCondition(bounds.x >= 0 && bounds.y >= 0, `${occurrenceId} starts outside the page.`);
  requireCondition(bounds.width > 0 && bounds.height > 0, `${occurrenceId} must have positive size.`);
  requireCondition(bounds.x + bounds.width <= 1 + BOUNDS_EPSILON, `${occurrenceId} extends past the page width.`);
  requireCondition(bounds.y + bounds.height <= 1 + BOUNDS_EPSILON, `${occurrenceId} extends past the page height.`);
}

function validateDocument(document) {
  requireCondition(typeof document.name === "string" && document.name.trim(), `${document.id} requires a document name.`);
  requireCondition(Number.isSafeInteger(document.size) && document.size > 0, `${document.id} size must be a positive integer.`);
  requireCondition(Number.isSafeInteger(document.pageCount) && document.pageCount > 0, `${document.id} pageCount must be a positive integer.`);
  requireCondition(
    typeof document.sha256 === "string" && SHA256_PATTERN.test(document.sha256),
    `${document.id} SHA-256 fingerprint is invalid.`,
  );
}

function cloneDocument(document) {
  return {
    id: document.id,
    name: document.name.trim(),
    size: document.size,
    pageCount: document.pageCount,
    sha256: document.sha256,
  };
}

function geometryFromRuntimeOccurrence(occurrence) {
  if (isRecord(occurrence.geometry)) {
    return cloneGeometry(occurrence.geometry);
  }
  if (occurrence.geometryType === "polygon") {
    return {
      type: "polygon",
      points: occurrence.points.map((point) => ({ ...point })),
    };
  }
  return {
    type: occurrence.geometryType ?? "rectangle",
    bounds: { ...occurrence.bounds },
  };
}

function validateGeometry(geometry, occurrenceId) {
  requireCondition(isRecord(geometry), `${occurrenceId} requires geometry.`);
  requireCondition(
    SUPPORTED_GEOMETRY_TYPES.has(geometry.type),
    `${occurrenceId} has unsupported geometry type: ${geometry.type ?? "missing"}.`,
  );
  if (geometry.type === "polygon") {
    requireCondition(Array.isArray(geometry.points) && geometry.points.length >= 3, `${occurrenceId} polygon requires at least three points.`);
    for (const point of geometry.points) {
      requireCondition(isRecord(point) && Number.isFinite(point.x) && Number.isFinite(point.y), `${occurrenceId} polygon has an invalid point.`);
      requireCondition(point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1, `${occurrenceId} polygon point is outside the page.`);
    }
    const doubledArea = Math.abs(geometry.points.reduce((sum, point, index) => {
      const next = geometry.points[(index + 1) % geometry.points.length];
      return sum + point.x * next.y - next.x * point.y;
    }, 0));
    requireCondition(doubledArea > BOUNDS_EPSILON, `${occurrenceId} polygon must enclose an area.`);
    return;
  }
  validateBounds(geometry.bounds, occurrenceId);
}

function cloneGeometry(geometry) {
  if (geometry.type === "polygon") {
    return {
      type: geometry.type,
      points: geometry.points.map((point) => ({ ...point })),
    };
  }
  return {
    type: geometry.type,
    bounds: { ...geometry.bounds },
  };
}

function validateLegacySidecar(value) {
  requireCondition(typeof value.exportedAt === "string" && !Number.isNaN(Date.parse(value.exportedAt)), "Invalid exportedAt timestamp.");
  requireCondition(isRecord(value.document), "The sidecar is missing its document fingerprint.");
  requireCondition(value.document.id === DOCUMENT_ID, `Document ID must be ${DOCUMENT_ID}.`);
  validateDocument(value.document);
  requireCondition(Array.isArray(value.objects), "Objects must be an array.");
  requireCondition(Array.isArray(value.occurrences), "Occurrences must be an array.");

  const objectIds = validateUniqueIds(value.objects, LEGACY_DOOR_ID_PATTERN, "Door");
  for (const object of value.objects) {
    requireCondition(object.type === "Door", `${object.id} has an unsupported object type.`);
    requireCondition(typeof object.label === "string" && object.label.trim(), `${object.id} requires a label.`);
  }

  validateUniqueIds(value.occurrences, OCCURRENCE_ID_PATTERN, "occurrence");
  for (const occurrence of value.occurrences) {
    requireCondition(
      occurrence.objectId === null || objectIds.has(occurrence.objectId),
      `${occurrence.id} links to an unknown Door.`,
    );
    requireCondition(occurrence.documentId === DOCUMENT_ID, `${occurrence.id} has the wrong document ID.`);
    requireCondition(
      Number.isSafeInteger(occurrence.page)
        && occurrence.page >= 1
        && occurrence.page <= value.document.pageCount,
      `${occurrence.id} has an invalid page number.`,
    );
    validateBounds(occurrence.bounds, occurrence.id);
  }
}

function validateProject(value) {
  requireCondition(typeof value.exportedAt === "string" && !Number.isNaN(Date.parse(value.exportedAt)), "Invalid exportedAt timestamp.");
  requireCondition(Array.isArray(value.documents) && value.documents.length > 0, "Documents must be a non-empty array.");
  requireCondition(Array.isArray(value.objects), "Objects must be an array.");
  requireCondition(Array.isArray(value.occurrences), "Occurrences must be an array.");
  requireCondition(Array.isArray(value.notes), "Notes must be an array.");
  requireCondition(Array.isArray(value.relations), "Relations must be an array.");

  const documentIds = validateUniqueIds(value.documents, DOCUMENT_ID_PATTERN, "document");
  const documentsById = new Map();
  const fingerprintKeys = new Set();
  for (const document of value.documents) {
    validateDocument(document);
    const fingerprintKey = `${document.sha256}:${document.size}:${document.pageCount}`;
    requireCondition(!fingerprintKeys.has(fingerprintKey), `Duplicate document fingerprint: ${document.id}.`);
    fingerprintKeys.add(fingerprintKey);
    documentsById.set(document.id, document);
  }
  requireCondition(documentIds.has(value.activeDocumentId), "activeDocumentId must reference a project document.");

  const objectIds = validateUniqueIds(value.objects, OBJECT_ID_PATTERN, "object");
  for (const object of value.objects) {
    requireCondition(isObjectCategoryKey(object.category), `${object.id} has an unsupported object category.`);
    requireCondition(typeof object.label === "string" && object.label.trim(), `${object.id} requires a label.`);
  }

  const occurrenceIds = validateUniqueIds(value.occurrences, OCCURRENCE_ID_PATTERN, "occurrence");
  const occurrencesById = new Map();
  for (const occurrence of value.occurrences) {
    requireCondition(
      occurrence.objectId === null || objectIds.has(occurrence.objectId),
      `${occurrence.id} links to an unknown object.`,
    );
    const occurrenceDocument = documentsById.get(occurrence.documentId);
    requireCondition(occurrenceDocument, `${occurrence.id} links to an unknown document.`);
    requireCondition(
      Number.isSafeInteger(occurrence.page)
        && occurrence.page >= 1
        && occurrence.page <= occurrenceDocument.pageCount,
      `${occurrence.id} has an invalid page number for ${occurrence.documentId}.`,
    );
    validateGeometry(occurrence.geometry, occurrence.id);
    occurrencesById.set(occurrence.id, occurrence);
  }

  validateUniqueIds(value.notes, NOTE_ID_PATTERN, "note");
  for (const note of value.notes) {
    requireCondition(NOTE_SCOPES.includes(note.scope), `${note.id} has an unsupported note scope.`);
    requireCondition(typeof note.text === "string" && note.text.trim(), `${note.id} requires text.`);
    requireCondition(typeof note.createdAt === "string" && !Number.isNaN(Date.parse(note.createdAt)), `${note.id} has an invalid createdAt timestamp.`);
    requireCondition(typeof note.updatedAt === "string" && !Number.isNaN(Date.parse(note.updatedAt)), `${note.id} has an invalid updatedAt timestamp.`);
    requireCondition(Date.parse(note.updatedAt) >= Date.parse(note.createdAt), `${note.id} updatedAt precedes createdAt.`);
    if (note.scope === "project") {
      requireCondition(note.objectId === null && note.occurrenceId === null, `${note.id} project note cannot reference an object or occurrence.`);
    } else if (note.scope === "object") {
      requireCondition(objectIds.has(note.objectId), `${note.id} links to an unknown object.`);
      requireCondition(note.occurrenceId === null, `${note.id} object note cannot reference an occurrence.`);
    } else {
      requireCondition(note.objectId === null, `${note.id} occurrence note cannot also reference an object.`);
      requireCondition(occurrenceIds.has(note.occurrenceId), `${note.id} links to an unknown occurrence.`);
    }
  }

  validateUniqueIds(value.relations, RELATION_ID_PATTERN, "relation");
  const relations = value.relations.map(sideFromRevitLabel);
  const acceptedRelations = [];
  for (const relation of relations) {
    requireCondition(isRelationType(relation.type), `${relation.id} has an unsupported relation type.`);
    requireCondition(objectIds.has(relation.from), `${relation.id} starts at an unknown object.`);
    requireCondition(objectIds.has(relation.to), `${relation.id} ends at an unknown object.`);
    requireCondition(relation.from !== relation.to, `${relation.id} relates an object to itself.`);
    requireCondition(
      typeof relation.label === "string" && relation.label.length <= MAXIMUM_RELATION_LABEL_LENGTH,
      `${relation.id} label must be text of at most ${MAXIMUM_RELATION_LABEL_LENGTH} characters.`,
    );
    requireCondition(
      relation.createdAt === undefined || (typeof relation.createdAt === "string" && !Number.isNaN(Date.parse(relation.createdAt))),
      `${relation.id} has an invalid createdAt timestamp.`,
    );
    requireCondition(
      relation.side === undefined || (RELATION_SIDES.includes(relation.side) && relationType(relation.type).sides),
      `${relation.id} has a side its relation type does not have.`,
    );
    requireCondition(
      relation.origin === undefined || RELATION_ORIGINS.includes(relation.origin),
      `${relation.id} has an unsupported origin.`,
    );
    requireCondition(!findDuplicateRelation(acceptedRelations, relation), `${relation.id} duplicates another relation.`);
    acceptedRelations.push(relation);
  }

  return {
    format: PROJECT_FORMAT,
    exportedAt: value.exportedAt,
    activeDocumentId: value.activeDocumentId,
    documents: value.documents.map(cloneDocument),
    objects: value.objects.map((object) => ({
      id: object.id,
      category: object.category,
      label: object.label.trim(),
    })),
    occurrences: value.occurrences.map((occurrence) => ({
      id: occurrence.id,
      objectId: occurrence.objectId,
      documentId: occurrence.documentId,
      page: occurrence.page,
      geometry: cloneGeometry(occurrence.geometry),
    })),
    notes: value.notes.map((note) => ({
      id: note.id,
      scope: note.scope,
      objectId: note.objectId ?? null,
      occurrenceId: note.occurrenceId ?? null,
      text: note.text.trim(),
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    })),
    relations: relations.map((relation) => ({
      id: relation.id,
      type: relation.type,
      from: relation.from,
      to: relation.to,
      label: relation.label.trim(),
      ...(relation.side ? { side: relation.side } : {}),
      ...(relation.origin ? { origin: relation.origin } : {}),
      ...(relation.createdAt ? { createdAt: relation.createdAt } : {}),
    })),
  };
}

// The first Revit relations export wrote the door side into the label.
// Only those exact Revit-written labels become a side; a person's own label is never read.
const REVIT_SIDE_LABELS = new Map([["to room", "to"], ["from room", "from"]]);

function sideFromRevitLabel(relation) {
  if (!isRecord(relation) || relation.origin !== "revit" || relation.side !== undefined || relation.type !== "connectsTo") {
    return relation;
  }
  const side = REVIT_SIDE_LABELS.get(relation.label);
  return side ? { ...relation, label: "", side } : relation;
}

function notesFromLegacyObservations(value) {
  const observations = value.observations ?? [];
  requireCondition(Array.isArray(observations), "Observations must be an array.");
  const objectIds = new Set(value.objects.map((object) => object.id));
  const occurrencesById = new Map(value.occurrences.map((occurrence) => [occurrence.id, occurrence]));
  validateUniqueIds(observations, OBSERVATION_ID_PATTERN, "observation");
  return observations.map((observation, index) => {
    requireCondition(objectIds.has(observation.objectId), `${observation.id} links to an unknown object.`);
    requireCondition(typeof observation.topic === "string" && observation.topic.trim(), `${observation.id} requires a topic.`);
    requireCondition(typeof observation.value === "string" && observation.value.trim(), `${observation.id} requires a value or note.`);
    requireCondition(["observation", "assumption"].includes(observation.evidenceKind), `${observation.id} has an unsupported evidence kind.`);
    requireCondition(["unreviewed", "needs-confirmation", "confirmed", "rejected"].includes(observation.reviewState), `${observation.id} has an unsupported review state.`);
    requireCondition(typeof observation.createdAt === "string" && !Number.isNaN(Date.parse(observation.createdAt)), `${observation.id} has an invalid createdAt timestamp.`);
    requireCondition(typeof observation.updatedAt === "string" && !Number.isNaN(Date.parse(observation.updatedAt)), `${observation.id} has an invalid updatedAt timestamp.`);
    requireCondition(Date.parse(observation.updatedAt) >= Date.parse(observation.createdAt), `${observation.id} updatedAt precedes createdAt.`);
    if (observation.occurrenceId !== null) {
      const occurrence = occurrencesById.get(observation.occurrenceId);
      requireCondition(occurrence, `${observation.id} links to an unknown occurrence.`);
      requireCondition(occurrence.objectId === observation.objectId, `${observation.id} source occurrence belongs to a different object.`);
    } else {
      requireCondition(observation.evidenceKind === "assumption", `${observation.id} observation requires an exact source occurrence.`);
    }
    return {
      id: `note-${String(index + 1).padStart(3, "0")}`,
      scope: observation.occurrenceId ? "occurrence" : "object",
      objectId: observation.occurrenceId ? null : observation.objectId,
      occurrenceId: observation.occurrenceId,
      text: `${observation.topic.trim()}: ${observation.value.trim()}`,
      createdAt: observation.createdAt,
      updatedAt: observation.updatedAt,
    };
  });
}

export async function sha256Hex(data) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createDocumentFingerprint({ id = DOCUMENT_ID, name, size, pageCount, sha256 }) {
  return { id, name, size, pageCount, sha256 };
}

export function nextDocumentId(documents) {
  const highest = documents.reduce((maximum, document) => {
    const match = DOCUMENT_ID_PATTERN.exec(document.id);
    return match ? Math.max(maximum, Number(document.id.slice("document-".length))) : maximum;
  }, 0);
  return `document-${String(highest + 1).padStart(3, "0")}`;
}

export function migrateLegacySidecar(value) {
  requireCondition(isRecord(value), "The sidecar root must be an object.");
  requireCondition(value.format === LEGACY_SIDECAR_FORMAT, `Expected ${LEGACY_SIDECAR_FORMAT}.`);
  validateLegacySidecar(value);
  return validateProject({
    format: PROJECT_FORMAT,
    exportedAt: value.exportedAt,
    activeDocumentId: value.document.id,
    documents: [{ ...value.document }],
    objects: value.objects.map((object) => ({
      id: object.id,
      category: DEFAULT_OBJECT_CATEGORY,
      label: object.label,
    })),
    occurrences: value.occurrences.map((occurrence) => ({
      id: occurrence.id,
      objectId: occurrence.objectId,
      documentId: occurrence.documentId,
      page: occurrence.page,
      geometry: {
        type: "rectangle",
        bounds: { ...occurrence.bounds },
      },
    })),
    notes: [],
    relations: [],
  });
}

export function migrateProjectV2(value) {
  requireCondition(isRecord(value), "The project root must be an object.");
  requireCondition(value.format === MULTI_DOCUMENT_PROJECT_FORMAT, `Expected ${MULTI_DOCUMENT_PROJECT_FORMAT}.`);
  return validateProject({
    ...value,
    format: PROJECT_FORMAT,
    objects: value.objects.map((object) => ({
      id: object.id,
      category: DEFAULT_OBJECT_CATEGORY,
      label: object.label,
    })),
    notes: [],
    relations: [],
  });
}

export function migrateProjectV3(value) {
  requireCondition(isRecord(value), "The project root must be an object.");
  requireCondition(value.format === PROJECT_V3_FORMAT, `Expected ${PROJECT_V3_FORMAT}.`);
  return validateProject({
    ...value,
    format: PROJECT_FORMAT,
    objects: value.objects.map((object) => ({
      id: object.id,
      category: DEFAULT_OBJECT_CATEGORY,
      label: object.label,
    })),
    notes: notesFromLegacyObservations(value),
    relations: [],
  });
}

export function migrateProjectV4(value) {
  requireCondition(isRecord(value), "The project root must be an object.");
  requireCondition(
    [PREVIOUS_PROJECT_FORMAT, RENAMED_PROJECT_FORMAT].includes(value.format),
    `Expected ${PREVIOUS_PROJECT_FORMAT} or ${RENAMED_PROJECT_FORMAT}.`,
  );
  return validateProject({
    ...value,
    format: PROJECT_FORMAT,
    notes: notesFromLegacyObservations(value),
    relations: [],
  });
}

export function migrateProjectV5(value) {
  requireCondition(isRecord(value), "The project root must be an object.");
  requireCondition(value.format === PROJECT_V5_FORMAT, `Expected ${PROJECT_V5_FORMAT}.`);
  return validateProject({
    ...value,
    format: PROJECT_FORMAT,
    relations: [],
  });
}

export function createSidecar({
  documents,
  activeDocumentId,
  document,
  objects,
  occurrences,
  notes = [],
  relations = [],
  exportedAt = new Date().toISOString(),
}) {
  const projectDocuments = documents ?? (document ? [document] : []);
  const projectActiveDocumentId = activeDocumentId ?? document?.id ?? projectDocuments[0]?.id;
  return validateProject({
    format: PROJECT_FORMAT,
    exportedAt,
    activeDocumentId: projectActiveDocumentId,
    documents: projectDocuments.map((item) => ({ ...item })),
    objects: objects.map((object) => ({ ...object })),
    occurrences: occurrences.map((occurrence) => ({
      id: occurrence.id,
      objectId: occurrence.objectId ?? null,
      documentId: occurrence.documentId ?? projectActiveDocumentId,
      page: occurrence.page,
      geometry: geometryFromRuntimeOccurrence(occurrence),
    })),
    notes: notes.map((note) => ({ ...note })),
    relations: relations.map((relation) => ({ ...relation })),
  });
}

export function validateSidecar(value) {
  requireCondition(isRecord(value), "The sidecar root must be an object.");
  if (value.format === LEGACY_SIDECAR_FORMAT) {
    return migrateLegacySidecar(value);
  }
  if (value.format === PROJECT_V5_FORMAT) {
    return migrateProjectV5(value);
  }
  if ([PREVIOUS_PROJECT_FORMAT, RENAMED_PROJECT_FORMAT].includes(value.format)) {
    return migrateProjectV4(value);
  }
  if (value.format === PROJECT_V3_FORMAT) {
    return migrateProjectV3(value);
  }
  if (value.format === MULTI_DOCUMENT_PROJECT_FORMAT) {
    return migrateProjectV2(value);
  }
  requireCondition(value.format === PROJECT_FORMAT, `Unsupported project format. Expected ${PROJECT_FORMAT}.`);
  return validateProject(value);
}

export function compareDocumentFingerprint(projectDocument, activeDocument) {
  const reasons = [];
  if (projectDocument.sha256 !== activeDocument.sha256) {
    reasons.push("SHA-256 fingerprint differs");
  }
  if (projectDocument.size !== activeDocument.size) {
    reasons.push("file size differs");
  }
  if (projectDocument.pageCount !== activeDocument.pageCount) {
    reasons.push("page count differs");
  }
  return { matches: reasons.length === 0, reasons };
}

export function toRuntimeOccurrences(occurrences) {
  return occurrences.map((occurrence) => {
    const points = occurrence.geometry.type === "polygon"
      ? occurrence.geometry.points.map((point) => ({ ...point }))
      : null;
    const bounds = points
      ? {
        x: Math.min(...points.map((point) => point.x)),
        y: Math.min(...points.map((point) => point.y)),
        width: Math.max(...points.map((point) => point.x)) - Math.min(...points.map((point) => point.x)),
        height: Math.max(...points.map((point) => point.y)) - Math.min(...points.map((point) => point.y)),
      }
      : { ...occurrence.geometry.bounds };
    return {
      id: occurrence.id,
      objectId: occurrence.objectId,
      documentId: occurrence.documentId,
      page: occurrence.page,
      geometryType: occurrence.geometry.type,
      bounds,
      ...(points ? { points } : {}),
    };
  });
}
