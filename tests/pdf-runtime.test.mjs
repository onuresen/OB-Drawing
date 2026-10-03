import test from "node:test";
import assert from "node:assert/strict";
import * as pdfjsLib from "../vendor/pdfjs/pdf.mjs";

function createMinimalPdf() {
  const encoder = new TextEncoder();
  const stream = "0.94 g 0 0 200 200 re f";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << >> /Contents 4 0 R >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];

  let source = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(encoder.encode(source).length);
    source += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = encoder.encode(source).length;
  source += `xref\n0 ${objects.length + 1}\n`;
  source += "0000000000 65535 f \n";
  for (const offset of offsets.slice(1)) {
    source += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  source += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  source += `startxref\n${xrefOffset}\n%%EOF\n`;
  return encoder.encode(source);
}

test("the pinned PDF.js runtime opens a local PDF and exposes its page size", async () => {
  const loadingTask = pdfjsLib.getDocument({ data: createMinimalPdf() });
  const document = await loadingTask.promise;
  const page = await document.getPage(1);
  const viewport = page.getViewport({ scale: 1 });

  assert.equal(document.numPages, 1);
  assert.equal(viewport.width, 200);
  assert.equal(viewport.height, 200);

  await loadingTask.destroy();
});
