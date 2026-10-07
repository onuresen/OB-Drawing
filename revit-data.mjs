export const REVIT_DATA_FORMAT = "objdraw-revit-refs-v2";
export const LEGACY_REVIT_DATA_FORMAT = "objdraw-revit-refs-v1";

const OBJECT_ID_PATTERN = /^(?:door|object)-\d+$/;
const OCCURRENCE_ID_PATTERN = /^occurrence-\d+$/;
const STORAGE_TYPES = new Set(["double", "integer", "string", "elementId"]);

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requireCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function requireString(value, label, { allowEmpty = false } = {}) {
  requireCondition(typeof value === "string", `${label} must be text.`);
  requireCondition(allowEmpty || value.trim(), `${label} cannot be empty.`);
  return value;
}

function validateParameters(parameters, label) {
  requireCondition(Array.isArray(parameters), `${label} parameters must be an array.`);
  return parameters.map((parameter, index) => {
    requireCondition(isRecord(parameter), `${label} parameter ${index + 1} must be an object.`);
    requireString(parameter.sourceKey, `${label} parameter sourceKey`);
    requireString(parameter.name, `${label} parameter name`);
    requireCondition(STORAGE_TYPES.has(parameter.storageType), `${label} parameter ${parameter.name} has an unsupported storage type.`);
    requireString(parameter.rawValue, `${label} parameter ${parameter.name} rawValue`, { allowEmpty: true });
    requireString(parameter.displayValue, `${label} parameter ${parameter.name} displayValue`);
    return {
      sourceKey: parameter.sourceKey,
      name: parameter.name.trim(),
      storageType: parameter.storageType,
      rawValue: parameter.rawValue,
      displayValue: parameter.displayValue.trim(),
    };
  });
}

export function validateRevitData(value, projectObjects, projectDocuments = []) {
  requireCondition(isRecord(value), "Revit data must be an object.");
  requireCondition(
    value.format === REVIT_DATA_FORMAT || value.format === LEGACY_REVIT_DATA_FORMAT,
    `Unsupported Revit data format: ${value.format ?? "missing"}.`,
  );
  requireString(value.projectFile, "projectFile");
  requireCondition(typeof value.exportedAt === "string" && !Number.isNaN(Date.parse(value.exportedAt)), "Invalid Revit data exportedAt timestamp.");
  requireString(value.revitDocument, "revitDocument");
  requireCondition(Array.isArray(value.objects), "Revit objects must be an array.");
  requireCondition(Array.isArray(value.occurrences), "Revit occurrences must be an array.");
  requireCondition(Array.isArray(value.skipped), "Revit skipped views must be an array.");

  const includesParameters = value.format === REVIT_DATA_FORMAT
    ? value.includesParameters
    : false;
  requireCondition(typeof includesParameters === "boolean", "includesParameters must be true or false.");
  let sourceDocument = null;
  if (value.format === REVIT_DATA_FORMAT) {
    requireCondition(isRecord(value.sourceDocument), "Revit data requires its source document fingerprint.");
    const { id, name, size, pageCount, sha256 } = value.sourceDocument;
    requireString(id, "sourceDocument id");
    requireString(name, "sourceDocument name");
    requireCondition(Number.isSafeInteger(size) && size > 0, "sourceDocument size must be a positive integer.");
    requireCondition(Number.isSafeInteger(pageCount) && pageCount > 0, "sourceDocument pageCount must be a positive integer.");
    requireCondition(typeof sha256 === "string" && /^[a-f0-9]{64}$/.test(sha256), "sourceDocument SHA-256 is invalid.");
    requireCondition(
      projectDocuments.some((document) => document.sha256 === sha256 && document.size === size && document.pageCount === pageCount),
      "The Revit companion does not match a PDF in the current project.",
    );
    sourceDocument = { id, name, size, pageCount, sha256 };
  }
  const projectObjectIds = new Set(projectObjects.map((object) => object.id));
  const objectIds = new Set();
  const objects = value.objects.map((object) => {
    requireCondition(isRecord(object), "Every Revit object reference must be an object.");
    requireCondition(typeof object.objectId === "string" && OBJECT_ID_PATTERN.test(object.objectId), "Invalid Revit object ID.");
    requireCondition(!objectIds.has(object.objectId), `Duplicate Revit object reference: ${object.objectId}.`);
    requireCondition(projectObjectIds.has(object.objectId), `${object.objectId} is not present in the current project.`);
    objectIds.add(object.objectId);
    requireString(object.uniqueId, `${object.objectId} uniqueId`);
    requireCondition(Number.isSafeInteger(object.elementId), `${object.objectId} elementId must be an integer.`);
    for (const field of ["familyName", "typeName", "mark"]) {
      requireString(object[field], `${object.objectId} ${field}`, { allowEmpty: true });
    }
    return {
      objectId: object.objectId,
      uniqueId: object.uniqueId,
      elementId: object.elementId,
      familyName: object.familyName,
      typeName: object.typeName,
      mark: object.mark,
      instanceParameters: includesParameters ? validateParameters(object.instanceParameters, `${object.objectId} instance`) : [],
      typeParameters: includesParameters ? validateParameters(object.typeParameters, `${object.objectId} type`) : [],
    };
  });

  const occurrenceIds = new Set();
  const occurrences = value.occurrences.map((occurrence) => {
    requireCondition(isRecord(occurrence), "Every Revit occurrence reference must be an object.");
    requireCondition(typeof occurrence.occurrenceId === "string" && OCCURRENCE_ID_PATTERN.test(occurrence.occurrenceId), "Invalid Revit occurrence ID.");
    requireCondition(!occurrenceIds.has(occurrence.occurrenceId), `Duplicate Revit occurrence reference: ${occurrence.occurrenceId}.`);
    occurrenceIds.add(occurrence.occurrenceId);
    for (const field of ["sheetNumber", "sheetName", "sheetUniqueId", "viewName", "viewUniqueId"]) {
      requireString(occurrence[field], `${occurrence.occurrenceId} ${field}`, { allowEmpty: true });
    }
    return { ...occurrence };
  });

  return {
    format: REVIT_DATA_FORMAT,
    sourceFormat: value.format,
    projectFile: value.projectFile,
    exportedAt: value.exportedAt,
    revitDocument: value.revitDocument,
    sourceDocument,
    includesParameters,
    objects,
    occurrences,
    skipped: value.skipped.map((skipped) => ({ ...skipped })),
  };
}

export function revitObjectData(revitData, objectId) {
  return revitData?.objects.find((object) => object.objectId === objectId) ?? null;
}
