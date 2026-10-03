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
