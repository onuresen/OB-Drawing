# Third-party notices

## Mozilla PDF.js

Object-Centric Drawing vendors the generic runtime from Mozilla PDF.js version `6.3.289` so local PDF rendering does not require a runtime CDN connection.

Included components and their license files are kept under `vendor/pdfjs/`:

- `vendor/pdfjs/LICENSE.pdfjs`
- `vendor/pdfjs/cmaps/LICENSE`
- `vendor/pdfjs/standard_fonts/LICENSE_FOXIT`
- `vendor/pdfjs/standard_fonts/LICENSE_LIBERATION`

PDF.js source and releases are available from <https://github.com/mozilla/pdf.js>. Third-party components remain governed by their respective licenses; the Object-Centric Drawing project license does not replace them.

## Fonts

`vendor/fonts/` holds Latin subsets of DM Sans, Archivo and JetBrains Mono, taken from the `@fontsource` 5.0.x packages. They are the ui-system Executive font pairing, served locally so the Content-Security-Policy needs no font CDN. Each font is under the SIL Open Font License 1.1: `vendor/fonts/OFL-DM-Sans.txt`, `vendor/fonts/OFL-Archivo.txt`, `vendor/fonts/OFL-JetBrains-Mono.txt`.

## ui-system

`ui-base.css` and `palettes/executive.css` are stamped copies from the private `Vibe_Coding/ui-system` catalog (same author). Edit them there, not here.
