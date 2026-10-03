export function clamp(value, minimum = 0, maximum = 1) {
  return Math.min(Math.max(value, minimum), maximum);
}

export function pointFromClient(clientX, clientY, rect) {
  if (!rect.width || !rect.height) {
    return { x: 0, y: 0 };
  }

  return {
    x: clamp((clientX - rect.left) / rect.width),
    y: clamp((clientY - rect.top) / rect.height),
  };
}

export function boundsFromPoints(start, end) {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);

  return {
    x,
    y,
    width: Math.max(start.x, end.x) - x,
    height: Math.max(start.y, end.y) - y,
  };
}

export function moveBounds(bounds, deltaX, deltaY) {
  return {
    ...bounds,
    x: clamp(bounds.x + deltaX, 0, 1 - bounds.width),
    y: clamp(bounds.y + deltaY, 0, 1 - bounds.height),
  };
}

export function boundsFromPolygonPoints(points) {
  if (!Array.isArray(points) || points.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return {
    x,
    y,
    width: Math.max(...xs) - x,
    height: Math.max(...ys) - y,
  };
}

export function polygonArea(points) {
  if (!Array.isArray(points) || points.length < 3) {
    return 0;
  }
  return Math.abs(points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0)) / 2;
}

export function movePolygonPoints(points, bounds, deltaX, deltaY) {
  const nextBounds = moveBounds(bounds, deltaX, deltaY);
  const appliedX = nextBounds.x - bounds.x;
  const appliedY = nextBounds.y - bounds.y;
  return points.map((point) => ({
    x: clamp(point.x + appliedX),
    y: clamp(point.y + appliedY),
  }));
}

export function resizeBounds(bounds, handle, point, minimumWidth = 0, minimumHeight = minimumWidth) {
  const opposite = {
    nw: { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    ne: { x: bounds.x, y: bounds.y + bounds.height },
    sw: { x: bounds.x + bounds.width, y: bounds.y },
    se: { x: bounds.x, y: bounds.y },
  }[handle];
  if (!opposite) {
    return { ...bounds };
  }

  const horizontalDirection = handle.endsWith("e") ? 1 : -1;
  const verticalDirection = handle.startsWith("s") ? 1 : -1;
  let movingX = clamp(point.x);
  let movingY = clamp(point.y);
  if (horizontalDirection > 0) {
    movingX = Math.max(movingX, opposite.x + minimumWidth);
  } else {
    movingX = Math.min(movingX, opposite.x - minimumWidth);
  }
  if (verticalDirection > 0) {
    movingY = Math.max(movingY, opposite.y + minimumHeight);
  } else {
    movingY = Math.min(movingY, opposite.y - minimumHeight);
  }
  return boundsFromPoints(opposite, { x: clamp(movingX), y: clamp(movingY) });
}

export function resizePolygonPoints(points, originalBounds, nextBounds) {
  return points.map((point) => ({
    x: clamp(nextBounds.x + ((point.x - originalBounds.x) / originalBounds.width) * nextBounds.width),
    y: clamp(nextBounds.y + ((point.y - originalBounds.y) / originalBounds.height) * nextBounds.height),
  }));
}

export function pointsAreEqual(first, second) {
  return Boolean(
    Array.isArray(first)
    && Array.isArray(second)
    && first.length === second.length
    && first.every((point, index) => point.x === second[index].x && point.y === second[index].y)
  );
}

export function boundsSizeInPixels(bounds, rect) {
  return {
    width: bounds.width * rect.width,
    height: bounds.height * rect.height,
  };
}

export function meetsMinimumMarkSize(pixelSize, minimumSize = 7) {
  return pixelSize.width >= minimumSize && pixelSize.height >= minimumSize;
}
