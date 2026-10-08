using System.Collections.Generic;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace ObjectCentricDrawing
{
    // The browser app's project file. Field names and ID patterns must match sidecar.mjs:
    // document-NNN, object-NNN, occurrence-NNN, and a category key from category-catalog.mjs.
    // tests/revit-addin.test.mjs checks the format string and category keys against the app.
    internal static class ProjectFormat
    {
        public const string Name = "objdraw-project-v6";
        public const string RevitRefsName = "objdraw-revit-refs-v2";

        public static readonly JsonSerializerOptions Json = new()
        {
            WriteIndented = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            // Keep Japanese sheet and type names readable instead of \uXXXX escapes.
            Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
        };
    }

    internal sealed record Project(
        string Format,
        string ExportedAt,
        string ActiveDocumentId,
        List<ProjectDocument> Documents,
        List<ProjectObject> Objects,
        List<Occurrence> Occurrences,
        List<object> Notes,
        List<object> Relations);

    internal sealed record ProjectDocument(string Id, string Name, long Size, int PageCount, string Sha256);

    internal sealed record ProjectObject(string Id, string Category, string Label);

    internal sealed record Occurrence(string Id, string ObjectId, string DocumentId, int Page, Geometry Geometry);

    // A rectangle carries Bounds; a polygon carries Points. The other one is left out of the JSON.
    internal sealed record Geometry(
        string Type,
        [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] Bounds? Bounds,
        [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] List<PagePoint>? Points)
    {
        public static Geometry Rectangle(Bounds bounds) => new("rectangle", bounds, null);
        public static Geometry Polygon(List<PagePoint> points) => new("polygon", null, points);
    }

    internal sealed record PagePoint(double X, double Y);

    internal sealed record Bounds(double X, double Y, double Width, double Height);

    // Revit identity lives in its own adapter file, not in the project file.
    // The browser app rebuilds every object field by field on import, so an extra
    // field inside the project would be dropped on the next save.
    internal sealed record RevitRefs(
        string Format,
        string ProjectFile,
        string ExportedAt,
        string RevitDocument,
        ProjectDocument SourceDocument,
        bool IncludesParameters,
        List<RevitObjectRef> Objects,
        List<RevitOccurrenceRef> Occurrences,
        List<SkippedView> Skipped);

    internal sealed record RevitObjectRef(
        string ObjectId,
        string UniqueId,
        long ElementId,
        string FamilyName,
        string TypeName,
        string Mark,
        [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] List<RevitParameter>? InstanceParameters,
        [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] List<RevitParameter>? TypeParameters);

    internal sealed record RevitParameter(
        string SourceKey,
        string Name,
        string StorageType,
        string RawValue,
        string DisplayValue);

    internal sealed record RevitOccurrenceRef(
        string OccurrenceId,
        string SheetNumber,
        string SheetName,
        string SheetUniqueId,
        string ViewName,
        string ViewUniqueId);

    internal sealed record SkippedView(string SheetNumber, string ViewName, string Reason);
}
