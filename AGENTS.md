# Object-Centric Drawing Agent Handoff

## Product boundary

Object-Centric Drawing is a standalone browser prototype for object-centric navigation across architectural PDF drawing sets.

The PDF is a source document. Drawn shapes are visual occurrences. They become part of a shared building object only through an explicit create/link action; matching labels never imply identity.

Do not add OCR, automatic identity matching, BIM/Revit synchronization, revision comparison, collaboration, or CDI integration during the first prototype.

The one-way Revit export adapter in `revit-addin/` is allowed (see `DECISIONS.md`, 2026-10-06). It writes a standard project file and keeps Revit IDs in a separate adapter file. It never writes back to Revit.

## Current status

- [x] Group A — local PDF rendering, page/zoom controls, normalized rectangle drawing, selection, and repositioning.
- [x] Group B — explicit Door objects, link occurrences, object/occurrence navigation, edit and delete.
- [x] Group C — versioned JSON sidecar export/import, validation, PDF fingerprint, wrong-document warning.
- [x] Group D — five-Door real-source test, accessibility/error polish, and recorded acceptance observations.
- [x] Group E — responsive toolbar and side-panel layout with no horizontal overflow from 320 px upward.
- [x] Group F — page/zoom navigation, mouse and keyboard shortcuts, and discoverable shortcut help.
- [x] Group G — bounded undo/redo history for object and occurrence mutations.
- [x] Group H — placed-rectangle, Door-card, and occurrence-list visual polish.
- [x] Group I — object-layer save state, guarded replacement, and pre-PDF creation gating.
- [x] Group J — persistent marking retry, zoom guidance, and visible cancel state.
- [x] Group K — deletion focus recovery, shortcut metadata, and selection/history announcements.
- [x] Group L — pointer-centered wheel zoom, canvas panning, deliberate wheel page navigation, Fit Width, and 100% view controls.
- [x] Group M — multi-document `obd-project-v2` contract, v1 migration, retained occurrence document identity, and typed geometry validation.
- [x] Group N — multi-PDF attachment, switching, relinking, cross-document occurrence navigation, and missing-file recovery.
- [x] Group O — rectangle, ellipse, and polygon marking with corner resize, polygon vertex editing, history, and portable persistence.
- [x] Group P — Object Lens with cropped cross-PDF occurrence previews, coverage summary, missing-source state, and direct navigation.
- [x] Group Q — Drawing Set Map with expandable PDF groups, page density, selected-Door coverage, missing-source state, and exact page navigation.
- [x] Group R0 — portable Object Evidence Package contract, physical-instance/configuration separation, explicit relationships, and fail-closed validation.
- [x] Group R1 — user-facing Export Set with validated JSON manifests, optional marked PNG previews, portable ZIP packaging, and missing-source accounting.
- [x] Group R2 — source-linked observations, review states, assumptions, and unresolved conflicts.
- [x] Group R3 — sorted large-format Representation Board, exact marked-page navigation, and compact brand/action polish.
- [x] Group R4 — category-neutral objects, searchable grouped physical-model catalogue, and lossless v1/v2/v3-to-v4 migration.
- [ ] Group S — deferred; AI-assisted interpretation is outside the current PDF-object proof.
- [x] Group T1 — Joinery AI Handoff Pack with complete selected-object evidence, clean/marked representations, contact sheet, and an explicit Configurator prompt reference.
- [x] Group T2 — closed without Object-Centric Drawing implementation; AI-result validation remains owned by Joinery Configurator.
- [ ] Group T3 — deferred; direct AI connection is not part of the current PDF-object proof.
- [ ] Group U — deferred until a concrete CDI exchange workflow is selected.
- [ ] Group V — deferred until the core PDF-object workflow is proven on a coordinated drawing set.
- [x] Cleanup A — on-demand Drawing Set Map, one Representation Board gallery, consolidated object exports, and pruned speculative roadmap.
- [x] Cleanup B — optional collapsed Evidence notes preserving governed v4 data without occupying the primary object workflow.
- [x] Cleanup C — representation SVG, thumbnail, evidence-preview, and Joinery contact-sheet rendering extracted from the application controller without changing behavior or data contracts.
- [x] Group W — PDF.js selectable text layer with standard copy selection, render cancellation, zoom alignment, and explicit marking-mode priority; OCR remains out of scope.
- [x] Group X — active-PDF text search with `Ctrl+F`, session-only page indexing, exact result navigation, visible-page highlights, and no OCR or drawing-set index.
- [x] Group Y — continuous pointer-anchored wheel zoom with immediate whole-page preview and one debounced high-quality PDF render.
- [x] Group Z — calmer reader-first visual hierarchy with a compact brand bar, grouped controls, quiet canvas, and lighter object rail.
- [x] Group AA — split side panel: object browser grouped by category over a properties pane, a draggable splitter, object search, per-category drawing visibility, and dim/isolate focus for the selected object. View-only; nothing is saved.
- [x] Group AB — view options: group by category / page / none, natural label order, this-page-only filter, labels on marks (L), hide all marks (H), step through an object's places ([ ]), back/forward through jumps (Alt + arrows), object search (/), fit width (W), and Esc to clear the selection. Viewer preferences are remembered per browser.
- [x] Group AC — view rotation (R / Shift+R, per PDF, saved geometry never rotates) and a lazily rendered page thumbnail strip (T) with mark counts, current page, and pages holding the selected object. The toolbar wraps by its own width.
- [ ] Revit verification — build the add-in, run the export dialog and the Outline shape on a real sheet, and check multi-sheet page order. Built but not run; checklist in `revit-addin/README.md`.
- [ ] Later, when needed — toolbar back/forward buttons, a level filter in the Revit export, and using `.objdraw-revit.json` IDs in the app.
- [x] Public hosting — GitHub Pages deploys the static app from `main` after source checks and tests pass.

