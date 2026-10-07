export const NOTE_SCOPES = Object.freeze(["project", "object", "occurrence"]);

function normalizeText(value) {
  return String(value ?? "").trim().replace(/\r\n?/g, "\n");
}

export function nextNoteId(notes) {
  const highest = notes.reduce((maximum, note) => {
    const match = /^note-(\d+)$/.exec(note.id);
    return match ? Math.max(maximum, Number(match[1])) : maximum;
  }, 0);
  return `note-${String(highest + 1).padStart(3, "0")}`;
}

export function createNote(notes, {
  scope = "project",
  objectId = null,
  occurrenceId = null,
  text,
  createdAt = new Date().toISOString(),
}) {
  const normalizedText = normalizeText(text);
  if (!NOTE_SCOPES.includes(scope)) {
    throw new Error(`Unsupported note scope: ${scope}.`);
  }
  if (!normalizedText) {
    throw new Error("Enter a note.");
  }
  if (Number.isNaN(Date.parse(createdAt))) {
    throw new Error("A note requires a valid timestamp.");
  }
  if (scope === "object" && !objectId) {
    throw new Error("An object note requires an object.");
  }
  if (scope === "occurrence" && !occurrenceId) {
    throw new Error("An occurrence note requires an occurrence.");
  }
  return {
    id: nextNoteId(notes),
    scope,
    objectId: scope === "object" ? objectId : null,
    occurrenceId: scope === "occurrence" ? occurrenceId : null,
    text: normalizedText,
    createdAt,
    updatedAt: createdAt,
  };
}

export function updateNote(notes, noteId, text, updatedAt = new Date().toISOString()) {
  const normalizedText = normalizeText(text);
  if (!normalizedText) {
    throw new Error("Enter a note.");
  }
  if (Number.isNaN(Date.parse(updatedAt))) {
    throw new Error("A note update requires a valid timestamp.");
  }
  let found = false;
  const result = notes.map((note) => {
    if (note.id !== noteId) {
      return note;
    }
    found = true;
    return note.text === normalizedText ? note : { ...note, text: normalizedText, updatedAt };
  });
  if (!found) {
    throw new Error(`Unknown note: ${noteId}.`);
  }
  return result;
}

export function removeNote(notes, noteId) {
  return notes.filter((note) => note.id !== noteId);
}
