# Contributing

OB Drawing is an experimental local-first PDF reader with an explicit object layer. Contributions should preserve its central contract: visible labels are evidence, not identity, and source PDFs remain unchanged.

## Before opening a change

- Read `AGENTS.md` and the relevant entry in `DECISIONS.md`.
- Keep changes bounded and avoid introducing OCR, automatic identity matching, cloud upload, or BIM synchronization without a separately reviewed product decision.
- Do not commit source PDFs, exported `.obd.json` projects, generated ZIP files, credentials, local paths, or screenshots containing personal information.
- Use only synthetic or clearly redistributable fixtures in tests and documentation.

## Verification

Use Node.js 26 or newer (the same version CI uses) and run:

```sh
npm run check
npm test
```

Browser-facing changes should also be checked through `python serve.py` at supported desktop and narrow viewport widths. Describe what was tested and any remaining verification limits in the pull request.

## Pull requests

Keep commits focused, explain user-visible behavior, and include tests for new pure logic or regression fixes. Do not attach confidential drawings to a pull request or issue; reproduce document-specific bugs with a synthetic file whenever possible.
