using System.Collections.Generic;
using System.Linq;
using Autodesk.Revit.DB;
using Autodesk.Revit.DB.Architecture;

namespace ObjectCentricDrawing
{
    // The "Outline" shape option. Returns sheet-space points, or null to keep the rectangle.
    //
    // - Rooms: the room's own boundary loop. Exact, and usually simple.
    // - Everything else: the convex hull of what the view draws for the element,
    //   including shared nested families. Rotation is handled; inside corners are not.
    internal static class Outlines
    {
        // Enough for a detailed family; stops a huge element from stalling the export.
        private const int MaxSamples = 20000;

        public static List<Vec2>? OnSheet(Document doc, Element element, View view, Transform modelToSheet)
        {
            if (element is Room room) return RoomLoop(room, modelToSheet);

            var points = new List<Vec2>();
            var options = new Options { View = view };
            Collect(element, options, modelToSheet, points);
            if (element is FamilyInstance instance)
            {
                foreach (ElementId id in instance.GetSubComponentIds())
                {
                    if (doc.GetElement(id) is Element sub) Collect(sub, options, modelToSheet, points);
                }
            }
            if (points.Count < 3) return null;
            List<Vec2> hull = SheetMath.ConvexHull(points);
            return hull.Count >= 3 ? hull : null;
        }

        private static void Collect(Element element, Options options, Transform modelToSheet, List<Vec2> points)
        {
            GeometryElement? geometry = element.get_Geometry(options);
            if (geometry != null) Walk(geometry, modelToSheet, points);
        }

        private static void Walk(GeometryElement geometry, Transform modelToSheet, List<Vec2> points)
        {
            foreach (GeometryObject item in geometry)
            {
                if (points.Count > MaxSamples) return;
                switch (item)
                {
                    case Solid solid:
                        foreach (Edge edge in solid.Edges) Add(edge.Tessellate(), modelToSheet, points);
                        break;
                    case Curve curve:
                        Add(curve.Tessellate(), modelToSheet, points);
                        break;
                    case PolyLine polyLine:
                        Add(polyLine.GetCoordinates(), modelToSheet, points);
                        break;
                    case Mesh mesh:
                        Add(mesh.Vertices, modelToSheet, points);
                        break;
                    case GeometryInstance instance:
                        // Already in model coordinates.
                        Walk(instance.GetInstanceGeometry(), modelToSheet, points);
                        break;
                    case GeometryElement nested:
                        Walk(nested, modelToSheet, points);
                        break;
                }
            }
        }

        private static void Add(IEnumerable<XYZ> modelPoints, Transform modelToSheet, List<Vec2> points)
        {
            foreach (XYZ point in modelPoints)
            {
                XYZ p = modelToSheet.OfPoint(point);
                points.Add(new Vec2(p.X, p.Y));
            }
        }

        // The largest boundary loop on the sheet is the outside of the room.
        // In a section a room's boundary collapses to a line, so this returns null there.
        private static List<Vec2>? RoomLoop(Room room, Transform modelToSheet)
        {
            IList<IList<BoundarySegment>>? loops = room.GetBoundarySegments(new SpatialElementBoundaryOptions());
            if (loops == null) return null;

            List<Vec2>? best = null;
            double bestArea = 0;
            foreach (IList<BoundarySegment> loop in loops)
            {
                var points = new List<Vec2>();
                foreach (BoundarySegment segment in loop)
                {
                    var sheet = new List<Vec2>();
                    Add(segment.GetCurve().Tessellate(), modelToSheet, sheet);
                    // Each segment starts where the last one ended; skip the repeated point.
                    points.AddRange(points.Count > 0 && sheet.Count > 0 && sheet[0] == points[^1] ? sheet.Skip(1) : sheet);
                }
                double area = System.Math.Abs(DoubledArea(points));
                if (points.Count >= 3 && area > bestArea)
                {
                    best = points;
                    bestArea = area;
                }
            }
            return best;
        }

        private static double DoubledArea(List<Vec2> points)
        {
            double sum = 0;
            for (int i = 0; i < points.Count; i++)
            {
                Vec2 a = points[i], b = points[(i + 1) % points.Count];
                sum += a.X * b.Y - b.X * a.Y;
            }
            return sum;
        }
    }
}
