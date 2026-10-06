using System;
using System.Collections.Generic;
using System.Linq;

namespace ObjectCentricDrawing
{
    // Pure sheet-to-page math. No Revit types, so it reads on its own.
    //
    // Revit sheet coordinates: feet, y up, origin anywhere.
    // PDF page coordinates in the project file: 0-1, y down, origin at the top-left.
    internal readonly record struct Rect2(double MinX, double MinY, double MaxX, double MaxY)
    {
        public double Width => MaxX - MinX;
        public double Height => MaxY - MinY;

        public Rect2 Intersect(Rect2 other) => new(
            Math.Max(MinX, other.MinX),
            Math.Max(MinY, other.MinY),
            Math.Min(MaxX, other.MaxX),
            Math.Min(MaxY, other.MaxY));
    }

    internal readonly record struct Vec2(double X, double Y);

    internal static class SheetMath
    {
        private const int Digits = 6;

        // Returns null when the rectangle has no area on the page.
        public static Bounds? Normalize(Rect2 onSheet, Rect2 paper)
        {
            if (paper.Width <= 0 || paper.Height <= 0) return null;

            Rect2 clipped = onSheet.Intersect(paper);
            if (clipped.Width <= 0 || clipped.Height <= 0) return null;

            double x = Round((clipped.MinX - paper.MinX) / paper.Width);
            double y = Round((paper.MaxY - clipped.MaxY) / paper.Height);
            double w = Round(clipped.Width / paper.Width);
            double h = Round(clipped.Height / paper.Height);

            // Rounding must not push the shape past the page edge; the app rejects that.
            w = Math.Min(w, 1 - x);
            h = Math.Min(h, 1 - y);
            if (w <= 0 || h <= 0) return null;

            return new Bounds(x, y, w, h);
        }

        private static double Round(double value) =>
            Math.Clamp(Math.Round(value, Digits), 0, 1);

        // Andrew's monotone chain. Returns the hull counter-clockwise, without repeating the first point.
        public static List<Vec2> ConvexHull(IEnumerable<Vec2> points)
        {
            var p = points.Distinct().OrderBy(v => v.X).ThenBy(v => v.Y).ToList();
            if (p.Count < 3) return p;
            static double Cross(Vec2 o, Vec2 a, Vec2 b) => (a.X - o.X) * (b.Y - o.Y) - (a.Y - o.Y) * (b.X - o.X);

            var hull = new List<Vec2>(p.Count * 2);
            foreach (Vec2 v in p)
            {
                while (hull.Count >= 2 && Cross(hull[^2], hull[^1], v) <= 0) hull.RemoveAt(hull.Count - 1);
                hull.Add(v);
            }
            int lower = hull.Count + 1;
            for (int i = p.Count - 2; i >= 0; i--)
            {
                while (hull.Count >= lower && Cross(hull[^2], hull[^1], p[i]) <= 0) hull.RemoveAt(hull.Count - 1);
                hull.Add(p[i]);
            }
            hull.RemoveAt(hull.Count - 1);
            return hull;
        }

        // Sutherland-Hodgman against an axis-aligned rectangle. Works for any simple polygon.
        public static List<Vec2> ClipToRect(IReadOnlyList<Vec2> polygon, Rect2 rect)
        {
            List<Vec2> result = polygon.ToList();
            result = ClipEdge(result, v => v.X >= rect.MinX, (a, b) => AtX(a, b, rect.MinX));
            result = ClipEdge(result, v => v.X <= rect.MaxX, (a, b) => AtX(a, b, rect.MaxX));
            result = ClipEdge(result, v => v.Y >= rect.MinY, (a, b) => AtY(a, b, rect.MinY));
            result = ClipEdge(result, v => v.Y <= rect.MaxY, (a, b) => AtY(a, b, rect.MaxY));
            return result;
        }

        private static List<Vec2> ClipEdge(List<Vec2> input, Func<Vec2, bool> inside, Func<Vec2, Vec2, Vec2> cross)
        {
            var output = new List<Vec2>(input.Count + 4);
            for (int i = 0; i < input.Count; i++)
            {
                Vec2 current = input[i];
                Vec2 previous = input[(i + input.Count - 1) % input.Count];
                bool currentIn = inside(current), previousIn = inside(previous);
                if (currentIn)
                {
                    if (!previousIn) output.Add(cross(previous, current));
                    output.Add(current);
                }
                else if (previousIn)
                {
                    output.Add(cross(previous, current));
                }
            }
            return output;
        }

        private static Vec2 AtX(Vec2 a, Vec2 b, double x) => new(x, a.Y + (b.Y - a.Y) * (x - a.X) / (b.X - a.X));
        private static Vec2 AtY(Vec2 a, Vec2 b, double y) => new(a.X + (b.X - a.X) * (y - a.Y) / (b.Y - a.Y), y);

        // Clips a sheet-space polygon to the viewport and page, keeps at most maxPoints corners,
        // and converts to page coordinates. Returns null when nothing with area is left;
        // the caller then keeps the rectangle.
        public static List<PagePoint>? NormalizePolygon(IReadOnlyList<Vec2> onSheet, Rect2 viewport, Rect2 paper, int maxPoints = 32)
        {
            if (paper.Width <= 0 || paper.Height <= 0 || onSheet.Count < 3) return null;
            List<Vec2> clipped = ClipToRect(onSheet, viewport.Intersect(paper));
            if (clipped.Count < 3) return null;

            // Drop the corner that matters least until the polygon is small enough.
            while (clipped.Count > maxPoints)
            {
                int weakest = 0;
                double weakestArea = double.MaxValue;
                for (int i = 0; i < clipped.Count; i++)
                {
                    Vec2 a = clipped[(i + clipped.Count - 1) % clipped.Count], b = clipped[i], c = clipped[(i + 1) % clipped.Count];
                    double area = Math.Abs((b.X - a.X) * (c.Y - a.Y) - (c.X - a.X) * (b.Y - a.Y));
                    if (area < weakestArea) { weakestArea = area; weakest = i; }
                }
                clipped.RemoveAt(weakest);
            }

            var points = new List<PagePoint>(clipped.Count);
            foreach (Vec2 v in clipped)
            {
                var point = new PagePoint(
                    Round((v.X - paper.MinX) / paper.Width),
                    Round((paper.MaxY - v.Y) / paper.Height));
                if (points.Count == 0 || points[^1] != point) points.Add(point);
            }
            if (points.Count > 1 && points[0] == points[^1]) points.RemoveAt(points.Count - 1);
            if (points.Count < 3) return null;

            double doubledArea = 0;
            for (int i = 0; i < points.Count; i++)
            {
                PagePoint a = points[i], b = points[(i + 1) % points.Count];
                doubledArea += a.X * b.Y - b.X * a.Y;
            }
            // Same threshold the app uses (sidecar.mjs BOUNDS_EPSILON).
            return Math.Abs(doubledArea) > 1e-9 ? points : null;
        }
    }
}
