export const OBJECT_EVIDENCE_FORMAT = "obd-object-evidence-v1";
export const PHYSICAL_INSTANCE_KIND = "physical-instance";
export const INSTANCE_OF_RELATIONSHIP = "instanceOf";

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const BOUNDS_EPSILON = 1e-9;
const SUPPORTED_GEOMETRY_TYPES = new Set(["rectangle", "ellipse", "polygon"]);

function requireCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requireText(value, message) {
  requireCondition(typeof value === "string" && value.trim(), message);
  return value.trim();
}

function validateUniqueIds(items, label) {
  const ids = new Set();
  for (const item of items) {
    requireCondition(isRecord(item), `Every ${label} must be an object.`);
    const id = requireText(item.id, `Every ${label} requires an ID.`);
    requireCondition(!ids.has(id), `Duplicate ${label} ID: ${id}.`);
    ids.add(id);
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

function validateGeometry(geometry, occurrenceId) {
  requireCondition(isRecord(geometry), `${occurrenceId} requires geometry.`);
  requireCondition(
    SUPPORTED_GEOMETRY_TYPES.has(geometry.type),
    `${occurrenceId} has unsupported geometry type: ${geometry.type ?? "missing"}.`,
  );
  if (geometry.type !== "polygon") {
    validateBounds(geometry.bounds, occurrenceId);
    return;
  }
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
}

function cloneGeometry(geometry) {
  return geometry.type === "polygon"
    ? { type: geometry.type, points: geometry.points.map((point) => ({ ...point })) }
    : { type: geometry.type, bounds: { ...geometry.bounds } };
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

export function validateObjectEvidencePackage(value) {
  requireCondition(isRecord(value), "The evidence package root must be an object.");
  requireCondition(value.format === OBJECT_EVIDENCE_FORMAT, `Unsupported evidence package format. Expected ${OBJECT_EVIDENCE_FORMAT}.`);
  requireCondition(typeof value.exportedAt === "string" && !Number.isNaN(Date.parse(value.exportedAt)), "Invalid exportedAt timestamp.");
  requireCondition(isRecord(value.producer), "The evidence package requires producer metadata.");
  requireCondition(value.producer.name === "OB Drawing", "The producer name must be OB Drawing.");
  requireCondition(
    ["obd-project-v2", "obd-project-v3", "obd-project-v4"].includes(value.producer.projectFormat),
    "The producer project format must be a supported OBD project version.",
  );
  requireCondition(Array.isArray(value.subjects) && value.subjects.length > 0, "Subjects must be a non-empty array.");
  requireCondition(Array.isArray(value.configurations), "Configurations must be an array.");
  requireCondition(Array.isArray(value.relationships), "Relationships must be an array.");
  requireCondition(Array.isArray(value.documents) && value.documents.length > 0, "Documents must be a non-empty array.");
  requireCondition(Array.isArray(value.occurrences) && value.occurrences.length > 0, "Occurrences must be a non-empty array.");
  const observations = value.observations ?? [];
  requireCondition(Array.isArray(observations), "Observations must be an array.");

  const subjectIds = validateUniqueIds(value.subjects, "subject");
  const subjectsById = new Map();
  for (const subject of value.subjects) {
    requireCondition(subject.kind === PHYSICAL_INSTANCE_KIND, `${subject.id} has unsupported subject kind.`);
    const category = requireText(subject.category, `${subject.id} requires a category.`);
    const label = requireText(subject.label, `${subject.id} requires a label.`);
    subjectsById.set(subject.id, { category, label });
  }

  const configurationIds = validateUniqueIds(value.configurations, "configuration");
  const configurationsById = new Map();
  for (const configuration of value.configurations) {
    const category = requireText(configuration.category, `${configuration.id} requires a category.`);
    const label = requireText(configuration.label, `${configuration.id} requires a label.`);
    configurationsById.set(configuration.id, { category, label });
  }

  const linkedSubjects = new Set();
  for (const relationship of value.relationships) {
    requireCondition(isRecord(relationship), "Every relationship must be an object.");
    requireCondition(relationship.kind === INSTANCE_OF_RELATIONSHIP, "Only explicit instanceOf relationships are supported in v1.");
    requireCondition(subjectIds.has(relationship.subjectId), `${relationship.subjectId ?? "Missing subject"} is not an exported subject.`);
    requireCondition(configurationIds.has(relationship.configurationId), `${relationship.configurationId ?? "Missing configuration"} is not an exported configuration.`);
    requireCondition(!linkedSubjects.has(relationship.subjectId), `${relationship.subjectId} has more than one configuration relationship.`);
    requireCondition(
      subjectsById.get(relationship.subjectId).category === configurationsById.get(relationship.configurationId).category,
      `${relationship.subjectId} and ${relationship.configurationId} have different categories.`,
    );
    linkedSubjects.add(relationship.subjectId);
  }

  const documentIds = validateUniqueIds(value.documents, "document");
  const documentsById = new Map();
  for (const document of value.documents) {
    requireText(document.name, `${document.id} requires a document name.`);
    requireCondition(Number.isSafeInteger(document.size) && document.size > 0, `${document.id} size must be a positive integer.`);
    requireCondition(Number.isSafeInteger(document.pageCount) && document.pageCount > 0, `${document.id} pageCount must be a positive integer.`);
    requireCondition(typeof document.sha256 === "string" && SHA256_PATTERN.test(document.sha256), `${document.id} SHA-256 fingerprint is invalid.`);
    documentsById.set(document.id, document);
  }

  validateUniqueIds(value.occurrences, "occurrence");
  const representedSubjects = new Set();
  for (const occurrence of value.occurrences) {
    requireCondition(subjectIds.has(occurrence.subjectId), `${occurrence.id} links to an unknown subject.`);
    const document = documentsById.get(occurrence.documentId);
    requireCondition(documentIds.has(occurrence.documentId), `${occurrence.id} links to an unknown document.`);
    requireCondition(
      Number.isSafeInteger(occurrence.page) && occurrence.page >= 1 && occurrence.page <= document.pageCount,
      `${occurrence.id} has an invalid page number for ${occurrence.documentId}.`,
    );
    validateGeometry(occurrence.geometry, occurrence.id);
    representedSubjects.add(occurrence.subjectId);
  }
  for (const subjectId of subjectIds) {
    requireCondition(representedSubjects.has(subjectId), `${subjectId} has no exported source occurrence.`);
  }

  validateUniqueIds(observations, "observation");
  for (const observation of observations) {
    requireCondition(subjectIds.has(observation.subjectId), `${observation.id} links to an unknown subject.`);
    if (observation.occurrenceId !== null) {
      const sourceOccurrence = value.occurrences.find((occurrence) => occurrence.id === observation.occurrenceId);
      requireCondition(sourceOccurrence, `${observation.id} links to an unknown occurrence.`);
      requireCondition(sourceOccurrence.subjectId === observation.subjectId, `${observation.id} source occurrence belongs to a different subject.`);
    } else {
      requireCondition(observation.evidenceKind === "assumption", `${observation.id} observation requires an exact source occurrence.`);
    }
    requireText(observation.topic, `${observation.id} requires a topic.`);
    requireText(observation.value, `${observation.id} requires a value or note.`);
    requireCondition(["observation", "assumption"].includes(observation.evidenceKind), `${observation.id} has an unsupported evidence kind.`);
    requireCondition(["unreviewed", "needs-confirmation", "confirmed", "rejected"].includes(observation.reviewState), `${observation.id} has an unsupported review state.`);
    requireCondition(typeof observation.createdAt === "string" && !Number.isNaN(Date.parse(observation.createdAt)), `${observation.id} has an invalid createdAt timestamp.`);
    requireCondition(typeof observation.updatedAt === "string" && !Number.isNaN(Date.parse(observation.updatedAt)), `${observation.id} has an invalid updatedAt timestamp.`);
  }

  return {
    format: OBJECT_EVIDENCE_FORMAT,
    exportedAt: value.exportedAt,
    producer: { name: "OB Drawing", projectFormat: value.producer.projectFormat },
    subjects: value.subjects.map((subject) => ({
      id: subject.id,
      kind: PHYSICAL_INSTANCE_KIND,
      category: subject.category.trim(),
      label: subject.label.trim(),
    })),
    configurations: value.configurations.map((configuration) => ({
      id: configuration.id,
      category: configuration.category.trim(),
      label: configuration.label.trim(),
    })),
    relationships: value.relationships.map((relationship) => ({
      kind: INSTANCE_OF_RELATIONSHIP,
      subjectId: relationship.subjectId,
      configurationId: relationship.configurationId,
    })),
    documents: value.documents.map(cloneDocument),
    occurrences: value.occurrences.map((occurrence) => ({
      id: occurrence.id,
      subjectId: occurrence.subjectId,
      documentId: occurrence.documentId,
      page: occurrence.page,
      geometry: cloneGeometry(occurrence.geometry),
    })),
    observations: observations.map((observation) => ({
      id: observation.id,
      subjectId: observation.subjectId,
      occurrenceId: observation.occurrenceId,
      topic: observation.topic.trim(),
      value: observation.value.trim(),
      evidenceKind: observation.evidenceKind,
      reviewState: observation.reviewState,
      createdAt: observation.createdAt,
      updatedAt: observation.updatedAt,
    })),
  };
}

export function createObjectEvidencePackage({
  documents,
  objects,
  occurrences,
  observations = [],
  selectedObjectIds,
  configurations = [],
  relationships = [],
  exportedAt = new Date().toISOString(),
}) {
  requireCondition(Array.isArray(selectedObjectIds) && selectedObjectIds.length > 0, "Select at least one object for export.");
  const selectedIds = new Set(selectedObjectIds);
  requireCondition(selectedIds.size === selectedObjectIds.length, "Selected object IDs must be unique.");
  const objectsById = new Map(objects.map((object) => [object.id, object]));
  for (const objectId of selectedIds) {
    requireCondition(objectsById.has(objectId), `Unknown selected object: ${objectId}.`);
  }

  const selectedOccurrences = occurrences.filter((occurrence) => selectedIds.has(occurrence.objectId));
  const representedObjectIds = new Set(selectedOccurrences.map((occurrence) => occurrence.objectId));
  for (const objectId of selectedIds) {
    requireCondition(representedObjectIds.has(objectId), `${objectId} has no exported source occurrence.`);
  }
  const referencedDocumentIds = new Set(selectedOccurrences.map((occurrence) => occurrence.documentId));
  const selectedDocuments = documents.filter((document) => referencedDocumentIds.has(document.id));
  const selectedRelationships = relationships.filter((relationship) => selectedIds.has(relationship.subjectId));
  const referencedConfigurationIds = new Set(selectedRelationships.map((relationship) => relationship.configurationId));
  const selectedConfigurations = configurations.filter((configuration) => referencedConfigurationIds.has(configuration.id));

  return validateObjectEvidencePackage({
    format: OBJECT_EVIDENCE_FORMAT,
    exportedAt,
    producer: { name: "OB Drawing", projectFormat: "obd-project-v4" },
    subjects: selectedObjectIds.map((objectId) => {
      const object = objectsById.get(objectId);
      return {
        id: object.id,
        kind: PHYSICAL_INSTANCE_KIND,
        category: object.category,
        label: object.label,
      };
    }),
    configurations: selectedConfigurations,
    relationships: selectedRelationships,
    documents: selectedDocuments,
    occurrences: selectedOccurrences.map((occurrence) => ({
      id: occurrence.id,
      subjectId: occurrence.objectId,
      documentId: occurrence.documentId,
      page: occurrence.page,
      geometry: occurrence.geometry ?? (
        occurrence.geometryType === "polygon"
          ? { type: "polygon", points: occurrence.points }
          : { type: occurrence.geometryType ?? "rectangle", bounds: occurrence.bounds }
      ),
    })),
    observations: observations
      .filter((observation) => selectedIds.has(observation.objectId))
      .map((observation) => ({
        id: observation.id,
        subjectId: observation.objectId,
        occurrenceId: observation.occurrenceId,
        topic: observation.topic,
        value: observation.value,
        evidenceKind: observation.evidenceKind,
        reviewState: observation.reviewState,
        createdAt: observation.createdAt,
        updatedAt: observation.updatedAt,
      })),
  });
}
