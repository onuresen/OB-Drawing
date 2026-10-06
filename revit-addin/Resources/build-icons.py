#!/usr/bin/env python3
"""
Generates the ribbon button icon as PNGs.

    python3 revit-addin/Resources/build-icons.py

Canvas and PNG writer copied from the Joinery Configurator add-in's generator, so the
OneMore tab's icons share one look. Standard library only. Shapes are drawn at SS x and
box-filtered down for anti-aliasing.
"""

import os
import struct
import sys
import zlib

SS = 8
HERE = os.path.dirname(os.path.abspath(__file__))

# Same mid-tone palette as Joinery Configurator: readable on Revit's light and dark ribbon.
FRAME = (0x76, 0x7F, 0x90, 255)   # sheet outline
PAPER = (0xF2, 0xF6, 0xFA, 255)   # sheet
FOLD = (0xC9, 0xD3, 0xDE, 255)    # folded corner
LINE = (0xA9, 0xB3, 0xC2, 255)    # drawing lines on the sheet
MARK = (0xE8, 0x6A, 0x2C, 255)    # occurrence mark, the app's orange
MARK_FILL = (0xE8, 0x6A, 0x2C, 70)
AMBER = (0xF0, 0x9A, 0x33, 255)   # export arrow, as on the Joinery Export buttons


class Canvas:
    def __init__(self, size):
        self.size = size
        self.w = size * SS
        self.h = size * SS
        # straight (non-premultiplied) RGBA, transparent
        self.px = [[0, 0, 0, 0] for _ in range(self.w * self.h)]

    def _blend(self, i, rgba):
        r, g, b, a = rgba
        if a == 0:
            return
        dr, dg, db, da = self.px[i]
        sa = a / 255.0
        na = sa + (da / 255.0) * (1 - sa)
        if na <= 0:
            return
        nr = (r * sa + dr * (da / 255.0) * (1 - sa)) / na
        ng = (g * sa + dg * (da / 255.0) * (1 - sa)) / na
        nb = (b * sa + db * (da / 255.0) * (1 - sa)) / na
        self.px[i] = [nr, ng, nb, na * 255.0]

    def poly(self, pts, rgba):
        """Fill a polygon given in icon units. Crossing-number test per sample."""
        sp = [(x * SS, y * SS) for x, y in pts]
        ys = [p[1] for p in sp]
        xs = [p[0] for p in sp]
        y0 = max(0, int(min(ys)))
        y1 = min(self.h - 1, int(max(ys)) + 1)
        x0 = max(0, int(min(xs)))
        x1 = min(self.w - 1, int(max(xs)) + 1)
        n = len(sp)
        for y in range(y0, y1 + 1):
            cy = y + 0.5
            for x in range(x0, x1 + 1):
                cx = x + 0.5
                inside = False
                j = n - 1
                for i in range(n):
                    xi, yi = sp[i]
                    xj, yj = sp[j]
                    if (yi > cy) != (yj > cy):
                        xint = (xj - xi) * (cy - yi) / (yj - yi) + xi
                        if cx < xint:
                            inside = not inside
                    j = i
                if inside:
                    self._blend(y * self.w + x, rgba)

    def rect(self, x0, y0, x1, y1, rgba):
        self.poly([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], rgba)

    def frame_rect(self, x0, y0, x1, y1, t, rgba):
        """Stroked rectangle of thickness t, drawn inside the bounds."""
        self.rect(x0, y0, x1, y0 + t, rgba)
        self.rect(x0, y1 - t, x1, y1, rgba)
        self.rect(x0, y0, x0 + t, y1, rgba)
        self.rect(x1 - t, y0, x1, y1, rgba)

    def ring(self, cx, cy, r, t, rgba):
        sx, sy, sr, st = cx * SS, cy * SS, r * SS, t * SS
        y0 = max(0, int(sy - sr - 1)); y1 = min(self.h - 1, int(sy + sr + 1))
        x0 = max(0, int(sx - sr - 1)); x1 = min(self.w - 1, int(sx + sr + 1))
        inner = sr - st
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                d = ((x + 0.5 - sx) ** 2 + (y + 0.5 - sy) ** 2) ** 0.5
                if inner <= d <= sr:
                    self._blend(y * self.w + x, rgba)

    def downsample(self):
        out = bytearray()
        for oy in range(self.size):
            row = bytearray()
            for ox in range(self.size):
                r = g = b = a = 0.0
                for dy in range(SS):
                    for dx in range(SS):
                        pr, pg, pb, pa = self.px[(oy * SS + dy) * self.w + ox * SS + dx]
                        w = pa / 255.0
                        r += pr * w; g += pg * w; b += pb * w; a += pa
                n = SS * SS
                a_avg = a / n
                if a > 0:
                    wsum = a / 255.0
                    r, g, b = r / wsum, g / wsum, b / wsum
                else:
                    r = g = b = 0
                row += bytes((int(r + 0.5), int(g + 0.5), int(b + 0.5), int(a_avg + 0.5)))
            out += b"\x00" + row      # filter type 0 per scanline
        return bytes(out)