## File map

| File | Role |
|---|---|
| `index.html` | Application structure and controls. |
| `styles.css` | Object-Centric Drawing visual system and responsive layout. |
| `app.js` | PDF session, rendering, interaction state, and object/occurrence UI. |
| `geometry.mjs` | Pure normalized-coordinate helpers. |
| `object-model.mjs` | Pure category-neutral object identity, link, edit, and delete operations. |
| `display-filter.mjs` | Pure view-only browser grouping, search, and mark visibility rules. Never touches project data. |
| `category-catalog.mjs` | Stable grouped Object-Centric Drawing physical-model category catalogue and search helpers. |
| `navigation.mjs` | Pure shortcut mapping, bounded zoom-step, and list-focus recovery rules. |
| `project-documents.mjs` | Pure fingerprint matching, document occurrence counts, removal guards, and cross-document target selection. |
| `object-lens.mjs` | Pure Object Lens coverage summaries, deterministic representation ordering, and normalized thumbnail-context framing. |
| `representation-rendering.mjs` | Browser-only SVG, thumbnail, evidence-preview, and Joinery contact-sheet rendering shared by the canvas, Representation Board, and export flows. |
| `pdf-text-layer.mjs` | Small lifecycle wrapper around the pinned PDF.js `TextLayer`, including replacement-render cancellation, stale-span cleanup, and the PDF.js-style selection boundary. |
| `pdf-search.mjs` | Pure page-text indexing, case-insensitive match mapping back to PDF.js text divs, and wrapped result navigation. |
| `drawing-map.mjs` | Pure drawing-set page grouping, occurrence-density, object-coverage, and summary helpers. |
| `object-evidence-package.mjs` | Pure portable evidence-package selection, physical-instance/configuration relationships, cloning, and validation. |
| `evidence-model.mjs` | Pure governed observation creation, review transitions, removal, conflict derivation, and summaries. |
| `evidence-export.mjs` | Pure evidence filename and companion preview-asset index helpers. |
| `joinery-ai-handoff.mjs` | Pure Joinery AI eligibility, handoff index, provenance, and AI instruction builder. |
| `zip-store.mjs` | Minimal dependency-free stored-ZIP writer for portable evidence bundles. |
| `history.mjs` | Bounded snapshot history for object-layer undo and redo. |
| `session-state.mjs` | Pure object-layer signature and saved-baseline tracking. |
| `sidecar.mjs` | Versioned sidecar creation, validation, fingerprint comparison, and runtime conversion. |
| `tests/geometry.test.mjs` | Node tests for coordinate and movement rules. |
| `tests/object-model.test.mjs` | Node tests for object identity and occurrence lifecycle rules. |
| `tests/category-catalog.test.mjs` | Node tests for catalogue breadth, stable keys, and grouped search. |
| `tests/navigation.test.mjs` | Node tests for page, zoom, mark, help, input-safety, and deletion-focus rules. |
| `tests/project-documents.test.mjs` | Node tests for attachment matching, removal guards, and cross-document navigation preference. |
| `tests/object-lens.test.mjs` | Node tests for Object Lens coverage and page-bounded context framing. |
| `tests/pdf-text-layer.test.mjs` | Node tests for PDF.js text-stream wiring, replacement cancellation, and cleanup. |
| `tests/pdf-search.test.mjs` | Node tests for multi-page extraction, cross-span phrases, ordered matches, progress, and result wrapping. |
| `tests/drawing-map.test.mjs` | Node tests for page grouping, density levels, selected-object coverage, and source summaries. |
| `tests/object-evidence-package.test.mjs` | Node tests for explicit export selection, identity separation, configuration links, and fail-closed source validation. |
| `tests/evidence-model.test.mjs` | Node tests for source requirements, immutable content, review transitions, removal, and conflict derivation. |
| `tests/evidence-export.test.mjs` | Node tests for safe export names and included/unavailable asset accounting. |
| `tests/joinery-ai-handoff.test.mjs` | Node tests for eligibility, exact provenance, fail-closed packaging, instructions, and prompt drift. |
| `tests/zip-store.test.mjs` | Node tests for CRC-32, stored-ZIP structure, and safe archive paths. |
| `tests/history.test.mjs` | Node tests for snapshot restoration, redo invalidation, bounds comparison, and history limits. |
| `tests/session-state.test.mjs` | Node tests for dirty detection, selection exclusion, and saved-baseline restoration. |
| `tests/sidecar.test.mjs` | Node tests for hashing, schema validation, and wrong-document protection. |
| `vendor/pdfjs/` | Pinned Mozilla PDF.js `6.3.289` runtime. |
| `serve.py` | Loopback-only static server with explicit JavaScript-module MIME types. |
| `start-server.cmd` | Local HTTP launcher on port `8765`. |
| `DATA-MODEL.md` | Intended object-layer contract. |
| `OBJECT-EVIDENCE-PACKAGE.md` | Portable `objdraw-object-evidence-v1` contract and ecosystem adapter boundary. |
| `JOINERY-AI-HANDOFF.md` | Joinery AI bundle layout, use flow, prompt-version, and trust boundary. |
| `DECISIONS.md` | Durable product and architecture decisions. |
| `ACCEPTANCE-2026-09-29.md` | Runtime five-Door evidence, fixes, limitations, and remaining proof. |

