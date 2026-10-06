import * as pdfjsLib from "./vendor/pdfjs/pdf.mjs";
import {
  boundsFromPoints,
  boundsFromPolygonPoints,
  boundsSizeInPixels,
  clamp,
  meetsMinimumMarkSize,
  moveBounds,
  movePolygonPoints,
  normalizeRotation,
  pointsAreEqual,
  polygonArea,
  pointFromClient,
  resizeBounds,
  resizePolygonPoints,
  rotateBounds,
  rotationTransform,
  unrotatePoint,
  unrotatedSize,
} from "./geometry.mjs";
import {
  createObject,
  createOccurrence,
  deleteObjectPreservingOccurrences,
  getObjectOccurrences,
  linkOccurrence,
  normalizeLabel,
  removeOccurrence,
  updateObjectDetails,
} from "./object-model.mjs";
import {
  DEFAULT_OBJECT_CATEGORY,
  OBJECT_CATEGORY_GROUPS,
  filterObjectCategoryGroups,
  objectCategoryCode,
  objectCategoryLabel,
} from "./category-catalog.mjs";
import {
  applyDisplayPreferences,
  createDisplayState,
  displayPreferences,
  groupObjectsForBrowser,
  occurrenceVisibility,
  toggleSetMember,
} from "./display-filter.mjs";
import {
  compareDocumentFingerprint,
  createDocumentFingerprint,
  createSidecar,
  nextDocumentId,
  sha256Hex,
  toRuntimeOccurrences,
  validateSidecar,
} from "./sidecar.mjs";
import {
  ViewHistory,
  stepObjectOccurrence,
  createFitPageView,
  isShortcutBlockedTarget,
  keyboardShortcutAction,
  nextFocusIndex,
  stepZoom,
  wheelDeltaPixels,
  wheelNavigationAction,
  wheelZoomScale,
} from "./navigation.mjs";
import {
  canRemoveDocument,
  chooseObjectOccurrence,
  findDocumentByFingerprint,
  occurrenceCountForDocument,
} from "./project-documents.mjs";
import {
  boundsAreEqual,
  createObjectLayerSnapshot,
  ObjectLayerHistory,
} from "./history.mjs";
import { ObjectLayerSaveState } from "./session-state.mjs";
import {
  sortObjectRepresentations,
  summarizeObjectLens,
} from "./object-lens.mjs";
import {
  createJoineryContactSheet,
  makeSvgShape,
  renderEvidencePreviewAsset,
  renderJoineryRepresentationAsset,
  renderObjectLensThumbnail,
} from "./representation-rendering.mjs";
import { PdfTextLayerRenderer } from "./pdf-text-layer.mjs?v=2026-10-02-selection-relocation";
import {
  buildPdfTextIndex,
  findPdfTextMatches,
  stepPdfMatchIndex,
} from "./pdf-search.mjs";
import {
  buildDrawingMap,
  summarizeDrawingMap,
} from "./drawing-map.mjs";
import { createObjectEvidencePackage } from "./object-evidence-package.mjs";
import {
  createEvidenceAssetIndex,
  evidenceExportStem,
} from "./evidence-export.mjs";
import {
  canCreateJoineryAiHandoff,
  createJoineryAiHandoffIndex,
  createJoineryAiInstructions,
} from "./joinery-ai-handoff.mjs";
import { createStoredZip } from "./zip-store.mjs";
import {
  conflictsForObject,
  createObservation,
  evidenceSummary,
  removeObservation,
  updateObservationReviewState,
} from "./evidence-model.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = "./vendor/pdfjs/pdf.worker.mjs";

const PDF_OPTIONS = {
  cMapUrl: "./vendor/pdfjs/cmaps/",
  cMapPacked: true,
  standardFontDataUrl: "./vendor/pdfjs/standard_fonts/",
};

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const MINIMUM_MARK_SIZE = 7;
const ZOOM_STEP = 1.18;
const MINIMUM_SCALE = 0.15;
const MAXIMUM_SCALE = 5;
const WHEEL_ZOOM_SENSITIVITY = 0.002;
const WHEEL_ZOOM_COMMIT_DELAY = 140;
const WHEEL_PAGE_THRESHOLD = 90;
const WHEEL_PAGE_COOLDOWN = 420;

const elements = {
  pdfFile: document.querySelector("#pdfFile"),
  documentName: document.querySelector("#documentName"),
  previousPage: document.querySelector("#previousPage"),
  nextPage: document.querySelector("#nextPage"),
  pageNumber: document.querySelector("#pageNumber"),
  pageCount: document.querySelector("#pageCount"),
  zoomOut: document.querySelector("#zoomOut"),
  zoomIn: document.querySelector("#zoomIn"),
  zoomValue: document.querySelector("#zoomValue"),
  actualSize: document.querySelector("#actualSize"),
  fitWidth: document.querySelector("#fitWidth"),
  fitPage: document.querySelector("#fitPage"),
  shapeTool: document.querySelector("#shapeTool"),
  markOccurrence: document.querySelector("#markOccurrence"),
  openPdfSearch: document.querySelector("#openPdfSearch"),
  pdfSearchBar: document.querySelector("#pdfSearchBar"),
  pdfSearchInput: document.querySelector("#pdfSearchInput"),
  pdfSearchCount: document.querySelector("#pdfSearchCount"),
  previousPdfSearchMatch: document.querySelector("#previousPdfSearchMatch"),
  nextPdfSearchMatch: document.querySelector("#nextPdfSearchMatch"),
  closePdfSearch: document.querySelector("#closePdfSearch"),
  openDrawingMap: document.querySelector("#openDrawingMap"),
  drawingMapDialog: document.querySelector("#drawingMapDialog"),
  closeDrawingMap: document.querySelector("#closeDrawingMap"),
  shortcutHelp: document.querySelector("#shortcutHelp"),
  shortcutPanel: document.querySelector("#shortcutPanel"),
  closeShortcutHelp: document.querySelector("#closeShortcutHelp"),
  undoAction: document.querySelector("#undoAction"),
  redoAction: document.querySelector("#redoAction"),
  viewerStage: document.querySelector("#viewerStage"),
  emptyState: document.querySelector("#emptyState"),
  emptyEyebrow: document.querySelector("#emptyEyebrow"),
  emptyTitle: document.querySelector("#emptyTitle"),
  emptyDescription: document.querySelector("#emptyDescription"),
  emptyChoosePdf: document.querySelector("#emptyChoosePdf"),
  pageSurface: document.querySelector("#pageSurface"),
  pageContent: document.querySelector("#pageContent"),
  pdfCanvas: document.querySelector("#pdfCanvas"),
  textLayer: document.querySelector("#pdfTextLayer"),
  overlay: document.querySelector("#occurrenceOverlay"),
  renderingIndicator: document.querySelector("#renderingIndicator"),
  markingGuide: document.querySelector("#markingGuide"),
  markingGuideText: document.querySelector("#markingGuideText"),
  statusMessage: document.querySelector("#statusMessage"),
  documentSummary: document.querySelector("#documentSummary"),
  objectBadge: document.querySelector("#objectBadge"),
  documentBadge: document.querySelector("#documentBadge"),
  drawingMapBadge: document.querySelector("#drawingMapBadge"),
  drawingMapHelp: document.querySelector("#drawingMapHelp"),
  drawingMap: document.querySelector("#drawingMap"),
  documentHelp: document.querySelector("#documentHelp"),
  documentList: document.querySelector("#documentList"),
  relinkPdfFile: document.querySelector("#relinkPdfFile"),
  objectComposer: document.querySelector("#objectComposer"),
  objectFormTitle: document.querySelector("#objectFormTitle"),
  objectFormHint: document.querySelector("#objectFormHint"),
  createObjectForm: document.querySelector("#createObjectForm"),
  categoryFilter: document.querySelector("#categoryFilter"),
  objectCategory: document.querySelector("#objectCategory"),
  objectLabel: document.querySelector("#objectLabel"),
  createObjectButton: document.querySelector("#createObjectButton"),
  linkExistingBlock: document.querySelector("#linkExistingBlock"),
  existingObjectSelect: document.querySelector("#existingObjectSelect"),
  linkExistingObject: document.querySelector("#linkExistingObject"),
  noObjects: document.querySelector("#noObjects"),
  noObjectMatches: document.querySelector("#noObjectMatches"),
  objectSearch: document.querySelector("#objectSearch"),
  markFocus: document.querySelector("#markFocus"),
  groupBy: document.querySelector("#groupBy"),
  currentPageOnly: document.querySelector("#currentPageOnly"),
  showLabels: document.querySelector("#showLabels"),
  markLabels: document.querySelector("#markLabels"),
  toggleThumbnails: document.querySelector("#toggleThumbnails"),
  rotateView: document.querySelector("#rotateView"),
  thumbnailPanel: document.querySelector("#thumbnailPanel"),
  thumbnailList: document.querySelector("#thumbnailList"),
  sidePanel: document.querySelector(".side-panel"),
  browserPane: document.querySelector("#browserPane"),
  paneSplitter: document.querySelector("#paneSplitter"),
  propertiesEmpty: document.querySelector("#propertiesEmpty"),
  documentSection: document.querySelector("#documentSection"),
  objectList: document.querySelector("#objectList"),
  selectedObjectPanel: document.querySelector("#selectedObjectPanel"),
  selectedObjectTitle: document.querySelector("#selectedObjectTitle"),
  selectedObjectIdentity: document.querySelector("#selectedObjectIdentity"),
  objectLensSummary: document.querySelector("#objectLensSummary"),
  objectExportMenu: document.querySelector("#objectExportMenu"),
  exportObjectEvidence: document.querySelector("#exportObjectEvidence"),
  exportObjectEvidenceZip: document.querySelector("#exportObjectEvidenceZip"),
  exportJoineryAiPack: document.querySelector("#exportJoineryAiPack"),
  joineryAiHint: document.querySelector("#joineryAiHint"),
  evidenceExportStatus: document.querySelector("#evidenceExportStatus"),
  evidenceReviewPanel: document.querySelector("#evidenceReviewPanel"),
  evidenceReviewCount: document.querySelector("#evidenceReviewCount"),
  evidenceConflictSummary: document.querySelector("#evidenceConflictSummary"),
  addEvidenceForm: document.querySelector("#addEvidenceForm"),
  evidenceTopic: document.querySelector("#evidenceTopic"),
  evidenceValue: document.querySelector("#evidenceValue"),
  evidenceKind: document.querySelector("#evidenceKind"),
  evidenceSource: document.querySelector("#evidenceSource"),
  addEvidence: document.querySelector("#addEvidence"),
  noEvidence: document.querySelector("#noEvidence"),
  evidenceList: document.querySelector("#evidenceList"),
  editObjectLabel: document.querySelector("#editObjectLabel"),
  editObjectCategory: document.querySelector("#editObjectCategory"),
  saveObjectLabel: document.querySelector("#saveObjectLabel"),
  markForObject: document.querySelector("#markForObject"),
  deleteObject: document.querySelector("#deleteObject"),
  selectedOccurrenceCount: document.querySelector("#selectedOccurrenceCount"),
  noObjectOccurrences: document.querySelector("#noObjectOccurrences"),
  openRepresentationBoard: document.querySelector("#openRepresentationBoard"),
  representationBoard: document.querySelector("#representationBoard"),
  representationBoardTitle: document.querySelector("#representationBoardTitle"),
  representationBoardSummary: document.querySelector("#representationBoardSummary"),
  representationBoardGrid: document.querySelector("#representationBoardGrid"),
  closeRepresentationBoard: document.querySelector("#closeRepresentationBoard"),
  unlinkedSection: document.querySelector("#unlinkedSection"),
  unlinkedCount: document.querySelector("#unlinkedCount"),
  unlinkedList: document.querySelector("#unlinkedList"),
  exportSidecar: document.querySelector("#exportSidecar"),
  chooseSidecar: document.querySelector("#chooseSidecar"),
  sidecarFile: document.querySelector("#sidecarFile"),
  sidecarStatus: document.querySelector("#sidecarStatus"),
  saveState: document.querySelector("#saveState"),
};

const state = {
  pdfDocument: null,
  loadingTask: null,
  renderTask: null,
  renderGeneration: 0,
  fileName: "",
  documentFingerprint: null,
  documents: [],
  activeDocumentId: null,
  pageNumber: 1,
  scale: 1,
  zoomMode: "fit-page",
  // View rotation on top of the page's own. Saved geometry never rotates.
  rotation: 0,
  markMode: false,
  markGeometryType: "rectangle",
  linkTargetObjectId: null,
  objects: [],
  occurrences: [],
  observations: [],
  selectedObjectId: null,
  selectedOccurrenceId: null,
  interaction: null,
  documentSessions: new Map(),
  documentViews: new Map(),
  pendingRelinkDocumentId: null,
  // View-only browser and canvas filters. Never saved in the project file.
  display: applyDisplayPreferences(createDisplayState(), readDisplayPreferences()),
};

let wheelPageAccumulator = 0;
let lastWheelPageNavigation = Number.NEGATIVE_INFINITY;
let wheelZoomCommitTimer = null;
let wheelZoomAnchor = null;
let renderedPageMetrics = null;
let spacePanActive = false;
let panInteraction = null;
let representationBoardGeneration = 0;
// The object whose browser group was last opened and scrolled to. Selecting a different
// object reveals it once; after that, the user may collapse its group again.
let revealedObjectId = null;
// Back/forward through jumps (Alt + arrows).
const viewHistory = new ViewHistory(50);
// What "H" restores when marks are shown again.
let markFocusBeforeHiding = "all";
let pdfSearchInputTimer = null;
const pdfSearchState = {
  generation: 0,
  documentId: null,
  query: "",
  matches: [],
  activeIndex: -1,
  indexing: false,
};

const objectHistory = new ObjectLayerHistory(100);
const objectLayerSaveState = new ObjectLayerSaveState();
const pdfTextLayer = new PdfTextLayerRenderer(elements.textLayer, pdfjsLib.TextLayer);

// View preferences are per browser and best effort: storage can be blocked or full.
function readDisplayPreferences() {
  try {
    return JSON.parse(localStorage.getItem("objdraw-display") ?? "null");
  } catch {
    return null;
  }
}

function saveDisplayPreferences() {
  try {
    localStorage.setItem("objdraw-display", JSON.stringify(displayPreferences(state.display)));
  } catch {
    // The view still works; the choice is just not remembered.
  }
}

function syncDisplayControls() {
  elements.markFocus.value = state.display.markFocus;
  elements.groupBy.value = state.display.groupBy;
  elements.currentPageOnly.checked = state.display.currentPageOnly;
  elements.showLabels.checked = state.display.showLabels;
}

function setStatus(message) {
  elements.statusMessage.textContent = message;
}

function populateCategorySelect(select, groups, preferredKey = DEFAULT_OBJECT_CATEGORY) {
  select.replaceChildren();
  const availableKeys = new Set();
  for (const group of groups) {
    const optgroup = document.createElement("optgroup");
    optgroup.label = group.label;
    for (const category of group.categories) {
      const option = document.createElement("option");
      option.value = category.key;
      option.textContent = category.label;
      availableKeys.add(category.key);
      optgroup.append(option);
    }
    select.append(optgroup);
  }
  const selectedKey = availableKeys.has(preferredKey) ? preferredKey : availableKeys.values().next().value;
  if (selectedKey) {
    select.value = selectedKey;
  } else {
    const option = document.createElement("option");
    option.textContent = "No matching categories";
    option.disabled = true;
    select.append(option);
  }
  return Boolean(selectedKey);
}

function refreshCreateCategoryOptions() {
  const preferredKey = elements.objectCategory.value || DEFAULT_OBJECT_CATEGORY;
  const hasCategory = populateCategorySelect(
    elements.objectCategory,
    filterObjectCategoryGroups(elements.categoryFilter.value),
    preferredKey,
  );
  elements.objectCategory.disabled = !state.pdfDocument || !hasCategory;
  elements.createObjectButton.disabled = !state.pdfDocument || !hasCategory;
}

function setShortcutHelpOpen(open) {
  const isOpen = Boolean(open);
  elements.shortcutPanel.hidden = !isOpen;
  elements.shortcutHelp.setAttribute("aria-expanded", String(isOpen));
}

function updatePdfSearchControls() {
  const hasMatches = pdfSearchState.matches.length > 0;
  elements.previousPdfSearchMatch.disabled = pdfSearchState.indexing || !hasMatches;
  elements.nextPdfSearchMatch.disabled = pdfSearchState.indexing || !hasMatches;
  if (pdfSearchState.indexing) {
    return;
  }
  elements.pdfSearchCount.textContent = !pdfSearchState.query
    ? "Type to find"
    : hasMatches
      ? `${pdfSearchState.activeIndex + 1} / ${pdfSearchState.matches.length}`
      : "No matches";
}

function renderPdfSearchHighlights({ scrollActive = false } = {}) {
  const textDivs = pdfTextLayer.textDivs;
  for (const textDiv of textDivs) {
    if (textDiv?.querySelector?.(".pdf-search-highlight")) {
      textDiv.textContent = textDiv.textContent;
    }
  }
  if (!pdfSearchState.query || pdfSearchState.matches.length === 0) {
    return;
  }

  const pageMatches = pdfSearchState.matches
    .map((match, matchIndex) => ({ ...match, matchIndex }))
    .filter((match) => match.pageNumber === state.pageNumber);
  const segmentsByTextDiv = new Map();
  for (const match of pageMatches) {
    for (const segment of match.segments) {
      const segments = segmentsByTextDiv.get(segment.textDivIndex) ?? [];
      segments.push({
        ...segment,
        active: match.matchIndex === pdfSearchState.activeIndex,
      });
      segmentsByTextDiv.set(segment.textDivIndex, segments);
    }
  }

  let activeHighlight = null;
  for (const [textDivIndex, segments] of segmentsByTextDiv) {
    const textDiv = textDivs[textDivIndex];
    if (!textDiv?.isConnected) {
      continue;
    }
    const text = textDiv.textContent ?? "";
    const fragment = document.createDocumentFragment();
    let offset = 0;
    for (const segment of segments.sort((left, right) => left.start - right.start)) {
      const start = clamp(segment.start, offset, text.length);
      const end = clamp(segment.end, start, text.length);
      if (start > offset) {
        fragment.append(document.createTextNode(text.slice(offset, start)));
      }
      const highlight = document.createElement("mark");
      highlight.className = `pdf-search-highlight${segment.active ? " is-active" : ""}`;
      highlight.textContent = text.slice(start, end);
      fragment.append(highlight);
      if (segment.active && !activeHighlight) {
        activeHighlight = highlight;
      }
      offset = end;
    }
    if (offset < text.length) {
      fragment.append(document.createTextNode(text.slice(offset)));
    }
    textDiv.replaceChildren(fragment);
  }

  if (scrollActive && activeHighlight) {
    activeHighlight.scrollIntoView({ block: "center", inline: "center" });
  }
}

function resetPdfSearch({ close = true } = {}) {
  clearTimeout(pdfSearchInputTimer);
  pdfSearchInputTimer = null;
  pdfSearchState.generation += 1;
  pdfSearchState.documentId = null;
  pdfSearchState.query = "";
  pdfSearchState.matches = [];
  pdfSearchState.activeIndex = -1;
  pdfSearchState.indexing = false;
  elements.pdfSearchInput.value = "";
  if (close) {
    elements.pdfSearchBar.hidden = true;
  }
  updatePdfSearchControls();
  renderPdfSearchHighlights();
}

function openPdfSearch() {
  if (!state.pdfDocument) {
    return;
  }
  setMarkMode(false);
  setShortcutHelpOpen(false);
  elements.pdfSearchBar.hidden = false;
  pdfSearchState.documentId = state.activeDocumentId;
  updatePdfSearchControls();
  elements.pdfSearchInput.focus();
  elements.pdfSearchInput.select();
}

function closePdfSearch({ restoreFocus = true } = {}) {
  resetPdfSearch();
  if (restoreFocus && !elements.openPdfSearch.disabled) {
    elements.openPdfSearch.focus();
  }
}

