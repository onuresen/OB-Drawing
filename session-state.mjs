export function objectLayerSignature(source) {
  const documents = (source.documents ?? []).map((document) => ({
    id: document.id,
    name: document.name,
    size: document.size,
    pageCount: document.pageCount,
    sha256: document.sha256,
  }));
  const objects = (source.objects ?? []).map((object) => ({
    id: object.id,
    category: object.category,
    label: object.label,
  }));
  const occurrences = (source.occurrences ?? []).map((occurrence) => ({
    id: occurrence.id,
    objectId: occurrence.objectId ?? null,
    documentId: occurrence.documentId ?? null,
    page: occurrence.page,
    geometryType: occurrence.geometryType ?? "rectangle",
    bounds: {
      x: occurrence.bounds.x,
      y: occurrence.bounds.y,
      width: occurrence.bounds.width,
      height: occurrence.bounds.height,
    },
    ...(occurrence.points ? {
      points: occurrence.points.map((point) => ({ x: point.x, y: point.y })),
    } : {}),
  }));
  const notes = (source.notes ?? []).map((note) => ({
    id: note.id,
    scope: note.scope,
    objectId: note.objectId ?? null,
    occurrenceId: note.occurrenceId ?? null,
    text: note.text,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  }));

  const relations = (source.relations ?? []).map((relation) => ({
    id: relation.id,
    type: relation.type,
    from: relation.from,
    to: relation.to,
    label: relation.label ?? "",
    origin: relation.origin ?? null,
    createdAt: relation.createdAt ?? null,
  }));

  return JSON.stringify({
    documents,
    objects,
    occurrences,
    notes,
    relations,
  });
}

export class ObjectLayerSaveState {
  constructor() {
    this.savedSignature = null;
  }

  get hasBaseline() {
    return this.savedSignature !== null;
  }

  reset() {
    this.savedSignature = null;
  }

  markSaved(snapshot) {
    this.savedSignature = objectLayerSignature(snapshot);
  }

  isDirty(snapshot) {
    return this.hasBaseline && objectLayerSignature(snapshot) !== this.savedSignature;
  }
}
