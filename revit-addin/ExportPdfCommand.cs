using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text.Json;
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
        // v1 scope: doors and windows. Values are category-catalog.mjs keys.
        private static readonly Dictionary<BuiltInCategory, string> CategoryKeys = new()
        {
            { BuiltInCategory.OST_Doors, "doors" },
            { BuiltInCategory.OST_Windows, "windows" },
        };

        public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
        {
            UIDocument uidoc = commandData.Application.ActiveUIDocument;
            Document doc = uidoc.Document;

            List<ViewSheet> sheets = CollectSheets(uidoc);
            if (sheets.Count == 0)
            {
                TaskDialog.Show("Export PDF + Objects", "Open a sheet, or select sheets in the Project Browser.");
                return Result.Cancelled;
            }

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

                var result = Build(doc, sheets, pdfPath);
                string projectPath = Path.Combine(folder, baseName + ".objdraw.json");
                string refsPath = Path.Combine(folder, baseName + ".objdraw-revit.json");
                File.WriteAllText(projectPath, JsonSerializer.Serialize(result.Project, ProjectFormat.Json));
                File.WriteAllText(refsPath, JsonSerializer.Serialize(result.Refs, ProjectFormat.Json));

                TaskDialog.Show("Export PDF + Objects", Summary(result, sheets.Count, baseName));
                return Result.Succeeded;
            }
            catch (Exception ex)
            {
                message = ex.Message;
                return Result.Failed;
            }
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

        private sealed record BuildResult(Project Project, RevitRefs Refs);

        private static BuildResult Build(Document doc, List<ViewSheet> sheets, string pdfPath)
        {
            const string documentId = "document-001";
            string exportedAt = DateTime.UtcNow.ToString("o");

            var objects = new List<ProjectObject>();
            var objectRefs = new List<RevitObjectRef>();
            var objectIdByUniqueId = new Dictionary<string, string>();
            var occurrences = new List<Occurrence>();
            var occurrenceRefs = new List<RevitOccurrenceRef>();
            var skipped = new List<SkippedView>();

            for (int i = 0; i < sheets.Count; i++)
            {
                ViewSheet sheet = sheets[i];
                int page = i + 1;
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
                        .WherePasses(new ElementMulticategoryFilter(CategoryKeys.Keys.ToList()))
                        .WhereElementIsNotElementType();

                    foreach (Element element in collector)
                    {
                        // Shared nested families are FamilyInstances of the same category.
                        // Only the top-level instance is the physical object.
                        if (element is not FamilyInstance instance || instance.SuperComponent != null) continue;
                        if (element.Category?.BuiltInCategory is not BuiltInCategory bic
                            || !CategoryKeys.TryGetValue(bic, out string? categoryKey)) continue;

                        BoundingBoxXYZ? bbox = element.get_BoundingBox(view);
                        if (bbox == null) continue;

                        Bounds? bounds = SheetMath.Normalize(
                            SheetRect(bbox, modelToSheet).Intersect(viewportRect), paper.Value);
                        if (bounds == null) continue;

                        if (!objectIdByUniqueId.TryGetValue(element.UniqueId, out string? objectId))
                        {
                            objectId = $"object-{objects.Count + 1:000}";
                            objectIdByUniqueId[element.UniqueId] = objectId;
                            string mark = element.get_Parameter(BuiltInParameter.ALL_MODEL_MARK)?.AsString() ?? "";
                            objects.Add(new ProjectObject(objectId, categoryKey, Label(instance, mark)));
                            objectRefs.Add(new RevitObjectRef(
                                objectId, element.UniqueId, element.Id.Value,
                                instance.Symbol.FamilyName, instance.Symbol.Name, mark));
                        }

                        string occurrenceId = $"occurrence-{occurrences.Count + 1:000}";
                        occurrences.Add(new Occurrence(
                            occurrenceId, objectId, documentId, page, new Geometry("rectangle", bounds)));
                        occurrenceRefs.Add(new RevitOccurrenceRef(
                            occurrenceId, sheet.SheetNumber, sheet.Name, sheet.UniqueId, view.Name, view.UniqueId));
                    }
                }
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
                new List<object>());

            var refs = new RevitRefs(
                ProjectFormat.RevitRefsName,
                Path.GetFileNameWithoutExtension(pdfPath) + ".objdraw.json",
                exportedAt,
                doc.Title,
                objectRefs,
                occurrenceRefs,
                skipped);

            return new BuildResult(project, refs);
        }

        private static string? UnsupportedReason(View view)
        {
            if (view.IsTemplate) return "View template.";
            if (view is ViewPlan || view is ViewSection) return null;
            return $"{view.ViewType} views are not supported yet.";
        }

        // The printed page is the title block. Fall back to the sheet outline.
        // Unverified: confirm the title block box matches the PDF page on a real sheet.
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
        // element gets a loose box. Polygons can come later.
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

        // The mark is evidence, not identity. Identity is the UniqueId in the refs file.
        private static string Label(FamilyInstance instance, string mark) =>
            string.IsNullOrWhiteSpace(mark)
                ? $"{instance.Symbol.Name} #{instance.Id.Value}"
                : mark.Trim();

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

        private static string Summary(BuildResult result, int sheetCount, string baseName)
        {
            string text =
                $"{sheetCount} sheet(s) → {baseName}.pdf\n"
                + $"{result.Project.Objects.Count} object(s), {result.Project.Occurrences.Count} occurrence(s)\n\n"
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
