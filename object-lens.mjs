import { clamp } from "./geometry.mjs";

function fittedRange(center, size) {
  const boundedSize = clamp(size, 0, 1);
  return clamp(center - boundedSize / 2, 0, 1 - boundedSize);
}

export function objectLensContextBounds(
  bounds,
  pageAspect,
  { padding = 0.08, minimumWidth = 0.32, minimumHeight = 0.22, targetAspect = 1.6 } = {},
) {
  let width = Math.max(bounds.width + padding * 2, minimumWidth);
  let height = Math.max(bounds.height + padding * 2, minimumHeight);
  const normalizedTargetRatio = targetAspect / pageAspect;

  if (width / height < normalizedTargetRatio) {
    width = height * normalizedTargetRatio;
  } else {
    height = width / normalizedTargetRatio;
  }

  if (width > 1) {
    width = 1;
    height = Math.min(1, width / normalizedTargetRatio);
  }
  if (height > 1) {
    height = 1;
    width = Math.min(1, height * normalizedTargetRatio);
  }

  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  return {
    x: fittedRange(centerX, width),
    y: fittedRange(centerY, height),
    width,
    height,
  };
}

export function summarizeObjectLens(occurrences, attachedDocumentIds = []) {
  const attached = new Set(attachedDocumentIds);
  const documents = new Set();
  const pages = new Set();
  const missingDocuments = new Set();

  for (const occurrence of occurrences) {
    documents.add(occurrence.documentId);
    pages.add(`${occurrence.documentId}:${occurrence.page}`);
    if (!attached.has(occurrence.documentId)) {
      missingDocuments.add(occurrence.documentId);
    }
  }

  return {
    occurrenceCount: occurrences.length,
    documentCount: documents.size,
    pageCount: pages.size,
    missingDocumentCount: missingDocuments.size,
  };
}

export function sortObjectRepresentations(occurrences, documents) {
  const documentOrder = new Map(documents.map((document, index) => [document.id, index]));
  return [...occurrences].sort((first, second) => {
    const firstDocumentIndex = documentOrder.get(first.documentId) ?? Number.MAX_SAFE_INTEGER;
    const secondDocumentIndex = documentOrder.get(second.documentId) ?? Number.MAX_SAFE_INTEGER;
    return firstDocumentIndex - secondDocumentIndex
      || first.page - second.page
      || first.id.localeCompare(second.id, undefined, { numeric: true });
  });
}
