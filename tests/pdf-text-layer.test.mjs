import assert from "node:assert/strict";
import test from "node:test";

import {
  moveSelectionBoundary,
  PdfTextLayerRenderer,
} from "../pdf-text-layer.mjs";

function createEventTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, listener) {
      const typeListeners = listeners.get(type) ?? new Set();
      typeListeners.add(listener);
      listeners.set(type, typeListeners);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    emit(type) {
      for (const listener of listeners.get(type) ?? []) {
        listener({ type });
      }
    },
    listenerCount(type) {
      return listeners.get(type)?.size ?? 0;
    },
  };
}

function createContainer(events) {
  const eventTarget = createEventTarget();
  const window = createEventTarget();
  const document = {
    ...createEventTarget(),
    defaultView: window,
    createElement() {
      return { className: "", style: {} };
    },
  };
  const classes = new Set();
  return {
    ...eventTarget,
    ownerDocument: document,
    classList: {
      add(name) {
        classes.add(name);
      },
      remove(name) {
        classes.delete(name);
      },
      contains(name) {
        return classes.has(name);
      },
    },
    children: [],
    append(child) {
      this.children = this.children.filter((candidate) => candidate !== child);
      this.children.push(child);
    },
    replaceChildren() {
      this.children = [];
      events.push("clear");
    },
  };
}

function createHarness() {
  const events = [];
  const container = createContainer(events);
  class FakeTextLayer {
    constructor(options) {
      this.options = options;
      this.cancelled = false;
      this.textDivs = [{ textContent: "Drawing text" }];
      events.push(["construct", options]);
    }

    render() {
      events.push("render");
      return Promise.resolve();
    }

    cancel() {
      this.cancelled = true;
      events.push("cancel");
    }
  }
  return { container, events, FakeTextLayer };
}

test("text rendering streams marked PDF content into the pinned TextLayer API", async () => {
  const { container, events, FakeTextLayer } = createHarness();
  const stream = { id: "text-stream" };
  const page = {
    streamTextContent(options) {
      assert.deepEqual(options, {
        includeMarkedContent: true,
        disableNormalization: true,
      });
      return stream;
    },
  };
  const viewport = { scale: 1.5 };
  const renderer = new PdfTextLayerRenderer(container, FakeTextLayer);

  const task = await renderer.render(page, viewport);

  assert.equal(events[0], "clear");
  assert.equal(events[2], "render");
  assert.equal(task.options.textContentSource, stream);
  assert.equal(task.options.container, container);
  assert.equal(task.options.viewport, viewport);
  assert.equal(renderer.textDivs, task.textDivs);
});

test("starting a replacement render cancels the pending text layer and clears stale spans", async () => {
  const events = [];
  const container = createContainer(events);
  let resolveFirst;
  class DeferredTextLayer {
    constructor(options) {
      this.options = options;
      this.index = events.filter((event) => Array.isArray(event) && event[0] === "construct").length;
      events.push(["construct", this.index]);
    }

    render() {
      if (this.index === 0) {
        return new Promise((resolve) => {
          resolveFirst = resolve;
        });
      }
      return Promise.resolve();
    }

    cancel() {
      events.push(["cancel", this.index]);
      resolveFirst();
    }
  }
  const renderer = new PdfTextLayerRenderer(container, DeferredTextLayer);
  const page = { streamTextContent: () => ({}) };
  const first = renderer.render(page, { scale: 1 });
  const second = renderer.render(page, { scale: 2 });

  await Promise.all([first, second]);

  assert.deepEqual(events, [
    "clear",
    ["construct", 0],
    ["cancel", 0],
    "clear",
    ["construct", 1],
  ]);
});

test("explicit cancellation is safe after a completed render", async () => {
  const { container, events, FakeTextLayer } = createHarness();
  const renderer = new PdfTextLayerRenderer(container, FakeTextLayer);
  const page = { streamTextContent: () => ({}) };

  await renderer.render(page, { scale: 1 });
  renderer.cancel();

  assert.deepEqual(events.slice(-1), ["clear"]);
  assert.deepEqual(renderer.textDivs, []);
});

test("completed rendering installs and cleans up the PDF.js selection boundary", async () => {
  const { container, FakeTextLayer } = createHarness();
  const renderer = new PdfTextLayerRenderer(container, FakeTextLayer);
  const page = { streamTextContent: () => ({}) };

  await renderer.render(page, { scale: 1 });

  assert.equal(container.children.length, 1);
  assert.equal(container.children[0].className, "endOfContent");
  assert.equal(container.listenerCount("mousedown"), 1);
  assert.equal(container.ownerDocument.listenerCount("pointerup"), 1);

  container.emit("mousedown");
  assert.equal(container.classList.contains("selecting"), true);
  container.ownerDocument.emit("pointerup");
  assert.equal(container.classList.contains("selecting"), false);

  renderer.cancel();

  assert.equal(container.children.length, 0);
  assert.equal(container.listenerCount("mousedown"), 0);
  assert.equal(container.ownerDocument.listenerCount("pointerup"), 0);
  assert.equal(container.ownerDocument.defaultView.listenerCount("blur"), 0);
});

test("affected Chromium selection moves the boundary beside the active text span", () => {
  const container = {
    ownerDocument: { defaultView: {} },
    style: { width: "900px", height: "1200px" },
  };
  const first = { childNodes: [{}] };
  const selected = {
    nodeType: 1,
    childNodes: [{}],
    parentElement: container,
  };
  const endOfContent = { style: {} };
  const children = [first, endOfContent, selected];
  const refreshSiblings = () => {
    children.forEach((node, index) => {
      node.previousSibling = children[index - 1] ?? null;
      node.nextSibling = children[index + 1] ?? null;
      node.parentElement = container;
    });
  };
  refreshSiblings();
  container.closest = (selector) => selector === ".text-layer" ? container : null;
  container.insertBefore = (node, before) => {
    children.splice(children.indexOf(node), 1);
    const index = before ? children.indexOf(before) : children.length;
    children.splice(index, 0, node);
    refreshSiblings();
  };
  const textNode = { nodeType: 3, parentNode: selected };
  const clonedRange = { id: "cloned-range" };
  const range = {
    endContainer: textNode,
    endOffset: 1,
    cloneRange: () => clonedRange,
  };

  const result = moveSelectionBoundary({
    container,
    endOfContent,
    previousRange: null,
    range,
  });

  assert.deepEqual(children, [first, selected, endOfContent]);
  assert.equal(endOfContent.style.width, "900px");
  assert.equal(endOfContent.style.height, "1200px");
  assert.equal(endOfContent.style.userSelect, "text");
  assert.equal(result, clonedRange);
});
