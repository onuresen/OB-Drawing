export function fingerprintsMatch(first, second) {
  return Boolean(
    first
    && second
    && first.sha256 === second.sha256
    && first.size === second.size
    && first.pageCount === second.pageCount
  );
}

export function findDocumentByFingerprint(documents, fingerprint) {
  return documents.find((document) => fingerprintsMatch(document, fingerprint)) ?? null;
}

export function occurrenceCountForDocument(occurrences, documentId) {
  return occurrences.filter((occurrence) => occurrence.documentId === documentId).length;
}

export function canRemoveDocument(occurrences, documentId) {
  return occurrenceCountForDocument(occurrences, documentId) === 0;
}

// Thumbnail identity follows the source PDF fingerprint, not the project-local document ID.
// Different imported projects commonly reuse IDs such as "document-001".
export function documentThumbnailCacheKey(document, page, rotation) {
  if (!document) {
    return null;
  }
  return `${document.sha256}:${document.size}:${document.pageCount}|${page}|${rotation}`;
}

export function chooseObjectOccurrence({
  occurrences,
  objectId,
  activeDocumentId,
  activePage,
  attachedDocumentIds = [],
}) {
  const candidates = occurrences.filter((occurrence) => occurrence.objectId === objectId);
  const attachedIds = new Set(attachedDocumentIds);
  return candidates.find(
    (occurrence) => occurrence.documentId === activeDocumentId && occurrence.page === activePage,
  )
    ?? candidates.find((occurrence) => occurrence.documentId === activeDocumentId)
    ?? candidates.find((occurrence) => attachedIds.has(occurrence.documentId))
    ?? candidates[0]
    ?? null;
}
