# Decisions

## 2026-09-28 — Project identity

**Decision:** Name the project **OB Drawing**, use `OB-Drawing` as the folder, and use **OBD** as conversational shorthand.

**Why:** “OB” means Object-Based. “Drawing” places the project in architectural and construction work without restricting it permanently to PDF.

**Alternative:** `OB-PDF` was clear for the first medium but would make the project sound like a new file format and could become restrictive. `Object Atlas` captured the navigation idea but sounded too generic and not specifically architectural.

**Revisit when:** The prototype expands beyond drawing documents or the name causes confusion with another OBD term.

## 2026-09-28 — Object-centred model

**Decision:** Treat rectangles as occurrences of an object, never as the object itself.

**Why:** The same Door can have several visual representations across plans, elevations, schedules, and details.

**Alternative:** Shared markup labels are simpler but do not provide a reliable object model.

**Revisit when:** Do not revisit the separation itself. Extend it only when a real workflow requires more occurrence types.

## 2026-09-28 — Separate sidecar

**Decision:** Preserve the source PDF and store Object-Centric Drawing data in a separate JSON sidecar.

**Why:** The experiment remains reversible, portable, and independent of proprietary PDF annotation formats.

**Alternative:** Embedding annotations directly in the PDF was deferred because it mixes presentation markup with Object-Centric Drawing identity and relationship data.

**Revisit when:** Interoperability testing proves that embedded PDF objects can preserve the complete Object-Centric Drawing model without losing portability.

## 2026-09-28 — Manual identity first

**Decision:** Require explicit user confirmation when linking occurrences to the same object.

**Why:** Matching text, marks, or geometry alone does not prove that two representations describe the same physical object.

**Alternative:** OCR and automatic matching are deferred until the manual workflow proves useful. Later automation should propose links rather than create silent truth.

**Revisit when:** A reviewed dataset can measure match quality and expose ambiguity clearly.

## 2026-09-29 — Session identity and labels

**Decision:** Generate immutable, human-readable session IDs such as `door-001`. Keep labels editable and allow duplicate labels.

**Why:** A drawing label is useful evidence but does not prove that two representations are the same physical Door. Identity must survive a label correction and must not be inferred from text equality.

**Alternative:** Treating `D-105` as a unique key was rejected because drawing sets can contain missing, repeated, or revised labels.

**Revisit when:** Group C defines persisted IDs and import collision rules. Do not weaken the separation between identity and label.

## 2026-09-29 — Preserve marks when deleting objects

**Decision:** Deleting a Door unlinks its occurrences instead of deleting their rectangles.

**Why:** The rectangles are source observations. Removing an interpretation should not silently remove the underlying evidence.

**Alternative:** Cascading deletion is simpler but makes an object-management action destructive to occurrence evidence.

**Revisit when:** A real workflow demonstrates a need for an explicit, separately confirmed cascade-delete action.

## 2026-09-29 — Fingerprinted, replace-on-success sidecars

**Decision:** Export `obd-object-layer-v1` JSON files with a SHA-256 PDF fingerprint, byte size, and page count. Import only after full schema validation and an exact fingerprint match, then replace the in-memory layer as one operation.

**Why:** A sidecar must not attach Door evidence to the wrong or revised drawing set. Atomic replacement also avoids ambiguous merges and ID collisions.

**Alternative:** Filename matching was rejected because files can be renamed. Automatic merging was deferred because the prototype has no reviewed conflict policy.

**Revisit when:** A real workflow needs intentional migration between PDF revisions or a reviewed merge experience.

## 2026-09-30 — Multi-document project contract

**Decision:** New exports use `obd-project-v2`, with a `documents[]` manifest, `activeDocumentId`, explicit `occurrence.documentId`, and typed occurrence geometry. Existing `obd-object-layer-v1` files migrate in memory before import.

**Why:** A project can contain several PDFs, while the same Door can occur in plans, schedules, elevations, and details across those documents. Document identity and geometry type must therefore be explicit before the multi-PDF interface or new drawing tools are added.

**Alternative:** Adding document fields directly to the v1 structure was rejected because its single `document` root cannot represent a complete project. Silently importing only the active portion of a multi-document project was rejected because it would lose evidence on the next export.

**Compatibility boundary (completed):** Group N added multi-PDF attachment and Group O added rendering/editing for every geometry type accepted by v2.

**Revisit when:** Group N defines file relinking and document removal behavior, or a future PDF revision workflow needs aliases between old and replacement fingerprints.

## 2026-09-30 — Local PDF attachment lifecycle

**Decision:** Import project data independently of local PDF availability. Match selected files to manifest documents by SHA-256, byte size, and page count; keep attachment and per-document view state in memory only.