function getPdfTextSearchIndex(documentId) {
  const session = getDocumentSession(documentId);
  if (!session) {
    return Promise.reject(new Error("The active PDF is no longer attached."));
  }
  if (!session.textSearchIndexPromise) {
    session.textSearchIndexPromise = buildPdfTextIndex(session.pdfDocument, (pageNumber, total) => {
      if (
        !elements.pdfSearchBar.hidden
        && pdfSearchState.indexing
        && pdfSearchState.documentId === documentId
      ) {
        elements.pdfSearchCount.textContent = `${pageNumber} / ${total} pages`;
      }
    }).catch((error) => {
      delete session.textSearchIndexPromise;
      throw error;
    });
  }
  return session.textSearchIndexPromise;
}

async function navigateToPdfSearchMatch() {
  const match = pdfSearchState.matches[pdfSearchState.activeIndex];
  if (!match || pdfSearchState.documentId !== state.activeDocumentId) {
    return;
  }
  if (match.pageNumber !== state.pageNumber) {
    await navigateToPage(match.pageNumber);
  }
  renderPdfSearchHighlights({ scrollActive: true });
  updatePdfSearchControls();
}

async function runPdfSearch() {
  clearTimeout(pdfSearchInputTimer);
  pdfSearchInputTimer = null;
  const documentId = state.activeDocumentId;
  const query = elements.pdfSearchInput.value.trim();
  const generation = ++pdfSearchState.generation;
  pdfSearchState.documentId = documentId;
  pdfSearchState.query = query;
  pdfSearchState.matches = [];
  pdfSearchState.activeIndex = -1;
  pdfSearchState.indexing = Boolean(query);
  updatePdfSearchControls();
  renderPdfSearchHighlights();
  if (!query || !documentId || !state.pdfDocument) {
    pdfSearchState.indexing = false;
    updatePdfSearchControls();
    return;
  }

  try {
    const indexedPages = await getPdfTextSearchIndex(documentId);
    if (
      generation !== pdfSearchState.generation
      || documentId !== state.activeDocumentId
      || query !== pdfSearchState.query
    ) {
      return;
    }
    pdfSearchState.matches = findPdfTextMatches(indexedPages, query);
    pdfSearchState.activeIndex = pdfSearchState.matches.length > 0 ? 0 : -1;
    pdfSearchState.indexing = false;
    updatePdfSearchControls();
    if (pdfSearchState.matches.length > 0) {
      await navigateToPdfSearchMatch();
      setStatus(`${pdfSearchState.matches.length} match${pdfSearchState.matches.length === 1 ? "" : "es"} for “${query}” in the current PDF.`);
    } else {
      renderPdfSearchHighlights();
      setStatus(`No matches for “${query}” in the current PDF.`);
    }
  } catch (error) {
    if (generation !== pdfSearchState.generation) {
      return;
    }
    console.error(error);
    pdfSearchState.indexing = false;
    elements.pdfSearchCount.textContent = "Search failed";
    setStatus("The current PDF could not be searched.");
  }
}

async function movePdfSearchMatch(direction) {
  if (pdfSearchState.matches.length === 0 || pdfSearchState.indexing) {
    return;
  }
  pdfSearchState.activeIndex = stepPdfMatchIndex(
    pdfSearchState.activeIndex,
    pdfSearchState.matches.length,
    direction,
  );
  await navigateToPdfSearchMatch();
}

function schedulePdfSearch() {
  clearTimeout(pdfSearchInputTimer);
  if (!elements.pdfSearchInput.value.trim()) {
    void runPdfSearch();
    return;
  }
  pdfSearchInputTimer = setTimeout(() => {
    void runPdfSearch();
  }, 160);
}

function dialogIsOpen(dialog) {
  return dialog.hasAttribute("open");
}

function showDialog(dialog) {
  if (typeof dialog.showModal === "function") {
    dialog.showModal();
    return;
  }
  dialog.setAttribute("open", "");
}

function hideDialog(dialog) {
  if (!dialogIsOpen(dialog)) {
    return;
  }
  if (typeof dialog.close === "function") {
    dialog.close();
    return;
  }
  dialog.removeAttribute("open");
  dialog.dispatchEvent(new Event("close"));
}

function currentObjectLayerSnapshot() {
  return createObjectLayerSnapshot(state);
}

function currentProjectSnapshot() {
  return {
    ...currentObjectLayerSnapshot(),
    documents: state.documents.map((document) => ({ ...document })),
  };
}

function hasUnsavedObjectLayerChanges() {
  return state.documents.length > 0 && objectLayerSaveState.isDirty(currentProjectSnapshot());
}

function updateSaveState() {
  const hasDocument = state.documents.length > 0;
  const isDirty = hasUnsavedObjectLayerChanges();
  elements.saveState.textContent = !hasDocument
    ? "No project"
    : isDirty
      ? "Unsaved changes"
      : "Saved";
  elements.saveState.dataset.dirty = String(isDirty);
  document.title = isDirty ? "Object-Centric Drawing — Unsaved changes" : "Object-Centric Drawing";
}

function markObjectLayerSaved() {
  objectLayerSaveState.markSaved(currentProjectSnapshot());
  updateSaveState();
}

function updateHistoryControls() {
  const enabled = state.documents.length > 0;
  elements.undoAction.disabled = !enabled || !objectHistory.canUndo;
  elements.redoAction.disabled = !enabled || !objectHistory.canRedo;
  elements.undoAction.title = objectHistory.undoLabel
    ? `Undo ${objectHistory.undoLabel} (Ctrl+Z)`
    : "Nothing to undo (Ctrl+Z)";
  elements.redoAction.title = objectHistory.redoLabel
    ? `Redo ${objectHistory.redoLabel} (Ctrl+Y)`
    : "Nothing to redo (Ctrl+Y)";
}

function resetObjectHistory() {
  objectHistory.reset();
  updateHistoryControls();
}

function recordObjectMutation(label, snapshot = currentObjectLayerSnapshot()) {
  objectHistory.record(snapshot, label);
  updateHistoryControls();
}

function restoreObjectLayerSnapshot(snapshot) {
  state.objects = snapshot.objects;
  state.occurrences = snapshot.occurrences;
  state.observations = snapshot.observations;
  state.selectedObjectId = snapshot.selectedObjectId;
  state.selectedOccurrenceId = snapshot.selectedOccurrenceId;
  state.interaction = null;
  setMarkMode(false);
  refreshUi();
}

function focusSelectedOccurrenceRectangle() {
  // Shapes sit inside the rotation group, so search the whole overlay, not its direct children.
  const focusedRectangle = Array.from(elements.overlay.querySelectorAll("[data-occurrence-id]"))
    .find((element) => element.dataset.occurrenceId === state.selectedOccurrenceId);
  focusedRectangle?.focus();
  return Boolean(focusedRectangle);
}

function applyHistory(direction) {
  const result = direction === "undo"
    ? objectHistory.undo(currentObjectLayerSnapshot())
    : objectHistory.redo(currentObjectLayerSnapshot());
  if (!result) {
    return;
  }

  const restoreCanvasFocus = document.activeElement?.classList.contains("occurrence-shape");
  restoreObjectLayerSnapshot(result.snapshot);
  updateHistoryControls();
  if (restoreCanvasFocus) {
    focusSelectedOccurrenceRectangle();
  }
  const objectLabel = `${state.objects.length} object${state.objects.length === 1 ? "" : "s"}`;
  const occurrenceLabel = `${state.occurrences.length} occurrence${state.occurrences.length === 1 ? "" : "s"}`;
  const evidenceLabel = `${state.observations.length} evidence entr${state.observations.length === 1 ? "y" : "ies"}`;
  setStatus(`${direction === "undo" ? "Undid" : "Redid"} ${result.label}. ${objectLabel}, ${occurrenceLabel}, ${evidenceLabel}.`);
}

function setDocumentControlsEnabled(enabled) {
  for (const control of [
    elements.previousPage,
    elements.nextPage,
    elements.pageNumber,
    elements.zoomOut,
    elements.zoomIn,
    elements.actualSize,
    elements.fitWidth,
    elements.fitPage,
    elements.rotateView,
    elements.toggleThumbnails,
    elements.shapeTool,
    elements.markOccurrence,
    elements.openPdfSearch,
    elements.categoryFilter,
    elements.objectCategory,
    elements.objectLabel,
    elements.createObjectButton,
  ]) {
    control.disabled = !enabled;
  }
  const hasProject = state.documents.length > 0;
  const hasSelection = Boolean(getOccurrence(state.selectedOccurrenceId));
  elements.existingObjectSelect.disabled = !hasProject || !hasSelection;
  elements.linkExistingObject.disabled = !hasProject || !hasSelection;
  elements.editObjectLabel.disabled = !hasProject;
  elements.editObjectCategory.disabled = !hasProject;
  elements.saveObjectLabel.disabled = !hasProject;
  elements.deleteObject.disabled = !hasProject;
  elements.markForObject.disabled = !enabled || !state.selectedObjectId;
  elements.exportSidecar.disabled = !hasProject;
  elements.chooseSidecar.disabled = false;
  updateHistoryControls();
  updateSaveState();
}

function setSidecarMessage(message = "", isError = false) {
  elements.sidecarStatus.textContent = message;
  elements.sidecarStatus.hidden = !message;
  elements.sidecarStatus.classList.toggle("is-error", isError);
}

function getObject(id) {
  return state.objects.find((object) => object.id === id) ?? null;
}

function getOccurrence(id) {
  return state.occurrences.find((occurrence) => occurrence.id === id) ?? null;
}

function getProjectDocument(id) {
  return state.documents.find((document) => document.id === id) ?? null;
}

function getDocumentSession(id) {
  return state.documentSessions.get(id) ?? null;
}

function attachedDocumentIds() {
  return Array.from(state.documentSessions.keys());
}

function documentView(documentId) {
  if (!state.documentViews.has(documentId)) {
    state.documentViews.set(documentId, createFitPageView());
  }
  return state.documentViews.get(documentId);
}

function resetDocumentViewToFit(documentId) {
  const view = documentView(documentId);
  Object.assign(view, createFitPageView());
  return view;
}

function saveActiveDocumentView() {
  if (!state.activeDocumentId) {
    return;
  }
  const view = documentView(state.activeDocumentId);
  view.pageNumber = state.pageNumber;
  view.scale = state.scale;
  view.zoomMode = state.zoomMode;
  view.rotation = state.rotation;
  view.scrollLeft = elements.viewerStage.scrollLeft;
  view.scrollTop = elements.viewerStage.scrollTop;
}

function renderDocumentList() {
  elements.documentList.replaceChildren();
  elements.documentBadge.textContent = String(state.documents.length);
  const attachedCount = state.documentSessions.size;
  elements.documentHelp.textContent = state.documents.length === 0
    ? "Add PDFs directly, or import a project and relink its source files."
    : `${attachedCount} of ${state.documents.length} PDF${state.documents.length === 1 ? "" : "s"} attached locally.`;

  if (state.documents.some((projectDocument) => !getDocumentSession(projectDocument.id))) {
    elements.documentSection.open = true;
  }

  for (const projectDocument of state.documents) {
    const item = document.createElement("li");
    const row = document.createElement("div");
    const selectButton = document.createElement("button");
    const copy = document.createElement("span");
    const title = document.createElement("strong");
    const details = document.createElement("small");
    const attachmentState = document.createElement("span");
    const actions = document.createElement("div");
    const attachButton = document.createElement("button");
    const removeButton = document.createElement("button");
    const attached = Boolean(getDocumentSession(projectDocument.id));
    const occurrenceCount = occurrenceCountForDocument(state.occurrences, projectDocument.id);

    row.className = "document-row";
    selectButton.type = "button";
    selectButton.className = "document-select";
    selectButton.dataset.documentId = projectDocument.id;
    selectButton.dataset.action = "select-document";
    selectButton.setAttribute("aria-current", String(projectDocument.id === state.activeDocumentId));
    copy.className = "document-copy";
    title.textContent = projectDocument.name;
    details.textContent = `${projectDocument.pageCount} pages · ${occurrenceCount} occurrence${occurrenceCount === 1 ? "" : "s"}`;
    copy.append(title, details);
    attachmentState.className = `document-state${attached ? "" : " is-missing"}`;
    attachmentState.textContent = attached ? "Attached" : "Missing";
    selectButton.append(copy, attachmentState);

    actions.className = "document-actions";
    attachButton.type = "button";
    attachButton.className = "document-action";
    attachButton.dataset.documentId = projectDocument.id;
    attachButton.dataset.action = attached ? "detach-document" : "relink-document";
    attachButton.textContent = attached ? "Detach" : "Relink";
    attachButton.title = attached
      ? `Detach the local file for ${projectDocument.name}`
      : `Relink the local file for ${projectDocument.name}`;

    removeButton.type = "button";
    removeButton.className = "document-action";
    removeButton.dataset.documentId = projectDocument.id;
    removeButton.dataset.action = "remove-document";
    removeButton.textContent = "Remove";
    const removalWouldDiscardProjectObjects = state.documents.length === 1 && state.objects.length > 0;
    removeButton.disabled = !canRemoveDocument(state.occurrences, projectDocument.id)
      || removalWouldDiscardProjectObjects;
    removeButton.title = removeButton.disabled
      ? removalWouldDiscardProjectObjects
        ? "The last PDF cannot be removed while objects remain"
        : "Delete this PDF's occurrences before removing it from the project"
      : `Remove ${projectDocument.name} from the project`;
    actions.append(attachButton, removeButton);
    row.append(selectButton, actions);
    item.append(row);
    elements.documentList.append(item);
  }
}

function drawingMapContentSignature() {
  return JSON.stringify({
    documents: state.documents.map((document) => ({
      id: document.id,
      name: document.name,
      pageCount: document.pageCount,
    })),
    attachedDocumentIds: attachedDocumentIds().sort(),
    occurrences: state.occurrences.map((occurrence) => ({
      id: occurrence.id,
      documentId: occurrence.documentId,
      page: occurrence.page,
      objectId: occurrence.objectId,
    })),
  });
}

function updateDrawingMapState() {
  const selectedObject = getObject(state.selectedObjectId);
  for (const documentGroup of elements.drawingMap.querySelectorAll(".drawing-map-document")) {
    const isActive = documentGroup.dataset.documentId === state.activeDocumentId;
    documentGroup.classList.toggle("is-active", isActive);
    if (isActive) {
      documentGroup.open = true;
    }
  }

  for (const pageButton of elements.drawingMap.querySelectorAll(".drawing-map-page")) {
    const isCurrent = pageButton.dataset.documentId === state.activeDocumentId
      && Number(pageButton.dataset.page) === state.pageNumber;
    const objectIds = pageButton.dataset.objectIds?.split(" ").filter(Boolean) ?? [];
    const containsSelectedObject = Boolean(selectedObject && objectIds.includes(selectedObject.id));
    const baseLabel = pageButton.dataset.baseLabel;
    pageButton.setAttribute("aria-current", isCurrent ? "page" : "false");
    pageButton.classList.toggle("has-selected-object", containsSelectedObject);
    pageButton.title = containsSelectedObject
      ? `${baseLabel}. Contains ${selectedObject.label} (${selectedObject.id}).`
      : baseLabel;
  }
}

function renderDrawingMap() {
  const summary = summarizeDrawingMap(state.documents, state.occurrences, attachedDocumentIds());
  elements.drawingMapBadge.textContent = `${summary.pageCount} page${summary.pageCount === 1 ? "" : "s"}`;
  elements.drawingMapHelp.textContent = state.documents.length === 0
    ? "Add PDFs to map pages and object coverage."
    : `${summary.documentCount} PDF${summary.documentCount === 1 ? "" : "s"} · ${summary.occurrenceCount} occurrence${summary.occurrenceCount === 1 ? "" : "s"}${summary.missingDocumentCount ? ` · ${summary.missingDocumentCount} missing` : ""}`;

  const signature = drawingMapContentSignature();
  if (elements.drawingMap.dataset.signature === signature) {
    updateDrawingMapState();
    return;
  }

  const previouslyOpen = new Set(
    Array.from(elements.drawingMap.querySelectorAll(".drawing-map-document[open]"))
      .map((item) => item.dataset.documentId),
  );
  elements.drawingMap.dataset.signature = signature;
  elements.drawingMap.replaceChildren();
  const drawingMap = buildDrawingMap(state.documents, state.occurrences);

  for (const projectDocument of drawingMap) {
    const attached = Boolean(getDocumentSession(projectDocument.id));
    const group = document.createElement("details");
    const heading = document.createElement("summary");
    const copy = document.createElement("span");
    const name = document.createElement("strong");
    const meta = document.createElement("small");
    const sourceState = document.createElement("span");
    const pages = document.createElement("div");

    group.className = `drawing-map-document${attached ? "" : " is-missing"}`;
    group.dataset.documentId = projectDocument.id;
    group.open = previouslyOpen.size > 0
      ? previouslyOpen.has(projectDocument.id)
      : projectDocument.id === state.activeDocumentId || drawingMap.length === 1;
    heading.className = "drawing-map-document-heading";
    copy.className = "drawing-map-document-copy";
    name.textContent = projectDocument.name;
    meta.textContent = `${projectDocument.pageCount} pages · ${projectDocument.occurrenceCount} occurrence${projectDocument.occurrenceCount === 1 ? "" : "s"}`;
    copy.append(name, meta);
    sourceState.className = "drawing-map-source-state";
    sourceState.textContent = attached ? "Attached" : "Missing";
    heading.append(copy, sourceState);
    pages.className = "drawing-map-pages";

    for (const page of projectDocument.pages) {
      const button = document.createElement("button");
      const pageNumber = document.createElement("strong");
      const count = document.createElement("span");
      const occurrenceLabel = `${page.occurrenceCount} occurrence${page.occurrenceCount === 1 ? "" : "s"}`;
      const baseLabel = `${projectDocument.name}, page ${page.page}, ${occurrenceLabel}`;
      button.type = "button";
      button.className = `drawing-map-page density-${page.density}`;
      button.dataset.action = "view-map-page";
      button.dataset.documentId = projectDocument.id;
      button.dataset.page = String(page.page);
      button.dataset.objectIds = page.objectIds.join(" ");
      button.dataset.baseLabel = baseLabel;
      button.setAttribute("aria-label", baseLabel);
      pageNumber.textContent = String(page.page);
      count.textContent = page.occurrenceCount > 0 ? String(page.occurrenceCount) : "";
      count.setAttribute("aria-hidden", "true");
      button.append(pageNumber, count);
      pages.append(button);
    }

    group.append(heading, pages);
    elements.drawingMap.append(group);
  }
  updateDrawingMapState();
}

function getCurrentPageOccurrences() {
  return state.occurrences.filter(
    (occurrence) => occurrence.documentId === state.activeDocumentId
      && occurrence.page === state.pageNumber,
  );
}

function setMarkMode(enabled, objectId = null) {
  if (enabled && !elements.pdfSearchBar.hidden) {
    closePdfSearch({ restoreFocus: false });
  }
  state.markMode = Boolean(enabled && state.pdfDocument);
  if (!state.markMode && state.interaction?.type === "polygon-draw") {
    state.interaction = null;
  }
  state.linkTargetObjectId = state.markMode && getObject(objectId) ? objectId : null;
  const targetObject = getObject(state.linkTargetObjectId);
  const shapeLabel = {
    rectangle: "rectangle",
    ellipse: "ellipse",
    polygon: "polygon",
  }[state.markGeometryType];
  const drawingInstruction = state.markGeometryType === "polygon"
    ? "Click corners around"
    : `Drag a${shapeLabel === "ellipse" ? "n" : ""} ${shapeLabel} around`;

  elements.markOccurrence.setAttribute("aria-pressed", String(state.markMode));
  elements.markOccurrence.textContent = state.markMode
    ? "Cancel"
    : "Mark";
  elements.markOccurrence.title = state.markMode
    ? "Cancel marking (M or Escape)"
    : `Mark ${shapeLabel} (M)`;
  elements.overlay.classList.toggle("is-marking", state.markMode);
  elements.pageSurface.classList.toggle("is-marking", state.markMode);
  elements.markingGuide.hidden = !state.markMode;
  elements.markingGuideText.textContent = targetObject
    ? `${drawingInstruction} another occurrence of ${targetObject.label}.${state.markGeometryType === "polygon" ? " Double-click or press Enter to finish." : ""}`
    : `${drawingInstruction} a visible object occurrence.${state.markGeometryType === "polygon" ? " Double-click or press Enter to finish." : ""}`;

  setStatus(state.markMode
    ? targetObject
      ? `${drawingInstruction} an occurrence of ${targetObject.label} (${targetObject.id}).${state.markGeometryType === "polygon" ? " Double-click or press Enter to finish." : ""} Press Escape to cancel.`
      : `${drawingInstruction} a visible object, then explicitly create or choose its identity.${state.markGeometryType === "polygon" ? " Double-click or press Enter to finish." : ""} Press Escape to cancel.`
    : state.pdfDocument
      ? "Select a shape or object to continue."
      : "Open a PDF to begin marking occurrences.");
  renderOverlay();
}

