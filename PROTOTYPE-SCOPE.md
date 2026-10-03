# OBD Prototype Scope

## Goal

Test object-centred navigation with one real architectural PDF and a few manually linked Doors.

## Required workflow

1. Open a local PDF.
2. Move between pages.
3. Draw a rectangular occurrence over visible content.
4. Create a new object or link to an existing object.
5. Select an occurrence and see the shared object.
6. List and jump to every occurrence of that object.
7. Edit or remove an incorrect occurrence.
8. Export and reload the object layer as JSON.

## First acceptance test

Create at least five Door objects with occurrences across more than one drawing type. Close and reopen the prototype. Reload the JSON and confirm that every occurrence still points to the intended Door.

The experiment succeeds when object navigation is clearly more useful than manually searching the same pages.

## Acceptance status

The 2026-09-29 five-Door runtime test passed the technical export/reload/import workflow and drove three interaction fixes. Its source was a real architectural modelling guide, not a coordinated project drawing set, so the usability hypothesis remains open. See [ACCEPTANCE-2026-09-29.md](ACCEPTANCE-2026-09-29.md).

## Not in the first prototype

- OCR or automatic object detection.
- Automatic identity matching.
- Multi-user collaboration.
- PDF editing or embedded PDF annotations.
- BIM or Revit synchronization.
- Drawing revision comparison.
- Construction knowledge graphs or CDI integration.
- A complete property schema for every object type.

## Likely technical direction

- Local browser application.
- PDF rendering through PDF.js or an equivalent browser-capable renderer.
- SVG or canvas overlay for occurrence rectangles.
- JSON sidecar for portable object data.
- Normalized page coordinates so links survive different display sizes.

The technical stack remains a prototype choice, not a permanent platform commitment.
