using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text.Json;
using System.Globalization;
using System.Windows.Interop;
using Autodesk.Revit.Attributes;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;

namespace ObjectCentricDrawing
{
    // Exports the chosen sheets to one PDF, then writes two files beside it:
    //   <name>.objdraw.json        the browser app's project (objects + occurrences)
    //   <name>.objdraw-revit.json  Revit identity for each object and occurrence
    // The PDF itself is never modified.
    [Transaction(TransactionMode.Manual)]
    public class ExportPdfCommand : IExternalCommand
    {
        public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
        {
            UIApplication uiapp = commandData.Application;
            UIDocument uidoc = uiapp.ActiveUIDocument;
            Document doc = uidoc.Document;

            List<ViewSheet> sheets = CollectSheets(uidoc);
            if (sheets.Count == 0)
            {
                TaskDialog.Show("Export PDF + Objects", "Open a sheet, or select sheets in the Project Browser.");
                return Result.Cancelled;
            }

            // Ask what to export before asking where, so a cancel costs nothing.
            ExportOptions? options = AskOptions(uiapp, doc, sheets);
            if (options == null) return Result.Cancelled;
            options.Save();

            var dialog = new Microsoft.Win32.SaveFileDialog
            {
                Title = "Export PDF + Objects",
                Filter = "PDF (*.pdf)|*.pdf",
                FileName = SafeFileName(doc.Title) + ".pdf",
            };
            if (dialog.ShowDialog() != true) return Result.Cancelled;

            string folder = Path.GetDirectoryName(dialog.FileName)!;
            string baseName = Path.GetFileNameWithoutExtension(dialog.FileName);
            string pdfPath = Path.Combine(folder, baseName + ".pdf");

            try
            {
                if (File.Exists(pdfPath)) File.Delete(pdfPath);
                if (!doc.Export(folder, sheets.Select(s => s.Id).ToList(), PdfOptions(baseName)) || !File.Exists(pdfPath))
                {
                    message = "Revit did not write the PDF.";
                    return Result.Failed;
                }

                var result = Build(doc, sheets, pdfPath, options);
                string projectPath = Path.Combine(folder, baseName + ".objdraw.json");
                string refsPath = Path.Combine(folder, baseName + ".objdraw-revit.json");
                File.WriteAllText(projectPath, JsonSerializer.Serialize(result.Project, ProjectFormat.Json));
                File.WriteAllText(refsPath, JsonSerializer.Serialize(result.Refs, ProjectFormat.Json));

                TaskDialog.Show("Export PDF + Objects", Summary(result, sheets.Count, baseName, options.Outline));
                return Result.Succeeded;
            }
            catch (Exception ex)
            {
                message = ex.Message;
                return Result.Failed;
            }
        }

        // Counts what each category would export on these sheets, then shows the choice.
        private static ExportOptions? AskOptions(UIApplication uiapp, Document doc, List<ViewSheet> sheets)
        {
            var all = ExportCategories.All.Select(c => c.Category).ToList();
            var seen = new Dictionary<BuiltInCategory, HashSet<string>>();
            var marked = new Dictionary<BuiltInCategory, HashSet<string>>();
            foreach (Placement p in Placements(doc, sheets, all, new List<SkippedView>()))
            {
                GetOrAdd(seen, p.Category).Add(p.Element.UniqueId);
                if (Identifier(p.Element) != "") GetOrAdd(marked, p.Category).Add(p.Element.UniqueId);
            }

            var counts = ExportCategories.All
                .Select(c => new CategoryCount(c,
                    seen.TryGetValue(c.Category, out var s) ? s.Count : 0,
                    marked.TryGetValue(c.Category, out var m) ? m.Count : 0))
                .ToList();

            var window = new ExportOptionsWindow(sheets.Count, counts, ExportOptions.Load());
            new WindowInteropHelper(window).Owner = uiapp.MainWindowHandle;
            return window.ShowDialog() == true ? window.Choice : null;
        }

