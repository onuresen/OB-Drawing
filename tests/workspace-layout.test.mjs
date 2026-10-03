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
  assert.match(html, /styles\.css\?v=2026-10-02-text-selection/);
});

test("the application requests the complete text-selection module version", async () => {
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
  assert.match(app, /pdf-text-layer\.mjs\?v=2026-10-02-selection-relocation/);
});