**Why:** Browser file handles cannot be treated as portable project state. A project must reopen without losing Doors or occurrences, clearly show which PDFs are missing, and recover as users reselect local files.

**Removal boundary:** Detaching a PDF is always recoverable and preserves its manifest entry and occurrences. Removing a manifest document is allowed only when it has no occurrences, and the last document cannot be removed while Door objects remain.

**Alternative:** Storing local paths was rejected because browsers cannot safely reopen arbitrary filesystem paths. Silently deleting occurrences with a removed PDF was rejected because it would destroy source evidence.

**Revisit when:** A packaged desktop runtime can offer durable file permissions, or a reviewed workflow defines intentional document-and-evidence deletion.

## 2026-09-30 — Deliberate shape geometry

**Decision:** Support rectangle, ellipse, and polygon occurrences. Rectangle and ellipse persist normalized bounds. Polygon persists ordered normalized vertices, derives a runtime bounding box, and must retain a non-zero enclosed area.

**Why:** Rectangles remain fast for most marks, ellipses distinguish rounded or callout regions, and polygons describe irregular architectural extents without the noisy, difficult-to-edit data produced by freehand drawing. All three remain stable through PDF zoom and document switching.

**Interaction:** Corner handles resize every selected shape; polygon corner resize scales its vertices proportionally, while direct vertex handles adjust individual corners. Each completed resize or vertex edit is one undoable mutation. Double-click, Enter, or the first vertex finishes polygon marking; Escape cancels it.

**Alternative:** Freehand paths were deferred because they require smoothing, hit testing, editing, and a separate persistence contract without adding comparable precision for this workflow.

**Revisit when:** Real drawing-set use demonstrates that polygons cannot efficiently describe the required evidence regions.

## 2026-09-30 — Object Lens as a derived view

**Decision:** Present a selected Door through an Object Lens containing cropped visual previews of every explicitly linked occurrence across PDFs. The previews, coverage counts, and missing-source indicators are derived in memory from the existing project model and local PDF attachments.

**Why:** The product promise is easier to evaluate when one object’s representations can be seen together rather than only listed by page. Cropped context preserves enough drawing evidence to recognize each representation while keeping source identity and navigation visible.

**Governance boundary:** Object Lens does not create links, infer identity, add persisted thumbnail data, or alter the source PDFs. Missing local files remain visible as recoverable cards. Activating a card uses the existing exact occurrence/document/page navigation path.

**Alternative:** Persisted screenshots were rejected because they duplicate source content, enlarge project files, and can become stale. Full-page thumbnails were rejected because small occurrence geometry becomes illegible in a narrow side panel.

**Revisit when:** Owner testing on a coordinated drawing set establishes whether context crops are sufficient or a larger comparison workspace is required.

## 2026-09-30 — Drawing Set Map as derived project topology

**Decision:** Add a compact Drawing Set Map that groups every manifest page under its PDF and derives occurrence density, active-page state, selected-Door coverage, and local-source availability from the existing project model.

**Why:** Multi-PDF support makes the project structure and the distribution of object evidence difficult to understand from a flat document list. A page map provides orientation and direct navigation while keeping the drawing itself as the dominant surface.

**Governance boundary:** The map is read-only. It does not create links, infer identity, persist expanded groups, or add a second document model. Each tile retains exact document/page identity and uses the existing navigation and missing-file recovery flow.

**Alternative:** Literal connector lines between Door occurrences were deferred because they would add visual noise in the narrow rail and imply a stronger relationship model than the explicit links already provide. Selected-Door page highlighting communicates the bounded path without inventing new data.

**Revisit when:** Real projects show that compact page density is insufficient and require sheet metadata, named drawing subsets, or a larger spatial map.

## 2026-09-30 — Portable evidence before ecosystem integration

**Decision:** Keep `obd-project-v2` as the editable Object-Centric Drawing source of truth and introduce a separate `objdraw-object-evidence-v1` export boundary. Current Object-Centric Drawing objects are physical instances; reusable configurations are separate records connected only by an explicit `instanceOf` relationship.

**Why:** The Object Lens already assembles an evidence dossier, but Joinery Configurator describes reusable opening configurations and CDI consumes governed source records. A neutral evidence package lets both systems use Object-Centric Drawing evidence without making their schemas part of Object-Centric Drawing or confusing a physical Door with a shared type.

**Portability boundary:** The package preserves selected subject identity, exact source documents, pages, fingerprints, and typed geometry. It contains no local paths, credentials, inferred links, PDF bytes, target-system records, or implicit relationships based on matching labels. Joinery Configurator, CDI, Revit, and future integrations remain adapters outside the portable core.

**AI boundary:** Future AI may propose source-linked interpretations, but those remain distinguishable from captured facts and human-reviewed values. AI output cannot create subject identity or configuration relationships silently.

