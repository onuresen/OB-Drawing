import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isObjectCategoryKey } from "../category-catalog.mjs";
import { PROJECT_FORMAT, validateSidecar } from "../sidecar.mjs";

// The Revit add-in is C# and is never built in CI. These checks read its source
// so the two halves cannot drift apart without a red test.
const addin = (file) => readFileSync(new URL(`../revit-addin/${file}`, import.meta.url), "utf8")
  .replace(/\/\/.*$/gm, "");

test("the add-in writes the project format the app reads", () => {
  const match = addin("ProjectSchema.cs").match(/const string Name = "([^"]+)"/);
  assert.ok(match, "ProjectFormat.Name not found");
  assert.equal(match[1], PROJECT_FORMAT);
});

test("every Revit category the add-in exports maps to an app category key", () => {
  const keys = [...addin("ExportPdfCommand.cs").matchAll(/BuiltInCategory\.OST_\w+,\s*"([^"]+)"/g)]
    .map((m) => m[1]);
  assert.ok(keys.length > 0, "CategoryKeys map not found");
  for (const key of keys) {
    assert.ok(isObjectCategoryKey(key), `${key} is not in category-catalog.mjs`);
  }
});

test("the add-in uses ID shapes the app accepts", () => {
  const source = addin("ExportPdfCommand.cs");
  assert.match(source, /\$"object-\{[^}]+:000\}"/);
  assert.match(source, /\$"occurrence-\{[^}]+:000\}"/);
  assert.match(source, /"document-001"/);
});

test("the add-in panel sits on the shared OneMore tab", () => {
  assert.match(addin("App.cs"), /TabName = "OneMore"/);
});

test("a project shaped like the add-in output imports without loss", () => {
  const fixture = JSON.parse(readFileSync(new URL("./fixtures/revit-export.synthetic.json", import.meta.url), "utf8"));
  const project = validateSidecar(fixture);
  assert.equal(project.objects.length, 2);
  assert.equal(project.occurrences.length, 3);
  assert.deepEqual(
    project.occurrences.filter((o) => o.objectId === "object-001").map((o) => o.page),
    [1, 2],
  );
});
