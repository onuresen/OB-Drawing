# Object-Centric Drawing Project Data Model

## Principle

Object identity, source documents, and drawing geometry are separate.

An object can have occurrences in several PDFs. Each occurrence explicitly names its document and page, then stores typed geometry in normalized page coordinates. Objects and occurrences remain separate collections so an occurrence can survive before it is linked or after its object is deleted.

```json
{
  "format": "objdraw-project-v5",
  "exportedAt": "2026-09-30T08:00:00.000Z",
  "activeDocumentId": "document-001",
  "documents": [
    {
      "id": "document-001",
      "name": "plans.pdf",
      "size": 28410293,
      "pageCount": 48,
      "sha256": "4d912a48a533db88236661d8c6c2a130ad2d7c8a5c70a6ff530091b1f6f6c1a9"
    },
    {
      "id": "document-002",
      "name": "details.pdf",
      "size": 9102451,
      "pageCount": 22,
      "sha256": "7f912a48a533db88236661d8c6c2a130ad2d7c8a5c70a6ff530091b1f6f6c2b8"
    }
  ],
  "objects": [
    {
      "id": "door-001",
      "category": "doors",
      "label": "D-105"
    }
  ],
  "occurrences": [
    {
      "id": "occurrence-001",
      "objectId": "door-001",
      "documentId": "document-001",
      "page": 12,
      "geometry": {
        "type": "rectangle",
        "bounds": { "x": 0.31, "y": 0.42, "width": 0.05, "height": 0.09 }
      }
    },
    {
      "id": "occurrence-002",
      "objectId": "door-001",
      "documentId": "document-002",
      "page": 7,
      "geometry": {
        "type": "ellipse",
        "bounds": { "x": 0.12, "y": 0.67, "width": 0.16, "height": 0.04 }
      }
    }
  ],
  "notes": [
    {
      "id": "note-001",
      "scope": "occurrence",
      "objectId": null,
      "occurrenceId": "occurrence-001",
      "text": "Confirm the fire rating shown for this representation.",
      "createdAt": "2026-09-30T08:10:00.000Z",
      "updatedAt": "2026-09-30T08:15:00.000Z"
    }
  ]
}
```

## Project and document rules

`documents[]` is the manifest of source PDFs known to the project. Document IDs are immutable project identity and do not depend on filenames. Exact duplicate fingerprints are rejected.

`activeDocumentId` must reference one manifest entry. It records the document that was active when the project was exported; it does not imply that other project documents are optional.

PDF bytes and filesystem paths are never embedded. Each document stores its filename plus SHA-256, byte size, and page count. Reopening a project therefore requires the user to select or relink local PDFs. A renamed copy with identical bytes remains a match.

## Identity rule

An object's generated ID is immutable project identity. Its visible label, such as `D-105`, is editable evidence and does not need to be unique. Two objects may share a label without becoming the same object. Category is a separate editable classification and changing it never changes identity or occurrence links.

New objects use neutral `object-*` identities. Imported `door-*` identities remain valid indefinitely so migration never rewrites established links. Categories use stable Object-Centric Drawing keys such as `doors`, `windows`, and `mechanical-equipment`; they are familiar physical-model classifications, not Autodesk API identifiers.

The user explicitly creates or confirms every cross-page and cross-document object link. Matching text, geometry, or labels must not silently merge objects.

Deleting an occurrence normally removes only that occurrence. Deleting an object normally preserves its occurrences and sets their `objectId` to `null`. If a note directly references the occurrence or object, deletion is blocked until the user explicitly removes that note; note removal is itself undoable. Occurrence notes continue to follow their mark if its object link changes.

## Physical instance and reusable configuration

An Object-Centric Drawing object currently identifies one physical building-object instance. A reusable type or configuration is a different entity even when it shares the instance's visible label.

Portable evidence exports may introduce configuration records and explicit `instanceOf` relationships. No configuration relationship may be inferred from matching labels, categories, shapes, or AI output. This keeps instance identity stable while allowing reviewed configuration evidence to be translated to systems such as Joinery Configurator.

The `objdraw-project-v5` editing contract adds flexible project, object, and occurrence notes without changing physical-instance identity. The separate `objdraw-object-evidence-v2` package extracts selected physical subjects, exact document/page/geometry evidence, and their relevant object or occurrence notes for downstream review or adapters. See [OBJECT-EVIDENCE-PACKAGE.md](OBJECT-EVIDENCE-PACKAGE.md).

## Note rules

Notes are ordinary editable working notes. Their `scope` is one of:

- `project`: applies to the drawing set and has no object or occurrence reference;
- `object`: applies to one exact object through `objectId`;
- `occurrence`: applies to one exact mark through `occurrenceId`, whether that mark is linked or unlinked.

Every note has a stable `note-*` ID, non-empty `text`, and valid creation/update timestamps. Text can be edited in place and advances `updatedAt`; add, edit, and delete are undoable project mutations. Notes have no review states, conflict derivation, assignment, threads, or inferred identity.

## Occurrence and geometry rules

Every occurrence must reference an existing document and a page within that document's page count. Runtime occurrences retain `documentId`; it is no longer discarded during import.

Geometry uses a typed envelope. Version 2 validates `rectangle` and `ellipse` using normalized bounds:

```json
{
  "type": "rectangle",
  "bounds": { "x": 0.1, "y": 0.2, "width": 0.3, "height": 0.4 }
}
```

Polygon geometry stores its ordered vertices instead of overloading bounds:

```json
{
  "type": "polygon",
  "points": [
    { "x": 0.1, "y": 0.2 },
    { "x": 0.4, "y": 0.2 },
    { "x": 0.28, "y": 0.55 }
  ]
}
```

A polygon requires at least three normalized points and a non-zero enclosed area. Runtime derives its bounding box for selection, movement, and proportional corner resize; the points remain the persisted source of truth. Freehand geometry still requires a separate future contract.

All values are normalized from `0` to `1` against the referenced page width and height. Rendering scale never changes stored geometry.

## Compatibility rule

`obd-object-layer-v1`, `obd-project-v2`, `obd-project-v3`, `obd-project-v4`, and `objdraw-project-v4` remain importable. A successful legacy migration:

- wraps its single `document` in `documents[]`;
- sets that ID as `activeDocumentId`;
- preserves object and occurrence IDs;
- keeps every occurrence's `documentId`;
- wraps legacy `bounds` in `geometry: { type: "rectangle", bounds }`;
- assigns legacy Door objects the stable `doors` category;
- initializes `notes` as an empty collection when the source format predates notes.

A v3 or v4 observation/assumption is converted to one ordinary note while importing. Its topic and value become `<topic>: <value>`; an entry with an occurrence becomes an occurrence note, while a whole-object assumption becomes an object note. The old review and conflict model is intentionally not retained.

All migrated data is validated as `objdraw-project-v5` before it can enter runtime state. New exports use only `objdraw-project-v5`; migration is one-way and does not rewrite the user's original file.

The interface can import this project before its PDFs are available. Local files are then attached by exact fingerprint, either in a multi-file batch or through a document-specific Relink action. Attachment state and per-document view state stay in memory and are not project content. A missing PDF never removes its manifest entry, objects, or occurrences.

Documents with occurrences cannot be removed from the manifest; they can be safely detached instead. This prevents source evidence from becoming orphaned. The interface renders and edits every geometry type retained by the v4 contract: rectangle, ellipse, and polygon.