        private static HashSet<string> GetOrAdd(Dictionary<BuiltInCategory, HashSet<string>> map, BuiltInCategory key)
        {
            if (!map.TryGetValue(key, out HashSet<string>? set)) map[key] = set = new HashSet<string>();
            return set;
        }

        // Selected sheets win. Otherwise the active view, if it is a sheet.
        // Sorted by sheet number, and exported in that order, so page N is sheets[N-1].
        private static List<ViewSheet> CollectSheets(UIDocument uidoc)
        {
            Document doc = uidoc.Document;
            var selected = uidoc.Selection.GetElementIds()
                .Select(id => doc.GetElement(id))
                .OfType<ViewSheet>()
                .ToList();
            if (selected.Count == 0 && doc.ActiveView is ViewSheet active) selected.Add(active);

            return selected
                .Where(s => !s.IsPlaceholder)
                .OrderBy(s => s.SheetNumber, StringComparer.OrdinalIgnoreCase)
                .ToList();
        }

        // Paper = sheet size, 100%, centred, so the page is exactly the title block.
        // Any fit-to-page or offset would shift every occurrence.
        private static PDFExportOptions PdfOptions(string baseName) => new()
        {
            FileName = baseName,
            Combine = true,
            PaperFormat = ExportPaperFormat.Default,
            ZoomType = ZoomType.Zoom,
            ZoomPercentage = 100,
            PaperPlacement = PaperPlacementType.Center,
            HideCropBoundaries = true,
            HideScopeBoxes = true,
            HideReferencePlane = true,
            HideUnreferencedViewTags = true,
        };

        // One element seen in one viewport, already projected to page coordinates.
        private sealed record Placement(
            int Page, ViewSheet Sheet, View View, Element Element, BuiltInCategory Category, Bounds Bounds,
            Transform ModelToSheet, Rect2 Viewport, Rect2 Paper);

        // Walks every viewport on every sheet and yields the elements of the given categories
        // that land on the page. Both the dialog counts and the export use this, so they agree.
        private static IEnumerable<Placement> Placements(
            Document doc, List<ViewSheet> sheets, ICollection<BuiltInCategory> categories, List<SkippedView> skipped)
        {
            if (categories.Count == 0) yield break;
            var filter = new ElementMulticategoryFilter(categories);

            for (int i = 0; i < sheets.Count; i++)
            {
                ViewSheet sheet = sheets[i];
                Rect2? paper = PaperRect(doc, sheet);
                if (paper == null)
                {
                    skipped.Add(new SkippedView(sheet.SheetNumber, "", "No title block or sheet outline."));
                    continue;
                }

                foreach (ElementId viewportId in sheet.GetAllViewports())
                {
                    if (doc.GetElement(viewportId) is not Viewport viewport) continue;
                    if (doc.GetElement(viewport.ViewId) is not View view) continue;

                    string? reason = UnsupportedReason(view);
                    if (reason != null)
                    {
                        skipped.Add(new SkippedView(sheet.SheetNumber, view.Name, reason));
                        continue;
                    }

                    // Model -> view projection -> sheet. A split view has several
                    // projection regions; v1 skips those rather than guess.
                    var regions = view.GetModelToProjectionTransforms();
                    if (regions.Count != 1)
                    {
                        skipped.Add(new SkippedView(sheet.SheetNumber, view.Name, "Split view."));
                        continue;
                    }
                    Transform modelToSheet = viewport.GetProjectionToSheetTransform()
                        .Multiply(regions[0].GetModelToProjectionTransform());

                    Outline box = viewport.GetBoxOutline();
                    var viewportRect = new Rect2(
                        box.MinimumPoint.X, box.MinimumPoint.Y, box.MaximumPoint.X, box.MaximumPoint.Y);

                    var collector = new FilteredElementCollector(doc, view.Id)
                        .WherePasses(filter)
                        .WhereElementIsNotElementType();

                    foreach (Element element in collector)
                    {
                        // Shared nested families are FamilyInstances of the same category.
                        // Only the top-level instance is the physical object.
                        if (element is FamilyInstance { SuperComponent: not null }) continue;
                        if (element.Category?.BuiltInCategory is not BuiltInCategory category) continue;
                        if (ExportCategories.Find(category) == null) continue;

                        BoundingBoxXYZ? bbox = element.get_BoundingBox(view);
                        if (bbox == null) continue;

                        Bounds? bounds = SheetMath.Normalize(
                            SheetRect(bbox, modelToSheet).Intersect(viewportRect), paper.Value);
                        if (bounds == null) continue;

                        yield return new Placement(
                            i + 1, sheet, view, element, category, bounds, modelToSheet, viewportRect, paper.Value);
                    }
                }
            }
        }