**Alternative:** Embedding Joinery Configurator fields or CDI records directly in `obd-project-v2` was rejected because it would couple the authoring tool to current ecosystem schemas and weaken its use elsewhere. Treating the Door label as a configuration key was rejected because labels are non-unique evidence.

**Revisit when:** R1 proves a useful human export workflow, then R2 defines reviewed observations and Group T validates one real package against the current Joinery Configurator schema.

## 2026-09-30 — Companion preview assets outside the neutral manifest

**Decision:** Export the selected object's `objdraw-object-evidence-v1` manifest directly as JSON, or package that identical manifest with marked PNG crops and an `objdraw-object-evidence-assets-v1` index in a dependency-free stored ZIP.

**Why:** Visual crops make the evidence set useful to humans and future AI interpretation, but embedding base64 images in the neutral manifest would enlarge it, mix binary presentation with identity/source records, and complicate downstream validation. A companion index keeps every asset tied to an exact occurrence while preserving missing-source states.

**Interaction:** Preview inclusion is explicit and off by default. Missing PDFs and preview-render failures are recorded in `assets.json`; they do not block the manifest or other available previews. Export never changes saved state, history, source attachment, selection, or the source PDFs.

**Alternative:** Multiple independent browser downloads were rejected because browsers may block them and the files lose their package relationship. A third-party ZIP dependency was unnecessary for a small set of already compressed PNG files.

**Revisit when:** Real evidence sets require larger assets, streaming archives, signed packages, or a richer media-manifest standard.

## 2026-09-30 — Governed human evidence and review

**Decision:** Supersede the editable project contract with `obd-project-v3` and add immutable human evidence entries. An `observation` must cite one exact occurrence belonging to its Door; an `assumption` may cite an occurrence or the whole Door. Review state is limited to `unreviewed`, `needs-confirmation`, `confirmed`, and `rejected`.

**Why:** Object Lens and Export Set make drawing evidence portable, but downstream interpretation needs a governed distinction between what a user saw, what they inferred, what was reviewed, and what remains disputed. Exact provenance must survive save/import and export without turning a label or AI suggestion into hidden truth.

**Conflict and deletion boundary:** Conflicts are derived when active entries on one Door share a normalized topic but disagree on value. Rejected entries remain traceable but do not contribute. Evidence content and source cannot be edited in place; review transitions and explicit removal are undoable. Door or occurrence deletion is blocked while evidence references it, so object editing cannot silently destroy provenance.

**Compatibility:** `obd-object-layer-v1` and `obd-project-v2` remain importable and migrate in memory with an empty observation collection. New project exports use v3. The neutral `objdraw-object-evidence-v1` package now carries only the selected subjects' governed evidence and retains exact source occurrence identity.

**Alternative:** Free-form editable notes were rejected because changing a claim or source in place would erase its review meaning. Persisting a separate conflict record was rejected because it could drift from the active evidence values. Automatically converting AI output into observations was rejected because Group S must keep machine drafts visibly separate until a human accepts them.

**Revisit when:** A real reviewed Door evidence set reveals that immutable replacement is too cumbersome, or a required audit workflow needs named reviewers and append-only decision events rather than the current bounded state model.

## 2026-09-30 — Representation Board as a derived comparison workspace

**Decision:** Add a large modal Representation Board for the selected object. It derives its cards from the same occurrences and in-memory PDF attachments as Object Lens, orders them by project PDF order, page, and occurrence identity, and returns to the exact marked source when a card is activated.

**Why:** A narrow side rail is useful for orientation but cannot support comfortable visual comparison across several plans, schedules, elevations, and details. The board makes the existing representations the primary review surface without creating another identity or persistence model.

**Interaction boundary:** `Show all` is available only when the selected object has linked occurrences. Missing PDFs remain visible and use the existing relink path. Opening, closing, and sorting the board are view state; they do not change project data, history, or saved state.

**Presentation boundary:** Keep one compact brand lockup (now the plain title; see 2026-10-05 rename) and use short visible action verbs backed by explicit accessible labels and tooltips. Category-neutral object language remains the separate R4 data-model and interface change.

**Alternative:** Replacing the drawing canvas with a permanent gallery was rejected because source-page marking and navigation remain the core authoring workspace. Persisting preview images in the project was rejected because the board can render them from exact source occurrences and local attachments.

**Revisit when:** Real projects require side-by-side pinning, filtering by drawing role, or comparison annotations that cannot be handled by the sorted responsive grid.

## 2026-09-30 — Category-neutral physical objects with stable Object-Centric Drawing keys

