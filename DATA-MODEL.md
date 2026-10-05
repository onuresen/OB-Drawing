# Object-Centric Drawing Project Data Model

## Principle

Object identity, source documents, and drawing geometry are separate.

An object can have occurrences in several PDFs. Each occurrence explicitly names its document and page, then stores typed geometry in normalized page coordinates. Objects and occurrences remain separate collections so an occurrence can survive before it is linked or after its object is deleted.

```json
{
  "format": "objdraw-project-v4",
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
  "observations": [
    {
      "id": "observation-001",
      "objectId": "door-001",
      "occurrenceId": "occurrence-001",
      "evidenceKind": "observation",
      "topic": "fire-rating",
      "value": "60 minutes",
      "reviewState": "confirmed",
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

Deleting an occurrence normally removes only that occurrence. Deleting an object normally preserves its occurrences and sets their `objectId` to `null`. If governed evidence references the occurrence or object, deletion is blocked until the user explicitly removes that evidence; evidence removal is itself undoable. This prevents provenance from disappearing as a side effect of object editing.

## Physical instance and reusable configuration

An Object-Centric Drawing object currently identifies one physical building-object instance. A reusable type or configuration is a different entity even when it shares the instance's visible label.

Portable evidence exports may introduce configuration records and explicit `instanceOf` relationships. No configuration relationship may be inferred from matching labels, categories, shapes, or AI output. This keeps instance identity stable while allowing reviewed configuration evidence to be translated to systems such as Joinery Configurator.

The `objdraw-project-v4` editing contract adds stable object categories without changing physical-instance identity. The separate `objdraw-object-evidence-v1` package extracts selected physical subjects, exact document/page/geometry evidence, and their governed observations for downstream review or adapters. See [OBJECT-EVIDENCE-PACKAGE.md](OBJECT-EVIDENCE-PACKAGE.md).

## Governed evidence rules

An evidence entry belongs to exactly one existing object. Its `evidenceKind` is either:

- `observation`: a claim read from or visibly supported by one exact occurrence; `occurrenceId` is required and must belong to the same object;
- `assumption`: an explicit human interpretation that may refer to one occurrence or to the whole object with `occurrenceId: null`.

`topic` and `value` are required human-entered strings. Entry IDs, content, kind, object, source occurrence, and creation time are immutable after creation. The only in-place change is the review state: `unreviewed`, `needs-confirmation`, `confirmed`, or `rejected`. A review-state change advances `updatedAt`; explicit removal remains available as a separate undoable action.

Conflicts are derived rather than stored. Two or more non-rejected entries for the same object and normalized topic conflict when they contain different normalized values. Rejected entries remain in the record for traceability but do not contribute to conflicts.

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

`obd-object-layer-v1`, `obd-project-v2`, and `obd-project-v3` remain importable. A successful legacy migration:

- wraps its single `document` in `documents[]`;
- sets that ID as `activeDocumentId`;
- preserves object and occurrence IDs;
- keeps every occurrence's `documentId`;
- wraps legacy `bounds` in `geometry: { type: "rectangle", bounds }`;
- assigns legacy Door objects the stable `doors` category;
- initializes `observations` as an empty collection when the source format predates evidence.

A successful v3 migration additionally preserves governed observations and their exact source links while replacing legacy `type: "Door"` with `category: "doors"`.

All migrated data is validated as `objdraw-project-v4` before it can enter runtime state. New exports use only `objdraw-project-v4`; migration is one-way and does not rewrite the user's original file.

The interface can import this project before its PDFs are available. Local files are then attached by exact fingerprint, either in a multi-file batch or through a document-specific Relink action. Attachment state and per-document view state stay in memory and are not project content. A missing PDF never removes its manifest entry, objects, or occurrences.

Documents with occurrences cannot be removed from the manifest; they can be safely detached instead. This prevents source evidence from becoming orphaned. The interface renders and edits every geometry type retained by the v4 contract: rectangle, ellipse, and polygon.