## Runtime conventions

- Serve the folder over HTTP. Do not rely on `file://` for ES modules or the PDF worker.
- Use `serve.py` or `start-server.cmd`; the MIME override is required on Windows systems that otherwise serve `.mjs` as plain text.
- Script entry is `app.js` as one `type="module"` tag at the end of `index.html`.
- `app.js` imports `geometry.mjs` and the pinned `vendor/pdfjs/pdf.mjs` display layer.
- `representation-rendering.mjs` owns browser SVG/canvas preview rendering; it receives exact occurrences and PDF sessions but does not own or mutate project state.
- The current rendered page includes a transient PDF.js text layer between the canvas and occurrence SVG. It uses only embedded PDF text; OCR is intentionally excluded.
- Keep the PDF.js-style `.endOfContent` selection boundary, pointer lifecycle, and `selectionchange` relocation when changing the text-layer wrapper; affected Chromium versions otherwise produce fragmented drag selections across absolutely positioned PDF text spans.
- The PDF worker path is `vendor/pdfjs/pdf.worker.mjs`.
- Coordinates are normalized from `0` to `1` against rendered page width and height.
- Rendering scale must never mutate occurrence bounds.
- Object IDs are immutable session identity. Labels and categories are editable evidence and may be duplicated.
- New objects use `object-*`; imported `door-*` identities remain valid and are never rewritten during migration.
- A visible mark is not identity. Marks remain unlinked until an explicit create/link action.
- “Mark another occurrence” is an explicit link intent and may assign the selected object automatically.
- Deleting an object preserves its shapes as unlinked occurrences. Deleting an occurrence does not delete its object. Either deletion is blocked while governed evidence references its target.
- New project files use `objdraw-project-v4`; legacy `obd-object-layer-v1`, `obd-project-v2`, `obd-project-v3`, and `obd-project-v4` files migrate in memory and remain importable.
- Categories use stable neutral Object-Centric Drawing keys from `category-catalog.mjs`; familiar Revit-style grouping does not make Autodesk API identifiers part of the contract.
- A project has a non-empty `documents[]` manifest and one valid `activeDocumentId`. Duplicate document IDs and exact duplicate fingerprints are rejected.
- Every occurrence retains `documentId` at runtime and must reference a page within that document's own page count.
- Persisted occurrence geometry is typed. Rectangle and ellipse use normalized bounds; polygon uses three or more normalized points enclosing a non-zero area.
- Match project documents by SHA-256, file size, and page count. Filename changes alone do not cause rejection.
- Project JSON can be imported before its PDFs. Missing files remain visible and can be batch-matched or explicitly relinked by fingerprint.
- Local PDF sessions and per-document page/zoom/scroll views stay in memory; they are not persisted project content.
- Switching the active document is view state: it neither enters undo history nor makes the saved project dirty.
- Detaching a PDF preserves its manifest entry and all evidence. Removing a document is disabled while occurrences reference it.
- A failed validation or fingerprint comparison must not mutate the active object layer.
- Direct page entry must work with Enter as well as change/blur.
- SVG occurrence shapes are keyboard-focusable; Enter or Space selects the occurrence and its Door.
- The desktop object panel uses a `320px`–`380px` responsive rail; below `900px` it stacks beneath the drawing workspace.
- The toolbar, optional search row, drawing viewer, and compact status bar use explicit workspace grid rows so hiding search never moves the status bar into the flexible viewer row.
- Toolbar groups may wrap into deliberate rows, but neither the toolbar nor object panel may create page-level horizontal overflow.
- `PageUp`/`PageDown` and `Home`/`End` navigate pages; `+`/`-` zoom; `0` or `F` fits; `M` toggles marking; `?` opens shortcut help.
- App shortcuts must not run while focus is inside an input, select, button, link, summary, or editable field.
- Every newly attached or relinked PDF opens on page 1 in Fit Page mode, regardless of an earlier transient view for that local attachment.
- A plain mouse wheel keeps native workspace scrolling; `Ctrl`/`Command` + wheel zooms around the pointer across the drawing workspace.
- Wheel zoom magnitude follows the input delta. Canvas, text, and occurrence geometry preview together immediately; one exact PDF.js render replaces the preview after the gesture settles.
- Wheel input outside the rendered page remains native. `Shift` + wheel pans horizontally, while debounced `Alt` + wheel changes pages.
- `Space` + primary-button drag or middle-button drag pans the drawing without changing occurrence geometry.
- Fit Page and Fit Width recalculate after workspace resize; 100% and stepped zoom are explicit custom scales.
- Page navigation and zoom are view state, not object-layer mutations, and must stay outside future undo/redo history.
- Text selection and copying are ordinary browser view behavior. The text layer is rebuilt on page or scale changes, never enters project state, and is cancelled when a replacement render begins.
- Outside Mark mode, the occurrence SVG root does not block selectable text; individual occurrence shapes and edit handles remain interactive. Mark mode disables text selection and gives the SVG the full page pointer surface.
- `Ctrl`/`Command` + `F` opens a temporary search row for the active attached PDF. Enter and Shift+Enter move through results, and Escape closes search before cancelling other canvas actions.
- Search extracts embedded text on demand once per attached PDF session. Its index, query, result position, and highlights are view-only memory state; switching PDFs closes search and no search content enters project JSON or browser storage.
- Search highlights map matches back to the current PDF.js text divs. All current-page matches are visible, the active match is distinct, and navigating a result uses the existing exact page-render path.
- Shape states remain semantic: orange is a linked/object-active occurrence, blue is the selected occurrence, and a neutral dashed shape is unlinked.
- Every selected shape exposes four interactive corner resize handles. Polygon selections additionally expose draggable vertex handles.
- Door cards expose label, immutable identity, and readable occurrence count. Occurrence rows expose session index, page, immutable identity, and linked state.
- Object-layer history keeps at most 100 snapshots and covers occurrence create/move/resize/vertex-edit/delete, Door create/rename/delete, and explicit linking.
- Selection is stored only as restoration context; page, zoom, and marking mode remain outside undo/redo history.
- Adding or removing a manifest document and successfully importing a project start fresh object history. Reattaching or detaching a local file does not alter project history.
- No-op occurrence moves and unchanged Door names must not create history entries.
- Door creation stays disabled until a PDF is open.
- The save indicator compares document, object, and occurrence content with the last open, export, or successful import baseline; view and selection changes do not make it dirty.
- Adding PDFs preserves the current object layer. Importing a project requires confirmation when it would replace unsaved project changes.
- A failed PDF add or relink preserves the current project, attachments, history, and save baseline.
- Marking mode displays a non-interactive drawing-area guide and changes the toolbar action to `Marking…`; `M` or `Escape` cancels it. The shape selector chooses rectangle, ellipse, or polygon without changing object identity.
- A rectangle or ellipse drag smaller than `7px` in either dimension creates no occurrence and keeps marking active for an immediate retry.
- Polygon marking adds a vertex per click and finishes by double-click, Enter, or clicking the first vertex; Escape cancels without history.
- Successful occurrence creation exits marking mode. The retry message may recommend zoom, but zoom remains explicit user-controlled view state.
- After deleting an occurrence, focus moves to the nearest surviving occurrence in that list, then to the selected Door action or Door-label field when the list is empty.
- After deleting a Door, focus moves to its first preserved unlinked occurrence workflow or the nearest surviving Door card.
- Cross-page Door/occurrence navigation and undo/redo report the resulting page and object-layer counts through the existing polite live status.
- Visible keyboard actions expose `aria-keyshortcuts`; occurrence shapes expose Enter and Space activation metadata.
- Object Lens is a compact read-only summary of the governed object layer; it never persists thumbnails or inferred identity.
- Each selected object summarizes its linked representation, PDF, page, and missing-source counts. `Show all` opens the only representation gallery rather than duplicating thumbnails in the narrow rail.
- Representation Board renders attached PDFs into in-memory, page-bounded previews with the exact rectangle, ellipse, or polygon overlay. Missing PDFs remain visible and recoverable.
- Representation Board sorts by project PDF order, page, and occurrence identity without persisting a second view model.
- Activating a Representation Board card closes the board and uses exact occurrence navigation, so the referenced PDF/page opens with the occurrence selected and marked. Missing PDFs retain their card and enter the existing relink state.
- The application brand is the plain `Object-Centric Drawing` title. Primary object actions use short visible verbs with fuller accessible labels and tooltips.
- Drawing Set Map is an on-demand dialog and read-only projection of the governed document and occurrence model. It does not infer object identity or persist map state.
- Map groups expose every document page, occurrence density, current-page state, selected-Door coverage, and attached or missing source state. Activating a page uses its exact document and page identity.
- Expanded drawing-map groups are view-only browser state and do not enter history or make the project dirty.
- `objdraw-project-v4` remains Object-Centric Drawing's editable project source of truth; `objdraw-object-evidence-v1` is a selected, target-neutral export package rather than a replacement project format.
- Current Object-Centric Drawing objects are physical instances. Reusable configurations remain separate and connect only through an explicit `instanceOf` relationship; duplicate labels never imply that relationship.
- Evidence packages retain exact source document fingerprints, page identities, and typed geometry, include only referenced documents, and fail closed on unknown or unrepresented subjects.
- Joinery Configurator and CDI remain downstream adapters. Target-specific fields, AI drafts, and adapter output do not silently enter the neutral project or evidence contract.
- Joinery AI handoff is available only for `doors` and `windows`, requires at least one successfully rendered local representation, and maps those categories only to target opening modes `door` and `window`.
- A Joinery handoff always includes the neutral manifest, exact occurrence/document/page mappings, clean and marked crops, one marked contact sheet, and an explicit reference to the separately maintained target prompt/schema.
- `JoineryConfigurator_Photo_to_JSON_Prompt.md` is authoritative in the Joinery Configurator repository. Object-Centric Drawing must not duplicate or silently synchronize it.
- Handoff export is read-only. It never calls AI, infers Joinery fields, changes project content, enters history, marks the project saved, or stores the downstream response.
- The selected object's compact Export menu keeps target-neutral JSON, preview ZIP, and eligible adapter packs together without making adapters part of the main workflow.
- Evidence JSON is available only for a selected object with linked source occurrences and downloads one validated `.objdraw-evidence.json` manifest.
- Evidence ZIP downloads a stored `.objdraw-evidence.zip` containing `manifest.objdraw-evidence.json`, `assets.json`, and `previews/<occurrence-id>.png` for each attached source that renders successfully.
- Exported previews use the same page-bounded Object Lens framing and add the exact rectangle, ellipse, or polygon mark. Missing or failed sources remain listed in the asset index rather than being hidden.
- Evidence export is a read-only projection. It does not mark the project saved, enter undo history, persist its preview option, or change attachment/view state.
- Governed evidence belongs to one exact Door. An `observation` requires one of that Door's exact occurrences; an `assumption` may instead apply to the whole Door.
- Evidence content and source are immutable after creation. Review state may move among `unreviewed`, `needs-confirmation`, `confirmed`, and `rejected`; explicit removal and review changes are undoable project mutations.
- Conflicts are derived when non-rejected entries for one Door share a normalized topic but disagree on value. Rejected entries remain traceable and do not contribute to conflicts.
- Evidence notes are optional and collapsed by default for each newly selected object. The full source/review controls remain available only inside that disclosure, and switching objects closes it.
- Cleanup B changes presentation only: existing v4 observations, conflict derivation, deletion guards, history, evidence-package output, and legacy migrations remain lossless.
- Source PDFs and object data must not be committed unless the user explicitly approves them.