**Decision:** Supersede the editable project contract with `objdraw-project-v4`. Every object carries one stable category key from a grouped physical-model catalogue. New identities use `object-*`; imported `door-*` identities remain valid and are never rewritten. Label and category changes preserve the physical-instance identity and all explicit occurrence and evidence links.

**Why:** Door-only language made a useful object-navigation experiment look like a hardcoded joinery prototype. A broad searchable catalogue allows the same evidence workflow to describe architecture, structure, MEP, spatial, site, fabrication, and custom objects without coupling the portable core to one discipline.

**Portability boundary:** Category labels and groupings are familiar to Revit users, but persisted values are neutral Object-Centric Drawing keys rather than Autodesk API identifiers. Categories classify a physical subject; they do not infer identity, configuration, or downstream target records. Duplicate labels and matching categories never merge objects.

**Compatibility:** `obd-object-layer-v1`, `obd-project-v2`, and `obd-project-v3` migrate in memory. Their Door records receive `category: "doors"`; every object, occurrence, observation, document, and relationship ID is retained. New exports use only v4, while the evidence-package validator continues to accept packages produced by supported older project versions.

**Alternative:** Persisting raw Revit built-in category IDs was rejected because it would make Autodesk semantics a requirement for a standalone drawing-evidence tool. Generating new neutral IDs during migration was rejected because it would break the explicit identity contract.

**Revisit when:** Real cross-discipline projects reveal missing physical-model categories, require project-defined category extensions, or prove that category history itself needs governed review rather than direct editing.

## 2026-09-30 — Joinery integration begins as an AI-ready evidence handoff

**Decision:** Add `objdraw-joinery-ai-handoff-v1` as a selected-object export for Door and Window subjects. The ZIP contains the neutral Object-Centric Drawing evidence manifest, clean and marked representation crops, a combined marked contact sheet, and exact occurrence/document/page mappings.

**Why:** The proven manual workflow gives one drawing snapshot plus the Configurator prompt to an external AI and receives an importable draft JSON with useful but imperfect accuracy. Object-Centric Drawing can improve that workflow by assembling every known representation of the same physical object, eliminating repeated screenshot capture without asking the user to re-enter dimensions or Joinery structure in Object-Centric Drawing.

**Trust boundary:** T1 does not call AI, infer dimensions, create pane trees, or store Joinery-specific fields in the Object-Centric Drawing project. The user uploads the pack to an AI of their choice. Its output remains an unverified draft until target validation and human comparison with the evidence. Missing representations remain explicit, and export fails if no local source can render.

**Prompt authority:** `JoineryConfigurator_Photo_to_JSON_Prompt.md` belongs to the standalone Joinery Configurator repository. Object-Centric Drawing names the expected file and target schema but does not duplicate or silently synchronize the prompt.

**Alternative:** A deterministic field-to-field adapter with manual width, height, and pane inputs was rejected because it repeats the Configurator's job and misunderstands the intended visual-AI workflow. Direct API integration is deferred until the external handoff proves valuable and the draft-validation loop is defined.

**Revisit when:** Real handoff packs establish whether multiple representations improve AI accuracy, which image types help or confuse it, and whether direct in-app AI invocation is worth the credential and governance burden.

## 2026-10-01 — Embedded PDF text before OCR

**Decision:** Make text embedded in digitally generated PDFs selectable and copyable through the pinned PDF.js text layer. Do not add OCR.

**Why:** Object-Centric Drawing should first become a strong architectural PDF reader with object memory. Native PDF text is exact, source-aligned, local, and sufficient to establish familiar reading and future search behavior without introducing recognition confidence, language models, background processing, or a second text source.

**Interaction boundary:** The text layer is transient view state between the PDF canvas and occurrence SVG. Ordinary selection never changes project data. Existing occurrence shapes remain interactive, while explicit Mark mode temporarily disables text selection and restores a full-page marking surface.

**Alternative:** OCR was rejected for this horizon because scanned-text recovery would add quality thresholds, rotation and language handling, performance costs, and review semantics before the basic PDF-reader experience is proven.

**Revisit when:** Real project PDFs that matter to the workflow are predominantly scanned and users confirm that missing text blocks object collection or navigation.

## 2026-10-01 — Search the active PDF before the drawing set

**Decision:** Provide familiar `Ctrl+F` search over embedded text in the currently active attached PDF. Build its page-text index only on demand and retain it only on that in-memory PDF session.

**Why:** Current-document search improves ordinary drawing reading immediately and reuses the selectable text foundation without creating a project-wide information-retrieval system. Page-ordered results, exact navigation, and visible-page highlighting are sufficient to test the value.

**Boundary:** Search text, matches, highlights, progress, and current-result position are view state. They never enter `objdraw-project-v4`, undo history, the saved baseline, or browser storage. Switching PDFs closes the search surface. OCR and drawing-set-wide search remain excluded.

