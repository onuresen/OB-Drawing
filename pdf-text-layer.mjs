export class PdfTextLayerRenderer {
  #container;
  #TextLayer;
  #task = null;
  #textDivs = [];
  #unbindSelection = null;

  constructor(container, TextLayer) {
    if (!container || typeof container.replaceChildren !== "function") {
      throw new TypeError("A text-layer container is required.");
    }
    if (typeof TextLayer !== "function") {
      throw new TypeError("A PDF.js TextLayer constructor is required.");
    }
    this.#container = container;
    this.#TextLayer = TextLayer;
  }

  cancel() {
    this.#task?.cancel();
    this.#task = null;
    this.#textDivs = [];
    this.#unbindSelection?.();
    this.#unbindSelection = null;
    this.#container.replaceChildren();
  }

  get textDivs() {
    return this.#textDivs;
  }

  async render(page, viewport) {
    this.cancel();
    const task = new this.#TextLayer({
      textContentSource: page.streamTextContent({
        includeMarkedContent: true,
        disableNormalization: true,
      }),
      container: this.#container,
      viewport,
    });
    this.#task = task;
    try {
      await task.render();
      if (this.#task === task) {
        this.#textDivs = task.textDivs ?? [];
        this.#bindSelectionBoundary();
      }
      return task;
    } finally {
      if (this.#task === task) {
        this.#task = null;
      }
    }
  }

  #bindSelectionBoundary() {
    const document = this.#container.ownerDocument;
    if (!document?.createElement || typeof this.#container.append !== "function") {
      return;
    }

    const endOfContent = document.createElement("div");
    endOfContent.className = "endOfContent";
    this.#container.append(endOfContent);

    let isPointerDown = false;
    let previousRange = null;

    const finishSelection = () => {
      this.#container.append(endOfContent);
      endOfContent.style.width = "";
      endOfContent.style.height = "";
      endOfContent.style.userSelect = "";
      this.#container.classList.remove("selecting");
    };
    const startSelection = () => {
      this.#container.classList.add("selecting");
    };
    const pointerDown = () => {
      isPointerDown = true;
    };
    const pointerUp = () => {
      isPointerDown = false;
      finishSelection();
    };
    const keyUp = () => {
      if (!isPointerDown) {
        finishSelection();
      }
    };
    const selectionChange = () => {
      const selection = document.getSelection?.();
      if (!selection || selection.rangeCount === 0) {
        finishSelection();
        previousRange = null;
        return;
      }

      let active = false;
      for (let index = 0; index < selection.rangeCount; index += 1) {
        if (selection.getRangeAt(index).intersectsNode(this.#container)) {
          active = true;
          break;
        }
      }
      if (!active) {
        finishSelection();
        previousRange = null;
        return;
      }

      this.#container.classList.add("selecting");
      if (!selectionNeedsBoundaryMove(document.defaultView, endOfContent)) {
        return;
      }
      previousRange = moveSelectionBoundary({
        container: this.#container,
        endOfContent,
        previousRange,
        range: selection.getRangeAt(0),
      });
    };

    this.#container.addEventListener("mousedown", startSelection);
    document.addEventListener("pointerdown", pointerDown);
    document.addEventListener("pointerup", pointerUp);
    document.addEventListener("mouseup", pointerUp);
    document.addEventListener("keyup", keyUp);
    document.addEventListener("selectionchange", selectionChange);
    document.defaultView?.addEventListener("blur", pointerUp);

    this.#unbindSelection = () => {
      finishSelection();
      this.#container.removeEventListener("mousedown", startSelection);
      document.removeEventListener("pointerdown", pointerDown);
      document.removeEventListener("pointerup", pointerUp);
      document.removeEventListener("mouseup", pointerUp);
      document.removeEventListener("keyup", keyUp);
      document.removeEventListener("selectionchange", selectionChange);
      document.defaultView?.removeEventListener("blur", pointerUp);
    };
  }
}

function selectionNeedsBoundaryMove(view, endOfContent) {
  const mozUserSelect = view?.getComputedStyle?.(endOfContent)
    .getPropertyValue("-moz-user-select");
  if (mozUserSelect === "none") {
    return false;
  }
  const brands = view?.navigator?.userAgentData?.brands;
  const chromiumVersion = brands
    ? brands.find(({ brand }) => brand === "Chromium")?.version
    : /\b(?:Chrome|Chromium)\/(\d+)\b/.exec(view?.navigator?.userAgent ?? "")?.[1];
  return !chromiumVersion || Number.parseInt(chromiumVersion, 10) < 148;
}

export function moveSelectionBoundary({ container, endOfContent, previousRange, range }) {
  const rangeConstructor = container.ownerDocument?.defaultView?.Range;
  const modifyStart = Boolean(
    previousRange
    && rangeConstructor
    && (
      range.compareBoundaryPoints(rangeConstructor.END_TO_END, previousRange) === 0
      || range.compareBoundaryPoints(rangeConstructor.START_TO_END, previousRange) === 0
    )
  );
  let anchor = modifyStart ? range.startContainer : range.endContainer;
  if (anchor?.nodeType === 3) {
    anchor = anchor.parentNode;
  }
  if (anchor?.classList?.contains("pdf-search-highlight")) {
    anchor = anchor.parentNode;
  }
  if (!anchor) {
    return previousRange;
  }

  if (!modifyStart && range.endOffset === 0) {
    do {
      while (!anchor.previousSibling) {
        anchor = anchor.parentNode;
        if (!anchor || anchor === container) {
          return range.cloneRange();
        }
      }
      anchor = anchor.previousSibling;
    } while (!anchor.childNodes?.length);
  }

  const textLayer = anchor.parentElement?.closest?.(".text-layer");
  if (textLayer === container) {
    endOfContent.style.width = container.style.width;
    endOfContent.style.height = container.style.height;
    endOfContent.style.userSelect = "text";
    anchor.parentElement.insertBefore(
      endOfContent,
      modifyStart ? anchor : anchor.nextSibling,
    );
  }
  return range.cloneRange();
}
