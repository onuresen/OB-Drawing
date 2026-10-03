export function occurrenceDensity(count) {
  if (count <= 0) {
    return "none";
  }
  if (count === 1) {
    return "low";
  }
  if (count <= 3) {
    return "medium";
  }
  return "high";
}

export function buildDrawingMap(documents, occurrences) {
  const occurrencesByPage = new Map();
  for (const occurrence of occurrences) {
    const key = `${occurrence.documentId}:${occurrence.page}`;
    if (!occurrencesByPage.has(key)) {
      occurrencesByPage.set(key, []);
    }
    occurrencesByPage.get(key).push(occurrence);
  }

  return documents.map((document) => {
    const pages = Array.from({ length: document.pageCount }, (_, index) => {
      const page = index + 1;
      const pageOccurrences = occurrencesByPage.get(`${document.id}:${page}`) ?? [];
      return {
        page,
        occurrenceCount: pageOccurrences.length,
        density: occurrenceDensity(pageOccurrences.length),
        objectIds: [...new Set(pageOccurrences.map((occurrence) => occurrence.objectId).filter(Boolean))],
      };
    });
    return {
      id: document.id,
      name: document.name,
      pageCount: document.pageCount,
      occurrenceCount: pages.reduce((total, page) => total + page.occurrenceCount, 0),
      pages,
    };
  });
}

export function summarizeDrawingMap(documents, occurrences, attachedDocumentIds = []) {
  const attached = new Set(attachedDocumentIds);
  return {
    documentCount: documents.length,
    pageCount: documents.reduce((total, document) => total + document.pageCount, 0),
    occurrenceCount: occurrences.length,
    missingDocumentCount: documents.filter((document) => !attached.has(document.id)).length,
  };
}