function occurrenceDisplayNumber(occurrence) {
  return state.occurrences.indexOf(occurrence) + 1;
}

function renderOccurrenceRows(container, occurrences) {
  container.replaceChildren();

  for (const occurrence of occurrences) {
    const item = document.createElement("li");
    const row = document.createElement("div");
    const navigateButton = document.createElement("button");
    const index = document.createElement("span");
    const details = document.createElement("span");
    const pageLabel = document.createElement("strong");
    const identity = document.createElement("small");
    const status = document.createElement("span");
    const deleteButton = document.createElement("button");

    item.className = "object-occurrence-item";
    row.className = "object-occurrence-row";
    navigateButton.type = "button";
    navigateButton.className = "occurrence-nav-button";
    navigateButton.dataset.action = "view-occurrence";
    navigateButton.dataset.occurrenceId = occurrence.id;
    navigateButton.setAttribute("aria-current", String(occurrence.id === state.selectedOccurrenceId));
    index.className = "occurrence-index";
    index.textContent = String(occurrenceDisplayNumber(occurrence)).padStart(2, "0");
    details.className = "occurrence-details";
    const occurrenceDocument = getProjectDocument(occurrence.documentId);
    const documentLabel = occurrenceDocument?.name ?? occurrence.documentId;
    const shapeLabel = `${occurrence.geometryType[0].toUpperCase()}${occurrence.geometryType.slice(1)}`;
    pageLabel.textContent = `${documentLabel} · page ${occurrence.page} · ${shapeLabel}`;
    identity.textContent = `${occurrence.id}${getDocumentSession(occurrence.documentId) ? "" : " · PDF missing"}`;
    details.append(pageLabel, identity);
    status.className = `occurrence-status ${occurrence.objectId ? "is-linked" : "is-unlinked"}`;
    status.textContent = occurrence.objectId ? "Linked" : "Unlinked";
    navigateButton.append(index, details, status);

    deleteButton.type = "button";
    deleteButton.className = "occurrence-delete-button";
    deleteButton.dataset.action = "delete-occurrence";
    deleteButton.dataset.occurrenceId = occurrence.id;
    deleteButton.setAttribute("aria-label", `Delete ${occurrence.id}`);
    const occurrenceEvidenceCount = state.observations.filter((observation) => observation.occurrenceId === occurrence.id).length;
    deleteButton.disabled = occurrenceEvidenceCount > 0;
    deleteButton.title = occurrenceEvidenceCount > 0
      ? `Remove ${occurrenceEvidenceCount} linked evidence entr${occurrenceEvidenceCount === 1 ? "y" : "ies"} before deleting this occurrence`
      : `Delete occurrence ${occurrenceDisplayNumber(occurrence)}`;
    deleteButton.textContent = "×";

    row.append(navigateButton, deleteButton);
    item.append(row);
    container.append(item);
  }
}

function createObjectCard(object) {
  const item = document.createElement("li");
  const button = document.createElement("button");
  const icon = document.createElement("span");
  const label = document.createElement("span");
  const title = document.createElement("strong");
  const identity = document.createElement("small");
  const count = document.createElement("span");
  const occurrences = getObjectOccurrences(state.occurrences, object.id);

  item.className = "object-card";
  button.type = "button";
  button.className = "object-card-button";
  button.dataset.objectId = object.id;
  button.setAttribute("aria-current", String(object.id === state.selectedObjectId));
  button.title = `Select ${object.label} (${object.id})`;
  icon.className = "object-icon";
  icon.textContent = objectCategoryCode(object.category);
  label.className = "object-label";
  title.textContent = object.label;
  identity.textContent = object.id;
  label.append(title, identity);
  count.className = "object-count";
  count.textContent = `${occurrences.length} occ`;
  count.setAttribute("aria-label", `${occurrences.length} occurrence${occurrences.length === 1 ? "" : "s"}`);
  button.append(icon, label, count);
  item.append(button);
  return item;
}