**Revisit when:** Active-PDF search is proven useful and real multi-document work shows that users repeatedly need one query across the complete drawing set.

## 2026-10-01 — Preview wheel zoom before committing the PDF render

**Decision:** Make wheel and trackpad zoom continuous and pointer-anchored. Scale the complete rendered page surface immediately during the gesture, then replace that preview with one exact PDF.js canvas and text-layer render after input settles.

**Why:** Re-rendering the PDF for every wheel threshold makes zoom feel stepped and can start work that the next wheel event immediately cancels. A short-lived whole-page preview keeps the canvas, selectable text, highlights, and occurrence geometry visually aligned while making the response immediate.

**Boundary:** The preview changes only transient view scale and layout. It does not rasterize new project assets, alter normalized occurrence geometry, enter undo history, persist in the project, or change the existing Fit, Fit Width, 100%, pan, and page-navigation contracts. Scale remains clamped, and any exact navigation or fit action supersedes a pending preview.

**Revisit when:** Real large-format drawing sets show that final render latency still interrupts reading, at which point PDF tile rendering or progressive-resolution strategies can be evaluated with measured evidence.

## 2026-10-01 — Reader-first visual hierarchy

**Decision:** Reduce visual competition around the PDF by using a shorter brand bar, compact grouped controls, a quiet neutral drawing field, flatter buttons and cards, and a lighter object rail. Preserve the current information architecture and every existing action.

**Why:** The feature set has matured, but a patterned canvas, strong shadows, and many equally prominent bordered controls make the prototype feel busier than a daily drawing reader. Subtle grouping makes navigation easier to scan while allowing source drawings and selected evidence to remain the strongest visual elements.

**Semantic boundary:** Orange remains the active action and linked-occurrence color; blue remains selection. Visual refinement does not hide functions, move data into dialogs, change accessible names, add state, or alter the project contract.

**Revisit when:** User smoke tests reveal a specific high-frequency control that deserves stronger emphasis or a low-frequency surface that should be progressively disclosed.

## 2026-10-02 — Fit newly loaded PDFs and reserve wheel zoom for a modifier

**Decision:** Reset every newly attached or relinked local PDF to page 1 in Fit Page mode. Keep ordinary wheel input as native workspace scrolling and require `Ctrl`/`Command` + wheel for pointer-anchored zoom. Center a page within both axes of the stable drawing viewport when it is smaller than the available area.

**Why:** Ordinary wheel input could silently replace Fit Page with a 15% custom scale, reducing a large-format drawing to a thumbnail while the full-height drawing workspace appeared to become an oversized lower panel. Loading should always begin with a legible whole page, and zooming should change the PDF surface without changing the surrounding application layout.

**Boundary:** Page and zoom remain transient view state. Toolbar buttons, `+`/`-`, Fit, Fit Width, 100%, panning, normalized occurrence geometry, object history, and the project schema are unchanged.

## 2026-10-02 — Pin workspace surfaces to explicit grid rows

**Decision:** Assign the toolbar, optional PDF search, drawing viewer, and status bar to rows 1–4 explicitly. The status bar remains a compact bottom strip and the viewer exclusively owns the flexible row.

**Why:** When the hidden search form stopped participating in grid auto-placement, the viewer and status bar shifted upward. The status bar then occupied the flexible `1fr` row and expanded into a large white panel. Explicit row ownership makes the layout invariant whether search is open or closed.

**Boundary:** This is layout-only. Search visibility, PDF rendering, project state, object interactions, responsive stacking, and the saved-data contract do not change.

## 2026-10-02 — Preserve the PDF.js text-selection boundary

**Decision:** Append the PDF.js-style `endOfContent` boundary after every successful text-layer render, expand it while the user is dragging, and reposition it beside the active text span on selection changes in affected Chromium versions. Remove its listeners and transient state whenever the layer is replaced or cancelled.

**Why:** PDF text is rendered as many absolutely positioned spans. Affected Chromium versions can collapse a drag across those spans into narrow, fragmented columns unless the viewer both supplies and dynamically relocates the same selection boundary used by PDF.js's own text-layer builder. The embedded text was available, but Object-Centric Drawing's lower-level wrapper had omitted this viewer behavior.

**Boundary:** The helper changes only browser selection behavior. It does not alter extracted text, search indexing, the rendered PDF, project data, marking geometry, or OCR scope. Explicit Mark mode continues to take interaction priority and intentionally disables text selection.

## 2026-10-05 — Enforce the local-only boundary with a Content-Security-Policy

**Decision:** `index.html` declares a strict CSP meta tag. Scripts, workers, styles, and fetches come only from the same origin. Images and fonts also allow `data:` and `blob:`. Objects, `<base>`, and form posts are blocked.

