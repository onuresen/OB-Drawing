import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("workspace surfaces retain explicit rows when PDF search is hidden", async () => {
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");

  for (const [selector, row] of [
    [".toolbar", 1],
    [".pdf-search-bar", 2],
    [".viewer-row", 3],
    [".status-bar", 4],
  ]) {
    const escapedSelector = selector.replace(".", "\\.");
    assert.match(css, new RegExp(`${escapedSelector}\\s*\\{[^}]*grid-row:\\s*${row};`, "s"));
  }
});

test("the application requests the current corrected stylesheet version", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /styles\.css\?v=2026-10-09-ui-cleanup/);
});

test("the application requests the complete text-selection module version", async () => {
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
  assert.match(app, /pdf-text-layer\.mjs\?v=2026-10-02-selection-relocation/);
});

test("properties float over the drawing on the left; the browser owns the right rail", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const viewerRow = html.indexOf('class="viewer-row"');
  const properties = html.indexOf('id="propertiesPane"');
  const sidePanel = html.indexOf('class="side-panel"');
  const browser = html.indexOf('id="browserPane"');
  assert.ok(viewerRow > 0 && viewerRow < properties && properties < sidePanel && sidePanel < browser, "panes out of place");
  assert.doesNotMatch(html, /id="paneSplitter"/);
  for (const id of ["objectList", "objectSearch", "markFocus"]) {
    assert.ok(html.indexOf(`id="${id}"`) > browser, `${id} is not in the browser pane`);
  }
  for (const id of ["objectComposer", "selectedObjectPanel"]) {
    const at = html.indexOf(`id="${id}"`);
    assert.ok(at > properties && at < sidePanel, `${id} is not in the properties panel`);
  }
  for (const id of ["toggleProperties", "collapseProperties", "closeProperties", "contextMenu", "relateFromPanel"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
});

test("toolbar and panel buttons use a compact font size", async () => {
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  const rule = css.match(/\n\.button \{[^}]*\}/s)?.[0] ?? "";
  assert.match(rule, /font-size:\s*0\.78rem;/);
});

test("hidden side-panel blocks stay hidden whatever display they set", async () => {
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(css, /\.side-panel \[hidden\],\s*\.properties-float \[hidden\]\s*\{\s*display:\s*none !important;/);
});

test("one Notes dialog replaces the former evidence form", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  for (const id of ["openNotes", "notesDialog", "noteScope", "noteText", "notesList"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.doesNotMatch(html, /Evidence notes|evidenceKind|evidenceTopic|evidenceValue/);
  for (const scope of ["project", "object", "occurrence"]) {
    assert.match(html, new RegExp(`<option value="${scope}"`));
  }
});

test("selected objects can show searchable read-only Revit properties", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  for (const id of [
    "revitProperties",
    "revitIdentity",
    "revitPropertySearch",
    "revitInstanceProperties",
    "revitTypeProperties",
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.ok(
    html.indexOf('id="revitProperties"') > html.indexOf('id="selectedObjectPanel"'),
    "Revit properties are not in the selected object panel",
  );
});

test("the narrow toolbar lets each control cluster shrink and wrap", async () => {
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  const narrowRules = css.slice(css.indexOf("@media (max-width: 420px)"));
  assert.match(
    narrowRules,
    /\.toolbar-navigation\s*>\s*\.control-group\s*\{[^}]*width:\s*100%;[^}]*min-width:\s*0;[^}]*flex-wrap:\s*wrap;/s,
  );
});
