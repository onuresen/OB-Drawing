# Joinery AI Handoff

## Purpose

`objdraw-joinery-ai-handoff-v1` packages one selected Door or Window object for a user-controlled external AI workflow. It does not convert Object-Centric Drawing fields into a Joinery Configurator composition and does not call an AI service.

The package replaces the manual work of taking and organizing screenshots one by one. Object-Centric Drawing already knows which plan, elevation, schedule, section, detail, and notes belong to the same physical object, so it exports that evidence for use with the current prompt and schema maintained by Joinery Configurator.

## Package layout

```text
AI-HANDOFF.md
handoff.json
manifest.objdraw-evidence.json
representations/
  contact-sheet.png
  clean/
    occurrence-001.png
  marked/
    occurrence-001.png
```

- `AI-HANDOFF.md` tells the external AI to treat every image as evidence about one physical object and return one raw Configurator JSON object.
- `handoff.json` maps every image back to its exact Object-Centric Drawing occurrence, source document, and page.
- `manifest.objdraw-evidence.json` retains the selected subject, document fingerprints, typed geometry, and relevant object or occurrence notes.
- `handoff.json` names the expected prompt file and records that it is not included. Obtain `JoineryConfigurator_Photo_to_JSON_Prompt.md` from the Joinery Configurator repository so its schema remains under one authority.
- `contact-sheet.png` gives an AI one marked overview of all available representations.
- `clean/` preserves unobstructed source crops for visual interpretation.
- `marked/` identifies the exact object region in each source crop.

## Eligibility and failure behavior

Version 1 supports Object-Centric Drawing categories `doors` and `windows`, mapped only to the Configurator's `door` and `window` opening modes. Other Object-Centric Drawing categories remain neutral and do not acquire guessed Joinery meaning.

At least one linked source must be locally attached and render successfully. Missing or failed representations are recorded in `handoff.json`; they are not silently omitted. If none can render, export fails without changing the Object-Centric Drawing project.

## Trust boundary

The handoff pack is evidence and instructions, not a verified Joinery composition. The external AI result remains a draft until it passes the Joinery Configurator validator and a person reviews it against the included representations. Labels, matching categories, or AI output never create or merge Object-Centric Drawing identity.

No source PDF bytes, local paths, credentials, API keys, AI responses, or target-system records are stored in the Object-Centric Drawing project. Export is a read-only projection and does not enter history or change saved state.
