export function isShortcutBlockedTarget(target) {
  if (!target || typeof target.closest !== "function") {
    return false;
  }

  return Boolean(target.closest("input, textarea, select, button, summary, a, [contenteditable='true']"));
}

export function keyboardShortcutAction(event) {
  if (event.altKey) {
    // Alt + arrows go back and forward through jumps, like a browser or PDF reader.
    if (event.blocked || event.ctrlKey || event.metaKey || event.shiftKey) {
      return null;
    }
    if (event.key === "ArrowLeft") {
      return "history-back";
    }
    if (event.key === "ArrowRight") {
      return "history-forward";
    }
    return null;
  }

  const key = String(event.key ?? "");
  const lowerKey = key.toLocaleLowerCase();
  const commandModifier = Boolean(event.ctrlKey || event.metaKey);

  if (commandModifier && lowerKey === "f") {
    return "open-search";
  }
  if (event.blocked) {
    return null;
  }

  if (commandModifier) {
    if (lowerKey === "z") {
      return event.shiftKey ? "redo" : "undo";
    }
    if (lowerKey === "y") {
      return "redo";
    }
    if (key === "+" || key === "=") {
      return "zoom-in";
    }
    if (key === "-") {
      return "zoom-out";
    }
    if (key === "0") {
      return "fit-page";
    }
    return null;
  }

  switch (key) {
    case "PageUp":
      return "previous-page";
    case "PageDown":
      return "next-page";
    case "Home":
      return "first-page";
    case "End":
      return "last-page";
    case "+":
    case "=":
      return "zoom-in";
    case "-":
      return "zoom-out";
    case "0":
      return "fit-page";
    case "?":
      return "toggle-help";
    case "[":
      return "previous-representation";
    case "]":
      return "next-representation";
    case "/":
      return "focus-object-search";
    default:
      if (lowerKey === "f") {
        return "fit-page";
      }
      if (lowerKey === "w") {
        return "fit-width";
      }
      if (lowerKey === "m") {
        return "toggle-mark";
      }
      if (lowerKey === "h") {
        return "toggle-marks-hidden";
      }
      if (lowerKey === "l") {
        return "toggle-labels";
      }
      if (lowerKey === "r") {
        return event.shiftKey ? "rotate-counterclockwise" : "rotate-clockwise";
      }
      if (lowerKey === "t") {
        return "toggle-thumbnails";
      }
      return null;
  }
}

export function stepZoom(scale, direction, step, minimum, maximum) {
  const multiplier = direction > 0 ? step : 1 / step;
  return Math.min(Math.max(scale * multiplier, minimum), maximum);
}

export function createFitPageView() {
  return {
    pageNumber: 1,
    scale: 1,
    zoomMode: "fit-page",
    rotation: 0,
    scrollLeft: 0,
    scrollTop: 0,
  };
}

export function wheelZoomScale(scale, delta, sensitivity, minimum, maximum) {
  if (!Number.isFinite(scale) || !Number.isFinite(delta) || !Number.isFinite(sensitivity)) {
    return scale;
  }
  const nextScale = scale * Math.exp(-delta * sensitivity);
  return Math.min(Math.max(nextScale, minimum), maximum);
}

export function wheelDeltaPixels(delta, deltaMode = 0, pageSize = 800) {
  if (!Number.isFinite(delta)) {
    return 0;
  }
  if (deltaMode === 1) {
    return delta * 16;
  }
  if (deltaMode === 2) {
    return delta * pageSize;
  }
  return delta;
}

export function wheelNavigationAction({
  deltaX = 0,
  deltaY = 0,
  ctrlKey = false,
  metaKey = false,
  altKey = false,
  shiftKey = false,
} = {}) {
  if (!deltaX && !deltaY) {
    return null;
  }
  if (altKey && deltaY) {
    return deltaY < 0 ? "previous-page" : "next-page";
  }
  if (shiftKey) {
    return "pan-horizontal";
  }
  if ((ctrlKey || metaKey) && deltaY) {
    return deltaY < 0 ? "zoom-in" : "zoom-out";
  }
  return null;
}

export function nextFocusIndex(deletedIndex, remainingCount) {
  if (remainingCount <= 0) {
    return -1;
  }
  return Math.min(Math.max(deletedIndex, 0), remainingCount - 1);
}

// Back and forward through view jumps (object selection, map, representation stepping).
// A location is { documentId, page }. Plain page turns are not recorded.
export class ViewHistory {
  constructor(limit = 50) {
    this.limit = limit;
    this.backStack = [];
    this.forwardStack = [];
  }

  static same(a, b) {
    return Boolean(a && b && a.documentId === b.documentId && a.page === b.page);
  }

  // Call before a jump, with where the view was.
  record(from, to) {
    if (!from || ViewHistory.same(from, to)) {
      return;
    }
    if (!ViewHistory.same(this.backStack.at(-1), from)) {
      this.backStack.push({ documentId: from.documentId, page: from.page });
      if (this.backStack.length > this.limit) {
        this.backStack.shift();
      }
    }
    this.forwardStack = [];
  }

  back(current) {
    const target = this.backStack.pop() ?? null;
    if (target && current) {
      this.forwardStack.push({ documentId: current.documentId, page: current.page });
    }
    return target;
  }

  forward(current) {
    const target = this.forwardStack.pop() ?? null;
    if (target && current) {
      this.backStack.push({ documentId: current.documentId, page: current.page });
    }
    return target;
  }

  clear() {
    this.backStack = [];
    this.forwardStack = [];
  }

  get canGoBack() {
    return this.backStack.length > 0;
  }

  get canGoForward() {
    return this.forwardStack.length > 0;
  }
}

// The next (or previous) representation of one object, in reading order:
// PDF order, then page, then top-to-bottom and left-to-right. Wraps around.
export function stepObjectOccurrence(occurrences, objectId, currentOccurrenceId, direction, documentIds = []) {
  const documentOrder = new Map(documentIds.map((id, index) => [id, index]));
  const top = (occurrence) => occurrence.bounds?.y ?? occurrence.geometry?.bounds?.y ?? 0;
  const left = (occurrence) => occurrence.bounds?.x ?? occurrence.geometry?.bounds?.x ?? 0;
  const ordered = occurrences
    .filter((occurrence) => occurrence.objectId === objectId)
    .sort((a, b) => (documentOrder.get(a.documentId) ?? Infinity) - (documentOrder.get(b.documentId) ?? Infinity)
      || a.page - b.page
      || top(a) - top(b)
      || left(a) - left(b)
      || a.id.localeCompare(b.id));
  if (ordered.length === 0) {
    return null;
  }
  const index = ordered.findIndex((occurrence) => occurrence.id === currentOccurrenceId);
  if (index < 0) {
    return direction < 0 ? ordered.at(-1) : ordered[0];
  }
  return ordered[(index + (direction < 0 ? -1 : 1) + ordered.length) % ordered.length];
}
