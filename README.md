# OB Drawing

> One building object, across every drawing.

OB Drawing (OBD) is a local-first browser prototype for navigating architectural PDF drawing sets by building object as well as by page. A physical object may appear in a plan, elevation, schedule, section, or detail. OBD connects those visible occurrences through explicit user-created identity without modifying the source PDFs.

## What it does

- Opens multiple local PDFs with fit, zoom, pan, page navigation, selectable embedded text, and in-document search.
- Marks rectangle, ellipse, and polygon occurrences using normalized page coordinates.
- Links occurrences to explicit category-neutral objects; matching labels never merge identity automatically.
- Navigates an object's representations across PDFs through Object Lens, Representation Board, and Drawing Set Map views.
- Saves the object and evidence layer as portable versioned JSON beside the unchanged PDFs.
- Exports target-neutral evidence packages and an optional Door/Window Joinery AI handoff pack.

The mechanics have passed a bounded round-trip test. The product-value hypothesis still needs validation on a coordinated drawing set with owner-confirmed object identities; see [ACCEPTANCE-2026-09-29.md](ACCEPTANCE-2026-09-29.md).

## Privacy and document safety

OBD runs locally. Selected PDFs, rendered previews, object data, and search indexes remain in browser memory unless you explicitly export a project or evidence package. The application does not upload source documents.

This repository intentionally contains no sample architectural PDFs or project sidecars. Use only documents you are authorized to use, and do not attach confidential drawings to public issues.

## Run locally

Requirements:

- Python 3 for the loopback static server.
- A current Chromium-, Firefox-, or WebKit-based browser.
- Node.js 22 or newer only when running the test suite.

On Windows, double-click `start-server.cmd`. On any platform, run:

```sh
python serve.py
```

Then open <http://localhost:8765> and choose one or more local PDFs.

The supplied server binds only to loopback and provides the JavaScript-module MIME types required by the bundled PDF.js runtime. Do not open `index.html` through `file://`.

## Save and restore

Export an `.obd.json` project beside its source PDFs. It stores fingerprints, document metadata, objects, occurrences, geometry, and governed evidence—not PDF bytes. A project can be imported before or after its PDFs are selected; identical renamed files can be matched by fingerprint.

## Development

The project has no package dependencies or build step. Run the complete suite with:

```sh
npm test
```

Contributor guidance is in [CONTRIBUTING.md](CONTRIBUTING.md). Product and architecture decisions are recorded in [DECISIONS.md](DECISIONS.md).

## Project documents

- [CONCEPT.md](CONCEPT.md) — product idea and terminology.
- [PROTOTYPE-SCOPE.md](PROTOTYPE-SCOPE.md) — bounded experiment and exclusions.
- [DATA-MODEL.md](DATA-MODEL.md) — project and occurrence model.
- [OBJECT-EVIDENCE-PACKAGE.md](OBJECT-EVIDENCE-PACKAGE.md) — portable evidence contract.
- [JOINERY-AI-HANDOFF.md](JOINERY-AI-HANDOFF.md) — optional Door/Window adapter and trust boundary.
- [AGENTS.md](AGENTS.md) — implementation handoff and acceptance checklist.

## Project status

OBD is an independent experimental project. It is not affiliated with or endorsed by an employer, software vendor, standards body, or the publishers of documents opened with it. It is not a BIM authoring tool, PDF editor, or replacement for professional review.

## License

OB Drawing is licensed under the [Apache License 2.0](LICENSE). Bundled third-party components retain their own licenses; see [NOTICE](NOTICE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