        private sealed record BuildResult(Project Project, RevitRefs Refs, int Outlines, int Rectangles);

        private static BuildResult Build(Document doc, List<ViewSheet> sheets, string pdfPath, ExportOptions options)
        {
            const string documentId = "document-001";
            string exportedAt = DateTime.UtcNow.ToString("o");

            var objects = new List<ProjectObject>();
            var objectRefs = new List<RevitObjectRef>();
            var objectIdByUniqueId = new Dictionary<string, string>();
            var exported = new Dictionary<string, (string ObjectId, Element Element)>();
            var occurrences = new List<Occurrence>();
            var occurrenceRefs = new List<RevitOccurrenceRef>();
            var skipped = new List<SkippedView>();
            int outlineCount = 0;

            foreach (Placement p in Placements(doc, sheets, options.Categories, skipped))
            {
                Element element = p.Element;
                string identifier = Identifier(element);
                if (options.RequireMark && identifier == "") continue;

                if (!objectIdByUniqueId.TryGetValue(element.UniqueId, out string? objectId))
                {
                    objectId = $"object-{objects.Count + 1:000}";
                    objectIdByUniqueId[element.UniqueId] = objectId;
                    exported[element.UniqueId] = (objectId, element);
                    (string familyName, string typeName) = TypeNames(doc, element);
                    objects.Add(new ProjectObject(
                        objectId, ExportCategories.Find(p.Category)!.Key, Label(element, identifier, typeName)));
                    Element? elementType = doc.GetElement(element.GetTypeId());
                    objectRefs.Add(new RevitObjectRef(
                        objectId,
                        element.UniqueId,
                        element.Id.Value,
                        familyName,
                        typeName,
                        identifier,
                        options.IncludeParameters ? Parameters(doc, element) : null,
                        options.IncludeParameters && elementType != null ? Parameters(doc, elementType) : null));
                }

                string occurrenceId = $"occurrence-{occurrences.Count + 1:000}";
                Geometry geometry = Geometry.Rectangle(p.Bounds);
                if (options.Outline)
                {
                    // An outline that comes back empty, or a geometry read that throws,
                    // keeps the rectangle, so no object is lost.
                    List<PagePoint>? points = null;
                    try
                    {
                        List<Vec2>? outline = Outlines.OnSheet(doc, element, p.View, p.ModelToSheet);
                        points = outline == null ? null : SheetMath.NormalizePolygon(outline, p.Viewport, p.Paper);
                    }
                    catch (Autodesk.Revit.Exceptions.ApplicationException)
                    {
                    }
                    if (points != null)
                    {
                        geometry = Geometry.Polygon(points);
                        outlineCount++;
                    }
                }
                occurrences.Add(new Occurrence(occurrenceId, objectId, documentId, p.Page, geometry));
                occurrenceRefs.Add(new RevitOccurrenceRef(
                    occurrenceId, p.Sheet.SheetNumber, p.Sheet.Name, p.Sheet.UniqueId, p.View.Name, p.View.UniqueId));
            }

            var pdf = new FileInfo(pdfPath);
            var project = new Project(
                ProjectFormat.Name,
                exportedAt,
                documentId,
                new List<ProjectDocument>
                {
                    // One page per sheet. Unverified: confirm Revit never splits a sheet.
                    new(documentId, pdf.Name, pdf.Length, sheets.Count, Sha256(pdfPath)),
                },
                objects,
                occurrences,
                new List<object>(),
                options.IncludeRelations ? Relations.Read(exported) : new List<ProjectRelation>());

            var refs = new RevitRefs(
                ProjectFormat.RevitRefsName,
                Path.GetFileNameWithoutExtension(pdfPath) + ".objdraw.json",
                exportedAt,
                doc.Title,
                project.Documents[0],
                options.IncludeParameters,
                objectRefs,
                occurrenceRefs,
                skipped);

            return new BuildResult(project, refs, outlineCount, occurrences.Count - outlineCount);
        }