function renderObjectList() {
  const { display } = state;
  const selectedObject = getObject(state.selectedObjectId);
  const revealSelection = Boolean(selectedObject) && selectedObject.id !== revealedObjectId;
  revealedObjectId = selectedObject?.id ?? null;

  const searching = display.query.trim().length > 0;
  const groups = groupObjectsForBrowser(state.objects, display.query, {
    groupBy: display.groupBy,
    occurrences: state.occurrences,
    documents: state.documents,
    currentPage: display.currentPageOnly && state.activeDocumentId
      ? { documentId: state.activeDocumentId, page: state.pageNumber }
      : null,
  });
  if (revealSelection) {
    for (const group of groups) {
      if (group.objects.some((object) => object.id === selectedObject.id)) {
        display.collapsedGroups.delete(group.key);
      }
    }
  }

  elements.objectList.replaceChildren();
  elements.noObjects.hidden = state.objects.length > 0;
  elements.noObjectMatches.hidden = state.objects.length === 0 || groups.length > 0;
  elements.noObjectMatches.textContent = display.currentPageOnly && !searching
    ? "No objects are marked on this page."
    : "No objects match the search.";
  elements.objectBadge.textContent = String(state.objects.length);

  for (const group of groups) {
    const item = document.createElement("li");
    const header = document.createElement("div");
    const toggle = document.createElement("button");
    const name = document.createElement("span");
    const count = document.createElement("small");
    const list = document.createElement("ol");
    const hiddenOnDrawing = Boolean(group.category) && display.hiddenCategories.has(group.category);
    // A search shows every match, whatever was collapsed before.
    const expanded = searching || !display.collapsedGroups.has(group.key);

    item.className = `object-group${hiddenOnDrawing ? " is-hidden-on-drawing" : ""}`;
    header.className = "object-group-header";
    toggle.type = "button";
    toggle.className = "object-group-toggle";
    toggle.dataset.groupToggle = group.key;
    toggle.setAttribute("aria-expanded", String(expanded));
    name.textContent = group.label;
    count.textContent = group.objects.length === group.total
      ? String(group.total)
      : `${group.objects.length} of ${group.total}`;
    toggle.append(name, count);
    header.append(toggle);

    // Drawing visibility is per category, so the checkbox only appears when grouping by category.
    if (group.category) {
      const visibility = document.createElement("label");
      const checkbox = document.createElement("input");
      visibility.className = "object-group-visibility";
      visibility.title = `Show ${group.label} on the drawing`;
      checkbox.type = "checkbox";
      checkbox.checked = !hiddenOnDrawing;
      checkbox.dataset.categoryVisibility = group.category;
      checkbox.setAttribute("aria-label", `Show ${group.label} on the drawing`);
      visibility.append(checkbox, document.createTextNode("Show"));
      header.append(visibility);
    }

    list.className = "object-list";
    list.hidden = !expanded;
    for (const object of group.objects) {
      list.append(createObjectCard(object));
    }
    item.append(header, list);
    elements.objectList.append(item);
  }

  if (revealSelection) {
    elements.objectList
      .querySelector(`button[data-object-id="${CSS.escape(selectedObject.id)}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }
}

function renderObjectComposer() {
  const selectedOccurrence = getOccurrence(state.selectedOccurrenceId);
  const isUnlinkedSelection = Boolean(selectedOccurrence && !selectedOccurrence.objectId);
  const selectedObject = getObject(state.selectedObjectId);

  elements.objectComposer.hidden = Boolean(selectedObject);
  elements.propertiesEmpty.hidden = Boolean(selectedObject) || isUnlinkedSelection;

  elements.objectFormTitle.textContent = isUnlinkedSelection ? "Link this occurrence" : "Create object";
  elements.objectFormHint.textContent = !state.pdfDocument
    ? "Open a PDF before creating objects."
    : isUnlinkedSelection
      ? `${selectedOccurrence.id} on page ${selectedOccurrence.page} needs an explicit object.`
      : "Create the object first, then mark its occurrences.";
  elements.createObjectButton.textContent = isUnlinkedSelection ? "Create + link" : "Create";
  elements.linkExistingBlock.hidden = !isUnlinkedSelection || state.objects.length === 0;
  elements.existingObjectSelect.replaceChildren();
  refreshCreateCategoryOptions();

  for (const object of state.objects) {
    const option = document.createElement("option");
    option.value = object.id;
    option.textContent = `${object.label} · ${object.id}`;
    option.selected = object.id === state.selectedObjectId;
    elements.existingObjectSelect.append(option);
  }
}

function renderSelectedObjectPanel() {
  const object = getObject(state.selectedObjectId);
  elements.selectedObjectPanel.hidden = !object;
  elements.markForObject.disabled = !object || !state.pdfDocument;
  if (!object) {
    elements.objectLensSummary.hidden = true;
    elements.objectLensSummary.replaceChildren();
    elements.openRepresentationBoard.disabled = true;
    if (dialogIsOpen(elements.representationBoard)) {
      hideDialog(elements.representationBoard);
    }
    elements.exportObjectEvidence.disabled = true;
    elements.exportObjectEvidenceZip.disabled = true;
    elements.exportJoineryAiPack.disabled = true;
    elements.joineryAiHint.textContent = "Available for Door and Window objects";
    elements.objectExportMenu.open = false;
    elements.evidenceExportStatus.hidden = true;
    delete elements.evidenceExportStatus.dataset.subjectId;
    elements.evidenceReviewPanel.open = false;
    delete elements.evidenceReviewPanel.dataset.subjectId;
    elements.evidenceReviewCount.textContent = "Optional";
    elements.evidenceConflictSummary.hidden = true;
    elements.evidenceList.replaceChildren();
    return;
  }

  const occurrences = getObjectOccurrences(state.occurrences, object.id);
  if (elements.evidenceReviewPanel.dataset.subjectId !== object.id) {
    elements.evidenceReviewPanel.open = false;
    elements.evidenceReviewPanel.dataset.subjectId = object.id;
  }
  if (dialogIsOpen(elements.representationBoard) && elements.representationBoard.dataset.objectId !== object.id) {
    closeRepresentationBoard();
  }
  const relatedEvidence = state.observations.filter((observation) => observation.objectId === object.id);
  const summary = summarizeObjectLens(occurrences, attachedDocumentIds());
  elements.selectedObjectTitle.textContent = object.label;
  elements.selectedObjectIdentity.textContent = object.id;
  if (document.activeElement !== elements.editObjectCategory) {
    populateCategorySelect(elements.editObjectCategory, OBJECT_CATEGORY_GROUPS, object.category);
  }
  if (document.activeElement !== elements.editObjectLabel) {
    elements.editObjectLabel.value = object.label;
  }
  elements.selectedOccurrenceCount.textContent = String(occurrences.length);
  elements.noObjectOccurrences.hidden = occurrences.length > 0;
  elements.openRepresentationBoard.disabled = occurrences.length === 0;
  elements.exportObjectEvidence.disabled = occurrences.length === 0;
  elements.exportObjectEvidenceZip.disabled = occurrences.length === 0;
  const joineryEligible = canCreateJoineryAiHandoff(object);
  elements.exportJoineryAiPack.disabled = occurrences.length === 0 || !joineryEligible;
  elements.exportJoineryAiPack.title = !joineryEligible
    ? "Joinery AI handoff is available for Door and Window objects"
    : occurrences.length === 0
      ? "Add a linked representation before exporting"
      : "Export all representations and evidence for Joinery Configurator";
  elements.joineryAiHint.textContent = !joineryEligible
    ? "Available for Door and Window objects"
    : occurrences.length === 0
      ? "Add a representation first"
      : "All representations + evidence manifest";
  elements.deleteObject.disabled = relatedEvidence.length > 0;
  elements.deleteObject.title = relatedEvidence.length > 0
    ? "Remove this object's evidence entries before deleting the object"
    : `Delete ${object.label}`;
  if (elements.evidenceExportStatus.dataset.subjectId !== object.id) {
    elements.objectExportMenu.open = false;
    elements.evidenceExportStatus.hidden = true;
    elements.evidenceExportStatus.textContent = "";
    elements.evidenceExportStatus.dataset.subjectId = object.id;
  }
  elements.objectLensSummary.hidden = occurrences.length === 0;
  elements.objectLensSummary.replaceChildren();
  const coverage = document.createElement("span");
  coverage.textContent = `${summary.occurrenceCount} representation${summary.occurrenceCount === 1 ? "" : "s"} · ${summary.documentCount} PDF${summary.documentCount === 1 ? "" : "s"} · ${summary.pageCount} page${summary.pageCount === 1 ? "" : "s"}`;
  elements.objectLensSummary.append(coverage);
  if (summary.missingDocumentCount > 0) {
    const missing = document.createElement("span");
    missing.className = "object-lens-missing";
    missing.textContent = `${summary.missingDocumentCount} source PDF${summary.missingDocumentCount === 1 ? "" : "s"} missing`;
    elements.objectLensSummary.append(missing);
  }
  renderEvidenceReview(object, occurrences);
}

function reviewStateLabel(reviewState) {
  return {
    "unreviewed": "Unreviewed",
    "needs-confirmation": "Needs confirmation",
    "confirmed": "Confirmed",
    "rejected": "Rejected",
  }[reviewState] ?? reviewState;
}

function evidenceSourceLabel(observation) {
  if (!observation.occurrenceId) {
    return "Whole object";
  }
  const occurrence = getOccurrence(observation.occurrenceId);
  const projectDocument = occurrence ? getProjectDocument(occurrence.documentId) : null;
  return occurrence
    ? `${projectDocument?.name ?? occurrence.documentId} · page ${occurrence.page} · ${occurrence.id}`
    : observation.occurrenceId;
}

function renderEvidenceReview(object, occurrences) {
  const relevant = state.observations.filter((observation) => observation.objectId === object.id);
  const conflicts = conflictsForObject(relevant, object.id);
  const summary = evidenceSummary(relevant, object.id);
  const conflictingIds = new Set(conflicts.flatMap((conflict) => conflict.observationIds));
  elements.evidenceReviewCount.textContent = summary.total === 0
    ? "Optional"
    : conflicts.length > 0
      ? `${summary.total} saved · ${conflicts.length} conflict${conflicts.length === 1 ? "" : "s"}`
      : `${summary.total} saved`;
  elements.noEvidence.hidden = relevant.length > 0;
  elements.evidenceConflictSummary.hidden = conflicts.length === 0;
  elements.evidenceConflictSummary.textContent = conflicts.length
    ? `${conflicts.length} unresolved conflict${conflicts.length === 1 ? "" : "s"}: ${conflicts.map((conflict) => conflict.topic).join(", ")}`
    : "";

  const previousSource = elements.evidenceSource.value;
  elements.evidenceSource.replaceChildren();
  const wholeObjectOption = document.createElement("option");
  wholeObjectOption.value = "";
  wholeObjectOption.textContent = "Whole object (assumption only)";
  elements.evidenceSource.append(wholeObjectOption);
  for (const occurrence of occurrences) {
    const option = document.createElement("option");
    const projectDocument = getProjectDocument(occurrence.documentId);
    option.value = occurrence.id;
    option.textContent = `${projectDocument?.name ?? occurrence.documentId} · p${occurrence.page} · ${occurrence.id}`;
    elements.evidenceSource.append(option);
  }
  const preferredSource = occurrences.some((occurrence) => occurrence.id === previousSource)
    ? previousSource
    : occurrences.some((occurrence) => occurrence.id === state.selectedOccurrenceId)
      ? state.selectedOccurrenceId
      : occurrences[0]?.id ?? "";
  elements.evidenceSource.value = elements.evidenceKind.value === "observation" ? preferredSource : previousSource;

  elements.evidenceList.replaceChildren();
  for (const observation of relevant) {
    const item = document.createElement("li");
    const heading = document.createElement("div");
    const topic = document.createElement("strong");
    const kind = document.createElement("span");
    const value = document.createElement("p");
    const source = document.createElement(observation.occurrenceId ? "button" : "span");
    const controls = document.createElement("div");
    const review = document.createElement("select");
    const remove = document.createElement("button");

    item.className = `evidence-card state-${observation.reviewState}${conflictingIds.has(observation.id) ? " has-conflict" : ""}`;
    item.dataset.observationId = observation.id;
    heading.className = "evidence-card-heading";
    topic.textContent = observation.topic;
    kind.className = `evidence-kind kind-${observation.evidenceKind}`;
    kind.textContent = observation.evidenceKind;
    heading.append(topic, kind);
    value.className = "evidence-card-value";
    value.textContent = observation.value;
    source.className = "evidence-source-link";
    source.textContent = evidenceSourceLabel(observation);
    if (observation.occurrenceId) {
      source.type = "button";
      source.dataset.action = "view-evidence-source";
      source.dataset.occurrenceId = observation.occurrenceId;
    }
    controls.className = "evidence-card-controls";
    review.className = "text-input evidence-review-state";
    review.dataset.action = "set-evidence-review";
    review.dataset.observationId = observation.id;
    review.setAttribute("aria-label", `Review state for ${observation.topic}`);
    for (const reviewState of ["unreviewed", "needs-confirmation", "confirmed", "rejected"]) {
      const option = document.createElement("option");
      option.value = reviewState;
      option.textContent = reviewStateLabel(reviewState);
      option.selected = observation.reviewState === reviewState;
      review.append(option);
    }
    remove.type = "button";
    remove.className = "evidence-remove";
    remove.dataset.action = "remove-evidence";
    remove.dataset.observationId = observation.id;
    remove.textContent = "Remove";
    remove.setAttribute("aria-label", `Remove evidence ${observation.topic}`);
    controls.append(review, remove);
    item.append(heading, value, source, controls);
    elements.evidenceList.append(item);
  }
}

function renderUnlinkedOccurrences() {
  const unlinked = state.occurrences.filter((occurrence) => !occurrence.objectId);
  elements.unlinkedSection.hidden = unlinked.length === 0;
  elements.unlinkedCount.textContent = String(unlinked.length);
  renderOccurrenceRows(elements.unlinkedList, unlinked);
}

function renderSessionSummary() {
  const unlinkedCount = state.occurrences.filter((occurrence) => !occurrence.objectId).length;
  const objectLabel = `${state.objects.length} object${state.objects.length === 1 ? "" : "s"}`;
  const occurrenceLabel = `${state.occurrences.length} occurrence${state.occurrences.length === 1 ? "" : "s"}`;
  const pdfLabel = `${state.documents.length} PDF${state.documents.length === 1 ? "" : "s"}`;
  const evidenceLabel = state.observations.length
    ? ` · ${state.observations.length} evidence entr${state.observations.length === 1 ? "y" : "ies"}`
    : "";
  elements.documentSummary.textContent = unlinkedCount
    ? `${pdfLabel} · ${objectLabel} · ${occurrenceLabel}${evidenceLabel} · ${unlinkedCount} unlinked`
    : `${pdfLabel} · ${objectLabel} · ${occurrenceLabel}${evidenceLabel}`;
}

// Shapes are drawn in unrotated page coordinates inside one group that applies the view rotation.
let overlayLayer = null;

function renderOverlay() {
  elements.overlay.replaceChildren();
  overlayLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
  const transform = rotationTransform(state.rotation);
  if (transform) {
    overlayLayer.setAttribute("transform", transform);
  }
  elements.overlay.append(overlayLayer);
  let selectedOccurrence = null;

  const objectsById = new Map(state.objects.map((object) => [object.id, object]));
  for (const occurrence of getCurrentPageOccurrences()) {
    const visibility = occurrenceVisibility(occurrence, objectsById, state.display, state.selectedObjectId);
    // A filter never hides the mark being worked on.
    if (visibility === "hidden" && occurrence.id !== state.selectedOccurrenceId) {
      continue;
    }
    const classes = ["occurrence-shape"];
    if (visibility === "dimmed") {
      classes.push("is-dimmed");
    }
    if (!occurrence.objectId) {
      classes.push("is-unlinked");
    }
    if (occurrence.objectId && occurrence.objectId === state.selectedObjectId) {
      classes.push("is-object-active");
    }
    if (occurrence.id === state.selectedOccurrenceId) {
      classes.push("is-selected");
      selectedOccurrence = occurrence;
    }
    if (state.interaction?.type === "move" && state.interaction.occurrenceId === occurrence.id) {
      classes.push("is-moving");
    }
    if (["resize", "vertex-move"].includes(state.interaction?.type) && state.interaction.occurrenceId === occurrence.id) {
      classes.push("is-resizing");
    }

    const object = getObject(occurrence.objectId);
    const shape = makeSvgShape(occurrence.geometryType, occurrence.bounds, occurrence.points, classes.join(" "));
    shape.dataset.occurrenceId = occurrence.id;
    shape.setAttribute("role", "button");
    shape.setAttribute("tabindex", "0");
    shape.setAttribute("aria-keyshortcuts", "Enter Space");
    shape.setAttribute(
      "aria-label",
      object
        ? `${object.label}, ${object.id}, ${occurrence.geometryType} occurrence on page ${occurrence.page}`
        : `Unlinked ${occurrence.geometryType} occurrence on page ${occurrence.page}`,
    );
    overlayLayer.append(shape);
  }

  if (selectedOccurrence) {
    appendSelectionHandles(selectedOccurrence);
  }
  renderMarkLabels(objectsById);

  if (state.interaction?.type === "draw") {
    overlayLayer.append(makeSvgShape(state.markGeometryType, state.interaction.bounds, null, "draft-shape"));
  } else if (state.interaction?.type === "polygon-draw") {
    const previewPoints = state.interaction.previewPoint
      ? [...state.interaction.points, state.interaction.previewPoint]
      : state.interaction.points;
    if (previewPoints.length > 0) {
      overlayLayer.append(makeSvgShape("polygon", null, previewPoints, "draft-shape"));
    }
  }
}

// Labels sit just above each visible mark's top-left corner, in page percentages.
function renderMarkLabels(objectsById) {
  elements.markLabels.replaceChildren();
  if (!state.display.showLabels) {
    return;
  }
  for (const occurrence of getCurrentPageOccurrences()) {
    const object = objectsById.get(occurrence.objectId);
    if (!object || !occurrence.bounds) {
      continue;
    }
    const visibility = occurrenceVisibility(occurrence, objectsById, state.display, state.selectedObjectId);
    if (visibility === "hidden" && occurrence.id !== state.selectedOccurrenceId) {
      continue;
    }
    const label = document.createElement("span");
    label.className = "mark-label";
    if (object.id === state.selectedObjectId) {
      label.classList.add("is-selected");
    } else if (visibility === "dimmed") {
      label.classList.add("is-dimmed");
    }
    label.textContent = object.label;
    const onView = rotateBounds(occurrence.bounds, state.rotation);
    label.style.left = `${onView.x * 100}%`;
    label.style.top = `${onView.y * 100}%`;
    elements.markLabels.append(label);
  }
}

function createRepresentationCard(occurrence, { isCurrent }) {
  const item = document.createElement("li");
  const navigateButton = document.createElement("button");
  const preview = document.createElement("span");
  const canvas = document.createElement("canvas");
  const overlay = document.createElementNS(SVG_NAMESPACE, "svg");
  const placeholder = document.createElement("span");
  const meta = document.createElement("span");
  const source = document.createElement("strong");
  const identity = document.createElement("small");
  const type = document.createElement("span");
  const deleteButton = document.createElement("button");
  const projectDocument = getProjectDocument(occurrence.documentId);
  const session = getDocumentSession(occurrence.documentId);
  const shapeLabel = `${occurrence.geometryType[0].toUpperCase()}${occurrence.geometryType.slice(1)}`;

  item.className = "object-lens-card representation-board-card";
  navigateButton.type = "button";
  navigateButton.className = "occurrence-nav-button object-lens-preview-button";
  navigateButton.dataset.action = "view-occurrence";
  navigateButton.dataset.occurrenceId = occurrence.id;
  navigateButton.setAttribute("aria-current", String(occurrence.id === state.selectedOccurrenceId));
  navigateButton.setAttribute(
    "aria-label",
    `Show ${occurrence.id} in ${projectDocument?.name ?? occurrence.documentId}, page ${occurrence.page}`,
  );

  preview.className = `object-lens-preview${session ? "" : " is-missing"}`;
  preview.setAttribute("aria-busy", String(Boolean(session)));
  canvas.setAttribute("aria-hidden", "true");
  overlay.setAttribute("preserveAspectRatio", "none");
  overlay.setAttribute("aria-hidden", "true");
  placeholder.className = "object-lens-placeholder";
  placeholder.textContent = session ? "Rendering preview…" : "PDF missing";
  preview.append(canvas, overlay, placeholder);

  meta.className = "object-lens-meta";
  source.textContent = `${projectDocument?.name ?? occurrence.documentId} · page ${occurrence.page}`;
  identity.textContent = occurrence.id;
  type.className = "object-lens-type";
  type.textContent = shapeLabel;
  meta.append(source, identity, type);
  navigateButton.append(preview, meta);

  deleteButton.type = "button";
  deleteButton.className = "occurrence-delete-button object-lens-delete";
  deleteButton.dataset.action = "delete-occurrence";
  deleteButton.dataset.occurrenceId = occurrence.id;
  deleteButton.setAttribute("aria-label", `Delete ${occurrence.id}`);
  const occurrenceEvidenceCount = state.observations.filter((observation) => observation.occurrenceId === occurrence.id).length;
  deleteButton.disabled = occurrenceEvidenceCount > 0;
  deleteButton.title = occurrenceEvidenceCount > 0
    ? `Remove ${occurrenceEvidenceCount} linked evidence entr${occurrenceEvidenceCount === 1 ? "y" : "ies"} before deleting ${occurrence.id}`
    : `Delete ${occurrence.id}`;
  deleteButton.textContent = "×";
  item.append(navigateButton, deleteButton);
  if (session) {
    void renderObjectLensThumbnail(preview, occurrence, session, isCurrent);
  }
  return item;
}

function closeRepresentationBoard() {
  hideDialog(elements.representationBoard);
}

function openDrawingMap() {
  renderDrawingMap();
  showDialog(elements.drawingMapDialog);
}

function closeDrawingMap() {
  hideDialog(elements.drawingMapDialog);
}

function openRepresentationBoard() {
  const object = getObject(state.selectedObjectId);
  if (!object) {
    return;
  }
  const occurrences = sortObjectRepresentations(
    getObjectOccurrences(state.occurrences, object.id),
    state.documents,
  );
  if (occurrences.length === 0) {
    return;
  }

  const summary = summarizeObjectLens(occurrences, attachedDocumentIds());
  const generation = ++representationBoardGeneration;
  elements.representationBoard.dataset.objectId = object.id;
  elements.representationBoardTitle.textContent = object.label;
  elements.representationBoardSummary.textContent = `${object.id} · ${summary.occurrenceCount} representation${summary.occurrenceCount === 1 ? "" : "s"} · ${summary.documentCount} PDF${summary.documentCount === 1 ? "" : "s"} · ${summary.pageCount} page${summary.pageCount === 1 ? "" : "s"}${summary.missingDocumentCount ? ` · ${summary.missingDocumentCount} source missing` : ""}`;
  elements.representationBoardGrid.replaceChildren();
  for (const occurrence of occurrences) {
    elements.representationBoardGrid.append(createRepresentationCard(occurrence, {
      isCurrent: () => generation === representationBoardGeneration && dialogIsOpen(elements.representationBoard),
    }));
  }
  showDialog(elements.representationBoard);
}

async function handleRepresentationBoardAction(event) {
  const button = event.target.closest("button[data-occurrence-id]");
  if (!button) {
    return;
  }
  const occurrenceId = button.dataset.occurrenceId;
  closeRepresentationBoard();
  if (button.dataset.action === "delete-occurrence") {
    deleteOccurrenceById(occurrenceId);
    return;
  }
  await selectOccurrenceAndNavigate(occurrenceId);
}

function setEvidenceExportStatus(message, isError = false) {
  elements.evidenceExportStatus.textContent = message;
  elements.evidenceExportStatus.hidden = !message;
  elements.evidenceExportStatus.classList.toggle("is-error", isError);
  if (state.selectedObjectId) {
    elements.evidenceExportStatus.dataset.subjectId = state.selectedObjectId;
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function exportSelectedObjectEvidence(includePreviews = false) {
  const object = getObject(state.selectedObjectId);
  if (!object) {
    return;
  }
  const occurrences = getObjectOccurrences(state.occurrences, object.id);
  if (occurrences.length === 0) {
    setEvidenceExportStatus("Add at least one linked representation before exporting.", true);
    return;
  }

  elements.exportObjectEvidence.disabled = true;
  elements.exportObjectEvidenceZip.disabled = true;
  elements.exportJoineryAiPack.disabled = true;
  setEvidenceExportStatus(includePreviews ? "Rendering marked preview assets…" : "Preparing evidence manifest…");

  try {
    const exportedAt = new Date().toISOString();
    const evidencePackage = createObjectEvidencePackage({
      documents: state.documents,
      objects: state.objects,
      occurrences: state.occurrences,
      observations: state.observations,
      selectedObjectIds: [object.id],
      exportedAt,
    });
    const stem = evidenceExportStem(object);
    const manifestText = `${JSON.stringify(evidencePackage, null, 2)}\n`;

    if (!includePreviews) {
      const filename = `${stem}.objdraw-evidence.json`;
      downloadBlob(new Blob([manifestText], { type: "application/json" }), filename);
      elements.objectExportMenu.open = false;
      setEvidenceExportStatus(`Exported ${filename} with ${occurrences.length} source representation${occurrences.length === 1 ? "" : "s"}.`);
      setStatus(`Exported the portable evidence manifest for ${object.label} (${object.id}).`);
      return;
    }

    const files = [{ name: "manifest.objdraw-evidence.json", data: manifestText }];
    const assets = [];
    const unavailableReasons = new Map();
    for (const occurrence of occurrences) {
      const session = getDocumentSession(occurrence.documentId);
      if (!session) {
        unavailableReasons.set(occurrence.id, "source-pdf-missing");
        continue;
      }
      try {
        const rendered = await renderEvidencePreviewAsset(occurrence, session);
        const path = `previews/${occurrence.id}.png`;
        files.push({ name: path, data: new Uint8Array(await rendered.blob.arrayBuffer()) });
        assets.push({
          occurrenceId: occurrence.id,
          path,
          width: rendered.width,
          height: rendered.height,
        });
      } catch (error) {
        console.error(error);
        unavailableReasons.set(occurrence.id, "preview-render-failed");
      }
    }
    const assetIndex = createEvidenceAssetIndex(occurrences, assets, unavailableReasons);
    files.splice(1, 0, { name: "assets.json", data: `${JSON.stringify(assetIndex, null, 2)}\n` });
    const zipBytes = createStoredZip(files, new Date(exportedAt));
    const filename = `${stem}.objdraw-evidence.zip`;
    downloadBlob(new Blob([zipBytes], { type: "application/zip" }), filename);
    elements.objectExportMenu.open = false;
    const unavailableCount = assetIndex.unavailable.length;
    setEvidenceExportStatus(
      `Exported ${filename} with ${assets.length} marked preview${assets.length === 1 ? "" : "s"}${unavailableCount ? `; ${unavailableCount} unavailable source${unavailableCount === 1 ? "" : "s"} recorded` : ""}.`,
    );
    setStatus(`Exported the portable evidence set for ${object.label} (${object.id}).`);
  } catch (error) {
    console.error(error);
    setEvidenceExportStatus(`Export failed: ${error.message}`, true);
    setStatus(`Evidence export for ${object.label} failed. The project was not changed.`);
  } finally {
    const currentObject = getObject(object.id);
    const hasRepresentations = getObjectOccurrences(state.occurrences, object.id).length > 0;
    elements.exportObjectEvidence.disabled = !currentObject || !hasRepresentations;
    elements.exportObjectEvidenceZip.disabled = !currentObject || !hasRepresentations;
    elements.exportJoineryAiPack.disabled = !currentObject || !canCreateJoineryAiHandoff(currentObject) || !hasRepresentations;
  }
}

async function exportSelectedObjectForJoineryAi() {
  const object = getObject(state.selectedObjectId);
  if (!object || !canCreateJoineryAiHandoff(object)) {
    setEvidenceExportStatus("Joinery AI handoff is available for Door and Window objects.", true);
    return;
  }
  const occurrences = sortObjectRepresentations(
    getObjectOccurrences(state.occurrences, object.id),
    state.documents,
  );
  if (occurrences.length === 0) {
    setEvidenceExportStatus("Add at least one linked representation before exporting a Joinery AI pack.", true);
    return;
  }

  elements.exportJoineryAiPack.disabled = true;
  elements.exportObjectEvidence.disabled = true;
  elements.exportObjectEvidenceZip.disabled = true;
  setEvidenceExportStatus("Rendering clean and marked representations for the Joinery AI handoff…");

  try {
    const exportedAt = new Date().toISOString();
    const evidencePackage = createObjectEvidencePackage({
      documents: state.documents,
      objects: state.objects,
      occurrences: state.occurrences,
      observations: state.observations,
      selectedObjectIds: [object.id],
      exportedAt,
    });
    const files = [
      { name: "manifest.objdraw-evidence.json", data: `${JSON.stringify(evidencePackage, null, 2)}\n` },
    ];
    const renderedAssets = [];
    const unavailableRepresentations = [];

    for (const occurrence of occurrences) {
      const session = getDocumentSession(occurrence.documentId);
      if (!session) {
        unavailableRepresentations.push({ occurrenceId: occurrence.id, reason: "source-pdf-missing" });
        continue;
      }
      try {
        const rendered = await renderJoineryRepresentationAsset(occurrence, session);
        const cleanPath = `representations/clean/${occurrence.id}.png`;
        const markedPath = `representations/marked/${occurrence.id}.png`;
        files.push(
          { name: cleanPath, data: new Uint8Array(await rendered.cleanBlob.arrayBuffer()) },
          { name: markedPath, data: new Uint8Array(await rendered.markedBlob.arrayBuffer()) },
        );
        const projectDocument = getProjectDocument(occurrence.documentId);
        renderedAssets.push({
          ...rendered,
          occurrenceId: occurrence.id,
          documentName: projectDocument?.name ?? occurrence.documentId,
          page: occurrence.page,
          cleanPath,
          markedPath,
        });
      } catch (error) {
        console.error(error);
        unavailableRepresentations.push({ occurrenceId: occurrence.id, reason: "preview-render-failed" });
      }
    }

    const handoffIndex = createJoineryAiHandoffIndex({
      evidencePackage,
      renderedRepresentations: renderedAssets,
      unavailableRepresentations,
      exportedAt,
    });
    const instructions = createJoineryAiInstructions({ evidencePackage, handoffIndex });
    const contactSheet = await createJoineryContactSheet(object, renderedAssets);
    files.unshift(
      { name: "AI-HANDOFF.md", data: instructions },
      { name: "handoff.json", data: `${JSON.stringify(handoffIndex, null, 2)}\n` },
    );
    files.push({ name: handoffIndex.representations.contactSheetPath, data: new Uint8Array(await contactSheet.arrayBuffer()) });

    const zipBytes = createStoredZip(files, new Date(exportedAt));
    const filename = `${evidenceExportStem(object)}.joinery-ai.zip`;
    downloadBlob(new Blob([zipBytes], { type: "application/zip" }), filename);
    elements.objectExportMenu.open = false;
    const missingCount = unavailableRepresentations.length;
    setEvidenceExportStatus(
      `Exported ${filename} with ${renderedAssets.length} clean/marked representation pair${renderedAssets.length === 1 ? "" : "s"} and one contact sheet${missingCount ? `; ${missingCount} unavailable source${missingCount === 1 ? "" : "s"} recorded` : ""}. Use it with the current prompt from Joinery Configurator.`,
    );
    setStatus(`Exported the Joinery AI handoff for ${object.label} (${object.id}). The project was not changed.`);
  } catch (error) {
    console.error(error);
    setEvidenceExportStatus(`Joinery AI handoff failed: ${error.message}`, true);
    setStatus(`Joinery AI export for ${object.label} failed. The project was not changed.`);
  } finally {
    const currentObject = getObject(object.id);
    const hasRepresentations = getObjectOccurrences(state.occurrences, object.id).length > 0;
    elements.exportJoineryAiPack.disabled = !currentObject || !canCreateJoineryAiHandoff(currentObject) || !hasRepresentations;
    elements.exportObjectEvidence.disabled = !currentObject || !hasRepresentations;
    elements.exportObjectEvidenceZip.disabled = !currentObject || !hasRepresentations;
  }
}

function setMarkFocus(mode) {
  state.display.markFocus = mode;
  syncDisplayControls();
  saveDisplayPreferences();
  renderOverlay();
}

function toggleMarksHidden() {
  if (state.display.markFocus === "none") {
    setMarkFocus(markFocusBeforeHiding);
    setStatus("Marks shown.");
  } else {
    markFocusBeforeHiding = state.display.markFocus;
    setMarkFocus("none");
    setStatus("Marks hidden. Press H to show them again.");
  }
}

function setShowLabels(show) {
  state.display.showLabels = show;
  syncDisplayControls();
  saveDisplayPreferences();
  renderOverlay();
}

async function rotateView(direction) {
  if (!state.pdfDocument) {
    return;
  }
  state.rotation = normalizeRotation(state.rotation + (direction < 0 ? -90 : 90));
  await renderPage();
  saveActiveDocumentView();
  setStatus(`View rotated to ${state.rotation}°. Marks are saved unrotated, so the project file does not change.`);
}

// Page thumbnails. Rendered lazily as they scroll into view, one at a time, and cached
// per PDF, page and rotation for the session.
const THUMBNAIL_WIDTH = 112;
const thumbnailCache = new Map();
let thumbnailListKey = "";
let thumbnailObserver = null;
let thumbnailQueue = [];
let thumbnailQueueRunning = false;
let thumbnailGeneration = 0;
let lastThumbnailPage = null;

function setThumbnailsOpen(open) {
  state.display.showThumbnails = open;
  elements.thumbnailPanel.hidden = !open;
  elements.toggleThumbnails.setAttribute("aria-pressed", String(open));
  saveDisplayPreferences();
  lastThumbnailPage = null;
  renderThumbnails();
  // Fit modes depend on the space beside the panel.
  if (state.pdfDocument && state.zoomMode !== "custom") {
    renderPage();
  }
}

function renderThumbnails() {
  if (elements.thumbnailPanel.hidden || !state.pdfDocument || !state.activeDocumentId) {
    return;
  }
  const listKey = `${state.activeDocumentId}|${state.rotation}|${state.pdfDocument.numPages}`;
  if (listKey !== thumbnailListKey) {
    buildThumbnailList(listKey);
  }
  updateThumbnailStates();
}

function buildThumbnailList(listKey) {
  thumbnailListKey = listKey;
  thumbnailGeneration += 1;
  thumbnailQueue = [];
  lastThumbnailPage = null;
  thumbnailObserver?.disconnect();
  elements.thumbnailList.replaceChildren();
  thumbnailObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        thumbnailObserver.unobserve(entry.target);
        enqueueThumbnail(Number(entry.target.dataset.thumbnailPage));
      }
    }
  }, { root: elements.thumbnailPanel, rootMargin: "240px 0px" });

  for (let page = 1; page <= state.pdfDocument.numPages; page += 1) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    const frame = document.createElement("span");
    const number = document.createElement("span");
    const badge = document.createElement("span");
    button.type = "button";
    button.className = "thumbnail-button";
    button.dataset.thumbnailPage = String(page);
    frame.className = "thumbnail-frame";
    frame.dataset.thumbnailPage = String(page);
    frame.style.minHeight = "80px";
    number.textContent = String(page);
    badge.className = "thumbnail-badge";
    badge.hidden = true;
    button.append(frame, number, badge);
    item.append(button);
    elements.thumbnailList.append(item);

    const cached = thumbnailCache.get(`${state.activeDocumentId}|${page}|${state.rotation}`);
    if (cached) {
      showThumbnailImage(frame, cached);
    } else {
      thumbnailObserver.observe(frame);
    }
  }
}

function showThumbnailImage(frame, url) {
  const image = document.createElement("img");
  image.src = url;
  image.alt = "";
  frame.style.minHeight = "";
  frame.replaceChildren(image);
}

function enqueueThumbnail(page) {
  thumbnailQueue.push(page);
  runThumbnailQueue();
}

async function runThumbnailQueue() {
  if (thumbnailQueueRunning) {
    return;
  }
  thumbnailQueueRunning = true;
  try {
    while (thumbnailQueue.length > 0) {
      const page = thumbnailQueue.shift();
      const generation = thumbnailGeneration;
      const pdfDocument = state.pdfDocument;
      const key = `${state.activeDocumentId}|${page}|${state.rotation}`;
      let url = thumbnailCache.get(key);
      if (!url) {
        try {
          url = await renderThumbnailImage(pdfDocument, page, state.rotation);
        } catch (error) {
          console.warn(`Thumbnail for page ${page} could not be rendered.`, error);
          continue;
        }
        thumbnailCache.set(key, url);
      }
      if (generation !== thumbnailGeneration) {
        continue;
      }
      const frame = elements.thumbnailList.querySelector(`.thumbnail-frame[data-thumbnail-page="${page}"]`);
      if (frame && !frame.querySelector("img")) {
        showThumbnailImage(frame, url);
      }
    }
  } finally {
    thumbnailQueueRunning = false;
  }
}

async function renderThumbnailImage(pdfDocument, pageNumber, viewRotation) {
  const page = await pdfDocument.getPage(pageNumber);
  const rotation = normalizeRotation(page.rotate + viewRotation);
  const base = page.getViewport({ scale: 1, rotation });
  // Twice the shown width, so it stays sharp on high-density screens.
  const viewport = page.getViewport({ scale: (THUMBNAIL_WIDTH * 2) / base.width, rotation });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  await page.render({ canvasContext: canvas.getContext("2d", { alpha: false }), viewport }).promise;
  return canvas.toDataURL("image/jpeg", 0.82);
}

// Current page, mark counts, and pages where the selected object appears.
function updateThumbnailStates() {
  const counts = new Map();
  const selectedPages = new Set();
  for (const occurrence of state.occurrences) {
    if (occurrence.documentId !== state.activeDocumentId) {
      continue;
    }
    counts.set(occurrence.page, (counts.get(occurrence.page) ?? 0) + 1);
    if (occurrence.objectId && occurrence.objectId === state.selectedObjectId) {
      selectedPages.add(occurrence.page);
    }
  }
  for (const button of elements.thumbnailList.querySelectorAll("button[data-thumbnail-page]")) {
    const page = Number(button.dataset.thumbnailPage);
    const count = counts.get(page) ?? 0;
    const badge = button.querySelector(".thumbnail-badge");
    if (page === state.pageNumber) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
    button.classList.toggle("has-selected", selectedPages.has(page));
    badge.hidden = count === 0;
    badge.textContent = String(count);
    button.setAttribute("aria-label", `Page ${page}${count ? `, ${count} mark${count === 1 ? "" : "s"}` : ""}${selectedPages.has(page) ? ", has the selected object" : ""}`);
  }
  if (lastThumbnailPage !== state.pageNumber) {
    lastThumbnailPage = state.pageNumber;
    elements.thumbnailList
      .querySelector(`button[data-thumbnail-page="${state.pageNumber}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }
}

// Drag or arrow keys move the line between the object browser and the properties pane.
function setUpPaneSplitter() {
  const minimum = 140;
  const setBrowserSize = (pixels) => {
    const total = elements.sidePanel.clientHeight - elements.paneSplitter.offsetHeight;
    const clamped = Math.round(Math.min(Math.max(pixels, minimum), total - minimum));
    elements.sidePanel.style.setProperty("--browser-pane-size", `${clamped}px`);
    elements.paneSplitter.setAttribute("aria-valuenow", String(Math.round((clamped / total) * 100)));
  };

  elements.paneSplitter.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    const top = elements.sidePanel.getBoundingClientRect().top;
    elements.paneSplitter.setPointerCapture(event.pointerId);
    elements.paneSplitter.classList.add("is-dragging");
    const move = (moveEvent) => setBrowserSize(moveEvent.clientY - top);
    const end = () => {
      elements.paneSplitter.classList.remove("is-dragging");
      elements.paneSplitter.removeEventListener("pointermove", move);
      elements.paneSplitter.removeEventListener("pointerup", end);
      elements.paneSplitter.removeEventListener("pointercancel", end);
    };
    elements.paneSplitter.addEventListener("pointermove", move);
    elements.paneSplitter.addEventListener("pointerup", end);
    elements.paneSplitter.addEventListener("pointercancel", end);
  });

  elements.paneSplitter.addEventListener("keydown", (event) => {
    const step = event.shiftKey ? 80 : 24;
    const current = elements.browserPane.offsetHeight;
    if (event.key === "ArrowUp") {
      setBrowserSize(current - step);
    } else if (event.key === "ArrowDown") {
      setBrowserSize(current + step);
    } else {
      return;
    }
    event.preventDefault();
  });
}

function refreshObjectUi() {
  renderThumbnails();
  renderDocumentList();
  renderDrawingMap();
  renderObjectList();
  renderObjectComposer();
  renderSelectedObjectPanel();
  renderUnlinkedOccurrences();
  renderSessionSummary();
  updateSaveState();
}

function refreshUi() {
  renderOverlay();
  refreshObjectUi();
}

function calculateFitScale(baseViewport, mode = state.zoomMode) {
  const availableWidth = Math.max(elements.viewerStage.clientWidth - 64, 160);
  const availableHeight = Math.max(elements.viewerStage.clientHeight - 64, 160);
  const targetScale = mode === "fit-width"
    ? availableWidth / baseViewport.width
    : Math.min(availableWidth / baseViewport.width, availableHeight / baseViewport.height);
  return clamp(
    targetScale,
    MINIMUM_SCALE,
    MAXIMUM_SCALE,
  );
}

function showDocumentPlaceholder(projectDocument = null) {
  resetPdfSearch();
  clearTimeout(wheelZoomCommitTimer);
  wheelZoomCommitTimer = null;
  wheelZoomAnchor = null;
  renderedPageMetrics = null;
  elements.pageSurface.classList.remove("is-zoom-preview");
  elements.pageContent.style.transform = "";
  pdfTextLayer.cancel();
  elements.pageSurface.hidden = true;
  elements.emptyState.hidden = false;
  elements.emptyChoosePdf.textContent = projectDocument ? "Relink or add PDFs" : "Choose PDFs";
  if (projectDocument) {
    elements.emptyEyebrow.textContent = "Source PDF required";
    elements.emptyTitle.textContent = projectDocument.name;
    elements.emptyDescription.textContent = "This project data is safe, but the local PDF must be relinked before its pages and occurrences can be shown.";
  } else {
    elements.emptyEyebrow.textContent = "Start with a drawing set";
    elements.emptyTitle.textContent = "Add local architectural PDFs";
    elements.emptyDescription.textContent = "The source files stay on this computer. This app stores their shared object layer in a separate project JSON file.";
  }
}

async function activateDocument(documentId, targetPage = null) {
  const projectDocument = getProjectDocument(documentId);
  if (!projectDocument) {
    return false;
  }

  if (state.activeDocumentId !== documentId) {
    resetPdfSearch();
  }

  saveActiveDocumentView();
  if (state.renderTask) {
    state.renderTask.cancel();
    state.renderTask = null;
  }
  pdfTextLayer.cancel();
  state.renderGeneration += 1;
  state.interaction = null;
  setMarkMode(false);
  state.activeDocumentId = documentId;
  state.documentFingerprint = projectDocument;
  state.fileName = projectDocument.name;
  elements.documentName.textContent = projectDocument.name;
  elements.documentName.title = projectDocument.name;

  const session = getDocumentSession(documentId);
  const view = documentView(documentId);
  if (!session) {
    state.pdfDocument = null;
    state.loadingTask = null;
    state.pageNumber = clamp(targetPage ?? view.pageNumber, 1, projectDocument.pageCount);
    elements.pageNumber.value = String(state.pageNumber);
    elements.pageCount.textContent = `/ ${projectDocument.pageCount}`;
    elements.zoomValue.textContent = "Missing";
    showDocumentPlaceholder(projectDocument);
    setDocumentControlsEnabled(false);
    refreshUi();
    setStatus(`${projectDocument.name} is not attached. Relink its local PDF to show page ${state.pageNumber}.`);
    return false;
  }

  state.pdfDocument = session.pdfDocument;
  state.loadingTask = session.loadingTask;
  state.pageNumber = clamp(targetPage ?? view.pageNumber, 1, session.pdfDocument.numPages);
  state.scale = view.scale;
  state.zoomMode = view.zoomMode;
  state.rotation = normalizeRotation(view.rotation);
  elements.emptyState.hidden = true;
  elements.pageSurface.hidden = false;
  setDocumentControlsEnabled(true);
  refreshUi();
  await renderPage();
  if (targetPage === null) {
    elements.viewerStage.scrollLeft = view.scrollLeft;
    elements.viewerStage.scrollTop = view.scrollTop;
  }
  return true;
}

function updatePageControls() {
  if (!state.pdfDocument) {
    return;
  }

  const pageCount = state.pdfDocument.numPages;
  elements.pageNumber.value = String(state.pageNumber);
  elements.pageNumber.max = String(pageCount);
  elements.pageCount.textContent = `/ ${pageCount}`;
  elements.previousPage.disabled = state.pageNumber <= 1;
  elements.nextPage.disabled = state.pageNumber >= pageCount;
  const zoomPercentage = `${Math.round(state.scale * 100)}%`;
  elements.zoomValue.textContent = state.zoomMode === "fit-page"
    ? `Fit ${zoomPercentage}`
    : state.zoomMode === "fit-width"
      ? `Width ${zoomPercentage}`
      : zoomPercentage;
}

async function renderPage() {
  if (!state.pdfDocument) {
    return;
  }

  clearTimeout(wheelZoomCommitTimer);
  wheelZoomCommitTimer = null;
  wheelZoomAnchor = null;
  elements.pageSurface.classList.remove("is-zoom-preview");
  elements.pageContent.style.transform = "";
  const generation = ++state.renderGeneration;
  elements.renderingIndicator.hidden = false;
  elements.pageSurface.setAttribute("aria-busy", "true");

  try {
    if (state.renderTask) {
      state.renderTask.cancel();
      state.renderTask = null;
    }
    pdfTextLayer.cancel();

    const page = await state.pdfDocument.getPage(state.pageNumber);
    if (generation !== state.renderGeneration) {
      return;
    }

    const rotation = normalizeRotation(page.rotate + state.rotation);
    const baseViewport = page.getViewport({ scale: 1, rotation });
    if (state.zoomMode !== "custom") {
      state.scale = calculateFitScale(baseViewport, state.zoomMode);
    }
    const viewport = page.getViewport({ scale: state.scale, rotation });
    const outputScale = Math.max(globalThis.devicePixelRatio || 1, 1);
    const context = elements.pdfCanvas.getContext("2d", { alpha: false });

    elements.pageSurface.style.width = `${viewport.width}px`;
    elements.pageSurface.style.height = `${viewport.height}px`;
    elements.pageSurface.style.setProperty("--total-scale-factor", String(viewport.scale));
    elements.pageContent.style.width = `${viewport.width}px`;
    elements.pageContent.style.height = `${viewport.height}px`;
    renderedPageMetrics = {
      scale: viewport.scale,
      width: viewport.width,
      height: viewport.height,
    };
    elements.pdfCanvas.width = Math.floor(viewport.width * outputScale);
    elements.pdfCanvas.height = Math.floor(viewport.height * outputScale);
    elements.pdfCanvas.style.width = `${viewport.width}px`;
    elements.pdfCanvas.style.height = `${viewport.height}px`;

    state.renderTask = page.render({
      canvasContext: context,
      transform: outputScale === 1 ? null : [outputScale, 0, 0, outputScale, 0, 0],
      viewport,
    });
    const textLayerPromise = pdfTextLayer.render(page, viewport).catch((error) => {
      if (generation === state.renderGeneration && error?.name !== "AbortException") {
        console.warn("Selectable PDF text could not be rendered for this page.", error);
      }
    });

    await Promise.all([state.renderTask.promise, textLayerPromise]);
    if (generation !== state.renderGeneration) {
      return;
    }

    state.renderTask = null;
    updatePageControls();
    renderOverlay();
    renderThumbnails();
    renderPdfSearchHighlights();
    setStatus(`Page ${state.pageNumber} rendered. ${getCurrentPageOccurrences().length} occurrence${getCurrentPageOccurrences().length === 1 ? "" : "s"} on this page.`);
  } catch (error) {
    if (error?.name !== "RenderingCancelledException") {
      console.error(error);
      setStatus("This page could not be rendered. Try another PDF or page.");
    }
  } finally {
    if (generation === state.renderGeneration) {
      elements.renderingIndicator.hidden = true;
      elements.pageSurface.removeAttribute("aria-busy");
    }
  }
}

async function navigateToPage(pageNumber) {
  if (!state.pdfDocument) {
    return;
  }

  const nextPage = clamp(Math.round(Number(pageNumber) || 1), 1, state.pdfDocument.numPages);
  if (nextPage === state.pageNumber) {
    updatePageControls();
    renderOverlay();
    return;
  }

  state.pageNumber = nextPage;
  state.interaction = null;
  setMarkMode(false);
  await renderPage();
  refreshObjectUi();
}

function handlePageSurfaceClick(event) {
  if (state.markMode || event.target.closest("[data-occurrence-id]")) {
    return;
  }
  const selection = globalThis.getSelection?.();
  if (selection && !selection.isCollapsed) {
    return;
  }
  if (state.selectedOccurrenceId) {
    state.selectedOccurrenceId = null;
    refreshUi();
  }
}

function captureZoomAnchor(clientX, clientY) {
  const stageBounds = elements.viewerStage.getBoundingClientRect();
  const pageBounds = elements.pageSurface.getBoundingClientRect();
  const pointerIsOnPage = (
    clientX >= pageBounds.left
    && clientX <= pageBounds.right
    && clientY >= pageBounds.top
    && clientY <= pageBounds.bottom
  );
  const anchorX = pointerIsOnPage ? clientX : stageBounds.left + stageBounds.width / 2;
  const anchorY = pointerIsOnPage ? clientY : stageBounds.top + stageBounds.height / 2;

  return {
    clientX: anchorX,
    clientY: anchorY,
    pageX: clamp((anchorX - pageBounds.left) / pageBounds.width),
    pageY: clamp((anchorY - pageBounds.top) / pageBounds.height),
  };
}

function restoreZoomAnchor(anchor) {
  const pageBounds = elements.pageSurface.getBoundingClientRect();
  const nextClientX = pageBounds.left + pageBounds.width * anchor.pageX;
  const nextClientY = pageBounds.top + pageBounds.height * anchor.pageY;
  elements.viewerStage.scrollLeft += nextClientX - anchor.clientX;
  elements.viewerStage.scrollTop += nextClientY - anchor.clientY;
}

function previewWheelZoom(deltaY, clientX, clientY) {
  if (!state.pdfDocument || !renderedPageMetrics) {
    return;
  }

  const anchor = captureZoomAnchor(clientX, clientY);
  const nextScale = wheelZoomScale(
    state.scale,
    deltaY,
    WHEEL_ZOOM_SENSITIVITY,
    MINIMUM_SCALE,
    MAXIMUM_SCALE,
  );
  if (nextScale === state.scale && state.zoomMode === "custom") {
    return;
  }

  state.zoomMode = "custom";
  state.scale = nextScale;
  const previewRatio = nextScale / renderedPageMetrics.scale;
  elements.pageSurface.style.width = `${renderedPageMetrics.width * previewRatio}px`;
  elements.pageSurface.style.height = `${renderedPageMetrics.height * previewRatio}px`;
  elements.pageSurface.classList.add("is-zoom-preview");
  elements.pageContent.style.transform = `scale(${previewRatio})`;
  restoreZoomAnchor(anchor);
  updatePageControls();

  wheelZoomAnchor = {
    ...anchor,
    documentId: state.activeDocumentId,
    pageNumber: state.pageNumber,
    scale: nextScale,
  };
  clearTimeout(wheelZoomCommitTimer);
  wheelZoomCommitTimer = setTimeout(() => {
    void commitWheelZoom();
  }, WHEEL_ZOOM_COMMIT_DELAY);
}

async function commitWheelZoom() {
  const anchor = wheelZoomAnchor;
  wheelZoomAnchor = null;
  wheelZoomCommitTimer = null;
  if (
    !anchor
    || anchor.documentId !== state.activeDocumentId
    || anchor.pageNumber !== state.pageNumber
    || anchor.scale !== state.scale
  ) {
    return;
  }

  await renderPage();
  if (
    anchor.documentId === state.activeDocumentId
    && anchor.pageNumber === state.pageNumber
    && anchor.scale === state.scale
    && state.zoomMode === "custom"
  ) {
    restoreZoomAnchor(anchor);
    setStatus(`Zoom ${Math.round(state.scale * 100)}%.`);
  }
}

async function zoomBy(direction, clientX, clientY) {
  if (!state.pdfDocument) {
    return;
  }

  const stageBounds = elements.viewerStage.getBoundingClientRect();
  const anchor = captureZoomAnchor(
    Number.isFinite(clientX) ? clientX : stageBounds.left + stageBounds.width / 2,
    Number.isFinite(clientY) ? clientY : stageBounds.top + stageBounds.height / 2,
  );
  const nextScale = stepZoom(state.scale, direction, ZOOM_STEP, MINIMUM_SCALE, MAXIMUM_SCALE);
  if (nextScale === state.scale && state.zoomMode === "custom") {
    return;
  }

  state.zoomMode = "custom";
  state.scale = nextScale;
  await renderPage();
  if (state.zoomMode === "custom" && state.scale === nextScale) {
    restoreZoomAnchor(anchor);
    setStatus(`Zoom ${Math.round(state.scale * 100)}%.`);
  }
}

function appendSelectionHandles(occurrence) {
  const overlayBounds = unrotatedSize(elements.overlay.getBoundingClientRect(), state.rotation);
  if (!overlayBounds.width || !overlayBounds.height) {
    return;
  }

  const handleWidth = 8 / overlayBounds.width;
  const handleHeight = 8 / overlayBounds.height;
  const bounds = occurrence.bounds;
  const corners = [
    ["nw", bounds.x, bounds.y],
    ["ne", bounds.x + bounds.width, bounds.y],
    ["sw", bounds.x, bounds.y + bounds.height],
    ["se", bounds.x + bounds.width, bounds.y + bounds.height],
  ];

  for (const [name, x, y] of corners) {
    const handle = document.createElementNS(SVG_NAMESPACE, "rect");
    handle.setAttribute("x", String(clamp(x - handleWidth / 2, 0, 1 - handleWidth)));
    handle.setAttribute("y", String(clamp(y - handleHeight / 2, 0, 1 - handleHeight)));
    handle.setAttribute("width", String(handleWidth));
    handle.setAttribute("height", String(handleHeight));
    handle.setAttribute("rx", String(Math.min(handleWidth, handleHeight) * 0.22));
    handle.setAttribute("class", "selection-handle");
    handle.dataset.occurrenceId = occurrence.id;
    handle.dataset.resizeHandle = name;
    overlayLayer.append(handle);
  }

  if (occurrence.geometryType === "polygon") {
    occurrence.points.forEach((point, index) => {
      const vertex = document.createElementNS(SVG_NAMESPACE, "ellipse");
      vertex.setAttribute("cx", String(point.x));
      vertex.setAttribute("cy", String(point.y));
      vertex.setAttribute("rx", String(5 / overlayBounds.width));
      vertex.setAttribute("ry", String(5 / overlayBounds.height));
      vertex.setAttribute("class", "polygon-vertex");
      vertex.dataset.occurrenceId = occurrence.id;
      vertex.dataset.vertexIndex = String(index);
      overlayLayer.append(vertex);
    });
  }
}

async function fitPage() {
  if (!state.pdfDocument) {
    return;
  }
  state.zoomMode = "fit-page";
  await renderPage();
  setStatus("Page fitted to the drawing workspace.");
}

async function fitWidth() {
  if (!state.pdfDocument) {
    return;
  }
  state.zoomMode = "fit-width";
  await renderPage();
  setStatus("Page width fitted to the drawing workspace.");
}

async function showActualSize() {
  if (!state.pdfDocument) {
    return;
  }
  const stageBounds = elements.viewerStage.getBoundingClientRect();
  const anchor = captureZoomAnchor(
    stageBounds.left + stageBounds.width / 2,
    stageBounds.top + stageBounds.height / 2,
  );
  state.zoomMode = "custom";
  state.scale = 1;
  await renderPage();
  if (state.zoomMode === "custom" && state.scale === 1) {
    restoreZoomAnchor(anchor);
    setStatus("Actual size 100%.");
  }
}

function pointIsOnPage(clientX, clientY) {
  if (elements.pageSurface.hidden) {
    return false;
  }
  const bounds = elements.pageSurface.getBoundingClientRect();
  return clientX >= bounds.left
    && clientX <= bounds.right
    && clientY >= bounds.top
    && clientY <= bounds.bottom;
}

function accumulateDirectionalDelta(current, delta) {
  if (!current || Math.sign(current) === Math.sign(delta)) {
    return current + delta;
  }
  return delta;
}

function handleViewerWheel(event) {
  if (!state.pdfDocument) {
    return;
  }

  const stageSize = Math.max(elements.viewerStage.clientHeight, elements.viewerStage.clientWidth, 1);
  const deltaX = wheelDeltaPixels(event.deltaX, event.deltaMode, stageSize);
  const deltaY = wheelDeltaPixels(event.deltaY, event.deltaMode, stageSize);
  const action = wheelNavigationAction({
    deltaX,
    deltaY,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    altKey: event.altKey,
    shiftKey: event.shiftKey,
    pointerOnPage: pointIsOnPage(event.clientX, event.clientY),
  });
  if (!action) {
    return;
  }

  event.preventDefault();
  if (action === "pan-horizontal") {
    elements.viewerStage.scrollLeft += Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;
    return;
  }

  if (action === "previous-page" || action === "next-page") {
    wheelPageAccumulator = accumulateDirectionalDelta(wheelPageAccumulator, deltaY);
    const now = performance.now();
    if (
      Math.abs(wheelPageAccumulator) >= WHEEL_PAGE_THRESHOLD
      && now - lastWheelPageNavigation >= WHEEL_PAGE_COOLDOWN
    ) {
      const direction = wheelPageAccumulator < 0 ? -1 : 1;
      wheelPageAccumulator = 0;
      lastWheelPageNavigation = now;
      navigateToPage(state.pageNumber + direction);
    }
    return;
  }

  previewWheelZoom(deltaY, event.clientX, event.clientY);
}

function setSpacePanActive(active) {
  spacePanActive = Boolean(active && state.pdfDocument);
  elements.viewerStage.classList.toggle("is-pan-ready", spacePanActive && !panInteraction);
}

function finishPan(pointerId) {
  if (!panInteraction || (pointerId !== undefined && panInteraction.pointerId !== pointerId)) {
    return;
  }
  if (elements.viewerStage.hasPointerCapture(panInteraction.pointerId)) {
    elements.viewerStage.releasePointerCapture(panInteraction.pointerId);
  }
  panInteraction = null;
  elements.viewerStage.classList.remove("is-panning");
  elements.viewerStage.classList.toggle("is-pan-ready", spacePanActive);
}

function handleViewerPointerDown(event) {
  const startsMiddlePan = event.button === 1;
  const startsSpacePan = event.button === 0 && spacePanActive;
  if (!state.pdfDocument || (!startsMiddlePan && !startsSpacePan)) {
    return;
  }

  panInteraction = {
    pointerId: event.pointerId,
    clientX: event.clientX,
    clientY: event.clientY,
    scrollLeft: elements.viewerStage.scrollLeft,
    scrollTop: elements.viewerStage.scrollTop,
  };
  elements.viewerStage.setPointerCapture(event.pointerId);
  elements.viewerStage.classList.remove("is-pan-ready");
  elements.viewerStage.classList.add("is-panning");
  event.preventDefault();
  event.stopPropagation();
}

function handleViewerPointerMove(event) {
  if (!panInteraction || panInteraction.pointerId !== event.pointerId) {
    return;
  }
  elements.viewerStage.scrollLeft = panInteraction.scrollLeft - (event.clientX - panInteraction.clientX);
  elements.viewerStage.scrollTop = panInteraction.scrollTop - (event.clientY - panInteraction.clientY);
  event.preventDefault();
  event.stopPropagation();
}

async function inspectPdfFile(file, documentId) {
  let loadingTask = null;
  try {
    const data = new Uint8Array(await file.arrayBuffer());
    const sha256 = await sha256Hex(data);
    loadingTask = pdfjsLib.getDocument({ data, ...PDF_OPTIONS });
    const pdfDocument = await loadingTask.promise;
    return {
      fingerprint: createDocumentFingerprint({
        id: documentId,
        name: file.name,
        size: file.size,
        pageCount: pdfDocument.numPages,
        sha256,
      }),
      session: { loadingTask, pdfDocument, fileName: file.name },
    };
  } catch (error) {
    if (loadingTask) {
      try {
        await loadingTask.destroy();
      } catch (destroyError) {
        console.warn("The failed PDF load could not be released cleanly.", destroyError);
      }
    }
    throw error;
  }
}

async function destroyDocumentSession(documentId) {
  const session = getDocumentSession(documentId);
  state.documentSessions.delete(documentId);
  if (!session?.loadingTask) {
    return;
  }
  try {
    await session.loadingTask.destroy();
  } catch (error) {
    console.warn(`The PDF session for ${documentId} could not be released cleanly.`, error);
  }
}

async function attachPdfFile(file, targetDocumentId = null) {
  const temporaryId = targetDocumentId ?? nextDocumentId(state.documents);
  const candidate = await inspectPdfFile(file, temporaryId);

  if (targetDocumentId) {
    const targetDocument = getProjectDocument(targetDocumentId);
    if (!targetDocument) {
      await candidate.session.loadingTask.destroy();
      throw new Error("The document to relink is no longer in this project.");
    }
    const comparison = compareDocumentFingerprint(targetDocument, candidate.fingerprint);
    if (!comparison.matches) {
      await candidate.session.loadingTask.destroy();
      throw new Error(`Wrong PDF: ${comparison.reasons.join(", ")}`);
    }
    await destroyDocumentSession(targetDocumentId);
    state.documentSessions.set(targetDocumentId, candidate.session);
    resetDocumentViewToFit(targetDocumentId);
    return { documentId: targetDocumentId, added: false, relinked: true, duplicate: false };
  }

  const matchingDocument = findDocumentByFingerprint(state.documents, candidate.fingerprint);
  if (matchingDocument) {
    if (getDocumentSession(matchingDocument.id)) {
      await candidate.session.loadingTask.destroy();
      return { documentId: matchingDocument.id, added: false, relinked: false, duplicate: true };
    }
    state.documentSessions.set(matchingDocument.id, candidate.session);
    resetDocumentViewToFit(matchingDocument.id);
    return { documentId: matchingDocument.id, added: false, relinked: true, duplicate: false };
  }

  const documentId = nextDocumentId(state.documents);
  const projectDocument = { ...candidate.fingerprint, id: documentId };
  state.documents.push(projectDocument);
  state.documentSessions.set(documentId, candidate.session);
  resetDocumentViewToFit(documentId);
  return { documentId, added: true, relinked: false, duplicate: false };
}

async function addPdfFiles(files) {
  const selectedFiles = Array.from(files ?? []);
  if (selectedFiles.length === 0) {
    return;
  }

  const projectWasEmpty = state.documents.length === 0;
  const attachedIds = [];
  let addedCount = 0;
  let relinkedCount = 0;
  let duplicateCount = 0;
  const failures = [];
  elements.renderingIndicator.hidden = false;
  setSidecarMessage();
  setStatus(`Reading ${selectedFiles.length} PDF${selectedFiles.length === 1 ? "" : "s"}…`);

  for (const file of selectedFiles) {
    try {
      const result = await attachPdfFile(file);
      attachedIds.push(result.documentId);
      addedCount += Number(result.added);
      relinkedCount += Number(result.relinked);
      duplicateCount += Number(result.duplicate);
    } catch (error) {
      console.error(error);
      failures.push(`${file.name}: ${error.message}`);
    }
  }

  if (addedCount > 0) {
    resetObjectHistory();
  }
  const nextActiveId = getDocumentSession(state.activeDocumentId)
    ? state.activeDocumentId
    : attachedIds.find((documentId) => getDocumentSession(documentId)) ?? state.activeDocumentId;
  if (nextActiveId && nextActiveId !== state.activeDocumentId) {
    await activateDocument(nextActiveId);
  } else if (nextActiveId && state.pdfDocument) {
    setDocumentControlsEnabled(true);
    refreshUi();
  } else if (nextActiveId) {
    await activateDocument(nextActiveId);
  } else {
    showDocumentPlaceholder(getProjectDocument(state.activeDocumentId));
    setDocumentControlsEnabled(false);
    refreshUi();
  }

  if (projectWasEmpty && addedCount > 0) {
    markObjectLayerSaved();
  } else {
    updateSaveState();
  }
  const summary = [
    addedCount ? `${addedCount} added` : "",
    relinkedCount ? `${relinkedCount} relinked` : "",
    duplicateCount ? `${duplicateCount} already attached` : "",
  ].filter(Boolean).join(", ");
  setStatus(summary ? `PDF update complete: ${summary}.` : "No PDFs were added.");
  setSidecarMessage(failures.length ? `Some PDFs could not be opened: ${failures.join("; ")}` : "", failures.length > 0);
  elements.renderingIndicator.hidden = true;
  elements.pdfFile.value = "";
}

async function relinkDocument(documentId, file) {
  if (!documentId || !file) {
    return;
  }
  elements.renderingIndicator.hidden = false;
  setStatus(`Checking ${file.name}…`);
  try {
    await attachPdfFile(file, documentId);
    if (state.activeDocumentId === documentId || !state.pdfDocument) {
      await activateDocument(documentId);
    } else {
      refreshUi();
    }
    setSidecarMessage();
    setStatus(`${getProjectDocument(documentId).name} was relinked successfully.`);
  } catch (error) {
    console.error(error);
    setSidecarMessage(`Relink failed: ${error.message}. Project data was not changed.`, true);
    setStatus("The selected PDF did not match the project document.");
  } finally {
    elements.renderingIndicator.hidden = true;
    elements.relinkPdfFile.value = "";
    state.pendingRelinkDocumentId = null;
  }
}

async function detachDocument(documentId) {
  const projectDocument = getProjectDocument(documentId);
  if (!projectDocument || !getDocumentSession(documentId)) {
    return;
  }
  saveActiveDocumentView();
  if (state.activeDocumentId === documentId && state.renderTask) {
    state.renderTask.cancel();
    state.renderTask = null;
    state.renderGeneration += 1;
  }
  await destroyDocumentSession(documentId);
  if (state.activeDocumentId === documentId) {
    await activateDocument(documentId, state.pageNumber);
  } else {
    refreshUi();
  }
  setStatus(`${projectDocument.name} was detached. Its project data and occurrences were preserved.`);
}

async function removeDocument(documentId) {
  const projectDocument = getProjectDocument(documentId);
  if (!projectDocument || !canRemoveDocument(state.occurrences, documentId)) {
    return;
  }
  if (state.documents.length === 1 && state.objects.length > 0) {
    setStatus("The last PDF cannot be removed while the project still contains objects.");
    return;
  }

  if (state.activeDocumentId === documentId && state.renderTask) {
    state.renderTask.cancel();
    state.renderTask = null;
    state.renderGeneration += 1;
  }
  await destroyDocumentSession(documentId);
  state.documentViews.delete(documentId);
  state.documents = state.documents.filter((document) => document.id !== documentId);
  resetObjectHistory();
  const removedActiveDocument = state.activeDocumentId === documentId;
  if (removedActiveDocument) {
    state.activeDocumentId = null;
    state.documentFingerprint = null;
    state.pdfDocument = null;
    state.loadingTask = null;
  }
  if (state.documents.length === 0) {
    state.fileName = "";
    objectLayerSaveState.reset();
    elements.documentName.textContent = "No PDF open";
    elements.documentName.title = "No PDF open";
    elements.pageCount.textContent = "/ 0";
    elements.zoomValue.textContent = "Fit";
    showDocumentPlaceholder();
    setDocumentControlsEnabled(false);
    refreshUi();
  } else if (removedActiveDocument) {
    await activateDocument(state.documents[0].id);
    updateSaveState();
  } else {
    refreshUi();
    updateSaveState();
  }
  setStatus(`${projectDocument.name} was removed from the project.`);
}

function sidecarDownloadName() {
  const baseName = state.fileName
    .replace(/\.pdf$/i, "")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .trim();
  return `${baseName || "drawing"}.objdraw-project.json`;
}

function exportSidecar() {
  if (state.documents.length === 0) {
    return;
  }

  try {
    const sidecar = createSidecar({
      documents: state.documents,
      activeDocumentId: state.activeDocumentId,
      objects: state.objects,
      occurrences: state.occurrences,
      observations: state.observations,
    });
    const blob = new Blob([`${JSON.stringify(sidecar, null, 2)}\n`], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = sidecarDownloadName();
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    markObjectLayerSaved();
    setSidecarMessage(`Exported ${anchor.download}.`);
    setStatus(`Project exported with ${state.objects.length} object${state.objects.length === 1 ? "" : "s"}, ${state.occurrences.length} occurrence${state.occurrences.length === 1 ? "" : "s"}, ${state.observations.length} evidence entr${state.observations.length === 1 ? "y" : "ies"}, and ${state.documents.length} PDF${state.documents.length === 1 ? "" : "s"}.`);
  } catch (error) {
    console.error(error);
    setSidecarMessage(`Export failed: ${error.message}`, true);
  }
}

async function importSidecar(file) {
  if (!file) {
    return;
  }

  try {
    const parsed = JSON.parse(await file.text());
    const sidecar = validateSidecar(parsed);
    if (hasUnsavedObjectLayerChanges()) {
      const confirmed = globalThis.confirm(
        `Import ${file.name}?\n\nUnsaved object, occurrence, and evidence changes in the current project will be replaced.`,
      );
      if (!confirmed) {
        setStatus("Project import was cancelled. Current changes were preserved.");
        return;
      }
    }

    saveActiveDocumentView();
    if (state.renderTask) {
      state.renderTask.cancel();
      state.renderTask = null;
    }
    state.renderGeneration += 1;
    const previousDocuments = state.documents;
    const previousSessions = state.documentSessions;
    const previousViews = state.documentViews;
    const nextSessions = new Map();
    const nextViews = new Map();
    const reusedDocumentIds = new Set();
    for (const projectDocument of sidecar.documents) {
      const previousDocument = findDocumentByFingerprint(previousDocuments, projectDocument);
      const previousSession = previousDocument ? previousSessions.get(previousDocument.id) : null;
      if (previousSession) {
        nextSessions.set(projectDocument.id, previousSession);
        reusedDocumentIds.add(previousDocument.id);
      }
      const previousView = previousDocument ? previousViews.get(previousDocument.id) : null;
      if (previousView) {
        nextViews.set(projectDocument.id, { ...previousView });
      }
    }
    for (const [documentId, session] of previousSessions) {
      if (!reusedDocumentIds.has(documentId)) {
        try {
          await session.loadingTask.destroy();
        } catch (error) {
          console.warn(`The replaced PDF session for ${documentId} could not be released cleanly.`, error);
        }
      }
    }

    const importedActiveDocumentId = sidecar.activeDocumentId;
    state.documents = sidecar.documents;
    state.activeDocumentId = null;
    state.documentSessions = nextSessions;
    state.documentViews = nextViews;
    state.objects = sidecar.objects;
    state.occurrences = toRuntimeOccurrences(sidecar.occurrences);
    state.observations = sidecar.observations;
    state.selectedObjectId = null;
    state.selectedOccurrenceId = null;
    state.interaction = null;
    setMarkMode(false);
    resetObjectHistory();
    await activateDocument(importedActiveDocumentId);
    markObjectLayerSaved();
    const migrationNote = parsed.format === "obd-object-layer-v1"
      ? " and migrated from v1"
      : parsed.format === "obd-project-v2"
        ? " and migrated from v2"
        : parsed.format === "obd-project-v3"
          ? " and migrated from v3"
          : parsed.format === "obd-project-v4"
            ? " and updated from the old OBD format"
            : "";
    setSidecarMessage(`Imported ${file.name}${migrationNote}.`);
    const missingCount = state.documents.length - state.documentSessions.size;
    setStatus(`Restored ${state.documents.length} PDF${state.documents.length === 1 ? "" : "s"}, ${state.objects.length} object${state.objects.length === 1 ? "" : "s"}, ${state.occurrences.length} occurrence${state.occurrences.length === 1 ? "" : "s"}, and ${state.observations.length} evidence entr${state.observations.length === 1 ? "y" : "ies"}.${missingCount ? ` ${missingCount} PDF${missingCount === 1 ? " needs" : "s need"} relinking.` : ""}`);
  } catch (error) {
    console.error(error);
    setSidecarMessage(`Import failed: ${error.message}. The current session was not changed.`, true);
    setStatus("The selected project was not imported.");
  } finally {
    elements.sidecarFile.value = "";
  }
}

function currentLocation() {
  return state.activeDocumentId && state.pdfDocument
    ? { documentId: state.activeDocumentId, page: state.pageNumber }
    : null;
}

async function goThroughHistory(direction) {
  const current = currentLocation();
  const target = direction < 0 ? viewHistory.back(current) : viewHistory.forward(current);
  if (!target) {
    setStatus(direction < 0 ? "Nothing to go back to." : "Nothing to go forward to.");
    return;
  }
  if (target.documentId === state.activeDocumentId && state.pdfDocument) {
    await navigateToPage(target.page);
  } else {
    await activateDocument(target.documentId, target.page);
  }
  const projectDocument = getProjectDocument(target.documentId);
  setStatus(`${direction < 0 ? "Back" : "Forward"} to ${projectDocument?.name ?? target.documentId}, page ${target.page}.`);
}

async function stepSelectedObject(direction) {
  const object = getObject(state.selectedObjectId);
  if (!object) {
    setStatus("Select an object first, then use [ and ] to step through where it appears.");
    return;
  }
  const target = stepObjectOccurrence(
    state.occurrences, object.id, state.selectedOccurrenceId, direction, state.documents.map((document) => document.id),
  );
  if (target) {
    await selectOccurrenceAndNavigate(target.id);
  }
}

async function selectOccurrenceAndNavigate(occurrenceId) {
  const occurrence = getOccurrence(occurrenceId);
  if (!occurrence) {
    return;
  }
  viewHistory.record(currentLocation(), { documentId: occurrence.documentId, page: occurrence.page });

  state.selectedOccurrenceId = occurrence.id;
  state.selectedObjectId = occurrence.objectId;
  let attached = Boolean(getDocumentSession(occurrence.documentId));
  if (occurrence.documentId !== state.activeDocumentId) {
    attached = await activateDocument(occurrence.documentId, occurrence.page);
  } else if (state.pdfDocument && occurrence.page !== state.pageNumber) {
    await navigateToPage(occurrence.page);
  } else if (!state.pdfDocument) {
    attached = await activateDocument(occurrence.documentId, occurrence.page);
  } else {
    refreshUi();
  }
  const object = getObject(occurrence.objectId);
  const projectDocument = getProjectDocument(occurrence.documentId);
  const location = `${projectDocument?.name ?? occurrence.documentId}, page ${occurrence.page}`;
  setStatus(object
    ? `${occurrence.id} selected in ${location} for ${object.label} (${object.id}).${attached ? "" : " Relink this PDF to show it."}`
    : `${occurrence.id} selected in ${location}. It is not linked to an object.${attached ? "" : " Relink this PDF to show it."}`);
}

async function navigateFromDrawingMap(documentId, pageNumber) {
  const projectDocument = getProjectDocument(documentId);
  if (!projectDocument) {
    return;
  }
  viewHistory.record(currentLocation(), { documentId, page: pageNumber });
  let attached;
  if (documentId === state.activeDocumentId && state.pdfDocument) {
    await navigateToPage(pageNumber);
    attached = true;
  } else {
    attached = await activateDocument(documentId, pageNumber);
  }
  if (!attached) {
    return;
  }

  const pageOccurrences = state.occurrences.filter(
    (occurrence) => occurrence.documentId === documentId && occurrence.page === pageNumber,
  );
  const selectedObject = getObject(state.selectedObjectId);
  const containsSelectedObject = selectedObject
    && pageOccurrences.some((occurrence) => occurrence.objectId === selectedObject.id);
  setStatus(`Showing ${projectDocument.name}, page ${pageNumber}. ${pageOccurrences.length} occurrence${pageOccurrences.length === 1 ? "" : "s"}.${containsSelectedObject ? ` Includes ${selectedObject.label} (${selectedObject.id}).` : ""}`);
}

async function selectObjectAndNavigate(objectId) {
  const object = getObject(objectId);
  if (!object) {
    return;
  }

  state.selectedObjectId = object.id;
  const occurrences = getObjectOccurrences(state.occurrences, object.id);
  const targetOccurrence = chooseObjectOccurrence({
    occurrences: state.occurrences,
    objectId: object.id,
    activeDocumentId: state.activeDocumentId,
    activePage: state.pageNumber,
    attachedDocumentIds: attachedDocumentIds(),
  });
  state.selectedOccurrenceId = targetOccurrence?.id ?? null;
  if (targetOccurrence) {
    viewHistory.record(currentLocation(), { documentId: targetOccurrence.documentId, page: targetOccurrence.page });
  }

  if (targetOccurrence && targetOccurrence.documentId !== state.activeDocumentId) {
    await activateDocument(targetOccurrence.documentId, targetOccurrence.page);
  } else if (targetOccurrence && state.pdfDocument && targetOccurrence.page !== state.pageNumber) {
    await navigateToPage(targetOccurrence.page);
  } else if (targetOccurrence && !state.pdfDocument) {
    await activateDocument(targetOccurrence.documentId, targetOccurrence.page);
  } else {
    refreshUi();
  }
  const targetDocument = getProjectDocument(targetOccurrence?.documentId);
  setStatus(targetOccurrence
    ? `${object.label} (${object.id}) selected. Showing ${targetOccurrence.id} in ${targetDocument?.name ?? targetOccurrence.documentId}, page ${targetOccurrence.page}, from ${occurrences.length} occurrence${occurrences.length === 1 ? "" : "s"}.${getDocumentSession(targetOccurrence.documentId) ? "" : " Relink this PDF to show it."}`
    : `${object.label} (${object.id}) selected. This object has no occurrences yet.`);
}

function deleteOccurrenceById(occurrenceId) {
  const occurrence = getOccurrence(occurrenceId);
  if (!occurrence) {
    return false;
  }
  const evidenceCount = state.observations.filter((observation) => observation.occurrenceId === occurrenceId).length;
  if (evidenceCount > 0) {
    setStatus(`Remove ${evidenceCount} evidence entr${evidenceCount === 1 ? "y" : "ies"} linked to ${occurrence.id} before deleting the source occurrence.`);
    return false;
  }

  recordObjectMutation(`delete ${occurrence.id}`);
  state.occurrences = removeOccurrence(state.occurrences, occurrenceId);
  if (state.selectedOccurrenceId === occurrenceId) {
    state.selectedOccurrenceId = null;
  }
  refreshUi();
  setStatus(`${occurrence.id} was deleted. Its object was preserved.`);
  return true;
}

// Screen point -> unrotated page point, the only coordinates that are ever saved.
function pagePointFromClient(clientX, clientY, overlayBounds) {
  return unrotatePoint(pointFromClient(clientX, clientY, overlayBounds), state.rotation);
}

function handleOverlayPointerDown(event) {
  if (!state.pdfDocument || event.button !== 0) {
    return;
  }

  const overlayBounds = elements.overlay.getBoundingClientRect();
  const point = pagePointFromClient(event.clientX, event.clientY, overlayBounds);

  if (state.markMode && state.markGeometryType === "polygon") {
    return;
  }

  if (state.markMode) {
    state.interaction = {
      type: "draw",
      pointerId: event.pointerId,
      start: point,
      bounds: boundsFromPoints(point, point),
      beforeSnapshot: currentObjectLayerSnapshot(),
    };
    elements.overlay.setPointerCapture(event.pointerId);
    renderOverlay();
    event.preventDefault();
    return;
  }

  const occurrenceId = event.target.dataset?.occurrenceId;
  if (!occurrenceId) {
    state.selectedOccurrenceId = null;
    refreshUi();
    return;
  }

  const occurrence = getOccurrence(occurrenceId);
  if (!occurrence) {
    return;
  }

  state.selectedOccurrenceId = occurrenceId;
  state.selectedObjectId = occurrence.objectId;
  const commonInteraction = {
    pointerId: event.pointerId,
    occurrenceId,
    start: point,
    originalBounds: { ...occurrence.bounds },
    originalPoints: occurrence.points?.map((vertex) => ({ ...vertex })) ?? null,
    beforeSnapshot: currentObjectLayerSnapshot(),
  };
  if (event.target.dataset?.resizeHandle) {
    state.interaction = { ...commonInteraction, type: "resize", handle: event.target.dataset.resizeHandle };
  } else if (event.target.dataset?.vertexIndex !== undefined) {
    state.interaction = { ...commonInteraction, type: "vertex-move", vertexIndex: Number(event.target.dataset.vertexIndex) };
  } else {
    state.interaction = { ...commonInteraction, type: "move" };
  }
  elements.overlay.setPointerCapture(event.pointerId);
  refreshUi();
  event.preventDefault();
}

function handleOverlayPointerMove(event) {
  const interaction = state.interaction;
  if (interaction?.type === "polygon-draw") {
    interaction.previewPoint = pagePointFromClient(
      event.clientX,
      event.clientY,
      elements.overlay.getBoundingClientRect(),
    );
    renderOverlay();
    return;
  }
  if (!interaction || interaction.pointerId !== event.pointerId) {
    return;
  }

  const overlayBounds = elements.overlay.getBoundingClientRect();
  const point = pagePointFromClient(event.clientX, event.clientY, overlayBounds);

  if (interaction.type === "draw") {
    interaction.bounds = boundsFromPoints(interaction.start, point);
  } else if (interaction.type === "move") {
    const occurrence = getOccurrence(interaction.occurrenceId);
    if (occurrence) {
      const deltaX = point.x - interaction.start.x;
      const deltaY = point.y - interaction.start.y;
      occurrence.bounds = moveBounds(interaction.originalBounds, deltaX, deltaY);
      if (occurrence.geometryType === "polygon") {
        occurrence.points = movePolygonPoints(interaction.originalPoints, interaction.originalBounds, deltaX, deltaY);
        occurrence.bounds = boundsFromPolygonPoints(occurrence.points);
      }
    }
  } else if (interaction.type === "resize") {
    const occurrence = getOccurrence(interaction.occurrenceId);
    if (occurrence) {
      const nextBounds = resizeBounds(
        interaction.originalBounds,
        interaction.handle,
        point,
        MINIMUM_MARK_SIZE / overlayBounds.width,
        MINIMUM_MARK_SIZE / overlayBounds.height,
      );
      if (occurrence.geometryType === "polygon") {
        occurrence.points = resizePolygonPoints(interaction.originalPoints, interaction.originalBounds, nextBounds);
        occurrence.bounds = boundsFromPolygonPoints(occurrence.points);
      } else {
        occurrence.bounds = nextBounds;
      }
    }
  } else if (interaction.type === "vertex-move") {
    const occurrence = getOccurrence(interaction.occurrenceId);
    if (occurrence?.geometryType === "polygon") {
      occurrence.points[interaction.vertexIndex] = point;
      occurrence.bounds = boundsFromPolygonPoints(occurrence.points);
    }
  }

  renderOverlay();
  event.preventDefault();
}

function releasePointer(pointerId) {
  if (elements.overlay.hasPointerCapture(pointerId)) {
    elements.overlay.releasePointerCapture(pointerId);
  }
}

function handleOverlayPointerUp(event) {
  const interaction = state.interaction;
  if (!interaction || interaction.pointerId !== event.pointerId) {
    return;
  }

  if (interaction.type === "draw") {
    const pixelSize = boundsSizeInPixels(
      interaction.bounds,
      unrotatedSize(elements.overlay.getBoundingClientRect(), state.rotation),
    );
    let completionMessage;
    if (meetsMinimumMarkSize(pixelSize, MINIMUM_MARK_SIZE)) {
      const linkedObject = getObject(state.linkTargetObjectId);
      const occurrence = createOccurrence(
        state.occurrences,
        state.pageNumber,
        interaction.bounds,
        linkedObject?.id ?? null,
        state.activeDocumentId,
        state.markGeometryType,
      );
      recordObjectMutation(`create ${occurrence.id}`, interaction.beforeSnapshot);
      state.occurrences.push(occurrence);
      state.selectedOccurrenceId = occurrence.id;
      state.selectedObjectId = linkedObject?.id ?? null;
      completionMessage = linkedObject
        ? `${occurrence.id} linked to ${linkedObject.label} (${linkedObject.id}).`
        : `${occurrence.id} is unlinked. Create or choose its object.`;
      setMarkMode(false);
    } else {
      completionMessage = `That ${state.markGeometryType} was too small. Try a larger shape, or zoom in with + or Ctrl/Command + wheel. Marking is still active; press Escape to cancel.`;
    }
    setStatus(completionMessage);
  } else if (interaction.type === "move") {
    const movedOccurrence = getOccurrence(interaction.occurrenceId);
    if (movedOccurrence && (
      !boundsAreEqual(movedOccurrence.bounds, interaction.originalBounds)
      || (movedOccurrence.geometryType === "polygon" && !pointsAreEqual(movedOccurrence.points, interaction.originalPoints))
    )) {
      recordObjectMutation(`move ${interaction.occurrenceId}`, interaction.beforeSnapshot);
      setStatus(`${interaction.occurrenceId} repositioned on page ${state.pageNumber}.`);
    } else {
      setStatus(`${interaction.occurrenceId} stayed in its original position.`);
    }
  } else if (interaction.type === "resize") {
    const resizedOccurrence = getOccurrence(interaction.occurrenceId);
    if (resizedOccurrence && (
      !boundsAreEqual(resizedOccurrence.bounds, interaction.originalBounds)
      || (resizedOccurrence.geometryType === "polygon" && !pointsAreEqual(resizedOccurrence.points, interaction.originalPoints))
    )) {
      recordObjectMutation(`resize ${interaction.occurrenceId}`, interaction.beforeSnapshot);
      setStatus(`${interaction.occurrenceId} resized on page ${state.pageNumber}.`);
    } else {
      setStatus(`${interaction.occurrenceId} kept its original size.`);
    }
  } else if (interaction.type === "vertex-move") {
    const editedOccurrence = getOccurrence(interaction.occurrenceId);
    if (editedOccurrence && polygonArea(editedOccurrence.points) <= 1e-9) {
      editedOccurrence.points = interaction.originalPoints;
      editedOccurrence.bounds = interaction.originalBounds;
      setStatus(`${interaction.occurrenceId} must keep an enclosed polygon area.`);
    } else if (editedOccurrence && !pointsAreEqual(editedOccurrence.points, interaction.originalPoints)) {
      recordObjectMutation(`edit ${interaction.occurrenceId} vertices`, interaction.beforeSnapshot);
      setStatus(`${interaction.occurrenceId} polygon vertex updated on page ${state.pageNumber}.`);
    } else {
      setStatus(`${interaction.occurrenceId} vertex stayed in its original position.`);
    }
  }

  releasePointer(event.pointerId);
  state.interaction = null;
  refreshUi();
  if (
    interaction.type === "draw"
    && !state.markMode
    && getOccurrence(state.selectedOccurrenceId)
    && !getOccurrence(state.selectedOccurrenceId).objectId
  ) {
    elements.objectLabel.focus();
  }
  event.preventDefault();
}

function handleOverlayPointerCancel(event) {
  const interaction = state.interaction;
  if (!interaction || interaction.pointerId !== event.pointerId) {
    return;
  }

  if (["move", "resize", "vertex-move"].includes(interaction.type)) {
    const occurrence = getOccurrence(interaction.occurrenceId);
    if (occurrence) {
      occurrence.bounds = interaction.originalBounds;
      if (interaction.originalPoints) {
        occurrence.points = interaction.originalPoints;
      }
    }
  }

  releasePointer(event.pointerId);
  state.interaction = null;
  setMarkMode(false);
  refreshUi();
  setStatus("Interaction cancelled.");
}

function finishPolygonMark() {
  const interaction = state.interaction;
  if (!state.markMode || interaction?.type !== "polygon-draw") {
    return false;
  }
  if (interaction.points.length < 3 || polygonArea(interaction.points) <= 1e-9) {
    setStatus("A polygon needs at least three corners and an enclosed area. Keep clicking, or press Escape to cancel.");
    return true;
  }
  const linkedObject = getObject(state.linkTargetObjectId);
  const occurrence = createOccurrence(
    state.occurrences,
    state.pageNumber,
    boundsFromPolygonPoints(interaction.points),
    linkedObject?.id ?? null,
    state.activeDocumentId,
    "polygon",
    interaction.points,
  );
  recordObjectMutation(`create ${occurrence.id}`, interaction.beforeSnapshot);
  state.occurrences.push(occurrence);
  state.selectedOccurrenceId = occurrence.id;
  state.selectedObjectId = linkedObject?.id ?? null;
  state.interaction = null;
  setMarkMode(false);
  refreshUi();
  setStatus(linkedObject
    ? `${occurrence.id} polygon linked to ${linkedObject.label} (${linkedObject.id}).`
    : `${occurrence.id} polygon is unlinked. Create or choose its object.`);
  if (!linkedObject) {
    elements.objectLabel.focus();
  }
  return true;
}

function handleOverlayClick(event) {
  if (!state.markMode || state.markGeometryType !== "polygon" || !state.pdfDocument) {
    return;
  }
  const overlayBounds = elements.overlay.getBoundingClientRect();
  const point = pagePointFromClient(event.clientX, event.clientY, overlayBounds);
  if (!state.interaction || state.interaction.type !== "polygon-draw") {
    state.interaction = {
      type: "polygon-draw",
      points: [point],
      previewPoint: point,
      beforeSnapshot: currentObjectLayerSnapshot(),
    };
  } else if (event.detail >= 2) {
    finishPolygonMark();
    event.preventDefault();
    return;
  } else {
    const first = state.interaction.points[0];
    const closeToFirst = Math.hypot(
      (point.x - first.x) * overlayBounds.width,
      (point.y - first.y) * overlayBounds.height,
    ) <= 10;
    if (closeToFirst && state.interaction.points.length >= 3) {
      finishPolygonMark();
      event.preventDefault();
      return;
    }
    state.interaction.points.push(point);
    state.interaction.previewPoint = point;
  }
  renderOverlay();
  setStatus(`${state.interaction.points.length} polygon corner${state.interaction.points.length === 1 ? "" : "s"}. Double-click or press Enter to finish; Escape cancels.`);
  event.preventDefault();
}

function handleOverlayKeyDown(event) {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  const occurrenceId = event.target.dataset?.occurrenceId;
  const occurrence = getOccurrence(occurrenceId);
  if (!occurrence) {
    return;
  }

  event.preventDefault();
  state.selectedOccurrenceId = occurrence.id;
  state.selectedObjectId = occurrence.objectId;
  refreshUi();
  focusSelectedOccurrenceRectangle();
  const object = getObject(occurrence.objectId);
  setStatus(object
    ? `${occurrence.id} selected for ${object.label} (${object.id}).`
    : `${occurrence.id} selected. It is not linked to an object.`);
}

function createObjectFromForm(event) {
  event.preventDefault();
  if (!state.pdfDocument) {
    setStatus("Open a PDF before creating objects.");
    return;
  }
  const label = normalizeLabel(elements.objectLabel.value);
  if (!label) {
    elements.objectLabel.setCustomValidity("Enter an object label.");
    elements.objectLabel.reportValidity();
    return;
  }
  elements.objectLabel.setCustomValidity("");

  const duplicateLabelExists = state.objects.some((object) => object.label.toLocaleLowerCase() === label.toLocaleLowerCase());
  const object = createObject(state.objects, elements.objectCategory.value, label);
  const selectedOccurrence = getOccurrence(state.selectedOccurrenceId);
  recordObjectMutation(`create ${object.id}`);
  state.objects.push(object);
  state.selectedObjectId = object.id;
  if (selectedOccurrence && !selectedOccurrence.objectId) {
    state.occurrences = linkOccurrence(state.occurrences, selectedOccurrence.id, object.id);
  }
  elements.objectLabel.value = "";
  refreshUi();

  const linkedMessage = selectedOccurrence && !selectedOccurrence.objectId
    ? ` and linked ${selectedOccurrence.id}`
    : "";
  setStatus(`${objectCategoryLabel(object.category)} object ${object.label} created as ${object.id}${linkedMessage}.${duplicateLabelExists ? " The duplicate label remains a separate identity." : ""}`);
}

function linkSelectedOccurrenceToExistingObject() {
  const occurrence = getOccurrence(state.selectedOccurrenceId);
  const object = getObject(elements.existingObjectSelect.value);
  if (!occurrence || occurrence.objectId || !object) {
    return;
  }

  recordObjectMutation(`link ${occurrence.id} to ${object.id}`);
  state.occurrences = linkOccurrence(state.occurrences, occurrence.id, object.id);
  state.selectedObjectId = object.id;
  refreshUi();
  setStatus(`${occurrence.id} linked to ${object.label} (${object.id}).`);
}

function saveSelectedObjectLabel() {
  const object = getObject(state.selectedObjectId);
  const label = normalizeLabel(elements.editObjectLabel.value);
  if (!object || !label) {
    elements.editObjectLabel.setCustomValidity("Enter an object label.");
    elements.editObjectLabel.reportValidity();
    return;
  }
  elements.editObjectLabel.setCustomValidity("");
  const category = elements.editObjectCategory.value;
  if (object.label === label && object.category === category) {
    setStatus(`${object.id} already uses ${objectCategoryLabel(category)} and the label ${label}.`);
    return;
  }

  const duplicateLabelExists = state.objects.some((candidate) => (
    candidate.id !== object.id
    && candidate.label.toLocaleLowerCase() === label.toLocaleLowerCase()
  ));
  recordObjectMutation(`update ${object.id}`);
  state.objects = updateObjectDetails(state.objects, object.id, { category, label });
  refreshUi();
  setStatus(`${object.id} updated to ${objectCategoryLabel(category)} · ${label}.${duplicateLabelExists ? " Another object has the same label but remains separate." : ""}`);
}

function deleteSelectedObject() {
  const object = getObject(state.selectedObjectId);
  if (!object) {
    return;
  }

  const evidenceCount = state.observations.filter((observation) => observation.objectId === object.id).length;
  if (evidenceCount > 0) {
    setStatus(`Remove ${evidenceCount} evidence entr${evidenceCount === 1 ? "y" : "ies"} before deleting ${object.label} (${object.id}).`);
    return;
  }

  const occurrenceCount = getObjectOccurrences(state.occurrences, object.id).length;
  const confirmed = globalThis.confirm(
    `Delete ${object.label} (${object.id})?\n\n${occurrenceCount} occurrence${occurrenceCount === 1 ? "" : "s"} will remain as unlinked marks.`,
  );
  if (!confirmed) {
    return;
  }

  const deletedObjectIndex = state.objects.indexOf(object);
  recordObjectMutation(`delete ${object.id}`);
  const formerlyLinkedIds = new Set(
    getObjectOccurrences(state.occurrences, object.id).map((occurrence) => occurrence.id),
  );
  const result = deleteObjectPreservingOccurrences(state.objects, state.occurrences, object.id);
  state.objects = result.objects;
  state.occurrences = result.occurrences;
  state.selectedObjectId = null;
  const formerlyLinkedOccurrence = state.occurrences.find((occurrence) => formerlyLinkedIds.has(occurrence.id));
  state.selectedOccurrenceId = formerlyLinkedOccurrence?.id ?? null;
  refreshUi();
  if (formerlyLinkedOccurrence) {
    elements.objectLabel.focus();
  } else {
    const remainingObjectButtons = Array.from(elements.objectList.querySelectorAll("button[data-object-id]"));
    const nextObjectButton = remainingObjectButtons[nextFocusIndex(deletedObjectIndex, remainingObjectButtons.length)];
    (nextObjectButton ?? elements.objectLabel).focus();
  }
  setStatus(`${object.label} (${object.id}) deleted. Its occurrences were preserved as unlinked marks.`);
}

function addEvidenceFromForm(event) {
  event.preventDefault();
  const object = getObject(state.selectedObjectId);
  if (!object) {
    return;
  }
  const occurrenceId = elements.evidenceSource.value || null;
  const sourceOccurrence = occurrenceId ? getOccurrence(occurrenceId) : null;
  elements.evidenceSource.setCustomValidity("");
  if (elements.evidenceKind.value === "observation" && !sourceOccurrence) {
    elements.evidenceSource.setCustomValidity("Choose the exact source representation for an observation.");
    elements.evidenceSource.reportValidity();
    return;
  }
  if (sourceOccurrence && sourceOccurrence.objectId !== object.id) {
    elements.evidenceSource.setCustomValidity("The source representation must belong to the selected object.");
    elements.evidenceSource.reportValidity();
    return;
  }

  try {
    const observation = createObservation(state.observations, {
      objectId: object.id,
      occurrenceId,
      topic: elements.evidenceTopic.value,
      value: elements.evidenceValue.value,
      evidenceKind: elements.evidenceKind.value,
    });
    recordObjectMutation(`add ${observation.id}`);
    state.observations.push(observation);
    elements.evidenceTopic.value = "";
    elements.evidenceValue.value = "";
    refreshUi();
    elements.evidenceTopic.focus();
    setStatus(`${observation.evidenceKind === "observation" ? "Observation" : "Assumption"} ${observation.id} added to ${object.label} as unreviewed evidence.`);
  } catch (error) {
    setStatus(error.message);
  }
}

function updateEvidenceReview(event) {
  const select = event.target.closest("select[data-action='set-evidence-review']");
  if (!select) {
    return;
  }
  const observation = state.observations.find((entry) => entry.id === select.dataset.observationId);
  if (!observation || observation.reviewState === select.value) {
    return;
  }
  recordObjectMutation(`review ${observation.id}`);
  state.observations = updateObservationReviewState(state.observations, observation.id, select.value);
  refreshUi();
  setStatus(`${observation.id} marked ${reviewStateLabel(select.value).toLocaleLowerCase()}.`);
}

async function handleEvidenceAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }
  if (button.dataset.action === "view-evidence-source") {
    await selectOccurrenceAndNavigate(button.dataset.occurrenceId);
    return;
  }
  if (button.dataset.action !== "remove-evidence") {
    return;
  }
  const observation = state.observations.find((entry) => entry.id === button.dataset.observationId);
  if (!observation || !globalThis.confirm(`Remove ${observation.id}: ${observation.topic}?\n\nUndo can restore it during this session.`)) {
    return;
  }
  recordObjectMutation(`remove ${observation.id}`);
  state.observations = removeObservation(state.observations, observation.id);
  refreshUi();
  elements.addEvidence.focus();
  setStatus(`${observation.id} was removed. Its source occurrence was preserved.`);
}

