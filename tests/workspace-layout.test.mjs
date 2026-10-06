import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("workspace surfaces retain explicit rows when PDF search is hidden", async () => {
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");

  for (const [selector, row] of [
    [".toolbar", 1],
    [".pdf-search-bar", 2],
    [".viewer-stage", 3],
    [".status-bar", 4],
  ]) {
    const escapedSelector = selector.replace(".", "\\.");
    assert.match(css, new RegExp(`${escapedSelector}\\s*\\{[^}]*grid-row:\\s*${row};`, "s"));
  }
});

test("the application requests the current corrected stylesheet version", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /styles\.css\?v=2026-10-06-view-options/);
});

test("the application requests the complete text-selection module version", async () => {
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
  assert.match(app, /pdf-text-layer\.mjs\?v=2026-10-02-selection-relocation/);
});

test("the side panel keeps a browser pane, a splitter and a properties pane", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const browser = html.indexOf('id="browserPane"');
  const splitter = html.indexOf('id="paneSplitter"');
  const properties = html.indexOf('id="propertiesPane"');
  assert.ok(browser > 0 && browser < splitter && splitter < properties, "panes out of order");
  // The object list and display filters belong to the browser; editing belongs to properties.
  for (const id of ["objectList", "objectSearch", "markFocus"]) {
    const at = html.indexOf(`id="${id}"`);
    assert.ok(at > browser && at < splitter, `${id} is not in the browser pane`);
  }
  for (const id of ["objectComposer", "selectedObjectPanel"]) {
    assert.ok(html.indexOf(`id="${id}"`) > properties, `${id} is not in the properties pane`);
  }
});

test("hidden side-panel blocks stay hidden whatever display they set", async () => {
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(css, /\.side-panel \[hidden\]\s*\{\s*display:\s*none !important;/);
});