        // A broad, read-only snapshot. Empty/unreadable values are skipped; the adapter
        // remains separate from the neutral Object-Centric Drawing project file.
        private static List<RevitParameter> Parameters(Document doc, Element element)
        {
            var result = new List<RevitParameter>();
            foreach (Parameter parameter in element.Parameters)
            {
                try
                {
                    if (!parameter.HasValue || parameter.StorageType == StorageType.None) continue;
                    string name = parameter.Definition?.Name?.Trim() ?? "";
                    if (name == "") continue;

                    string storageType;
                    string rawValue;
                    switch (parameter.StorageType)
                    {
                        case StorageType.Double:
                            storageType = "double";
                            rawValue = parameter.AsDouble().ToString("R", CultureInfo.InvariantCulture);
                            break;
                        case StorageType.Integer:
                            storageType = "integer";
                            rawValue = parameter.AsInteger().ToString(CultureInfo.InvariantCulture);
                            break;
                        case StorageType.String:
                            storageType = "string";
                            rawValue = parameter.AsString() ?? "";
                            break;
                        case StorageType.ElementId:
                            storageType = "elementId";
                            rawValue = parameter.AsElementId().Value.ToString(CultureInfo.InvariantCulture);
                            break;
                        default:
                            continue;
                    }

                    string displayValue = parameter.AsValueString() ?? "";
                    if (parameter.StorageType == StorageType.String) displayValue = rawValue;
                    if (parameter.StorageType == StorageType.ElementId
                        && doc.GetElement(parameter.AsElementId()) is Element referenced)
                        displayValue = referenced.Name;
                    if (string.IsNullOrWhiteSpace(displayValue)) displayValue = rawValue;
                    if (string.IsNullOrWhiteSpace(displayValue)) continue;

                    string sourceKey = parameter.IsShared
                        ? $"shared:{parameter.GUID:D}"
                        : $"parameter:{parameter.Id.Value}";
                    result.Add(new RevitParameter(sourceKey, name, storageType, rawValue, displayValue.Trim()));
                }
                catch (Autodesk.Revit.Exceptions.ApplicationException)
                {
                    // One unreadable parameter must not block the PDF and object export.
                }
                catch (InvalidOperationException)
                {
                }
            }
            return result
                .OrderBy(parameter => parameter.Name, StringComparer.OrdinalIgnoreCase)
                .ThenBy(parameter => parameter.SourceKey, StringComparer.Ordinal)
                .ToList();
        }

        private static string? UnsupportedReason(View view)
        {
            if (view.IsTemplate) return "View template.";
            if (view is ViewPlan || view is ViewSection) return null;
            return $"{view.ViewType} views are not supported yet.";
        }

        // The printed page is the title block. Fall back to the sheet outline.
        // Verified on one sheet (2026-10-06): the title block box matches the PDF page.
        private static Rect2? PaperRect(Document doc, ViewSheet sheet)
        {
            Element? titleBlock = new FilteredElementCollector(doc, sheet.Id)
                .OfCategory(BuiltInCategory.OST_TitleBlocks)
                .WhereElementIsNotElementType()
                .FirstElement();

            BoundingBoxXYZ? box = titleBlock?.get_BoundingBox(sheet);
            if (box != null)
                return new Rect2(box.Min.X, box.Min.Y, box.Max.X, box.Max.Y);

            BoundingBoxUV outline = sheet.Outline;
            if (outline == null) return null;
            return new Rect2(outline.Min.U, outline.Min.V, outline.Max.U, outline.Max.V);
        }