async function handleOccurrenceListAction(event) {
  const button = event.target.closest("button[data-occurrence-id]");
  if (!button) {
    return;
  }

  if (button.dataset.action === "delete-occurrence") {
    const container = button.closest(".object-occurrence-list");
    const occurrenceButtons = Array.from(container?.querySelectorAll(".occurrence-nav-button") ?? []);
    const deletedIndex = occurrenceButtons.findIndex(
      (candidate) => candidate.dataset.occurrenceId === button.dataset.occurrenceId,
    );
    if (!deleteOccurrenceById(button.dataset.occurrenceId)) {
      return;
    }
    const remainingButtons = Array.from(container?.querySelectorAll(".occurrence-nav-button") ?? []);
    const nextButton = remainingButtons[nextFocusIndex(deletedIndex, remainingButtons.length)];
    const fallback = state.selectedObjectId ? elements.markForObject : elements.objectLabel;
    (nextButton ?? fallback).focus();
    return;
  }
  await selectOccurrenceAndNavigate(button.dataset.occurrenceId);
}

function cancelCurrentAction() {
  if (!elements.shortcutPanel.hidden) {
    setShortcutHelpOpen(false);
    elements.shortcutHelp.focus();
    return true;
  }

  const hadPanAction = Boolean(panInteraction || spacePanActive);
  finishPan();
  setSpacePanActive(false);
  if (["move", "resize", "vertex-move"].includes(state.interaction?.type)) {
    const occurrence = getOccurrence(state.interaction.occurrenceId);
    if (occurrence) {
      occurrence.bounds = state.interaction.originalBounds;
      if (state.interaction.originalPoints) {
        occurrence.points = state.interaction.originalPoints;
      }
    }
  }
  const hadAction = Boolean(state.interaction || state.markMode || hadPanAction);
  state.interaction = null;
  setMarkMode(false);
  // A second Escape, with nothing left to cancel, clears the selection.
  if (!hadAction && (state.selectedObjectId || state.selectedOccurrenceId)) {
    state.selectedObjectId = null;
    state.selectedOccurrenceId = null;
    refreshUi();
    setStatus("Selection cleared.");
    return true;
  }
  refreshUi();
  return hadAction;
}

