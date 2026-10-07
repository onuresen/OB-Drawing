import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
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
  const keys = [...addin("ExportCategories.cs").matchAll(/BuiltInCategory\.OST_\w+,\s*"([^"]+)"/g)]
    .map((m) => m[1]);
  assert.ok(keys.length > 0, "ExportCategories table not found");
  assert.equal(new Set(keys).size, keys.length, "a category key is listed twice");
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
  assert.equal(project.occurrences.length, 4);
  // An Outline export writes polygons; the app keeps every point.
  const polygon = project.occurrences.find((o) => o.id === "occurrence-004");
  assert.equal(polygon.geometry.type, "polygon");
  assert.equal(polygon.geometry.points.length, 4);
  assert.deepEqual(
    project.occurrences.filter((o) => o.objectId === "object-001").map((o) => o.page),
    [1, 2],
  );
});

test("every ribbon icon the add-in loads exists and is embedded", () => {
  const names = [...addin("App.cs").matchAll(/LoadIcon\("([^"]+)"\)/g)].map((m) => m[1]);
  assert.ok(names.length >= 2, "no LoadIcon calls found");
  for (const name of names) {
    assert.ok(existsSync(new URL(`../revit-addin/Resources/${name}`, import.meta.url)), `${name} missing`);
  }
  assert.match(addin("ObjectCentricDrawing.csproj"), /EmbeddedResource Include="Resources\\\*\.png"/);
});

test("doors and windows stay the default export", () => {
  const defaults = [...addin("ExportCategories.cs").matchAll(/"([a-z-]+)",\s*"[^"]+",\s*true\)/g)].map((m) => m[1]);
  assert.deepEqual(defaults.sort(), ["doors", "windows"]);
});

test("the export dialog counts and the export walk the sheets the same way", () => {
  const source = addin("ExportPdfCommand.cs");
  const askOptions = source.slice(source.indexOf("AskOptions(UIApplication"), source.indexOf("GetOrAdd(Dictionary"));
  const build = source.slice(source.indexOf("BuildResult Build("), source.indexOf("UnsupportedReason(View"));
  assert.match(askOptions, /Placements\(doc, sheets,/, "dialog does not use Placements");
  assert.match(build, /Placements\(doc, sheets, options\.Categories,/, "export does not use Placements with the chosen categories");
  // Only one place may create a FilteredElementCollector over a view's elements.
  assert.equal((source.match(/new FilteredElementCollector\(doc, view\.Id\)/g) ?? []).length, 1);
});

test("the remembered export choice is stored by category key, not enum number", () => {
  const source = addin("ExportOptions.cs");
  assert.match(source, /Select\(c => c\.Key\)/);
  assert.doesNotMatch(source, /\(int\)\s*c\.Category/);
});

test("parameter export is optional, remembered, and kept in the Revit adapter", () => {
  const options = addin("ExportOptions.cs");
  const dialog = addin("ExportOptionsWindow.cs");
  const schema = addin("ProjectSchema.cs");
  const build = addin("ExportPdfCommand.cs");
  assert.match(options, /bool IncludeParameters = false/);
  assert.match(dialog, /Include populated instance and type parameters/);
  assert.match(schema, /objdraw-revit-refs-v2/);
  assert.match(schema, /ProjectDocument SourceDocument/);
  assert.match(schema, /List<RevitParameter>\? InstanceParameters/);
  assert.match(schema, /List<RevitParameter>\? TypeParameters/);
  assert.match(build, /options\.IncludeParameters \? Parameters\(doc, element\) : null/);
  assert.doesNotMatch(schema.match(/internal sealed record Project\([\s\S]*?\);/)[0], /RevitParameter/);
});

test("rectangles stay the default shape, and an outline always falls back to one", () => {
  const options = addin("ExportOptions.cs");
  assert.match(options, /bool Outline = false[,)]/, "stored default is not rectangle");
  assert.doesNotMatch(options.slice(options.indexOf("Defaults()"), options.indexOf("private sealed record Stored")), /Outline\s*=\s*true/);
  const build = addin("ExportPdfCommand.cs");
  const start = build.indexOf("Geometry geometry = Geometry.Rectangle(p.Bounds);");
  assert.ok(start > 0, "the rectangle is not the starting geometry");
  assert.ok(build.indexOf("Geometry.Polygon(points)", start) > start, "the polygon does not replace the rectangle only on success");
});

test("polygons are written with the field names the app reads", () => {
  const schema = addin("ProjectSchema.cs");
  assert.match(schema, /record PagePoint\(double X, double Y\)/);
  assert.match(schema, /new\("polygon", null, points\)/);
  assert.match(schema, /List<PagePoint>\? Points\)/);
  // The app's area threshold and the add-in's must agree, or the app rejects a polygon the add-in kept.
  const sidecar = readFileSync(new URL("../sidecar.mjs", import.meta.url), "utf8");
  assert.match(sidecar, /BOUNDS_EPSILON = 1e-9;/);
  assert.match(addin("SheetMath.cs"), /> 1e-9 \? points : null;/);
});
