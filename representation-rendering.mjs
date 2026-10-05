import { objectLensContextBounds } from "./object-lens.mjs";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

function makeSvgRectangle(bounds, className) {
  const rectangle = document.createElementNS(SVG_NAMESPACE, "rect");
  rectangle.setAttribute("x", String(bounds.x));
  rectangle.setAttribute("y", String(bounds.y));
  rectangle.setAttribute("width", String(bounds.width));
  rectangle.setAttribute("height", String(bounds.height));
  rectangle.setAttribute("class", className);
  return rectangle;
}

function polygonPointString(points) {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

export function makeSvgShape(geometryType, bounds, points, className) {
  if (geometryType === "ellipse") {
    const ellipse = document.createElementNS(SVG_NAMESPACE, "ellipse");
    ellipse.setAttribute("cx", String(bounds.x + bounds.width / 2));
    ellipse.setAttribute("cy", String(bounds.y + bounds.height / 2));
    ellipse.setAttribute("rx", String(bounds.width / 2));
    ellipse.setAttribute("ry", String(bounds.height / 2));
    ellipse.setAttribute("class", className);
    return ellipse;
  }
  if (geometryType === "polygon") {
    const polygon = document.createElementNS(SVG_NAMESPACE, points.length >= 3 ? "polygon" : "polyline");
    polygon.setAttribute("points", polygonPointString(points));
    polygon.setAttribute("class", className);
    return polygon;
  }
  return makeSvgRectangle(bounds, className);
}

export async function renderObjectLensThumbnail(preview, occurrence, session, isCurrent) {
  const canvas = preview.querySelector("canvas");
  const overlay = preview.querySelector("svg");
  const placeholder = preview.querySelector(".object-lens-placeholder");
  try {
    const page = await session.pdfDocument.getPage(occurrence.page);
    if (!isCurrent() || !preview.isConnected) {
      return;
    }

    const baseViewport = page.getViewport({ scale: 1 });
    const contextBounds = objectLensContextBounds(
      occurrence.bounds,
      baseViewport.width / baseViewport.height,
    );
    const logicalWidth = 260;
    const scale = logicalWidth / (baseViewport.width * contextBounds.width);
    const viewport = page.getViewport({ scale });
    const logicalHeight = Math.max(1, Math.round(viewport.height * contextBounds.height));
    const outputScale = Math.max(globalThis.devicePixelRatio || 1, 1);
    const context = canvas.getContext("2d", { alpha: false });
    canvas.width = Math.floor(logicalWidth * outputScale);
    canvas.height = Math.floor(logicalHeight * outputScale);
    canvas.style.aspectRatio = `${logicalWidth} / ${logicalHeight}`;

    const renderTask = page.render({
      canvasContext: context,
      transform: [
        outputScale,
        0,
        0,
        outputScale,
        -contextBounds.x * viewport.width * outputScale,
        -contextBounds.y * viewport.height * outputScale,
      ],
      viewport,
    });
    await renderTask.promise;
    if (!isCurrent() || !preview.isConnected) {
      return;
    }

    overlay.setAttribute(
      "viewBox",
      `${contextBounds.x} ${contextBounds.y} ${contextBounds.width} ${contextBounds.height}`,
    );
    overlay.replaceChildren(makeSvgShape(
      occurrence.geometryType,
      occurrence.bounds,
      occurrence.points,
      "object-lens-mark",
    ));
    placeholder.hidden = true;
    preview.classList.add("is-ready");
  } catch (error) {
    if (error?.name !== "RenderingCancelledException" && isCurrent()) {
      placeholder.textContent = "Preview unavailable";
      preview.classList.add("has-error");
    }
  } finally {
    if (isCurrent() && preview.isConnected) {
      preview.removeAttribute("aria-busy");
    }
  }
}

function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("The browser could not encode a preview image."));
      }
    }, "image/png");
  });
}

function drawEvidencePreviewMark(context, occurrence, contextBounds, width, height) {
  const x = (value) => ((value - contextBounds.x) / contextBounds.width) * width;
  const y = (value) => ((value - contextBounds.y) / contextBounds.height) * height;
  const style = getComputedStyle(document.documentElement);
  context.fillStyle = style.getPropertyValue("--selection-soft").trim();
  context.strokeStyle = style.getPropertyValue("--selection").trim();
  context.lineWidth = 4;
  context.beginPath();
  if (occurrence.geometryType === "ellipse") {
    context.ellipse(
      x(occurrence.bounds.x + occurrence.bounds.width / 2),
      y(occurrence.bounds.y + occurrence.bounds.height / 2),
      occurrence.bounds.width / contextBounds.width * width / 2,
      occurrence.bounds.height / contextBounds.height * height / 2,
      0,
      0,
      Math.PI * 2,
    );
  } else if (occurrence.geometryType === "polygon") {
    occurrence.points.forEach((point, index) => {
      if (index === 0) {
        context.moveTo(x(point.x), y(point.y));
      } else {
        context.lineTo(x(point.x), y(point.y));
      }
    });
    context.closePath();
  } else {
    context.rect(
      x(occurrence.bounds.x),
      y(occurrence.bounds.y),
      occurrence.bounds.width / contextBounds.width * width,
      occurrence.bounds.height / contextBounds.height * height,
    );
  }
  context.fill();
  context.stroke();
}

