import test from "node:test";
import assert from "node:assert/strict";
import {
  createFitPageView,
  keyboardShortcutAction,
  nextFocusIndex,
  stepZoom,
  wheelDeltaPixels,
  wheelNavigationAction,
  wheelZoomScale,
} from "../navigation.mjs";

test("newly attached PDFs start on page one in Fit Page view", () => {
  assert.deepEqual(createFitPageView(), {
    pageNumber: 1,
    scale: 1,
    zoomMode: "fit-page",
    scrollLeft: 0,
    scrollTop: 0,
  });
});

test("page shortcuts map without overriding modified or editable input", () => {
  assert.equal(keyboardShortcutAction({ key: "PageUp" }), "previous-page");
  assert.equal(keyboardShortcutAction({ key: "PageDown" }), "next-page");
  assert.equal(keyboardShortcutAction({ key: "Home" }), "first-page");
  assert.equal(keyboardShortcutAction({ key: "End" }), "last-page");
  assert.equal(keyboardShortcutAction({ key: "PageDown", blocked: true }), null);
  assert.equal(keyboardShortcutAction({ key: "PageDown", altKey: true }), null);
});

test("zoom, fit, mark, and help shortcuts are discoverable actions", () => {
  assert.equal(keyboardShortcutAction({ key: "+" }), "zoom-in");
  assert.equal(keyboardShortcutAction({ key: "-" }), "zoom-out");
  assert.equal(keyboardShortcutAction({ key: "0" }), "fit-page");
  assert.equal(keyboardShortcutAction({ key: "f" }), "fit-page");
  assert.equal(keyboardShortcutAction({ key: "M" }), "toggle-mark");
  assert.equal(keyboardShortcutAction({ key: "?" }), "toggle-help");
  assert.equal(keyboardShortcutAction({ key: "=", ctrlKey: true }), "zoom-in");
  assert.equal(keyboardShortcutAction({ key: "-", metaKey: true }), "zoom-out");
  assert.equal(keyboardShortcutAction({ key: "0", ctrlKey: true }), "fit-page");
});

test("standard history shortcuts map without taking over text fields", () => {
  assert.equal(keyboardShortcutAction({ key: "z", ctrlKey: true }), "undo");
  assert.equal(keyboardShortcutAction({ key: "Z", ctrlKey: true, shiftKey: true }), "redo");
  assert.equal(keyboardShortcutAction({ key: "y", ctrlKey: true }), "redo");
  assert.equal(keyboardShortcutAction({ key: "z", metaKey: true }), "undo");
  assert.equal(keyboardShortcutAction({ key: "z", ctrlKey: true, blocked: true }), null);
});

test("find remains available from editable fields while other app shortcuts stay blocked", () => {
  assert.equal(keyboardShortcutAction({ key: "f", ctrlKey: true }), "open-search");
  assert.equal(keyboardShortcutAction({ key: "F", metaKey: true, blocked: true }), "open-search");
  assert.equal(keyboardShortcutAction({ key: "f", ctrlKey: true, altKey: true }), null);
});

test("zoom steps clamp at the supported scale limits", () => {
  assert.equal(stepZoom(1, 1, 1.25, 0.25, 4), 1.25);
  assert.equal(stepZoom(1, -1, 1.25, 0.25, 4), 0.8);
  assert.equal(stepZoom(3.5, 1, 2, 0.25, 4), 4);
  assert.equal(stepZoom(0.3, -1, 2, 0.25, 4), 0.25);
});

test("wheel gestures reserve zoom for a modifier and keep ordinary page scrolling native", () => {
  assert.equal(wheelNavigationAction({ deltaY: -100, pointerOnPage: true }), null);
  assert.equal(wheelNavigationAction({ deltaY: 100, pointerOnPage: true }), null);
  assert.equal(wheelNavigationAction({ deltaY: -100, ctrlKey: true }), "zoom-in");
  assert.equal(wheelNavigationAction({ deltaY: 100, metaKey: true }), "zoom-out");
  assert.equal(wheelNavigationAction({ deltaY: 80, shiftKey: true, pointerOnPage: true }), "pan-horizontal");
  assert.equal(wheelNavigationAction({ deltaY: -80, altKey: true, pointerOnPage: true }), "previous-page");
  assert.equal(wheelNavigationAction({ deltaY: 80, altKey: true, pointerOnPage: true }), "next-page");
  assert.equal(wheelNavigationAction({ deltaY: 100, pointerOnPage: false }), null);
  assert.equal(wheelNavigationAction({}), null);
});

test("wheel deltas normalize line and page modes for consistent gesture thresholds", () => {
  assert.equal(wheelDeltaPixels(12), 12);
  assert.equal(wheelDeltaPixels(3, 1), 48);
  assert.equal(wheelDeltaPixels(-1, 2, 640), -640);
  assert.equal(wheelDeltaPixels(Number.NaN), 0);
});

