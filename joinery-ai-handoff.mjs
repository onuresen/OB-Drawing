export const JOINERY_AI_HANDOFF_FORMAT = "objdraw-joinery-ai-handoff-v1";
export const JOINERY_PROMPT_FILENAME = "JoineryConfigurator_Photo_to_JSON_Prompt.md";
export const JOINERY_EXPECTED_SCHEMA_VERSION = "1.1";

const TARGET_OPENING_TYPES = new Map([
  ["doors", "door"],
  ["windows", "window"],
]);

function requireCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function requireText(value, message) {
  requireCondition(typeof value === "string" && value.trim(), message);
  return value.trim();
}

export function joineryOpeningType(category) {
  return TARGET_OPENING_TYPES.get(category) ?? null;
}

export function canCreateJoineryAiHandoff(subject) {
  return Boolean(subject && joineryOpeningType(subject.category));
}

export function createJoineryAiInstructions({ evidencePackage, handoffIndex }) {
  const subject = evidencePackage.subjects[0];
  const observations = evidencePackage.observations ?? [];
  const observationLines = observations.length
    ? observations.map((entry) => (
      `- ${entry.topic}: ${entry.value} [${entry.evidenceKind}; ${entry.reviewState}; source ${entry.occurrenceId ?? "whole object"}]`
    ))
    : ["- No reviewed notes were recorded in Object-Centric Drawing. Use only visible drawing evidence and state uncertainty conservatively."];
  const representationLines = handoffIndex.representations.items.map((item) => (
    `- ${item.occurrenceId}: ${item.documentName}, page ${item.page}; marked ${item.markedPath}; clean ${item.cleanPath}`
  ));

  return `# Joinery Configurator AI handoff

## Goal

Create one Joinery Configurator JSON composition for the single physical object represented by this package.

- Object-Centric Drawing subject: ${subject.label} (${subject.id})
- Object-Centric Drawing category: ${subject.category}
- Target openingType: ${handoffIndex.target.openingType}
- Target schemaVersion: ${handoffIndex.target.schemaVersion}

## How to use the evidence

1. Open the current \`${JOINERY_PROMPT_FILENAME}\` from the Joinery Configurator repository first. The prompt is maintained there and is not duplicated in this package.
2. Treat every representation below as evidence about the same physical object. Do not create one JSON per image.
3. Use the marked images to locate the object and the clean images to inspect its geometry, dimensions, schedule text, operation, panels, frame, and other visible properties.
4. Cross-check plan, elevation, schedule, section, detail, and notes. Prefer explicit dimensions and labels over visual estimation.
5. Treat Object-Centric Drawing observations and assumptions according to their recorded kind and review state. Rejected evidence must not become a target value.
6. Do not invent hidden geometry or manufacturer/Revit family mappings. When evidence is insufficient, use the most conservative schema-valid representation and leave optional values empty or null where the schema permits.
7. Return exactly one raw JSON object that can be imported into Joinery Configurator. Do not wrap the JSON in Markdown fences.

## Representations

${representationLines.join("\n")}

The combined marked overview is \`${handoffIndex.representations.contactSheetPath}\`.

## Object-Centric Drawing evidence notes

${observationLines.join("\n")}

## Provenance

The source manifest is \`manifest.objdraw-evidence.json\`. The handoff index is \`handoff.json\`. Preserve the Object-Centric Drawing subject ID in your review notes so the generated composition can be traced back to this evidence set.
`;
}

export function createJoineryAiHandoffIndex({
  evidencePackage,
  renderedRepresentations,
  unavailableRepresentations = [],
  exportedAt = new Date().toISOString(),
}) {
  requireCondition(evidencePackage?.format === "objdraw-object-evidence-v1", "A valid Object-Centric Drawing evidence package is required.");
  requireCondition(Array.isArray(evidencePackage.subjects) && evidencePackage.subjects.length === 1, "A Joinery AI handoff requires exactly one subject.");
  const subject = evidencePackage.subjects[0];
  const openingType = joineryOpeningType(subject.category);
  requireCondition(openingType, `Category ${subject.category ?? "missing"} is not supported by the Joinery AI handoff.`);
  requireCondition(Array.isArray(renderedRepresentations) && renderedRepresentations.length > 0, "At least one rendered representation is required.");
  requireCondition(typeof exportedAt === "string" && !Number.isNaN(Date.parse(exportedAt)), "A valid export timestamp is required.");

  const occurrenceById = new Map(evidencePackage.occurrences.map((occurrence) => [occurrence.id, occurrence]));
  const documentById = new Map(evidencePackage.documents.map((document) => [document.id, document]));
  const seen = new Set();
  const items = renderedRepresentations.map((asset) => {
    const occurrence = occurrenceById.get(asset.occurrenceId);
    requireCondition(occurrence, `Rendered representation references unknown occurrence: ${asset.occurrenceId}.`);
    requireCondition(!seen.has(asset.occurrenceId), `Duplicate rendered representation: ${asset.occurrenceId}.`);
    seen.add(asset.occurrenceId);
    const sourceDocument = documentById.get(occurrence.documentId);
    requireCondition(sourceDocument, `${asset.occurrenceId} references an unknown document.`);
    requireCondition(Number.isSafeInteger(asset.width) && asset.width > 0, `${asset.occurrenceId} requires a positive image width.`);
    requireCondition(Number.isSafeInteger(asset.height) && asset.height > 0, `${asset.occurrenceId} requires a positive image height.`);
    return {
      occurrenceId: asset.occurrenceId,
      documentId: occurrence.documentId,
      documentName: sourceDocument.name,
      page: occurrence.page,
      cleanPath: requireText(asset.cleanPath, `${asset.occurrenceId} requires a clean image path.`),
      markedPath: requireText(asset.markedPath, `${asset.occurrenceId} requires a marked image path.`),
      width: asset.width,
      height: asset.height,
    };
  });

  const unavailable = unavailableRepresentations.map((item) => {
    requireCondition(occurrenceById.has(item.occurrenceId), `Unavailable representation references unknown occurrence: ${item.occurrenceId}.`);
    requireCondition(!seen.has(item.occurrenceId), `${item.occurrenceId} cannot be both rendered and unavailable.`);
    seen.add(item.occurrenceId);
    return {
      occurrenceId: item.occurrenceId,
      reason: requireText(item.reason, `${item.occurrenceId} requires an unavailable reason.`),
    };
  });

  requireCondition(seen.size === evidencePackage.occurrences.length, "Every exported occurrence must be rendered or recorded as unavailable.");

  return {
    format: JOINERY_AI_HANDOFF_FORMAT,
    exportedAt,
    subject: {
      id: subject.id,
      category: subject.category,
      label: subject.label,
    },
    target: {
      application: "Joinery Configurator",
      openingType,
      schemaVersion: JOINERY_EXPECTED_SCHEMA_VERSION,
      promptFileName: JOINERY_PROMPT_FILENAME,
      promptIncluded: false,
      promptAuthority: "Joinery Configurator repository",
      expectedOutput: "one raw JSON object",
    },
    representations: {
      contactSheetPath: "representations/contact-sheet.png",
      items,
      unavailable,
    },
    evidenceManifestPath: "manifest.objdraw-evidence.json",
    instructionsPath: "AI-HANDOFF.md",
  };
}
