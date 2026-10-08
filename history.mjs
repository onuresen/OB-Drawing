function cloneSnapshot(snapshot) {
  return {
    objects: snapshot.objects.map((object) => ({ ...object })),
    occurrences: snapshot.occurrences.map((occurrence) => ({
      ...occurrence,
      bounds: { ...occurrence.bounds },
      ...(occurrence.points ? { points: occurrence.points.map((point) => ({ ...point })) } : {}),
    })),
    notes: snapshot.notes.map((note) => ({ ...note })),
    relations: (snapshot.relations ?? []).map((relation) => ({ ...relation })),
    selectedObjectId: snapshot.selectedObjectId ?? null,
    selectedOccurrenceId: snapshot.selectedOccurrenceId ?? null,
  };
}

export function createObjectLayerSnapshot(source) {
  return cloneSnapshot({
    objects: source.objects ?? [],
    occurrences: source.occurrences ?? [],
    notes: source.notes ?? [],
    relations: source.relations ?? [],
    selectedObjectId: source.selectedObjectId,
    selectedOccurrenceId: source.selectedOccurrenceId,
  });
}

export function boundsAreEqual(first, second) {
  return Boolean(
    first
    && second
    && first.x === second.x
    && first.y === second.y
    && first.width === second.width
    && first.height === second.height
  );
}

export class ObjectLayerHistory {
  constructor(limit = 100) {
    this.limit = Math.max(1, Math.floor(limit));
    this.undoEntries = [];
    this.redoEntries = [];
  }

  get canUndo() {
    return this.undoEntries.length > 0;
  }

  get canRedo() {
    return this.redoEntries.length > 0;
  }

  get undoLabel() {
    return this.undoEntries.at(-1)?.label ?? null;
  }

  get redoLabel() {
    return this.redoEntries.at(-1)?.label ?? null;
  }

  reset() {
    this.undoEntries = [];
    this.redoEntries = [];
  }

  record(snapshot, label) {
    this.undoEntries.push({ snapshot: cloneSnapshot(snapshot), label });
    if (this.undoEntries.length > this.limit) {
      this.undoEntries.shift();
    }
    this.redoEntries = [];
  }

  undo(currentSnapshot) {
    const entry = this.undoEntries.pop();
    if (!entry) {
      return null;
    }
    this.redoEntries.push({
      snapshot: cloneSnapshot(currentSnapshot),
      label: entry.label,
    });
    return { snapshot: cloneSnapshot(entry.snapshot), label: entry.label };
  }

  redo(currentSnapshot) {
    const entry = this.redoEntries.pop();
    if (!entry) {
      return null;
    }
    this.undoEntries.push({
      snapshot: cloneSnapshot(currentSnapshot),
      label: entry.label,
    });
    return { snapshot: cloneSnapshot(entry.snapshot), label: entry.label };
  }
}