**Why:** Object-Centric Drawing says it never uploads documents. The CSP makes the browser enforce that, instead of relying only on the code. It also limits damage if an imported project file ever reaches an unsafe code path.

**Alternative:** No CSP. Rejected because the policy costs nothing at runtime and is checked by the browser on every load.

**Revisit when:** a feature needs a remote host, WebAssembly decoders, or inline scripts. Change the policy in the same pull request and record why.

**Boundary:** Checked in Chromium: PDF render, text layer, and injected inline scripts blocked. `frame-ancestors` cannot be set from a meta tag, and GitHub Pages does not allow custom headers.

## 2026-10-05 — Rename to Object-Centric Drawing

**Decision:** The project is now **Object-Centric Drawing**. It has no short acronym. File formats use the `objdraw-` prefix, for example `objdraw-project-v4` and `.objdraw.json`. This replaces the 2026-09-28 project identity entry.

**Why:** This is a personal project. The old "OB" name could be read as an employer link. The full name says what the tool does.

**Alternative:** "OCD" as a short form. Rejected because most readers know it as a health condition, and it cannot be searched.

**Compatibility:** Files saved as `obd-project-v4` still import and are saved again as `objdraw-project-v4`. Older `obd-*` formats migrate as before.

**Confidence:** high.

## 2026-10-06 — One-way Revit export adapter

**Decision:** A Revit add-in in `revit-addin/` exports sheets to PDF and writes a project file beside it. Doors and windows become objects. Each sheet view they appear in becomes an occurrence.

**Why:** It is the same file the manual workflow produces. Marking a coordinated set by hand is slow; the model already knows which shapes are the same object.

**Identity:** Here identity comes from the model, not from a matching label. One Revit element is one object. That is an explicit source, so it keeps the explicit-identity rule.

**Boundary:** One-way export only. Nothing goes back to Revit. This is not the deferred BIM synchronization.

**Decision:** Revit IDs go in a separate `.objdraw-revit.json` adapter file. The project file stays exactly `objdraw-project-v4`.

**Why:** Import rebuilds objects field by field, so a Revit field inside the project would be dropped on the next save. It also keeps Revit out of the neutral core.

**Alternative:** An optional `sourceRefs` field on each object. Rejected for both reasons above.

**Revisit when:** the app needs to show or act on Revit identity.

**Confidence:** med. Not yet built or run in Revit.

## 2026-10-06 — Split the side panel into a browser and properties

**Decision:** The side panel has two panes, like Revit's Project Browser over Properties. The top pane lists objects grouped by category, with search and display filters. The bottom pane shows the selected object, or the create form when nothing is selected. A splitter between them can be dragged or moved with the arrow keys.

**Why:** After a Revit export with 89 objects, one long list made a selected object hard to find. The properties of one object were mixed in with the list of all of them.

**Decision:** Display filters are view-only. Hiding a category, dimming others and showing the selected object only change the canvas and the list. They are not saved in the project file.

**Why:** The project file records evidence. What someone chose to look at is not evidence.

**Boundary:** The selected object's marks and unlinked marks are never hidden by a filter. You cannot lose sight of what you are working on, or of a mark that still needs an object.

## 2026-10-07 — Keep optional Revit parameters broad, separate, and read-only

**Decision:** The Revit export dialog has one off-by-default `Include populated instance and type parameters` option. When enabled, the exporter captures every populated readable parameter for each exported element and its type in `objdraw-revit-refs-v2`; it does not require a category-dependent parameter picker.

**Interaction:** The existing Import JSON action recognizes the Revit companion after the matching project is loaded. Exact `objectId` references attach source data. The selected-object Properties pane groups Instance and Type values and provides local search.

**Boundary:** Revit identity and parameters remain read-only adapter data. They do not enter the neutral project, undo history, dirty comparison, Notes, or object evidence exports. Empty and unreadable parameters are skipped. The source PDF fingerprint and every referenced object ID must match the current project; failure leaves the current session unchanged.

**Alternative:** Tabs instead of stacked panes. Rejected because selecting in the list and editing below it should be visible together.

**Confidence:** high.

## 2026-10-06 — Outline shapes from Revit, rectangle stays the default

**Decision:** The Revit export offers Shape: Rectangle or Outline. Outline gives rooms their boundary loop. Everything else gets the convex hull of what the view draws, including shared nested families.

**Why:** Rotated elements and rooms got boxes much larger than themselves, and the boxes overlapped. A convex outline fixes rotation without polygon unions.

**Alternative:** Exact outlines that follow inside corners. Rejected by Onur for now: too detailed for the benefit.

**Default:** Rectangle, because it is verified on a real sheet. Outline is opt-in. Any element whose outline fails keeps its rectangle.

