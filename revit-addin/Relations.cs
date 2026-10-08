using System;
using System.Collections.Generic;
using Autodesk.Revit.DB;

namespace ObjectCentricDrawing
{
    // Optional and off by default: relations Revit already records, written only
    // between objects that are in this export. Each rule is read on its own, so a
    // Revit error skips that one relation and never the export.
    // Type keys must exist in relation-model.mjs; tests/revit-addin.test.mjs checks them.
    internal static class Relations
    {
        public const string Origin = "revit";

        public static List<ProjectRelation> Read(IReadOnlyDictionary<string, (string ObjectId, Element Element)> exported)
        {
            var result = new List<ProjectRelation>();
            var seen = new HashSet<string>();

            void Add(string type, string fromObjectId, Element? target, string? side = null)
            {
                if (target == null || !exported.TryGetValue(target.UniqueId, out var to)) return;
                if (to.ObjectId == fromObjectId) return;
                // A door whose From and To Room are the same room gives one relation, not two.
                if (!seen.Add($"{type}|{fromObjectId}|{to.ObjectId}")) return;
                result.Add(new ProjectRelation(
                    $"relation-{result.Count + 1:000}", type, fromObjectId, to.ObjectId, "", side, Origin));
            }

            foreach ((string objectId, Element element) in exported.Values)
            {
                if (element is not FamilyInstance instance) continue;
                if (element.Category?.BuiltInCategory is not BuiltInCategory category) continue;
                bool opening = category is BuiltInCategory.OST_Doors or BuiltInCategory.OST_Windows;

                if (opening)
                {
                    // Face-based families report a level as host; a level is never an exported object.
                    Try(() => Add("hostedBy", objectId, instance.Host));
                }
                if (category == BuiltInCategory.OST_Doors)
                {
                    // Revit's To Room is the room the door opens into.
                    Try(() => Add("connectsTo", objectId, instance.ToRoom, "to"));
                    Try(() => Add("connectsTo", objectId, instance.FromRoom, "from"));
                }
                else if (!opening)
                {
                    Try(() => Add("inside", objectId, instance.Room));
                }
            }
            return result;
        }

        private static void Try(Action read)
        {
            try
            {
                read();
            }
            catch (Autodesk.Revit.Exceptions.ApplicationException)
            {
            }
            catch (InvalidOperationException)
            {
            }
        }
    }
}
