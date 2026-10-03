export function isShortcutBlockedTarget(target) {
  if (!target || typeof target.closest !== "function") {
    return false;
  }

  return Boolean(target.closest("input, textarea, select, button, summary, a, [contenteditable='true']"));
}

export function keyboardShortcutAction(event) {
  if (event.altKey) {
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
    default:
      if (lowerKey === "f") {
        return "fit-page";
      }
      if (lowerKey === "m") {
        return "toggle-mark";
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