**Confidence:** med. The maths was checked against the app's validator in a JavaScript port; the C# was not built or run in Revit.

## 2026-10-06 — View options are remembered per browser, never in the project

**Decision:** Group by, this-page-only, labels and the marks mode are saved in the browser's local storage. The search text, hidden categories and collapsed groups are not saved.

**Why:** These are how one person likes to read. They are not evidence, so they stay out of the project file. Search and hidden categories are per task; restoring them would surprise.

**Decision:** Back and forward (Alt + arrows) record jumps only: selecting an object, stepping with [ and ], and the drawing map. Plain page turns are not recorded.

**Why:** Page turns would fill the history and make "back" a page-by-page walk.

**Confidence:** high.

## 2026-10-06 — Rotation is a view, never data

**Decision:** Rotating the view (R, Shift+R) changes only how the page is drawn. Marks are always saved in the page's unrotated coordinates. Drawing, moving and resizing in a rotated view are converted back before saving.

**Why:** A project file must mean the same thing whoever opens it and however they turned the page.

**Alternative:** Store a rotation per document in the project. Rejected: it is a reading preference, not evidence.

**Decision:** Thumbnails render lazily, one at a time, and are cached for the session per PDF, page and rotation.

**Why:** Drawing sets can have hundreds of pages; rendering them all on open would stall the reader.

**Confidence:** high. Checked in headless Chromium: a mark drawn on a 90° view is saved at the expected unrotated position.

## 2026-10-07 — Replace governed evidence entries with flexible Notes

**Decision:** `objdraw-project-v5` has one `notes[]` collection with three explicit scopes: project, object, and occurrence. Notes are editable free text with stable IDs and timestamps. Add, edit, and delete are undoable project mutations.

**Why:** Hands-on review found the observation/assumption, topic/value, review-state, and conflict model confusing and unnecessary for the current drawing workflow. Project, object, and occurrence notes match the practical jobs directly and are easier to explain and maintain.

**Replacement:** The former Evidence-notes UI, evidence model, review states, and conflict derivation are removed rather than kept beside Notes. V3 and v4 imports convert human topic/value content into ordinary notes: occurrence-sourced entries become occurrence notes and whole-object assumptions become object notes. The old governance metadata is intentionally not carried into the new runtime.

**Deletion behavior:** An object cannot be deleted while an object note references it, and an occurrence cannot be deleted while an occurrence note references it. Occurrence notes follow the mark if it becomes unlinked. Project notes have no target.

**Portable exports:** `objdraw-object-evidence-v2` includes relevant object and occurrence notes for selected subjects. Project notes stay in the project because they do not belong to one exported subject. Joinery instructions treat notes as human context to check against visible representations, not verified target values.

**Revit boundary:** This does not authorize write-back. The Revit adapter now emits the v5 project envelope with an empty note collection, while Revit review import remains a later explicit decision.

**Alternative:** Keep Evidence as an advanced panel beside Notes. Rejected because two overlapping systems would preserve the confusing mental model and increase maintenance.

**Confidence:** high for the product direction; browser interaction still needs the planned automated fixture and later owner smoke test.

## 2026-10-08 — Explicit object relations, drawn on the sheet

**Decision:** `objdraw-project-v6` adds one `relations[]` collection. A relation is `{ id, type, from, to, label }` between two objects. It is drawn as an arc between their nearest marks on the current page.

**Why:** Drawings carry relationships that labels cannot. A card reader controls a door. A door is hosted on a wall and opens to rooms. The door takes its finish data from those rooms.

**Sources compared:**
- Thinking Hub uses three edge types (`relates`, `blocks`, `depends-on`). Light and pleasant to draw, but too few words for buildings.
- ONEXUS uses free-form `type` + `dimension` + `directional`. Flexible, but free text drifts.
- CDI has a curated vocabulary in families (`ontology/cdi-relationship-vocabulary.json`) with forward and inverse meaning. Rich, but its truth classes and review states are for model-derived data.

**Chosen mix:** CDI's type keys and families. Thinking Hub's simple click-to-connect drawing. ONEXUS's directed flag, so export to ONEXUS is a plain field mapping later.

**Vocabulary:** 14 types in 5 families: Assembly, Space, System, Data, General. Twelve keep CDI's exact key. `takesDataFrom` and `relatesTo` are local and have no CDI equivalent yet. Each type has a forward and an inverse phrase, so a relation reads well from either end.

**Human-made only:** Every relation is drawn by a person. There is no truth class, review state, or inferred relation. Category pairs only preselect a type in the dialog; the person still confirms it.

**Objects, not marks:** A relation joins objects. The canvas picks the closest pair of marks on the page. A relation therefore shows on every sheet where both objects appear.