async function renderEvidencePreviewCanvas(occurrence, session) {
  const page = await session.pdfDocument.getPage(occurrence.page);
  const baseViewport = page.getViewport({ scale: 1 });
  const contextBounds = objectLensContextBounds(
    occurrence.bounds,
    baseViewport.width / baseViewport.height,
  );
  const width = 520;
  const scale = width / (baseViewport.width * contextBounds.width);
  const viewport = page.getViewport({ scale });
  const height = Math.max(1, Math.round(viewport.height * contextBounds.height));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  await page.render({
    canvasContext: context,
    transform: [1, 0, 0, 1, -contextBounds.x * viewport.width, -contextBounds.y * viewport.height],
    viewport,
  }).promise;
  return {
    canvas,
    context,
    contextBounds,
    width,
    height,
  };
}

export async function renderEvidencePreviewAsset(occurrence, session) {
  const rendered = await renderEvidencePreviewCanvas(occurrence, session);
  drawEvidencePreviewMark(
    rendered.context,
    occurrence,
    rendered.contextBounds,
    rendered.width,
    rendered.height,
  );
  return {
    blob: await canvasToPngBlob(rendered.canvas),
    width: rendered.width,
    height: rendered.height,
  };
}

export async function renderJoineryRepresentationAsset(occurrence, session) {
  const rendered = await renderEvidencePreviewCanvas(occurrence, session);
  const cleanBlob = await canvasToPngBlob(rendered.canvas);
  drawEvidencePreviewMark(
    rendered.context,
    occurrence,
    rendered.contextBounds,
    rendered.width,
    rendered.height,
  );
  return {
    ...rendered,
    cleanBlob,
    markedBlob: await canvasToPngBlob(rendered.canvas),
  };
}

export async function createJoineryContactSheet(object, renderedAssets) {
  const sheetWidth = 1400;
  const margin = 40;
  const gap = 28;
  const columns = 2;
  const cardWidth = (sheetWidth - margin * 2 - gap) / columns;
  const imageWidth = cardWidth - 24;
  const headerHeight = 126;
  const cardMetrics = renderedAssets.map((asset) => ({
    ...asset,
    displayHeight: Math.min(440, Math.max(180, Math.round(imageWidth * asset.height / asset.width))),
  }));
  const rowHeights = [];
  for (let index = 0; index < cardMetrics.length; index += columns) {
    rowHeights.push(Math.max(...cardMetrics.slice(index, index + columns).map((asset) => asset.displayHeight + 78)));
  }
  const sheetHeight = headerHeight + margin + rowHeights.reduce((total, height) => total + height, 0) + gap * Math.max(0, rowHeights.length - 1);
  const canvas = document.createElement("canvas");
  canvas.width = sheetWidth;
  canvas.height = sheetHeight;
  const context = canvas.getContext("2d", { alpha: false });
  const style = getComputedStyle(document.documentElement);
  const background = style.getPropertyValue("--white").trim();
  const ink = style.getPropertyValue("--ink").trim();
  const inkSoft = style.getPropertyValue("--ink-soft").trim();
  const line = style.getPropertyValue("--line").trim();
  context.fillStyle = background;
  context.fillRect(0, 0, sheetWidth, sheetHeight);
  context.fillStyle = ink;
  context.font = "700 30px system-ui, sans-serif";
  context.fillText(`${object.label} · Joinery AI evidence`, margin, 50);
  context.fillStyle = inkSoft;
  context.font = "18px system-ui, sans-serif";
  context.fillText(`${object.id} · ${renderedAssets.length} representation${renderedAssets.length === 1 ? "" : "s"} · all images refer to the same physical object`, margin, 82);
  context.fillText("Blue marks identify the object. Clean source crops are included separately in the package.", margin, 108);

  let rowTop = headerHeight + margin;
  for (let index = 0; index < cardMetrics.length; index += 1) {
    const asset = cardMetrics[index];
    const column = index % columns;
    const row = Math.floor(index / columns);
    if (column === 0 && row > 0) {
      rowTop += rowHeights[row - 1] + gap;
    }
    const x = margin + column * (cardWidth + gap);
    context.strokeStyle = line;
    context.lineWidth = 2;
    context.strokeRect(x, rowTop, cardWidth, asset.displayHeight + 70);
    context.drawImage(asset.canvas, x + 12, rowTop + 12, imageWidth, asset.displayHeight);
    context.fillStyle = ink;
    context.font = "700 17px system-ui, sans-serif";
    context.fillText(`${asset.documentName} · page ${asset.page}`, x + 12, rowTop + asset.displayHeight + 40);
    context.fillStyle = inkSoft;
    context.font = "15px ui-monospace, monospace";
    context.fillText(asset.occurrenceId, x + 12, rowTop + asset.displayHeight + 61);
  }
  return canvasToPngBlob(canvas);
}