        // Projects all 8 corners and takes the 2D extent. Axis-aligned, so a rotated
        // element gets a loose box. The Outline option (Outlines.cs) gives a tighter shape.
        private static Rect2 SheetRect(BoundingBoxXYZ bbox, Transform modelToSheet)
        {
            double minX = double.MaxValue, minY = double.MaxValue;
            double maxX = double.MinValue, maxY = double.MinValue;
            foreach (double x in new[] { bbox.Min.X, bbox.Max.X })
            foreach (double y in new[] { bbox.Min.Y, bbox.Max.Y })
            foreach (double z in new[] { bbox.Min.Z, bbox.Max.Z })
            {
                XYZ p = modelToSheet.OfPoint(bbox.Transform.OfPoint(new XYZ(x, y, z)));
                minX = Math.Min(minX, p.X);
                minY = Math.Min(minY, p.Y);
                maxX = Math.Max(maxX, p.X);
                maxY = Math.Max(maxY, p.Y);
            }
            return new Rect2(minX, minY, maxX, maxY);
        }

        // The mark, or a room's number. Empty when the element has neither.
        // It is evidence, not identity: identity is the UniqueId in the refs file.
        private static string Identifier(Element element)
        {
            string mark = element.get_Parameter(BuiltInParameter.ALL_MODEL_MARK)?.AsString() ?? "";
            if (!string.IsNullOrWhiteSpace(mark)) return mark.Trim();
            string number = element.get_Parameter(BuiltInParameter.ROOM_NUMBER)?.AsString() ?? "";
            return number.Trim();
        }

        private static string Label(Element element, string identifier, string typeName)
        {
            if (element is Autodesk.Revit.DB.Architecture.Room room)
            {
                string name = room.get_Parameter(BuiltInParameter.ROOM_NAME)?.AsString() ?? "";
                string label = $"{identifier} {name}".Trim();
                if (label != "") return label;
            }
            if (identifier != "") return identifier;
            return $"{(typeName == "" ? element.Name : typeName)} #{element.Id.Value}";
        }

        private static (string FamilyName, string TypeName) TypeNames(Document doc, Element element)
        {
            if (element is FamilyInstance instance)
                return (instance.Symbol.FamilyName, instance.Symbol.Name);
            if (doc.GetElement(element.GetTypeId()) is ElementType type)
                return (type.FamilyName, type.Name);
            return ("", "");
        }

        private static string Sha256(string path)
        {
            using FileStream stream = File.OpenRead(path);
            return Convert.ToHexString(SHA256.HashData(stream)).ToLowerInvariant();
        }

        private static string SafeFileName(string name)
        {
            foreach (char c in Path.GetInvalidFileNameChars()) name = name.Replace(c, '_');
            return string.IsNullOrWhiteSpace(name) ? "sheets" : name;
        }

        private static string Summary(BuildResult result, int sheetCount, string baseName, bool outline)
        {
            string shapes = outline
                ? $"{result.Outlines} outline(s), {result.Rectangles} kept as rectangles\n"
                : "";
            string text =
                $"{sheetCount} sheet(s) → {baseName}.pdf\n"
                + $"{result.Project.Objects.Count} object(s), {result.Project.Occurrences.Count} occurrence(s)\n"
                + shapes
                + (result.Refs.IncludesParameters ? "Populated Revit parameters included\n" : "")
                + (result.Project.Relations.Count > 0 ? $"{result.Project.Relations.Count} relation(s) from Revit\n" : "")
                + "\n"
                + "Open the PDF in Object-Centric Drawing, then import the .objdraw.json.";
            if (result.Refs.Skipped.Count > 0)
            {
                text += $"\n\nSkipped {result.Refs.Skipped.Count} view(s):\n"
                    + string.Join("\n", result.Refs.Skipped.Take(8)
                        .Select(s => $"  {s.SheetNumber} {s.ViewName}: {s.Reason}"));
            }
            return text;
        }
    }
}