**Deletion:** Deleting an object removes its relations in the same undo step. The confirm dialog says how many. Relations are not notes, so they do not block deletion.

**Alternatives rejected:**
- Free-text relation types like ONEXUS. They drift and cannot be mapped to CDI.
- CDI's full 25-type list. Doc 39 measured that a long flat list makes people hesitate.
- Relations between marks. A door is the same door on plan and elevation.
- An optional `relations` field inside v5. An older app would drop it silently on save.

**Not yet:** Relations are not in `objdraw-object-evidence-v2` or the Joinery pack. Revit does not export host or From/To Room yet; the add-in writes an empty list.

**Revisit when:** A second project needs a type that is missing, or Revit host/room export is added.

**Confidence:** med. Mechanics are tested in a browser. The vocabulary needs real drawing use.

## 2026-10-08 — Optional relations from the Revit export

**Decision:** The Revit export can add relations Revit already records: host wall, door From/To Room, and room for other instances. The option is off by default.

**Why:** Hand-drawing every door's wall and rooms is slow. Revit already knows them.

**Optional and additive:**
- Off means the exact same file as before.
- Only between objects in the same export. Nothing points outside the file.
- Each relation carries an optional `origin: "revit"`. Older v6 files without it stay valid.
- The app shows "from Revit" and offers one undoable "Remove Revit relations".
- Editing a Revit relation drops its origin. It is the person's from then on.

**Not CDI truth classes:** `origin` only says who wrote the line. It does not claim confirmed or inferred truth. That richer model waits for the CDI exchange discussion.

**Alternative:** Infer card reader → door from geometry, like CDI. Rejected for now. Proximity is a guess, and Revit host/room data is not.

**Revisit when:** It is run on a real model, or CDI exchange is designed.

**Confidence:** med. Not yet built or run in Revit.

## 2026-10-08 — Relate many at once, and drag from a mark

**Decision:** "Save, add more" repeats one relation for every further pick. A dot beside the selected mark relates by drag-and-drop.

**Why:** One card reader to many doors, or one room to many doors, was one dialog per line. CDI found batch linking saved the most time (docs 34–35).

**Repeat rule:** The source object keeps its side. Picking a room first and saving "D-105 opens to 105 Retail" means each further door opens to that room.

**Each relation is its own undo step.** One Undo removes only the last pick.

**Alternative:** Select many objects, then relate them all in one dialog. Rejected for now. The app has no multi-select yet, and clicking on the sheet is faster.

**Confidence:** high for repeat; med for the dot's size and place until used on real sheets.

## 2026-10-08 — Trace, related pages, and relations in object exports

**Decision:** Add a relation trace, mark related pages in the map and thumbnails, and put relations in Object JSON/ZIP.

**Trace:** Follows relations 1–3 steps, both directions. The root stays pinned while you jump between traced objects. It is view state only.

**Why both directions:** "What does this touch?" matters more than which way an arrow points. Card reader → door → rooms must work from either end.

**Related pages:** The trace when one runs; otherwise the selected object's direct relations. A violet dot, so the blue selected-object outline keeps its meaning.

**Export:** `objectRelations` and identity-only `relatedObjects`, as optional fields in `objdraw-object-evidence-v2`. Readers that ignore them keep working. The other objects' drawings stay out, so a package stays about its subject.

**Alternative:** A new `-v3` package format. Rejected: the change only adds fields, so a version bump would break readers for nothing. `relationships` stays reserved for `instanceOf`.

**Escape:** An open dialog now owns Escape. Before, closing the Map with Escape also ended the trace or cleared the selection.

**Confidence:** high.

## 2026-10-08 — ONEXUS export that merges with CDI's

**Decision:** Export objects and relations as an ONEXUS graph, using CDI's exporter mapping exactly.

**Why:** CDI already exports to ONEXUS (CDI docs/44). Matching its node keys and edge IDs means the same door and relation from both tools become one node and one edge in ONEXUS.

**Identity:** Revit UniqueId when the Revit file is loaded. Otherwise a local key, marked `identity: "local"`. Local objects still show; they just cannot merge with CDI.

**Truth:** Hand-drawn relations are `project-defined`; Revit ones are `source-native`. Review is `unreviewed`. No date is invented; `createdAt` is used when present.

**Relation dates:** New relations get `createdAt`. It stays optional, so older files are valid. Missing means unknown, never old.

**Not now:** Writing into CDI's relationship confirmations. CDI is moving to IFC as well as Forma, so changes there wait. Proposing `takesDataFrom` to CDI also waits.

**Alternative:** An Object-Centric Drawing–specific ONEXUS mapping. Rejected: two mappings for one viewer would fork the same door into two nodes.

**Confidence:** high. Edge IDs were checked against CDI's Python, and the file validates against ONEXUS's schema.
