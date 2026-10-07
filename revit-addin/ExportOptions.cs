using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using Autodesk.Revit.DB;

namespace ObjectCentricDrawing
{
    // What one export includes. The last choice is remembered in
    // %APPDATA%\ObjectCentricDrawing\export-options.json, so a repeat export is one click.
    internal sealed class ExportOptions
    {
        public HashSet<BuiltInCategory> Categories { get; init; } = new();
        public bool RequireMark { get; init; }

        // false = rectangles (the default, verified on a real sheet). true = convex outlines.
        public bool Outline { get; init; }
        public bool IncludeParameters { get; init; }

        public static ExportOptions Defaults() => new()
        {
            Categories = ExportCategories.All.Where(c => c.DefaultOn).Select(c => c.Category).ToHashSet(),
        };

        private sealed record Stored(
            List<string> Categories,
            bool RequireMark,
            bool Outline = false,
            bool IncludeParameters = false);

        private static string StorePath => Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "ObjectCentricDrawing", "export-options.json");

        // Stored by key, not by enum number, so a Revit update cannot remap the choice.
        public static ExportOptions Load()
        {
            try
            {
                if (!File.Exists(StorePath)) return Defaults();
                var stored = JsonSerializer.Deserialize<Stored>(File.ReadAllText(StorePath));
                if (stored == null) return Defaults();
                var categories = ExportCategories.All
                    .Where(c => stored.Categories.Contains(c.Key))
                    .Select(c => c.Category)
                    .ToHashSet();
                return categories.Count == 0
                    ? Defaults()
                    : new ExportOptions
                    {
                        Categories = categories,
                        RequireMark = stored.RequireMark,
                        Outline = stored.Outline,
                        IncludeParameters = stored.IncludeParameters,
                    };
            }
            catch (Exception)
            {
                return Defaults();
            }
        }

        // A failed save only means the dialog opens with defaults next time.
        public void Save()
        {
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(StorePath)!);
                var keys = ExportCategories.All.Where(c => Categories.Contains(c.Category)).Select(c => c.Key).ToList();
                File.WriteAllText(StorePath, JsonSerializer.Serialize(new Stored(keys, RequireMark, Outline, IncludeParameters)));
            }
            catch (Exception)
            {
            }
        }
    }
}