def write_png(path, canvas):
    raw = canvas.downsample()
    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    ihdr = struct.pack(">IIBBBBB", canvas.size, canvas.size, 8, 6, 0, 0, 0)
    png = (b"\x89PNG\r\n\x1a\n"
           + chunk(b"IHDR", ihdr)
           + chunk(b"IDAT", zlib.compress(raw, 9))
           + chunk(b"IEND", b""))
    with open(path, "wb") as f:
        f.write(png)



# --- the icon ---------------------------------------------------------------
# A drawing sheet with marked objects, plus the amber outbound arrow.

def sheet(c, S):
    small = S <= 16
    x0, y0 = S * 0.12, S * 0.06
    x1, y1 = S * (0.78 if small else 0.74), S * 0.90
    fold = S * 0.18
    t = max(S * 0.06, 1)
    outline = [(x0, y0), (x1 - fold, y0), (x1, y0 + fold), (x1, y1), (x0, y1)]
    c.poly(outline, FRAME)
    c.poly([(x0 + t, y0 + t), (x1 - fold - t * 0.4, y0 + t), (x1 - t, y0 + fold + t * 0.4),
            (x1 - t, y1 - t), (x0 + t, y1 - t)], PAPER)
    c.poly([(x1 - fold, y0), (x1 - fold, y0 + fold), (x1, y0 + fold)], FOLD)
    return x0, y0, x1, y1, t


def mark(c, x0, y0, x1, y1, t):
    c.rect(x0, y0, x1, y1, MARK_FILL)
    c.frame_rect(x0, y0, x1, y1, t, MARK)


def draw_exportpdf(S):
    c = Canvas(S)
    x0, y0, x1, y1, t = sheet(c, S)
    if S > 16:
        # A wall line, so the sheet reads as a drawing, then two marked openings on it.
        c.rect(x0 + S * 0.10, S * 0.44, x1 - S * 0.08, S * 0.44 + t, LINE)
        mark(c, S * 0.20, S * 0.30, S * 0.38, S * 0.56, t)
        mark(c, S * 0.44, S * 0.62, S * 0.62, S * 0.80, t)
    else:
        mark(c, S * 0.24, S * 0.34, S * 0.62, S * 0.66, 1)
    # Outbound arrow at the lower right, over the sheet edge.
    cx = S * 0.82
    tip, base = S * 0.40, S * 0.98
    head = S * (0.20 if S <= 16 else 0.15)
    shaft = S * (0.14 if S <= 16 else 0.09)
    c.rect(cx - shaft / 2, tip + head, cx + shaft / 2, base, AMBER)
    c.poly([(cx - head, tip + head), (cx + head, tip + head), (cx, tip)], AMBER)
    return c


ICONS = {"exportpdf": draw_exportpdf}
SIZES = (16, 32)


def build(out_dir=None):
    out_dir = out_dir or HERE
    os.makedirs(out_dir, exist_ok=True)
    written = []
    for name, fn in ICONS.items():
        for size in SIZES:
            path = os.path.join(out_dir, f"{name}{size}.png")
            write_png(path, fn(size))
            written.append(os.path.basename(path))
    return written


if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else None
    for f in build(target):
        print("wrote", f)
