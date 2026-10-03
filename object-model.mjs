import { isObjectCategoryKey } from "./category-catalog.mjs";

export function normalizeLabel(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

export function nextEntityId(entities, prefix) {
  const pattern = new RegExp(`^${prefix}-(\\d+)$`);
  const highest = entities.reduce((maximum, entity) => {
    const match = pattern.exec(entity.id);
    return match ? Math.max(maximum, Number(match[1])) : maximum;
  }, 0);
  return `${prefix}-${String(highest + 1).padStart(3, "0")}`;
}

export function createObject(objects, category, label) {
  const normalizedLabel = normalizeLabel(label);
  if (!normalizedLabel) {
    throw new Error("An object label is required.");
  }
  if (!isObjectCategoryKey(category)) {
    throw new Error("A supported object category is required.");
  }

  return {
    id: nextEntityId(objects, "object"),
    category,
    label: normalizedLabel,
  };
}

export function createOccurrence(
  occurrences,
  page,
  bounds,
  objectId = null,
  documentId,
  geometryType = "rectangle",
  points = null,
) {
  if (!documentId) {
    throw new Error("An occurrence requires a document ID.");
  }
  const occurrence = {
    id: nextEntityId(occurrences, "occurrence"),
    objectId,
    documentId,
    page,
    geometryType,
    bounds: { ...bounds },
  };
  if (geometryType === "polygon") {
    occurrence.points = points.map((point) => ({ ...point }));
  }
  return occurrence;
}

export function renameObject(objects, objectId, label) {
  const normalizedLabel = normalizeLabel(label);
  if (!normalizedLabel) {
    throw new Error("An object label is required.");
  }

  return objects.map((object) => object.id === objectId
    ? { ...object, label: normalizedLabel }
    : object);
}

export function updateObjectDetails(objects, objectId, { category, label }) {
  const normalizedLabel = normalizeLabel(label);
  if (!normalizedLabel) {
    throw new Error("An object label is required.");
  }
  if (!isObjectCategoryKey(category)) {
    throw new Error("A supported object category is required.");
  }

  return objects.map((object) => object.id === objectId
    ? { ...object, category, label: normalizedLabel }
    : object);
}

export function linkOccurrence(occurrences, occurrenceId, objectId) {
  return occurrences.map((occurrence) => occurrence.id === occurrenceId
    ? { ...occurrence, objectId }
    : occurrence);
}

export function removeOccurrence(occurrences, occurrenceId) {
  return occurrences.filter((occurrence) => occurrence.id !== occurrenceId);
}

export function deleteObjectPreservingOccurrences(objects, occurrences, objectId) {
  return {
    objects: objects.filter((object) => object.id !== objectId),
    occurrences: occurrences.map((occurrence) => occurrence.objectId === objectId
      ? { ...occurrence, objectId: null }
      : occurrence),
  };
}

export function getObjectOccurrences(occurrences, objectId) {
  return occurrences.filter((occurrence) => occurrence.objectId === objectId);
}
