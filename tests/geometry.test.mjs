import test from "node:test";
import assert from "node:assert/strict";
import {
  boundsFromPoints,
  boundsFromPolygonPoints,
  boundsSizeInPixels,
  clamp,
  meetsMinimumMarkSize,
  moveBounds,
  movePolygonPoints,
  pointsAreEqual,
  polygonArea,
  pointFromClient,
  resizeBounds,
  resizePolygonPoints,
} from "../geometry.mjs";

test("clamp keeps normalized values in range", () => {
  assert.equal(clamp(-0.4), 0);
  assert.equal(clamp(0.35), 0.35);
  assert.equal(clamp(1.4), 1);
});

test("pointFromClient normalizes and clamps pointer coordinates", () => {
  const rect = { left: 100, top: 50, width: 400, height: 200 };
  assert.deepEqual(pointFromClient(300, 150, rect), { x: 0.5, y: 0.5 });
  assert.deepEqual(pointFromClient(20, 400, rect), { x: 0, y: 1 });
});

test("boundsFromPoints supports dragging in any direction", () => {
  assert.deepEqual(
    boundsFromPoints({ x: 0.8, y: 0.7 }, { x: 0.25, y: 0.2 }),
    { x: 0.25, y: 0.2, width: 0.55, height: 0.49999999999999994 },
  );
});

test("moveBounds preserves size and keeps a rectangle on the page", () => {
  const bounds = { x: 0.7, y: 0.75, width: 0.25, height: 0.2 };
  assert.deepEqual(
    moveBounds(bounds, 0.4, 0.4),
    { x: 0.75, y: 0.8, width: 0.25, height: 0.2 },
  );
  assert.deepEqual(
    moveBounds(bounds, -1, -1),
    { x: 0, y: 0, width: 0.25, height: 0.2 },
  );
});

test("polygon helpers derive, move, and compare normalized geometry", () => {
  const points = [{ x: 0.1, y: 0.2 }, { x: 0.4, y: 0.2 }, { x: 0.25, y: 0.6 }];
  const bounds = boundsFromPolygonPoints(points);
  assert.deepEqual(bounds, { x: 0.1, y: 0.2, width: 0.30000000000000004, height: 0.39999999999999997 });
  assert.ok(polygonArea(points) > 0);
  const moved = movePolygonPoints(points, bounds, 0.8, 0.8);
  const movedBounds = boundsFromPolygonPoints(moved);
  assert.ok(Math.abs(movedBounds.x - 0.7) < 1e-12);
  assert.ok(Math.abs(movedBounds.y - 0.6) < 1e-12);
  assert.ok(Math.abs(movedBounds.width - 0.3) < 1e-12);
  assert.ok(Math.abs(movedBounds.height - 0.4) < 1e-12);
  assert.equal(pointsAreEqual(points, points.map((point) => ({ ...point }))), true);
  assert.equal(pointsAreEqual(points, moved), false);
});

test("corner resizing preserves the opposite corner and scales polygon vertices", () => {
  const original = { x: 0.1, y: 0.2, width: 0.3, height: 0.4 };
  const resized = resizeBounds(original, "se", { x: 0.6, y: 0.8 }, 0.01);
  assert.deepEqual(resized, { x: 0.1, y: 0.2, width: 0.5, height: 0.6000000000000001 });
  const points = resizePolygonPoints([{ x: 0.1, y: 0.2 }, { x: 0.4, y: 0.6 }], original, resized);
  assert.deepEqual(points[0], { x: 0.1, y: 0.2 });
  assert.ok(Math.abs(points[1].x - 0.6) < 1e-12);
  assert.equal(points[1].y, 0.8);
});

test("boundsSizeInPixels converts normalized size for mark validation", () => {
  assert.deepEqual(
    boundsSizeInPixels(
      { x: 0.2, y: 0.2, width: 0.25, height: 0.4 },
      { width: 800, height: 600 },
    ),
    { width: 200, height: 240 },
  );
});

test("minimum mark size requires both dimensions", () => {
  assert.equal(meetsMinimumMarkSize({ width: 7, height: 7 }), true);
  assert.equal(meetsMinimumMarkSize({ width: 6.99, height: 12 }), false);
  assert.equal(meetsMinimumMarkSize({ width: 12, height: 6.99 }), false);
});
