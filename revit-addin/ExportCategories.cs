using System.Collections.Generic;
using System.Linq;
using Autodesk.Revit.DB;

namespace ObjectCentricDrawing
{
    // Categories the export dialog offers. Keys are category-catalog.mjs keys;
    // tests/revit-addin.test.mjs checks each one against the app.
    // Discrete, plan-visible things only. Linear systems (pipes, ducts) would flood the drawing.
    internal sealed record ExportCategory(BuiltInCategory Category, string Key, string Label, bool DefaultOn);

    internal static class ExportCategories
    {
        public static readonly IReadOnlyList<ExportCategory> All = new ExportCategory[]
        {
            new(BuiltInCategory.OST_Doors, "doors", "Doors", true),
            new(BuiltInCategory.OST_Windows, "windows", "Windows", true),
            new(BuiltInCategory.OST_Rooms, "rooms", "Rooms", false),
            new(BuiltInCategory.OST_Walls, "walls", "Walls", false),
            new(BuiltInCategory.OST_Stairs, "stairs", "Stairs", false),
            new(BuiltInCategory.OST_Furniture, "furniture", "Furniture", false),
            new(BuiltInCategory.OST_Casework, "casework", "Casework", false),
            new(BuiltInCategory.OST_GenericModel, "generic-models", "Generic Models", false),
            new(BuiltInCategory.OST_SpecialityEquipment, "specialty-equipment", "Specialty Equipment", false),
            new(BuiltInCategory.OST_PlumbingFixtures, "plumbing-fixtures", "Plumbing Fixtures", false),
            new(BuiltInCategory.OST_StructuralColumns, "structural-columns", "Structural Columns", false),
            new(BuiltInCategory.OST_MechanicalEquipment, "mechanical-equipment", "Mechanical Equipment", false),
            new(BuiltInCategory.OST_ElectricalEquipment, "electrical-equipment", "Electrical Equipment", false),
            new(BuiltInCategory.OST_ElectricalFixtures, "electrical-fixtures", "Electrical Fixtures", false),
            new(BuiltInCategory.OST_LightingFixtures, "lighting-fixtures", "Lighting Fixtures", false),
        };

        private static readonly Dictionary<BuiltInCategory, ExportCategory> ByCategory =
            All.ToDictionary(c => c.Category);

        public static ExportCategory? Find(BuiltInCategory category) =>
            ByCategory.TryGetValue(category, out ExportCategory? found) ? found : null;
    }
}
