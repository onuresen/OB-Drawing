# Object-Centric Drawing Object Evidence Package

## Purpose

`objdraw-object-evidence-v2` is a portable, target-neutral package for carrying one or more explicitly selected physical subjects and their exact drawing evidence out of an Object-Centric Drawing project.

It is not a replacement for `objdraw-project-v5`. The project file remains the editable Object-Centric Drawing source of truth. An evidence package is a bounded export assembled from that project for review, exchange, or translation by a separate adapter.

## Semantic boundary

Object-Centric Drawing currently treats each object as a **physical instance**. An object such as `object-001` means one explicitly identified building object even when another object has the same visible label. Stable category keys such as `doors` and `windows` describe the object without defining its identity.

A reusable type or configuration is a separate entity. An instance belongs to a configuration only through an explicit `instanceOf` relationship. Matching labels, categories, geometry, or AI suggestions never create that relationship.

This distinction allows a future Joinery Configurator adapter to translate reviewed configuration evidence without redefining the identity of the physical objects that supplied it.

## Version 2 envelope

```json
{
  "format": "objdraw-object-evidence-v2",
  "exportedAt": "2026-09-30T00:00:00.000Z",
  "producer": {
    "name": "Object-Centric Drawing",
    "projectFormat": "objdraw-project-v5"
  },
  "subjects": [
    {
      "id": "door-001",
      "kind": "physical-instance",
      "category": "doors",
      "label": "D-105"
    }
  ],
  "configurations": [
    {
      "id": "configuration-001",
      "category": "doors",
      "label": "D-105 Type"
    }
  ],
  "relationships": [
    {
      "kind": "instanceOf",
      "subjectId": "door-001",
      "configurationId": "configuration-001"
    }
  ],
  "documents": [
    {
      "id": "document-001",
      "name": "plans.pdf",
      "size": 28410293,
      "pageCount": 48,
      "sha256": "4d912a48a533db88236661d8c6c2a130ad2d7c8a5c70a6ff530091b1f6f6c1a9"
    }
  ],
  "occurrences": [
    {
      "id": "occurrence-001",
      "subjectId": "door-001",
      "documentId": "document-001",
      "page": 12,
      "geometry": {
        "type": "rectangle",
        "bounds": { "x": 0.31, "y": 0.42, "width": 0.05, "height": 0.09 }
      }
    }
  ],
  "notes": [
    {
      "id": "note-001",
      "scope": "occurrence",
      "subjectId": "door-001",
      "occurrenceId": "occurrence-001",
      "text": "Confirm the fire rating shown for this representation.",
      "createdAt": "2026-09-30T08:10:00.000Z",
      "updatedAt": "2026-09-30T08:15:00.000Z"
    }
  ]
}
```

## Selection and validation rules

- Export selection is explicit and must contain at least one subject.
- Every exported subject must retain at least one source occurrence.
- Only documents referenced by those occurrences are included.
- Subject IDs, occurrence IDs, document IDs, geometry, page numbers, filenames, sizes, page counts, and SHA-256 fingerprints are preserved.
- Object notes belonging to selected subjects and occurrence notes belonging to their exported occurrences are included; project `objectId` becomes package `subjectId`.
- Project notes are not included because the package contains only selected subjects.
- Note text, scope, target, and timestamps are preserved.
- Duplicate visible labels remain separate subjects.
- A configuration is included only when an explicit exported relationship references it.
- Version 2 allows at most one configuration relationship per physical subject and requires matching categories.
- Unknown subjects, documents, configurations, invalid pages, and invalid geometry fail closed.
- The package contains no local paths, PDF bytes, credentials, inferred links, or target-system records.

## Extension boundaries

Later groups may add separately governed sections or companion assets for:

- cropped visual representations;
- AI-produced draft claims and their provenance;
- domain-profile declarations;
- adapter results.

Human project, object, and occurrence notes are governed by `objdraw-project-v5`. They remain editable working context rather than reviewed claims.

AI output must remain distinguishable from captured facts and human-reviewed values. Target-specific Joinery Configurator or CDI records should be produced by adapters and must not silently become part of the neutral Object-Centric Drawing project model.

## R1 export forms

The Object Lens exposes two user-controlled export forms for the selected physical subject:

- **Manifest only:** `<label>-<subject-id>.objdraw-evidence.json`
- **Manifest with visual companions:** `<label>-<subject-id>.objdraw-evidence.zip`

The ZIP uses stored entries so it needs no external compression dependency. Its layout is:

```text
manifest.objdraw-evidence.json
assets.json
previews/
  occurrence-001.png
  occurrence-002.png
```

`manifest.objdraw-evidence.json` is the same validated neutral contract produced by the plain export. Preview binaries do not enter that manifest.

`assets.json` uses `objdraw-object-evidence-assets-v1`. Each included item identifies its `occurrenceId`, relative PNG path, media type, width, and height. Every occurrence without a PNG remains listed under `unavailable` with a bounded reason such as `source-pdf-missing` or `preview-render-failed`.

Each PNG uses the existing Object Lens context crop and draws the exact rectangle, ellipse, or polygon above the source image. The option is explicit and remains browser view state; it is not saved in the Object-Centric Drawing project.

## Planned flow

```text
objdraw-project-v5
  -> explicit subject selection
  -> objdraw-object-evidence-v2
  -> optional reviewed interpretation
  -> target adapter
  -> Joinery Configurator, CDI, or another consumer
```

R0 provides the pure package builder and validator. R1 adds the selected-object Export Set control and optional companion assets. Group AE replaces the earlier governed observation model with straightforward object and occurrence notes. AI interpretation and target-adapter fields remain outside these groups.

## T1 Joinery AI handoff

The separate `objdraw-joinery-ai-handoff-v1` ZIP reuses one selected subject's validated evidence manifest and adds clean crops, marked crops, a combined contact sheet, and the current Joinery Configurator photo-to-JSON prompt/schema. It is a user-controlled handoff to Copilot or another external AI, not a field-mapping adapter and not an AI result stored in Object-Centric Drawing.

See [JOINERY-AI-HANDOFF.md](JOINERY-AI-HANDOFF.md) for the package layout, eligibility, prompt-synchronization rule, and validation boundary.