function handleDocumentKeyDown(event) {
  if (event.key === "Escape") {
    if (!elements.pdfSearchBar.hidden) {
      closePdfSearch();
      event.preventDefault();
      return;
    }
    if (cancelCurrentAction()) {
      event.preventDefault();
    }
    return;
  }

  if (event.defaultPrevented) {
    return;
  }

  if (event.key === "Enter" && state.interaction?.type === "polygon-draw") {
    if (finishPolygonMark()) {
      event.preventDefault();
    }
    return;
  }

  if (
    (event.code === "Space" || event.key === " ")
    && state.pdfDocument
    && !isShortcutBlockedTarget(event.target)
    && !event.target.classList?.contains("occurrence-shape")
  ) {
    setSpacePanActive(true);
    event.preventDefault();
    return;
  }

  const action = keyboardShortcutAction({
    key: event.key,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    altKey: event.altKey,
    shiftKey: event.shiftKey,
    blocked: isShortcutBlockedTarget(event.target),
  });
  if (!action) {
    return;
  }

  if (action === "toggle-help") {
    event.preventDefault();
    setShortcutHelpOpen(elements.shortcutPanel.hidden);
    return;
  }
  if (action === "open-search") {
    if (state.pdfDocument) {
      event.preventDefault();
      openPdfSearch();
    }
    return;
  }
  if (action === "focus-object-search") {
    event.preventDefault();
    elements.objectSearch.focus();
    elements.objectSearch.select();
    return;
  }
  if (action === "toggle-labels") {
    event.preventDefault();
    setShowLabels(!state.display.showLabels);
    return;
  }
  if (!state.pdfDocument) {
    return;
  }

  event.preventDefault();
  switch (action) {
    case "fit-width":
      fitWidth();
      break;
    case "rotate-clockwise":
      rotateView(1);
      break;
    case "rotate-counterclockwise":
      rotateView(-1);
      break;
    case "toggle-thumbnails":
      setThumbnailsOpen(elements.thumbnailPanel.hidden);
      break;
    case "toggle-marks-hidden":
      toggleMarksHidden();
      break;
    case "previous-representation":
      stepSelectedObject(-1);
      break;
    case "next-representation":
      stepSelectedObject(1);
      break;
    case "history-back":
      goThroughHistory(-1);
      break;
    case "history-forward":
      goThroughHistory(1);
      break;
    case "previous-page":
      navigateToPage(state.pageNumber - 1);
      break;
    case "next-page":
      navigateToPage(state.pageNumber + 1);
      break;
    case "first-page":
      navigateToPage(1);
      break;
    case "last-page":
      navigateToPage(state.pdfDocument.numPages);
      break;
    case "zoom-in":
      zoomBy(1);
      break;
    case "zoom-out":
      zoomBy(-1);
      break;
    case "fit-page":
      fitPage();
      break;
    case "toggle-mark":
      setMarkMode(!state.markMode);
      break;
    case "undo":
      applyHistory("undo");
      break;
    case "redo":
      applyHistory("redo");
      break;
    default:
      break;
  }
}

