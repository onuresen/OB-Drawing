using System;

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
    }
}