test("wheel zoom follows continuous gesture magnitude and stays bounded", () => {
  assert.ok(Math.abs(wheelZoomScale(1, -50, 0.002, 0.15, 5) - Math.exp(0.1)) < 0.000001);
  assert.ok(Math.abs(wheelZoomScale(1, 50, 0.002, 0.15, 5) - Math.exp(-0.1)) < 0.000001);
  assert.equal(wheelZoomScale(4.9, -100, 0.002, 0.15, 5), 5);
  assert.equal(wheelZoomScale(0.16, 100, 0.002, 0.15, 5), 0.15);
  assert.equal(wheelZoomScale(1, Number.NaN, 0.002, 0.15, 5), 1);
});

test("focus recovery chooses the nearest surviving list item", () => {
  assert.equal(nextFocusIndex(1, 3), 1);
  assert.equal(nextFocusIndex(3, 3), 2);
  assert.equal(nextFocusIndex(-1, 3), 0);
  assert.equal(nextFocusIndex(0, 0), -1);
});

import { ViewHistory, stepObjectOccurrence } from "../navigation.mjs";

test("new single-key shortcuts", () => {
  assert.equal(keyboardShortcutAction({ key: "[" }), "previous-representation");
  assert.equal(keyboardShortcutAction({ key: "]" }), "next-representation");
  assert.equal(keyboardShortcutAction({ key: "/" }), "focus-object-search");
  assert.equal(keyboardShortcutAction({ key: "W" }), "fit-width");
  assert.equal(keyboardShortcutAction({ key: "h" }), "toggle-marks-hidden");
  assert.equal(keyboardShortcutAction({ key: "l" }), "toggle-labels");
  assert.equal(keyboardShortcutAction({ key: "]", blocked: true }), null);
});

test("Alt + arrows go back and forward, and nothing else uses Alt", () => {
  assert.equal(keyboardShortcutAction({ key: "ArrowLeft", altKey: true }), "history-back");
  assert.equal(keyboardShortcutAction({ key: "ArrowRight", altKey: true }), "history-forward");
  assert.equal(keyboardShortcutAction({ key: "ArrowLeft", altKey: true, blocked: true }), null);
  assert.equal(keyboardShortcutAction({ key: "ArrowLeft", altKey: true, shiftKey: true }), null);
  assert.equal(keyboardShortcutAction({ key: "ArrowLeft" }), null);
});

test("view history goes back and forward and drops the forward branch on a new jump", () => {
  const history = new ViewHistory(3);
  const a = { documentId: "d1", page: 1 };
  const b = { documentId: "d1", page: 5 };
  const c = { documentId: "d2", page: 2 };
  history.record(a, b);
  history.record(b, c);
  assert.deepEqual(history.back(c), b);
  assert.deepEqual(history.back(b), a);
  assert.equal(history.back(a), null);
  assert.deepEqual(history.forward(a), b);
  history.record(b, a);
  assert.equal(history.canGoForward, false);
  history.record(a, a);
  assert.equal(history.backStack.length, 2, "a jump to the same place is not recorded");
});

test("view history keeps only its limit", () => {
  const history = new ViewHistory(2);
  for (let page = 1; page <= 5; page += 1) {
    history.record({ documentId: "d", page }, { documentId: "d", page: page + 1 });
  }
  assert.deepEqual(history.backStack.map((entry) => entry.page), [4, 5]);
});

test("stepping through an object's representations follows PDF, page and reading order, and wraps", () => {
  const occurrences = [
    { id: "o-3", objectId: "x", documentId: "d2", page: 1, bounds: { x: 0.1, y: 0.1 } },
    { id: "o-1", objectId: "x", documentId: "d1", page: 2, bounds: { x: 0.5, y: 0.5 } },
    { id: "o-2", objectId: "x", documentId: "d1", page: 2, bounds: { x: 0.1, y: 0.8 } },
    { id: "o-0", objectId: "x", documentId: "d1", page: 1, bounds: { x: 0.9, y: 0.9 } },
    { id: "other", objectId: "y", documentId: "d1", page: 1, bounds: { x: 0, y: 0 } },
  ];
  const order = ["d1", "d2"];
  const walk = [];
  let current = null;
  for (let step = 0; step < 5; step += 1) {
    current = stepObjectOccurrence(occurrences, "x", current?.id, 1, order);
    walk.push(current.id);
  }
  assert.deepEqual(walk, ["o-0", "o-1", "o-2", "o-3", "o-0"]);
  assert.equal(stepObjectOccurrence(occurrences, "x", "o-0", -1, order).id, "o-3");
  assert.equal(stepObjectOccurrence(occurrences, "none", null, 1, order), null);
});