elements.pdfFile.addEventListener("change", (event) => addPdfFiles(event.target.files));
elements.relinkPdfFile.addEventListener("change", (event) => {
  relinkDocument(state.pendingRelinkDocumentId, event.target.files?.[0]);
});
elements.documentList.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-document-id]");
  if (!button) {
    return;
  }
  const documentId = button.dataset.documentId;
  switch (button.dataset.action) {
    case "select-document":
      await activateDocument(documentId);
      break;
    case "relink-document":
      state.pendingRelinkDocumentId = documentId;
      elements.relinkPdfFile.click();
      break;
    case "detach-document":
      await detachDocument(documentId);
      break;
    case "remove-document":
      await removeDocument(documentId);
      break;
    default:
      break;
  }
});
elements.drawingMap.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action='view-map-page']");
  if (!button) {
    return;
  }
  closeDrawingMap();
  await navigateFromDrawingMap(button.dataset.documentId, Number(button.dataset.page));
});
elements.exportSidecar.addEventListener("click", exportSidecar);
elements.exportObjectEvidence.addEventListener("click", () => exportSelectedObjectEvidence(false));
elements.exportObjectEvidenceZip.addEventListener("click", () => exportSelectedObjectEvidence(true));
elements.exportJoineryAiPack.addEventListener("click", exportSelectedObjectForJoineryAi);
elements.addEvidenceForm.addEventListener("submit", addEvidenceFromForm);
elements.evidenceList.addEventListener("change", updateEvidenceReview);
elements.evidenceList.addEventListener("click", handleEvidenceAction);
elements.evidenceKind.addEventListener("change", () => {
  elements.evidenceSource.setCustomValidity("");
  if (elements.evidenceKind.value === "observation" && !elements.evidenceSource.value) {
    const firstOccurrence = getObjectOccurrences(state.occurrences, state.selectedObjectId)[0];
    elements.evidenceSource.value = firstOccurrence?.id ?? "";
  }
});
elements.chooseSidecar.addEventListener("click", () => elements.sidecarFile.click());
elements.sidecarFile.addEventListener("change", (event) => importSidecar(event.target.files?.[0]));
elements.previousPage.addEventListener("click", () => navigateToPage(state.pageNumber - 1));
elements.nextPage.addEventListener("click", () => navigateToPage(state.pageNumber + 1));
elements.pageNumber.addEventListener("change", () => navigateToPage(elements.pageNumber.value));
elements.pageNumber.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    navigateToPage(elements.pageNumber.value);
  }
});
elements.markOccurrence.addEventListener("click", () => setMarkMode(!state.markMode));
elements.openPdfSearch.addEventListener("click", openPdfSearch);
elements.pdfSearchBar.addEventListener("submit", (event) => event.preventDefault());
elements.pdfSearchInput.addEventListener("input", schedulePdfSearch);
elements.pdfSearchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    void movePdfSearchMatch(event.shiftKey ? -1 : 1);
  } else if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    closePdfSearch();
  }
});
elements.previousPdfSearchMatch.addEventListener("click", () => movePdfSearchMatch(-1));
elements.nextPdfSearchMatch.addEventListener("click", () => movePdfSearchMatch(1));
elements.closePdfSearch.addEventListener("click", () => closePdfSearch());
elements.openDrawingMap.addEventListener("click", openDrawingMap);
elements.closeDrawingMap.addEventListener("click", closeDrawingMap);
elements.drawingMapDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeDrawingMap();
});
elements.drawingMapDialog.addEventListener("click", (event) => {
  if (event.target === elements.drawingMapDialog) {
    closeDrawingMap();
  }
});
elements.shapeTool.addEventListener("change", () => {
  state.markGeometryType = elements.shapeTool.value;
  state.interaction = null;
  if (state.markMode) {
    setMarkMode(true, state.linkTargetObjectId);
  } else {
    setStatus(`${elements.shapeTool.selectedOptions[0].textContent} marking selected. Press M or Mark occurrence to begin.`);
  }
  renderOverlay();
});
elements.fitPage.addEventListener("click", fitPage);
elements.fitWidth.addEventListener("click", fitWidth);
elements.actualSize.addEventListener("click", showActualSize);
elements.zoomIn.addEventListener("click", () => zoomBy(1));
elements.zoomOut.addEventListener("click", () => zoomBy(-1));
elements.undoAction.addEventListener("click", () => applyHistory("undo"));
elements.redoAction.addEventListener("click", () => applyHistory("redo"));
elements.shortcutHelp.addEventListener("click", () => setShortcutHelpOpen(elements.shortcutPanel.hidden));
elements.closeShortcutHelp.addEventListener("click", () => {
  setShortcutHelpOpen(false);
  elements.shortcutHelp.focus();
});
elements.viewerStage.addEventListener("wheel", handleViewerWheel, { passive: false });
elements.viewerStage.addEventListener("pointerdown", handleViewerPointerDown, true);
elements.viewerStage.addEventListener("pointermove", handleViewerPointerMove, true);
elements.viewerStage.addEventListener("pointerup", (event) => finishPan(event.pointerId), true);
elements.viewerStage.addEventListener("pointercancel", (event) => finishPan(event.pointerId), true);
elements.pageSurface.addEventListener("click", handlePageSurfaceClick);