## Storage keys

None. Runtime state stays in memory; persistence is an explicit user-controlled JSON sidecar.

Do not introduce an ad-hoc localStorage contract. The exported file is the portable source of truth.

## Visual conventions

- Use the CSS variables in `:root`.
- Do not add hardcoded hex colors.
- Preserve the orange occurrence / blue selection distinction.
- Keep the drawing as the dominant surface. The side panel explains and lists; it must not become the product.
- Prefer quiet flat surfaces and subtle grouping over decorative patterns, heavy shadows, or motion; reserve orange and blue for actions and semantic state.

## Verification

Run:

```text
node --test tests/*.test.mjs
```

Then run `start-server.cmd` and check:

1. A local PDF opens and renders.
2. Page navigation and direct page entry work.
3. Fit, zoom in, and zoom out render cleanly.
4. A rectangle can be drawn in any drag direction.
5. The rectangle remains aligned after zoom and fit.
6. The rectangle can be selected and repositioned without leaving the page.
7. Adding another PDF preserves the in-memory object layer and adds a distinct manifest document.
8. Two Doors can have the same label while retaining distinct IDs.
9. A mark can be linked to an existing Door and appears in its occurrence list.
10. Selecting an occurrence navigates to its page and highlights it.
11. Renaming a Door preserves its ID and occurrence links.
12. Deleting a Door leaves its former occurrences in the unlinked list.
13. Deleting one occurrence does not delete its Door or sibling occurrences.
14. Export produces valid `objdraw-project-v4` JSON with categorized objects, `documents[]`, `activeDocumentId`, typed geometry, and governed observations.
15. Import of a matching v4 project or migrated v1/v2/v3 file restores all IDs, categories, labels, document links, pages, bounds, and available evidence.
16. Import of malformed JSON or an invalid model is rejected without changing the session.
17. Relinking with a different or revised PDF shows a warning and leaves the project document unattached.
18. Typing a valid page number and pressing Enter navigates directly to that page.
19. Selecting a Door with an occurrence on another page updates both the canvas and selected-Door panel.
20. Tabbing to an occurrence rectangle exposes visible focus; Enter or Space selects it.
21. At `1280×720` and `1024×768`, the right panel has no horizontal scrollbar and no clipped form actions.
22. At `900px` and below, the object panel stacks beneath the drawing workspace without page-level horizontal overflow.
23. At `560px` and `320px`, toolbar groups remain usable without clipped controls or horizontal scrolling.
24. `PageUp`, `PageDown`, `Home`, and `End` navigate within PDF page bounds.
25. `+`, `-`, `0`, and `F` update zoom or Fit without mutating occurrence coordinates.
26. A plain wheel over the PDF scrolls the drawing workspace without changing scale; `Ctrl`/`Command` + wheel zooms around the pointer without triggering browser-page zoom.
27. Navigation shortcuts do not fire while typing in form controls.
28. `M` toggles marking, while `Escape` closes help or cancels the active marking/move action.
29. Shortcut help opens from the `?` control or key, closes by button/outside click/Escape, and remains within compact viewports.
30. Undo and redo restore complete object/occurrence snapshots for create, move, link, rename, and delete actions.
31. A new object-layer mutation after undo clears the redo stack, and history remains bounded to 100 snapshots.
32. Adding or removing a manifest document or successfully importing a project clears prior undo/redo history.
33. `Ctrl`/`Command` + `Z`, `Ctrl`/`Command` + `Shift` + `Z`, and `Ctrl`/`Command` + `Y` map to undo/redo while native text-field undo remains untouched.
34. Linked, selected, object-active, and unlinked rectangles remain visually distinct over light drawing content.
35. Door cards and occurrence rows show their label/page, immutable identity, count or link state without clipping.
36. At 320 px, the selected-Door actions stack and the occurrence list remains readable without panel-level horizontal overflow.
37. Door creation controls remain disabled until a PDF opens successfully.
38. Create, move, link, rename, and delete operations show `Unsaved changes`; export and successful import return the indicator to `Saved`.
39. Undoing exactly back to the saved baseline clears the dirty indicator without exporting again.
40. Cancelling a project import preserves the current project; a failed PDF add or relink does the same.
41. Entering marking mode shows the drawing-area guide and an explicit Escape hint without blocking the PDF.
42. An undersized drag creates no history entry or occurrence, reports retry/zoom guidance, and leaves the original mark target active.
43. A valid retry creates exactly one occurrence and exits marking mode; `Escape` exits without creating one.
44. Deleting a middle, last, or only occurrence leaves keyboard focus on the nearest useful surviving control.
45. Deleting a Door focuses the unlinked-occurrence workflow when evidence was preserved, or the nearest remaining Door when none was linked.
46. Cross-page Door and occurrence selection announces the chosen identity and destination page after rendering completes.
47. Undo/redo announces its action and resulting Door/occurrence counts, while canvas focus is restored when the selected rectangle still exists on the page.
48. Page, fit, history, marking, help, and rectangle-activation controls expose their supported shortcuts through `aria-keyshortcuts`.
49. `Space` + drag and middle-button drag pan both axes without moving selected occurrences.
50. `Shift` + wheel pans horizontally, while thresholded `Alt` + wheel changes exactly one page per deliberate gesture.
51. Fit Width, Fit Page, and 100% render cleanly and show the resulting scale in the toolbar.
52. V1 migration produces a valid single-document v4 project without changing object or occurrence IDs; v1 and v2 migration initialize an empty observation collection.
53. Multi-document validation accepts one Door across PDFs and rejects duplicate fingerprints, missing document references, and per-document page overflow.
54. Importing a valid multi-document project restores all evidence before PDFs are attached and reports every missing source.
55. Batch-added PDFs match imported manifest entries by fingerprint; renamed identical files are accepted and duplicates are not added twice.
56. Switching documents restores each PDF's page, zoom mode, and scroll position for the current browser session.
57. Selecting an occurrence on another PDF activates its document and page, or shows a relink state without losing selection when that PDF is missing.
58. Detaching preserves project data, while removing a document is disabled until all of its occurrences are deleted.
59. Rectangle and ellipse tools create visibly distinct normalized shapes that remain aligned through zoom, fit, page changes, and PDF switching.
60. Dragging a selected shape's corner resizes it without leaving the page; undo and redo restore the exact prior geometry.
61. Polygon clicks create vertices, double-click or Enter finishes, and Escape cancels without adding an occurrence or history entry.
62. Polygon vertices can be dragged while preserving a non-zero enclosed area; bounding-corner resize scales all vertices.
63. Export/import round-trips rectangle, ellipse, and polygon geometry without changing IDs, document links, pages, bounds, or vertices.
64. Selecting an object shows a compact Object Lens summary with representation, PDF, page, and missing-source counts without rendering duplicate rail thumbnails.
65. `Show all` renders each attached occurrence in the Representation Board with page context and its exact rectangle, ellipse, or polygon overlaid.
66. Representation cards identify source PDF, page, occurrence ID, and shape type; activating a card navigates through the existing cross-document occurrence flow.
67. Missing source PDFs retain visible Representation Board cards and navigate to the existing relink state without dropping object selection.
68. Opening, closing, sorting, and rendering the Representation Board do not persist thumbnail data or alter project history.
69. Drawing Set Map summarizes the exact number of project PDFs, pages, occurrences, and missing local sources.
70. Every manifest page appears under its PDF group, and occurrence density changes visibly without hiding empty pages.
71. Selecting a Door highlights every map page containing one of its explicitly linked occurrences across documents.
72. The active page is distinct from selected-Door coverage; activating a tile navigates to that exact document/page or preserves selection while showing the existing relink state.
73. Expanding map groups, changing pages, and selecting Doors do not alter persisted project content, object history, or the saved baseline.
74. An evidence package exports only explicitly selected physical subjects, their occurrences, and the documents those occurrences reference.
75. Two physical subjects with the same label remain distinct and acquire no implicit configuration relationship.
76. A configuration enters the package only through an explicit, category-compatible `instanceOf` relationship.
77. Unknown or unrepresented subjects, invalid relationship targets, invalid pages, and invalid geometry fail closed.
78. Creating or validating an evidence package does not change `objdraw-project-v4`, local PDF attachment state, browser storage, or object history.
79. Selecting an object with linked representations enables its compact Export menu options; an object without representations cannot be exported.
80. Evidence JSON produces a valid `objdraw-object-evidence-v1` document containing only the selected physical subject and its referenced evidence.
81. Evidence ZIP produces a readable archive containing the identical manifest, one asset index, and one PNG per successfully rendered attached occurrence.
82. Rectangle, ellipse, and polygon preview assets retain page context and show the exact selected evidence geometry.
83. Missing PDFs and render failures remain explicit in `assets.json` without blocking export of the manifest or other previews.
84. Evidence export leaves project dirty state, undo/redo history, current document/page, selection, and attachments unchanged.
85. Creating an `observation` requires an exact linked occurrence, while an `assumption` can be created for the whole selected Door.
86. Adding, reviewing, rejecting, or explicitly removing evidence updates saved state and can be undone and redone without changing immutable entry content.
87. Different active values under the same normalized topic show an unresolved conflict; rejecting one conflicting entry removes it from the derived conflict without deleting it.
88. Door and occurrence deletion are blocked while governed evidence references them, preventing silent provenance loss.
89. V1 and v2 files migrate to valid v4 projects with empty observations, while v3 migration preserves every evidence ID, source, state, and timestamp.
90. A selected-subject evidence package contains only that subject's governed evidence and translates project `objectId` to package `subjectId` without changing source occurrence identity.
91. The Evidence & review controls stack without horizontal overflow in the compact object panel.
92. A selected object with representations enables `Show all` and opens a large Representation Board containing every linked occurrence.
93. Representation Board cards are ordered by project PDF order, then page, then occurrence identity, independently of creation order.
94. Activating a board card closes the board, opens its exact PDF/page, and selects the marked occurrence.
95. Missing source PDFs remain visible in the board and route to the existing relink state without dropping object selection.
96. The `Object-Centric Drawing` header and short Mark, Delete, Export, and Create actions remain legible without horizontal clipping at supported widths.
97. The creation form searches a grouped catalogue of at least 70 stable physical-model categories and preserves category selection when possible.
98. New objects receive neutral `object-*` identities while legacy `door-*` identities remain valid after import.
99. Changing an object's category or label preserves its identity, occurrences, and governed evidence links.
100. Duplicate labels remain separate identities even when the objects use the same category.
101. V1, v2, and v3 projects migrate to v4 with legacy Doors assigned `category: "doors"` and no ID rewriting.
102. Object lists, marking guidance, evidence review, export, and status announcements use category-neutral language.
103. A Door or Window with at least one linked representation enables `AI pack`; other categories remain explicitly unsupported without acquiring guessed Joinery meaning.
104. The Joinery AI ZIP contains `AI-HANDOFF.md`, `handoff.json`, the validated Object-Centric Drawing manifest, clean and marked images, and a combined contact sheet; the index references the separate Configurator prompt authority.
105. Every image in the handoff index retains exact occurrence, document, page, and subject provenance; every unavailable occurrence retains a bounded reason.
106. The handoff instructions tell an external AI that all representations describe one physical object and request exactly one raw Configurator JSON object.
107. A handoff fails closed when no representation renders, while partially missing sources remain explicit without blocking available evidence.
108. The handoff names the expected Configurator prompt file, records that it is not bundled, and identifies the Joinery Configurator repository as its authority.
109. Creating a Joinery AI pack leaves project data, saved state, history, attachments, view state, and source PDFs unchanged.
110. The narrow object rail contains no representation thumbnails or permanent Drawing Set Map; both open in their dedicated dialogs.
111. The Drawing Set Map dialog closes after exact page navigation and remains usable without changing project state.
112. The compact Export menu exposes Evidence JSON, Evidence ZIP, and the eligible Joinery AI pack without duplicating export controls.
113. Linked occurrences remain deletable from the Representation Board after removal of the inline gallery, subject to the existing evidence-provenance guard.
114. Evidence notes occupy one collapsed summary row by default and do not expose the advanced form until the user opens it.
115. Switching selected objects closes Evidence notes and updates its compact saved/conflict count for the new object.
116. Existing v4 observations remain editable, reviewable, exportable, and losslessly round-trippable without a schema migration.
117. Canvas occurrences, Representation Board thumbnails, evidence previews, and Joinery contact sheets render through `representation-rendering.mjs` without changing geometry, source identity, or project state.
118. Cleanup C introduces no storage key, schema, UI, or interaction change; the single `app.js` module entry continues to load the extracted renderer transitively.
119. A digitally generated PDF page exposes aligned selectable text that can be copied with standard browser commands at Fit, Fit Width, 100%, and stepped zoom levels.
120. Page changes, PDF switches, and rapid replacement renders cancel and clear the prior text layer so stale spans never remain over the drawing.
121. Normal text selection does not create, move, resize, select, or persist an occurrence; existing shapes and their handles remain directly interactive.
122. Entering Mark mode disables text selection and restores the full-page rectangle, ellipse, or polygon marking surface; leaving Mark mode restores selectable text.
123. `Ctrl`/`Command` + `F` and the compact Find button open the active-PDF search field without invoking browser-page search.
124. Typing a query indexes embedded text once for the attached PDF session, reports progress, and returns results in page and reading order.
125. Enter, Shift+Enter, and previous/next controls wrap through results and navigate to each exact page while showing the current position and total count.
126. All matches on the rendered page are highlighted through the PDF.js text spans, with the active result visually distinct and scrolled into view.
127. Clearing or closing search removes highlights; switching, detaching, or losing the active PDF closes search without changing project data, history, saved state, or attachments.
128. A PDF without embedded matching text reports `No matches`; no OCR, drawing-set-wide index, localStorage entry, or project-schema field is introduced.
129. Small trackpad or wheel deltas produce proportionally small zoom changes, while large deltas remain clamped to the supported scale range.
130. A wheel gesture previews every scale change immediately but performs only one exact PDF.js render after input settles.
131. The pointer remains anchored to the same normalized page position through preview and exact render, with canvas, selectable text, search highlights, and occurrence geometry scaling together.
132. Page/document navigation, Fit, Fit Width, 100%, and document loss cancel any pending zoom preview cleanly without changing project data, history, or the saved baseline.
133. The drawing workspace uses a quiet neutral field rather than a high-contrast pattern, keeping PDF content visually dominant.
134. The brand and toolbar occupy less vertical space while every existing page, zoom, history, marking, search, map, and help control remains available.
135. Related page, zoom, and history controls read as compact groups without adding horizontal overflow at 320, 560, 900, 1024, or 1280 px.
136. Object-rail guidance, lists, and the selected-object panel use lighter borders and shadows while preserving orange action and blue selection semantics.

## Prototype acceptance

The 2026-09-29 runtime test restored five Doors and six occurrences across pages 60 and 61. See `ACCEPTANCE-2026-09-29.md` for the exact evidence and limitations.

The source was a real architectural modelling guide, not a coordinated project drawing set. Mechanics are accepted; the product-value question remains open until an owner confirms five physical Door identities across actual plan/elevation/schedule/detail representations.