elements.overlay.addEventListener("pointerdown", handleOverlayPointerDown);
elements.overlay.addEventListener("pointermove", handleOverlayPointerMove);
elements.overlay.addEventListener("pointerup", handleOverlayPointerUp);
elements.overlay.addEventListener("pointercancel", handleOverlayPointerCancel);
elements.overlay.addEventListener("click", handleOverlayClick);
elements.overlay.addEventListener("keydown", handleOverlayKeyDown);

elements.createObjectForm.addEventListener("submit", createObjectFromForm);
elements.categoryFilter.addEventListener("input", refreshCreateCategoryOptions);
elements.objectLabel.addEventListener("input", () => elements.objectLabel.setCustomValidity(""));
elements.linkExistingObject.addEventListener("click", linkSelectedOccurrenceToExistingObject);
elements.objectList.addEventListener("click", async (event) => {
  const groupToggle = event.target.closest("button[data-group-toggle]");
  if (groupToggle) {
    const { display } = state;
    const key = groupToggle.dataset.groupToggle;
    display.collapsedGroups = toggleSetMember(display.collapsedGroups, key);
    renderObjectList();
    elements.objectList.querySelector(`button[data-group-toggle="${CSS.escape(key)}"]`)?.focus();
    return;
  }
  const button = event.target.closest("button[data-object-id]");
  if (button) {
    await selectObjectAndNavigate(button.dataset.objectId);
  }
});
elements.objectList.addEventListener("change", (event) => {
  const checkbox = event.target.closest("input[data-category-visibility]");
  if (!checkbox) {
    return;
  }
  const { display } = state;
  display.hiddenCategories = toggleSetMember(display.hiddenCategories, checkbox.dataset.categoryVisibility);
  renderOverlay();
  renderObjectList();
  elements.objectList.querySelector(`input[data-category-visibility="${CSS.escape(checkbox.dataset.categoryVisibility)}"]`)?.focus();
});
elements.objectSearch.addEventListener("input", () => {
  state.display.query = elements.objectSearch.value;
  renderObjectList();
});
elements.markFocus.addEventListener("change", () => {
  setMarkFocus(elements.markFocus.value);
});
elements.groupBy.addEventListener("change", () => {
  state.display.groupBy = elements.groupBy.value;
  saveDisplayPreferences();
  renderObjectList();
});
elements.currentPageOnly.addEventListener("change", () => {
  state.display.currentPageOnly = elements.currentPageOnly.checked;
  saveDisplayPreferences();
  renderObjectList();
});
elements.showLabels.addEventListener("change", () => setShowLabels(elements.showLabels.checked));
syncDisplayControls();
elements.thumbnailPanel.hidden = !state.display.showThumbnails;
elements.toggleThumbnails.setAttribute("aria-pressed", String(state.display.showThumbnails));
elements.toggleThumbnails.addEventListener("click", () => setThumbnailsOpen(elements.thumbnailPanel.hidden));
elements.rotateView.addEventListener("click", (event) => rotateView(event.shiftKey ? -1 : 1));
elements.thumbnailList.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-thumbnail-page]");
  if (!button || !state.pdfDocument) {
    return;
  }
  const page = Number(button.dataset.thumbnailPage);
  viewHistory.record(currentLocation(), { documentId: state.activeDocumentId, page });
  await navigateToPage(page);
});
setUpPaneSplitter();
elements.saveObjectLabel.addEventListener("click", saveSelectedObjectLabel);
elements.editObjectLabel.addEventListener("input", () => elements.editObjectLabel.setCustomValidity(""));
elements.editObjectLabel.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    saveSelectedObjectLabel();
  }
});
elements.markForObject.addEventListener("click", () => {
  const object = getObject(state.selectedObjectId);
  if (object) {
    setMarkMode(true, object.id);
  }
});
elements.deleteObject.addEventListener("click", deleteSelectedObject);
elements.openRepresentationBoard.addEventListener("click", openRepresentationBoard);
elements.closeRepresentationBoard.addEventListener("click", closeRepresentationBoard);
elements.representationBoardGrid.addEventListener("click", handleRepresentationBoardAction);
elements.representationBoard.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeRepresentationBoard();
});
elements.representationBoard.addEventListener("click", (event) => {
  if (event.target === elements.representationBoard) {
    closeRepresentationBoard();
  }
});
elements.representationBoard.addEventListener("close", () => {
  representationBoardGeneration += 1;
  elements.representationBoardGrid.replaceChildren();
  delete elements.representationBoard.dataset.objectId;
});
elements.unlinkedList.addEventListener("click", handleOccurrenceListAction);

document.addEventListener("keydown", handleDocumentKeyDown);
document.addEventListener("keyup", (event) => {
  if (event.code === "Space" || event.key === " ") {
    setSpacePanActive(false);
  }
});
window.addEventListener("blur", () => {
  finishPan();
  setSpacePanActive(false);
});
document.addEventListener("pointerdown", (event) => {
  if (!elements.shortcutPanel.hidden && !event.target.closest(".shortcut-help")) {
    setShortcutHelpOpen(false);
  }
});

let resizeTimer = null;
new ResizeObserver(() => {
  if (!state.pdfDocument || state.zoomMode === "custom") {
    return;
  }
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => renderPage(), 120);
}).observe(elements.viewerStage);

setDocumentControlsEnabled(false);
populateCategorySelect(elements.objectCategory, OBJECT_CATEGORY_GROUPS, DEFAULT_OBJECT_CATEGORY);
populateCategorySelect(elements.editObjectCategory, OBJECT_CATEGORY_GROUPS, DEFAULT_OBJECT_CATEGORY);
refreshObjectUi();
