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
  documentThumbnailCacheKey,
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
import { buildOnexusGraph } from "./onexus-export.mjs";
import {
  createNote,
  removeNote,
  updateNote,
} from "./note-model.mjs";
import {
  createRelation,
  nearestOccurrencePair,
  relationCurve,
  relationLanes,
  relationPhrase,
  relationType,
  relationTypeGroups,
  relationsForObject,
  removeRelation,
  relatedObjectIds,
  removeRelationsByOrigin,
  removeRelationsForObject,
  suggestRelationType,
  traceRelations,
  updateRelation,
} from "./relation-model.mjs";
import {
  LEGACY_REVIT_DATA_FORMAT,
  REVIT_DATA_FORMAT,
  revitObjectData,
  validateRevitData,
} from "./revit-data.mjs";

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
  openNotes: document.querySelector("#openNotes"),
  notesDialog: document.querySelector("#notesDialog"),
  closeNotes: document.querySelector("#closeNotes"),
  notesBadge: document.querySelector("#notesBadge"),
  addNoteForm: document.querySelector("#addNoteForm"),
  noteScope: document.querySelector("#noteScope"),
  noteText: document.querySelector("#noteText"),
  addNote: document.querySelector("#addNote"),
  noNotes: document.querySelector("#noNotes"),
  notesList: document.querySelector("#notesList"),
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
  relationGuide: document.querySelector("#relationGuide"),
  relationGuideTitle: document.querySelector("#relationGuideTitle"),
  relationGuideText: document.querySelector("#relationGuideText"),
  saveRelationMore: document.querySelector("#saveRelationMore"),
  relationLabels: document.querySelector("#relationLabels"),
  showAllRelations: document.querySelector("#showAllRelations"),
  relationCount: document.querySelector("#relationCount"),
  startRelation: document.querySelector("#startRelation"),
  noRelations: document.querySelector("#noRelations"),
  relationList: document.querySelector("#relationList"),
  relationDialog: document.querySelector("#relationDialog"),
  relationDialogTitle: document.querySelector("#relationDialogTitle"),
  relationForm: document.querySelector("#relationForm"),
  closeRelationDialog: document.querySelector("#closeRelationDialog"),
  relationFromLabel: document.querySelector("#relationFromLabel"),
  relationPhrasePreview: document.querySelector("#relationPhrasePreview"),
  relationToLabel: document.querySelector("#relationToLabel"),
  relationType: document.querySelector("#relationType"),
  relationLabel: document.querySelector("#relationLabel"),
  relationError: document.querySelector("#relationError"),
  swapRelation: document.querySelector("#swapRelation"),
  deleteRelation: document.querySelector("#deleteRelation"),
  removeRevitRelations: document.querySelector("#removeRevitRelations"),
  toggleTrace: document.querySelector("#toggleTrace"),
  exportOnexus: document.querySelector("#exportOnexus"),
  linkOnexus: document.querySelector("#linkOnexus"),
  onexusUrl: document.querySelector("#onexusUrl"),
  exportTraceOnexus: document.querySelector("#exportTraceOnexus"),
  tracePanel: document.querySelector("#tracePanel"),
  traceTitle: document.querySelector("#traceTitle"),
  traceSteps: document.querySelector("#traceSteps"),
  endTrace: document.querySelector("#endTrace"),
  traceList: document.querySelector("#traceList"),
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
  revitProperties: document.querySelector("#revitProperties"),
  revitPropertyCount: document.querySelector("#revitPropertyCount"),
  revitIdentity: document.querySelector("#revitIdentity"),
  revitPropertySearch: document.querySelector("#revitPropertySearch"),
  noRevitProperties: document.querySelector("#noRevitProperties"),
  revitInstanceCount: document.querySelector("#revitInstanceCount"),
  revitInstanceProperties: document.querySelector("#revitInstanceProperties"),
  revitTypeCount: document.querySelector("#revitTypeCount"),
  revitTypeProperties: document.querySelector("#revitTypeProperties"),
  objectExportMenu: document.querySelector("#objectExportMenu"),
  exportObjectEvidence: document.querySelector("#exportObjectEvidence"),
  exportObjectEvidenceZip: document.querySelector("#exportObjectEvidenceZip"),
  exportJoineryAiPack: document.querySelector("#exportJoineryAiPack"),
  joineryAiHint: document.querySelector("#joineryAiHint"),
  evidenceExportStatus: document.querySelector("#evidenceExportStatus"),
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
  notes: [],
  relations: [],
  // Object whose relation is being drawn. Pick mode only; never saved.
  relateFromObjectId: null,
  // After "Save, add more": the type, note, and side reused for every further pick.
  relateRepeat: null,
  // Relation trace from one pinned object. View only; never saved.
  trace: null,
  // Optional read-only adapter data. It is never saved in the neutral project.
  revitData: null,
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
  elements.showAllRelations.checked = state.display.showAllRelations;
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
  state.notes = snapshot.notes;
  state.relations = snapshot.relations ?? [];
  state.selectedObjectId = snapshot.selectedObjectId;
  state.selectedOccurrenceId = snapshot.selectedOccurrenceId;
  state.interaction = null;
  setRelateMode(null);
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
  const noteLabel = `${state.notes.length} note${state.notes.length === 1 ? "" : "s"}`;
  setStatus(`${direction === "undo" ? "Undid" : "Redid"} ${result.label}. ${objectLabel}, ${occurrenceLabel}, ${noteLabel}.`);
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
    elements.openNotes,
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
  elements.exportOnexus.disabled = !hasProject;
  elements.linkOnexus.disabled = !hasProject;
  elements.openNotes.disabled = !hasProject;
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
  const related = highlightedRelatedIds();
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
    const relatedHere = objectIds.filter((id) => related.has(id)).map((id) => getObject(id)?.label ?? id);
    pageButton.classList.toggle("has-selected-object", containsSelectedObject);
    pageButton.classList.toggle("has-related-object", relatedHere.length > 0);
    pageButton.title = [
      baseLabel,
      containsSelectedObject ? `Contains ${selectedObject.label} (${selectedObject.id})` : "",
      relatedHere.length ? `Related: ${relatedHere.slice(0, 4).join(", ")}${relatedHere.length > 4 ? "…" : ""}` : "",
    ].filter(Boolean).join(". ");
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
  if (state.markMode && state.relateFromObjectId) {
    setRelateMode(null);
  }
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
    const occurrenceNoteCount = state.notes.filter((note) => note.occurrenceId === occurrence.id).length;
    deleteButton.disabled = occurrenceNoteCount > 0;
    deleteButton.title = occurrenceNoteCount > 0
      ? `Remove ${occurrenceNoteCount} linked note${occurrenceNoteCount === 1 ? "" : "s"} before deleting this occurrence`
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

function renderRevitParameterList(container, parameters) {
  container.replaceChildren();
  for (const parameter of parameters) {
    const name = document.createElement("dt");
    const value = document.createElement("dd");
    name.textContent = parameter.name;
    name.title = parameter.sourceKey;
    value.textContent = parameter.displayValue;
    if (parameter.rawValue !== parameter.displayValue) {
      value.title = `Raw value: ${parameter.rawValue}`;
    }
    container.append(name, value);
  }
}

function renderRevitProperties(object) {
  const source = object ? revitObjectData(state.revitData, object.id) : null;
  elements.revitProperties.hidden = !source;
  if (!source) {
    elements.revitInstanceProperties.replaceChildren();
    elements.revitTypeProperties.replaceChildren();
    return;
  }

  const familyAndType = [source.familyName, source.typeName].filter(Boolean).join(" · ");
  elements.revitIdentity.textContent = [
    state.revitData.revitDocument,
    `Element ${source.elementId}`,
    familyAndType,
  ].filter(Boolean).join(" · ");
  elements.revitIdentity.title = `Revit UniqueId: ${source.uniqueId}\nExported ${state.revitData.exportedAt}`;

  const query = elements.revitPropertySearch.value.trim().toLocaleLowerCase();
  const matches = (parameter) => !query || [
    parameter.name,
    parameter.displayValue,
    parameter.rawValue,
  ].some((value) => value.toLocaleLowerCase().includes(query));
  const instanceParameters = source.instanceParameters.filter(matches);
  const typeParameters = source.typeParameters.filter(matches);
  const total = source.instanceParameters.length + source.typeParameters.length;
  const visible = instanceParameters.length + typeParameters.length;

  elements.revitPropertyCount.textContent = String(total);
  elements.revitPropertyCount.title = `${total} populated parameter${total === 1 ? "" : "s"} in this Revit snapshot`;
  elements.revitInstanceCount.textContent = query
    ? `${instanceParameters.length} of ${source.instanceParameters.length}`
    : String(source.instanceParameters.length);
  elements.revitTypeCount.textContent = query
    ? `${typeParameters.length} of ${source.typeParameters.length}`
    : String(source.typeParameters.length);
  elements.revitInstanceProperties.closest("details").hidden = instanceParameters.length === 0;
  elements.revitTypeProperties.closest("details").hidden = typeParameters.length === 0;
  elements.noRevitProperties.hidden = visible > 0;
  elements.noRevitProperties.textContent = total === 0
    ? "This Revit companion contains identity only; parameters were not included."
    : "No properties match this search.";
  renderRevitParameterList(elements.revitInstanceProperties, instanceParameters);
  renderRevitParameterList(elements.revitTypeProperties, typeParameters);
}

function renderSelectedObjectPanel() {
  const object = getObject(state.selectedObjectId);
  elements.selectedObjectPanel.hidden = !object;
  elements.markForObject.disabled = !object || !state.pdfDocument;
  if (!object) {
    renderRevitProperties(null);
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
    return;
  }

  const occurrences = getObjectOccurrences(state.occurrences, object.id);
  if (dialogIsOpen(elements.representationBoard) && elements.representationBoard.dataset.objectId !== object.id) {
    closeRepresentationBoard();
  }
  const relatedNotes = state.notes.filter((note) => note.scope === "object" && note.objectId === object.id);
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
      : "Export all representations and notes for Joinery Configurator";
  elements.joineryAiHint.textContent = !joineryEligible
    ? "Available for Door and Window objects"
    : occurrences.length === 0
      ? "Add a representation first"
      : "All representations + notes manifest";
  elements.deleteObject.disabled = relatedNotes.length > 0;
  elements.deleteObject.title = relatedNotes.length > 0
    ? "Remove this object's notes before deleting the object"
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
  renderRevitProperties(object);
}

function noteTargetLabel(note) {
  if (note.scope === "project") {
    return "Project";
  }
  if (note.scope === "object") {
    const object = getObject(note.objectId);
    return object ? `${object.label} · ${object.id}` : note.objectId;
  }
  const occurrence = getOccurrence(note.occurrenceId);
  const projectDocument = occurrence ? getProjectDocument(occurrence.documentId) : null;
  return occurrence
    ? `${projectDocument?.name ?? occurrence.documentId} · page ${occurrence.page} · ${occurrence.id}`
    : note.occurrenceId;
}

function renderNotes() {
  const selectedObject = getObject(state.selectedObjectId);
  const selectedOccurrence = getOccurrence(state.selectedOccurrenceId);
  const objectOption = elements.noteScope.querySelector('option[value="object"]');
  const occurrenceOption = elements.noteScope.querySelector('option[value="occurrence"]');
  objectOption.disabled = !selectedObject;
  objectOption.textContent = selectedObject ? `Object · ${selectedObject.label}` : "Selected object";
  occurrenceOption.disabled = !selectedOccurrence;
  occurrenceOption.textContent = selectedOccurrence ? `Occurrence · ${selectedOccurrence.id}` : "Selected occurrence";
  if (elements.noteScope.selectedOptions[0]?.disabled) {
    elements.noteScope.value = selectedOccurrence ? "occurrence" : selectedObject ? "object" : "project";
  }

  elements.notesBadge.textContent = String(state.notes.length);
  elements.noNotes.hidden = state.notes.length > 0;
  elements.notesList.replaceChildren();
  for (const note of [...state.notes].reverse()) {
    const item = document.createElement("li");
    const heading = document.createElement("div");
    const scope = document.createElement("span");
    const target = document.createElement(note.scope === "project" ? "span" : "button");
    const text = document.createElement("textarea");
    const actions = document.createElement("div");
    const save = document.createElement("button");
    const remove = document.createElement("button");

    item.className = "note-card";
    item.dataset.noteId = note.id;
    heading.className = "note-card-heading";
    scope.className = "note-scope-label";
    scope.textContent = `${note.scope[0].toUpperCase()}${note.scope.slice(1)} note · ${note.id}`;
    target.className = "note-target";
    target.textContent = noteTargetLabel(note);
    if (note.scope !== "project") {
      target.type = "button";
      target.dataset.action = "view-note-target";
      target.dataset.noteId = note.id;
    }
    heading.append(scope, target);
    text.className = "text-input";
    text.value = note.text;
    text.maxLength = 1000;
    text.rows = 3;
    text.dataset.noteText = note.id;
    text.setAttribute("aria-label", `Text for ${note.id}`);
    actions.className = "note-card-actions";
    save.type = "button";
    save.className = "button";
    save.dataset.action = "save-note";
    save.dataset.noteId = note.id;
    save.textContent = "Save";
    remove.type = "button";
    remove.className = "button danger-button";
    remove.dataset.action = "remove-note";
    remove.dataset.noteId = note.id;
    remove.textContent = "Delete";
    actions.append(save, remove);
    item.append(heading, text, actions);
    elements.notesList.append(item);
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
  const noteLabel = state.notes.length
    ? ` · ${state.notes.length} note${state.notes.length === 1 ? "" : "s"}`
    : "";
  elements.documentSummary.textContent = unlinkedCount
    ? `${pdfLabel} · ${objectLabel} · ${occurrenceLabel}${noteLabel} · ${unlinkedCount} unlinked`
    : `${pdfLabel} · ${objectLabel} · ${occurrenceLabel}${noteLabel}`;
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
  const traced = tracedObjectIds();
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
    if (traced) {
      classes.push(traced.has(occurrence.objectId) ? "is-traced" : "is-dimmed");
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
    appendRelationHandle(selectedOccurrence);
  }
  renderMarkLabels(objectsById);
  renderRelationLines(objectsById);
  if (state.relateFromObjectId) {
    const preview = document.createElementNS(SVG_NAMESPACE, "path");
    preview.setAttribute("class", "relation-preview");
    overlayLayer.append(preview);
    updateRelationPreview(lastRelationPointer.x, lastRelationPointer.y);
  }

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

// ── Relations ─────────────────────────────────────────────
// Lines run between the nearest marks of two related objects on the current page.
// They follow the selected object unless "Relations" asks for every line on the page.

function relationsToDraw() {
  if (state.display.markFocus === "none" || state.markMode) {
    return [];
  }
  const traced = tracedObjectIds();
  if (traced) {
    return state.relations.filter((relation) => traced.has(relation.from) && traced.has(relation.to));
  }
  if (state.display.showAllRelations) {
    return state.relations;
  }
  const selectedId = state.selectedObjectId;
  return selectedId
    ? state.relations.filter((relation) => relation.from === selectedId || relation.to === selectedId)
    : [];
}

function relationSentence(relation) {
  const from = getObject(relation.from);
  const to = getObject(relation.to);
  const note = [relation.label, relation.origin === "revit" ? "from Revit" : ""].filter(Boolean).join(", ");
  return `${from?.label ?? relation.from} ${relationPhrase(relation)} ${to?.label ?? relation.to}${note ? ` (${note})` : ""}`;
}

function svgPoint(point) {
  return `${point.x} ${point.y}`;
}

function renderRelationLines(objectsById) {
  elements.relationLabels.replaceChildren();
  const relations = relationsToDraw();
  if (relations.length === 0 || !overlayLayer) {
    return;
  }
  const pageSize = unrotatedSize(elements.overlay.getBoundingClientRect(), state.rotation);
  if (pageSize.width < 2 || pageSize.height < 2) {
    return;
  }

  const marksByObject = new Map();
  for (const occurrence of getCurrentPageOccurrences()) {
    if (!occurrence.objectId) {
      continue;
    }
    if (occurrenceVisibility(occurrence, objectsById, state.display, state.selectedObjectId) === "hidden") {
      continue;
    }
    if (!marksByObject.has(occurrence.objectId)) {
      marksByObject.set(occurrence.objectId, []);
    }
    marksByObject.get(occurrence.objectId).push(occurrence);
  }

  const lanes = relationLanes(relations);
  const layer = document.createElementNS(SVG_NAMESPACE, "g");
  layer.setAttribute("class", "relation-layer");
  for (const relation of relations) {
    const pair = nearestOccurrencePair(marksByObject.get(relation.from) ?? [], marksByObject.get(relation.to) ?? []);
    if (!pair) {
      continue;
    }
    const type = relationType(relation.type);
    const curve = relationCurve(pair.from.bounds, pair.to.bounds, pageSize, {
      directed: type.directed,
      lane: lanes.get(relation.id),
    });
    if (!curve) {
      continue;
    }
    const focused = relation.from === state.selectedObjectId || relation.to === state.selectedObjectId;
    // In a trace every drawn line belongs to it, so none fades.
    const quiet = Boolean(state.selectedObjectId) && !focused && !state.trace;
    const modifiers = `${type.directed ? "" : " is-undirected"}${quiet ? " is-quiet" : ""}`;

    const line = document.createElementNS(SVG_NAMESPACE, "path");
    line.setAttribute("d", `M ${svgPoint(curve.start)} Q ${svgPoint(curve.control)} ${svgPoint(curve.end)}`);
    line.setAttribute("class", `relation-line family-${type.family}${modifiers}`);
    layer.append(line);
    if (curve.arrow) {
      const arrow = document.createElementNS(SVG_NAMESPACE, "polygon");
      arrow.setAttribute("points", curve.arrow.map(svgPoint).join(" "));
      arrow.setAttribute("class", `relation-arrow family-${type.family}${modifiers}`);
      layer.append(arrow);
    }

    const pill = document.createElement("button");
    pill.type = "button";
    pill.className = `relation-pill family-${type.family}${modifiers}`;
    pill.dataset.relationId = relation.id;
    pill.textContent = relation.label || relationPhrase(relation);
    pill.title = `${relationSentence(relation)}. Click to edit.`;
    pill.setAttribute("aria-label", `Edit relation: ${relationSentence(relation)}`);
    const onView = rotateBounds({ x: curve.mid.x, y: curve.mid.y, width: 0, height: 0 }, state.rotation);
    pill.style.left = `${onView.x * 100}%`;
    pill.style.top = `${onView.y * 100}%`;
    elements.relationLabels.append(pill);
  }
  // Under the marks, so a line never steals a click meant for a shape.
  overlayLayer.prepend(layer);
}

// A dashed line from the source mark to the pointer while picking the other object.
function updateRelationPreview(clientX, clientY) {
  const preview = overlayLayer?.querySelector(".relation-preview");
  if (!preview) {
    return;
  }
  const sourceMarks = getCurrentPageOccurrences().filter((occurrence) => occurrence.objectId === state.relateFromObjectId);
  if (sourceMarks.length === 0 || clientX === undefined) {
    preview.setAttribute("d", "");
    return;
  }
  const point = pagePointFromClient(clientX, clientY, elements.overlay.getBoundingClientRect());
  const source = sourceMarks.reduce((best, occurrence) => {
    const cx = occurrence.bounds.x + occurrence.bounds.width / 2;
    const cy = occurrence.bounds.y + occurrence.bounds.height / 2;
    const distance = Math.hypot(cx - point.x, cy - point.y);
    return !best || distance < best.distance ? { cx, cy, distance } : best;
  }, null);
  preview.setAttribute("d", `M ${source.cx} ${source.cy} L ${point.x} ${point.y}`);
}

let lastRelationPointer = {};

// A small dot beside the selected linked mark. Drag it onto another mark to relate them;
// a plain click starts Relate mode like the C key.
function appendRelationHandle(occurrence) {
  if (!occurrence.objectId || state.markMode || state.relateFromObjectId || state.interaction) {
    return;
  }
  const size = unrotatedSize(elements.overlay.getBoundingClientRect(), state.rotation);
  if (!size.width || !size.height) {
    return;
  }
  const { bounds } = occurrence;
  const radius = 6;
  const handle = document.createElementNS(SVG_NAMESPACE, "ellipse");
  handle.setAttribute("cx", String(Math.min(bounds.x + bounds.width + 14 / size.width, 1 - radius / size.width)));
  handle.setAttribute("cy", String(bounds.y + bounds.height / 2));
  handle.setAttribute("rx", String(radius / size.width));
  handle.setAttribute("ry", String(radius / size.height));
  handle.setAttribute("class", "relation-handle");
  handle.dataset.relationHandle = occurrence.objectId;
  const title = document.createElementNS(SVG_NAMESPACE, "title");
  title.textContent = "Drag to another mark to relate (or press C)";
  handle.append(title);
  overlayLayer.append(handle);
}

function startRelationDrag(event) {
  const objectId = event.target.dataset.relationHandle;
  if (!getObject(objectId)) {
    return;
  }
  lastRelationPointer = { x: event.clientX, y: event.clientY };
  state.interaction = {
    type: "relate-drag",
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    moved: false,
  };
  setRelateMode(objectId);
  elements.overlay.setPointerCapture(event.pointerId);
  event.preventDefault();
}

function moveRelationDrag(event) {
  const interaction = state.interaction;
  if (Math.hypot(event.clientX - interaction.startX, event.clientY - interaction.startY) > 4) {
    interaction.moved = true;
  }
  lastRelationPointer = { x: event.clientX, y: event.clientY };
  updateRelationPreview(event.clientX, event.clientY);
}

function finishRelationDrag(event) {
  const { moved } = state.interaction;
  releasePointer(event.pointerId);
  state.interaction = null;
  if (!moved) {
    // A click on the dot is the same as pressing Relate.
    const object = getObject(state.relateFromObjectId);
    renderOverlay();
    setStatus(`Relating ${object?.label ?? ""}. Click the other object's mark or pick it in the list. Escape cancels.`);
    return;
  }
  const target = document.elementsFromPoint(event.clientX, event.clientY)
    .find((element) => element.dataset?.occurrenceId && !element.dataset.resizeHandle && element.dataset.vertexIndex === undefined);
  if (!target) {
    setRelateMode(null);
    setStatus("Relating cancelled. Drop the line on another mark to relate.");
    return;
  }
  pickRelationTarget(getOccurrence(target.dataset.occurrenceId)?.objectId ?? null);
  if (state.relateFromObjectId && !state.relateRepeat) {
    // Dropped on its own mark or an unlinked one: stop rather than leave a half-made line.
    setRelateMode(null);
  }
}

function setRelateMode(objectId, repeat = null) {
  const object = objectId ? getObject(objectId) : null;
  const enabled = Boolean(object && state.documents.length > 0);
  if (enabled && state.markMode) {
    setMarkMode(false);
  }
  state.relateFromObjectId = enabled ? object.id : null;
  state.relateRepeat = enabled ? repeat : null;
  elements.relationGuide.hidden = !enabled;
  elements.relationGuideTitle.textContent = !enabled
    ? "Relating"
    : state.relateRepeat
      ? `${object.label} · ${repeatPhrase(state.relateRepeat)}`
      : `Relating ${object.label}`;
  elements.relationGuideText.textContent = state.relateRepeat
    ? "Each mark or list object you click gets this relation. Esc to finish."
    : "Click the other object's mark, or pick it in the list. Any page or PDF.";
  elements.pageSurface.classList.toggle("is-relating", enabled);
  elements.sidePanel.classList.toggle("is-relating", enabled);
  elements.startRelation.textContent = enabled ? "Cancel" : "Relate";
  elements.startRelation.setAttribute("aria-pressed", String(enabled));
  elements.startRelation.title = enabled ? "Cancel relating (Escape)" : "Relate to another object (C)";
  renderOverlay();
}

function startRelationFromSelection() {
  const object = getObject(state.selectedObjectId);
  if (!object) {
    setStatus("Select an object first, then relate it to another.");
    return;
  }
  if (state.relateFromObjectId) {
    setRelateMode(null);
    setStatus("Relating cancelled.");
    return;
  }
  setRelateMode(object.id);
  setStatus(`Relating ${object.label}. Click the other object's mark or pick it in the list. Escape cancels.`);
}

function pickRelationTarget(targetObjectId) {
  const from = getObject(state.relateFromObjectId);
  if (!from) {
    setRelateMode(null);
    return;
  }
  if (!targetObjectId) {
    setStatus("That mark has no object yet. Link it first, or pick another mark.");
    return;
  }
  if (targetObjectId === from.id) {
    setStatus(`That is ${from.label} itself. Pick another object.`);
    return;
  }
  if (state.relateRepeat) {
    addRepeatedRelation(targetObjectId);
    return;
  }
  setRelateMode(null);
  openRelationDialog({ from: from.id, to: targetObjectId });
}

// How the repeated relation reads from the source object's side.
function repeatPhrase(repeat) {
  const type = relationType(repeat.type);
  return repeat.sourceIsFrom ? type.forward : type.inverse;
}

function addRepeatedRelation(targetObjectId) {
  const sourceId = state.relateFromObjectId;
  const { type, label, sourceIsFrom } = state.relateRepeat;
  const values = sourceIsFrom
    ? { type, label, from: sourceId, to: targetObjectId }
    : { type, label, from: targetObjectId, to: sourceId };
  let relation;
  try {
    relation = createRelation(state.relations, values);
  } catch (error) {
    setStatus(`${error.message} Pick another, or press Escape to finish.`);
    return;
  }
  recordObjectMutation(`create ${relation.id}`);
  state.relations = [...state.relations, relation];
  refreshUi();
  setStatus(`Added: ${relationSentence(relation)}. Click more, or press Escape to finish.`);
}

// The dialog edits one draft. Nothing changes until Save.
let relationDraft = null;

function populateRelationTypeSelect(selectedType) {
  elements.relationType.replaceChildren();
  for (const group of relationTypeGroups()) {
    const optgroup = document.createElement("optgroup");
    optgroup.label = group.label;
    for (const type of group.types) {
      optgroup.append(new Option(type.forward, type.key));
    }
    elements.relationType.append(optgroup);
  }
  elements.relationType.value = selectedType;
}

function renderRelationDraft() {
  if (!relationDraft) {
    return;
  }
  const type = relationType(elements.relationType.value);
  elements.relationFromLabel.textContent = getObject(relationDraft.from)?.label ?? relationDraft.from;
  elements.relationToLabel.textContent = getObject(relationDraft.to)?.label ?? relationDraft.to;
  elements.relationPhrasePreview.textContent = type.directed ? `${type.forward} →` : `${type.forward} ↔`;
  elements.swapRelation.disabled = !type.directed;
}

function setRelationError(message = "") {
  elements.relationError.hidden = !message;
  elements.relationError.textContent = message;
}

function openRelationDialog({ id = null, from, to }) {
  const existing = id ? state.relations.find((relation) => relation.id === id) : null;
  let draftFrom = existing?.from ?? from;
  let draftTo = existing?.to ?? to;
  let type = existing?.type;
  if (!existing) {
    const suggestion = suggestRelationType(getObject(draftFrom)?.category, getObject(draftTo)?.category);
    type = suggestion.type;
    if (suggestion.swap) {
      [draftFrom, draftTo] = [draftTo, draftFrom];
    }
  }
  // The object the person started from stays the source when adding more, even after Swap.
  relationDraft = { id: existing?.id ?? null, from: draftFrom, to: draftTo, sourceObjectId: from };
  populateRelationTypeSelect(type);
  elements.relationLabel.value = existing?.label ?? "";
  elements.relationDialogTitle.textContent = existing ? "Edit relation" : "New relation";
  elements.deleteRelation.hidden = !existing;
  elements.saveRelationMore.hidden = Boolean(existing);
  setRelationError();
  renderRelationDraft();
  showDialog(elements.relationDialog);
  elements.relationType.focus();
}

function closeRelationDialog() {
  relationDraft = null;
  hideDialog(elements.relationDialog);
}

function saveRelationDraft(event, { addMore = false } = {}) {
  event.preventDefault();
  if (!relationDraft) {
    return;
  }
  const sourceObjectId = relationDraft.sourceObjectId;
  const values = {
    type: elements.relationType.value,
    from: relationDraft.from,
    to: relationDraft.to,
    label: elements.relationLabel.value,
  };
  try {
    if (relationDraft.id) {
      const next = updateRelation(state.relations, relationDraft.id, values);
      if (next !== state.relations) {
        recordObjectMutation(`edit ${relationDraft.id}`);
        state.relations = next;
      }
    } else {
      const relation = createRelation(state.relations, values);
      recordObjectMutation(`create ${relation.id}`);
      state.relations = [...state.relations, relation];
    }
  } catch (error) {
    setRelationError(error.message);
    return;
  }
  const saved = relationDraft.id
    ? state.relations.find((relation) => relation.id === relationDraft.id)
    : state.relations.at(-1);
  closeRelationDialog();
  refreshUi();
  if (addMore && getObject(sourceObjectId)) {
    setRelateMode(sourceObjectId, {
      type: saved.type,
      label: saved.label,
      sourceIsFrom: saved.from === sourceObjectId,
    });
    setStatus(`Saved: ${relationSentence(saved)}. Now click more marks for the same relation. Escape finishes.`);
    return;
  }
  setStatus(`Saved: ${relationSentence(saved)}.`);
}

function deleteRelationById(relationId) {
  const relation = state.relations.find((item) => item.id === relationId);
  if (!relation) {
    return;
  }
  const sentence = relationSentence(relation);
  recordObjectMutation(`delete ${relation.id}`);
  state.relations = removeRelation(state.relations, relation.id);
  refreshUi();
  setStatus(`Removed: ${sentence}. Undo brings it back.`);
}

function renderRelationList() {
  const revitRelationCount = state.relations.filter((relation) => relation.origin === "revit").length;
  elements.removeRevitRelations.hidden = revitRelationCount === 0;
  elements.removeRevitRelations.textContent = `Remove ${revitRelationCount} Revit relation${revitRelationCount === 1 ? "" : "s"}`;
  const object = getObject(state.selectedObjectId);
  if (state.relateFromObjectId && !getObject(state.relateFromObjectId)) {
    setRelateMode(null);
  }
  elements.relationList.replaceChildren();
  if (!object) {
    return;
  }
  const familyOrder = new Map(relationTypeGroups().map((group, index) => [group.key, index]));
  const entries = relationsForObject(state.relations, object.id)
    .map((entry) => ({ ...entry, other: getObject(entry.otherObjectId), type: relationType(entry.relation.type) }))
    .sort((a, b) => (familyOrder.get(a.type.family) - familyOrder.get(b.type.family))
      || a.phrase.localeCompare(b.phrase)
      || (a.other?.label ?? "").localeCompare(b.other?.label ?? "", undefined, { numeric: true }));
  elements.relationCount.textContent = String(entries.length);
  elements.noRelations.hidden = entries.length > 0;
  elements.startRelation.disabled = state.documents.length === 0;

  for (const entry of entries) {
    const item = document.createElement("li");
    const phrase = document.createElement("button");
    const target = document.createElement("button");
    const targetLabel = document.createElement("strong");
    const targetMeta = document.createElement("span");
    const remove = document.createElement("button");

    item.className = `relation-row family-${entry.type.family}`;
    phrase.type = "button";
    phrase.className = "relation-row-phrase";
    phrase.dataset.action = "edit-relation";
    phrase.dataset.relationId = entry.relation.id;
    phrase.textContent = entry.phrase;
    phrase.title = "Edit this relation";

    target.type = "button";
    target.className = "relation-row-target";
    target.dataset.action = "go-relation-target";
    target.dataset.objectId = entry.otherObjectId;
    target.title = `Go to ${entry.other?.label ?? entry.otherObjectId}`;
    targetLabel.textContent = entry.other?.label ?? entry.otherObjectId;
    targetMeta.textContent = [
      entry.other ? objectCategoryLabel(entry.other.category) : "",
      entry.relation.label,
      entry.relation.origin === "revit" ? "from Revit" : "",
    ]
      .filter(Boolean)
      .join(" · ");
    target.append(targetLabel, targetMeta);

    remove.type = "button";
    remove.className = "relation-row-remove";
    remove.dataset.action = "delete-relation";
    remove.dataset.relationId = entry.relation.id;
    remove.textContent = "×";
    remove.setAttribute("aria-label", `Remove relation: ${relationSentence(entry.relation)}`);
    remove.title = "Remove relation";

    item.append(phrase, target, remove);
    elements.relationList.append(item);
  }
}

async function handleRelationListAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }
  if (button.dataset.action === "edit-relation") {
    openRelationDialog({ id: button.dataset.relationId });
  } else if (button.dataset.action === "delete-relation") {
    deleteRelationById(button.dataset.relationId);
  } else if (button.dataset.action === "go-relation-target") {
    await selectObjectAndNavigate(button.dataset.objectId);
  }
}

function removeRevitRelations() {
  const count = state.relations.filter((relation) => relation.origin === "revit").length;
  if (count === 0) {
    return;
  }
  recordObjectMutation(`remove ${count} Revit relation${count === 1 ? "" : "s"}`);
  state.relations = removeRelationsByOrigin(state.relations, "revit");
  refreshUi();
  setStatus(`Removed ${count} relation${count === 1 ? "" : "s"} from the Revit export. Undo brings them back. Your own relations stay.`);
}

// The traced set, or null when no trace is running.
function tracedObjectIds() {
  if (!state.trace) {
    return null;
  }
  return new Set(traceRelations(state.relations, state.trace.rootId, state.trace.steps).map((entry) => entry.objectId));
}

// Objects the map and thumbnails mark as related: the trace, or the selected object's direct relations.
function highlightedRelatedIds() {
  const traced = tracedObjectIds();
  const related = traced ?? (state.selectedObjectId ? relatedObjectIds(state.relations, state.selectedObjectId) : new Set());
  related.delete(state.selectedObjectId);
  return related;
}

function startTrace() {
  const object = getObject(state.selectedObjectId);
  if (!object) {
    return;
  }
  state.trace = { rootId: object.id, steps: Number(elements.traceSteps.value) || 2 };
  refreshUi();
  const count = tracedObjectIds().size - 1;
  setStatus(`Tracing from ${object.label}: ${count} related object${count === 1 ? "" : "s"}. Click one to go there; Escape ends the trace.`);
}

function endTrace() {
  if (!state.trace) {
    return;
  }
  state.trace = null;
  refreshUi();
  setStatus("Trace ended.");
}

function objectPlacesLabel(objectId) {
  const multipleDocuments = state.documents.length > 1;
  const places = [...new Set(getObjectOccurrences(state.occurrences, objectId).map((occurrence) => {
    const name = multipleDocuments ? `${(getProjectDocument(occurrence.documentId)?.name ?? "").replace(/\.pdf$/i, "")} ` : "";
    return `${name}p.${occurrence.page}`;
  }))];
  if (places.length === 0) {
    return "not marked yet";
  }
  return places.length > 3 ? `${places.slice(0, 3).join(", ")} +${places.length - 3}` : places.join(", ");
}

function renderTrace() {
  if (state.trace && !getObject(state.trace.rootId)) {
    state.trace = null;
  }
  const active = Boolean(state.trace);
  elements.toggleTrace.setAttribute("aria-pressed", String(active));
  elements.toggleTrace.disabled = !active && relationsForObject(state.relations, state.selectedObjectId).length === 0;
  elements.tracePanel.hidden = !active;
  elements.traceList.replaceChildren();
  if (!active) {
    return;
  }
  const root = getObject(state.trace.rootId);
  elements.traceTitle.textContent = `Trace from ${root.label}`;
  elements.traceSteps.value = String(state.trace.steps);
  for (const entry of traceRelations(state.relations, state.trace.rootId, state.trace.steps)) {
    const object = getObject(entry.objectId);
    if (!object) {
      continue;
    }
    const item = document.createElement("li");
    const button = document.createElement("button");
    const step = document.createElement("span");
    const copy = document.createElement("span");
    const label = document.createElement("strong");
    const detail = document.createElement("small");
    button.type = "button";
    button.className = "trace-item";
    button.dataset.objectId = object.id;
    if (object.id === state.selectedObjectId) {
      button.setAttribute("aria-current", "true");
    }
    step.className = "trace-step";
    step.textContent = entry.step === 0 ? "●" : String(entry.step);
    step.title = entry.step === 0 ? "Start" : `${entry.step} step${entry.step === 1 ? "" : "s"} away`;
    copy.className = "trace-copy";
    label.textContent = object.label;
    detail.textContent = [
      entry.relation ? relationSentence(entry.relation) : objectCategoryLabel(object.category),
      objectPlacesLabel(object.id),
    ].join(" · ");
    copy.append(label, detail);
    button.append(step, copy);
    item.append(button);
    elements.traceList.append(item);
  }
}

// One-way download for ONEXUS. Never saved state, never history.
function exportOnexusGraph(objectIds = null) {
  if (state.documents.length === 0) {
    return;
  }
  const scope = objectIds ? "trace" : "project";
  const root = scope === "trace" ? getObject(state.trace?.rootId) : null;
  const projectName = sidecarDownloadName().replace(/\.objdraw-project\.json$/, "");
  const graph = buildOnexusGraph({
    documents: state.documents,
    objects: state.objects,
    occurrences: state.occurrences,
    relations: state.relations,
    revitObjects: state.revitData?.objects ?? [],
    objectIds,
    scope,
    projectName: root ? `${projectName} · trace from ${root.label}` : projectName,
  });
  const filename = `${projectName}${root ? `-trace-${root.label.replace(/[<>:"/\\|?*\s]+/g, "-")}` : ""}.onexus.json`;
  downloadBlob(new Blob([`${JSON.stringify(graph, null, 2)}\n`], { type: "application/json" }), filename);
  const { nodes, edges, localNodes } = graph.meta.objdraw.counts;
  const identity = localNodes === 0
    ? "All objects use Revit IDs."
    : localNodes === nodes
      ? "Objects use local IDs; load the Revit file first to merge with CDI."
      : `${localNodes} object${localNodes === 1 ? "" : "s"} use local IDs.`;
  setStatus(`Exported ${filename}: ${nodes} object${nodes === 1 ? "" : "s"}, ${edges} relation${edges === 1 ? "" : "s"}. ${identity}`);
}

// ── Live ONEXUS link ─────────────────────────────────────
// Two browser windows talk with postMessage: no server, no network request.
// Messages reuse ONEXUS's Revit-host vocabulary: onexus-graph, highlight-nodes, select-node.
const onexusLink = {
  window: null,
  origin: "",
  ready: false,
  helloTimer: null,
  graphTimer: null,
  graphSignature: "",
  highlightKey: "",
  objectByNode: new Map(),
  nodeByObject: new Map(),
};

function defaultOnexusUrl() {
  return ["localhost", "127.0.0.1"].includes(globalThis.location?.hostname)
    ? "http://localhost:4173/index.html"
    : "https://onuresen.github.io/onexus/";
}

function onexusLinkUrl() {
  const text = state.display.onexusUrl || defaultOnexusUrl();
  try {
    const url = new URL(text, globalThis.location?.href);
    return ["http:", "https:"].includes(url.protocol) ? url : null;
  } catch {
    return null;
  }
}

function onexusLinkOpen() {
  return Boolean(onexusLink.window && !onexusLink.window.closed);
}

function postToOnexus(message) {
  if (!onexusLinkOpen()) {
    return;
  }
  try {
    onexusLink.window.postMessage(message, onexusLink.origin);
  } catch {
    // The window navigated away or closed. The next refresh shows it as unlinked.
  }
}

function openOnexusLink() {
  const url = onexusLinkUrl();
  if (!url) {
    setStatus("The ONEXUS address is not a valid http or https address.");
    return;
  }
  url.searchParams.set("link", "objdraw");
  const linked = globalThis.open(url.href, "objdraw-onexus");
  if (!linked) {
    setStatus("The browser blocked the ONEXUS window. Allow pop-ups for this page, then try again.");
    return;
  }
  clearInterval(onexusLink.helloTimer);
  Object.assign(onexusLink, { window: linked, origin: url.origin, ready: false, graphSignature: "", highlightKey: "" });
  let attempts = 0;
  // Say hello until ONEXUS has loaded and answers. Stop after about 30 seconds.
  onexusLink.helloTimer = setInterval(() => {
    attempts += 1;
    if (onexusLink.ready || !onexusLinkOpen() || attempts > 75) {
      clearInterval(onexusLink.helloTimer);
      if (!onexusLink.ready) {
        setStatus(`ONEXUS did not answer at ${url.origin}. Check the address, and that this ONEXUS has the window link.`);
        renderOnexusLinkButton();
      }
      return;
    }
    postToOnexus({ type: "objdraw-hello" });
  }, 400);
  renderOnexusLinkButton();
  setStatus(`Opening ONEXUS at ${url.origin}…`);
}

function sendOnexusGraph() {
  const graph = buildOnexusGraph({
    documents: state.documents,
    objects: state.objects,
    occurrences: state.occurrences,
    relations: state.relations,
    revitObjects: state.revitData?.objects ?? [],
    projectName: sidecarDownloadName().replace(/\.objdraw-project\.json$/, ""),
  });
  const signature = JSON.stringify([
    graph.elements.nodes.map((node) => [node.data.id, node.data.label.en, node.data.category]),
    graph.elements.edges.map((edge) => [edge.data.id, edge.data.notes]),
  ]);
  if (signature === onexusLink.graphSignature) {
    return;
  }
  onexusLink.graphSignature = signature;
  onexusLink.objectByNode = new Map(graph.elements.nodes.map((node) => [node.data.id, node.data.objdraw.objectId]));
  onexusLink.nodeByObject = new Map(graph.elements.nodes.map((node) => [node.data.objdraw.objectId, node.data.id]));
  onexusLink.highlightKey = "";
  postToOnexus({ type: "onexus-graph", graph });
}

// Selection, or the whole trace, is highlighted in ONEXUS.
function sendOnexusHighlight() {
  const objectIds = tracedObjectIds() ?? new Set(state.selectedObjectId ? [state.selectedObjectId] : []);
  const ids = [...objectIds].map((id) => onexusLink.nodeByObject.get(id)).filter(Boolean);
  const key = ids.join("|");
  if (key === onexusLink.highlightKey) {
    return;
  }
  onexusLink.highlightKey = key;
  postToOnexus({ type: "highlight-nodes", ids, fitView: ids.length > 0 });
}

function renderOnexusLinkButton() {
  const linked = onexusLinkOpen() && onexusLink.ready;
  elements.linkOnexus.textContent = linked ? "ONEXUS linked ●" : onexusLinkOpen() ? "Connecting to ONEXUS…" : "Open live ONEXUS";
  elements.linkOnexus.classList.toggle("is-linked", linked);
}

function syncOnexusLink() {
  if (onexusLink.window && !onexusLinkOpen()) {
    clearInterval(onexusLink.helloTimer);
    onexusLink.window = null;
    onexusLink.ready = false;
  }
  renderOnexusLinkButton();
  if (!onexusLink.ready || !onexusLinkOpen()) {
    return;
  }
  // Wait for edits to settle, so a burst of changes reloads ONEXUS once.
  clearTimeout(onexusLink.graphTimer);
  onexusLink.graphTimer = setTimeout(() => {
    sendOnexusGraph();
    sendOnexusHighlight();
  }, 500);
}

function handleOnexusMessage(event) {
  if (!onexusLinkOpen() || event.source !== onexusLink.window || event.origin !== onexusLink.origin) {
    return;
  }
  const data = event.data;
  if (!data || typeof data !== "object") {
    return;
  }
  if (data.type === "onexus-ready" && !onexusLink.ready) {
    onexusLink.ready = true;
    clearInterval(onexusLink.helloTimer);
    sendOnexusGraph();
    sendOnexusHighlight();
    renderOnexusLinkButton();
    setStatus("ONEXUS is linked. Selecting here highlights there; clicking a node there selects it here.");
    return;
  }
  if (data.type === "select-node" && onexusLink.ready) {
    const objectId = onexusLink.objectByNode.get(String(data.id));
    if (getObject(objectId) && objectId !== state.selectedObjectId) {
      selectObjectAndNavigate(objectId);
    }
  }
}

function setShowAllRelations(show) {
  state.display.showAllRelations = show;
  elements.showAllRelations.checked = show;
  saveDisplayPreferences();
  renderOverlay();
  setStatus(show ? "Showing every relation on this page." : "Showing relations of the selected object.");
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
  const occurrenceNoteCount = state.notes.filter((note) => note.occurrenceId === occurrence.id).length;
  deleteButton.disabled = occurrenceNoteCount > 0;
  deleteButton.title = occurrenceNoteCount > 0
    ? `Remove ${occurrenceNoteCount} linked note${occurrenceNoteCount === 1 ? "" : "s"} before deleting ${occurrence.id}`
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

function openNotes() {
  if (state.documents.length === 0) {
    return;
  }
  elements.noteScope.value = state.selectedOccurrenceId
    ? "occurrence"
    : state.selectedObjectId
      ? "object"
      : "project";
  renderNotes();
  showDialog(elements.notesDialog);
  elements.noteText.focus();
}

function closeNotes() {
  hideDialog(elements.notesDialog);
  elements.openNotes.focus();
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
      notes: state.notes,
      relations: state.relations,
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
      notes: state.notes,
      relations: state.relations,
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

function resetThumbnailCache() {
  thumbnailGeneration += 1;
  thumbnailQueue = [];
  thumbnailListKey = "";
  lastThumbnailPage = null;
  thumbnailObserver?.disconnect();
  thumbnailObserver = null;
  thumbnailCache.clear();
  elements.thumbnailList.replaceChildren();
}

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
  const projectDocument = getProjectDocument(state.activeDocumentId);
  const listKey = documentThumbnailCacheKey(projectDocument, 0, state.rotation);
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

    const cached = thumbnailCache.get(documentThumbnailCacheKey(
      getProjectDocument(state.activeDocumentId), page, state.rotation,
    ));
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
      const projectDocument = getProjectDocument(state.activeDocumentId);
      const viewRotation = state.rotation;
      const key = documentThumbnailCacheKey(projectDocument, page, viewRotation);
      let url = thumbnailCache.get(key);
      if (!url) {
        try {
          url = await renderThumbnailImage(pdfDocument, page, viewRotation);
        } catch (error) {
          console.warn(`Thumbnail for page ${page} could not be rendered.`, error);
          continue;
        }
      }
      if (generation !== thumbnailGeneration) {
        continue;
      }
      thumbnailCache.set(key, url);
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
  const relatedPages = new Set();
  const related = highlightedRelatedIds();
  for (const occurrence of state.occurrences) {
    if (occurrence.documentId !== state.activeDocumentId) {
      continue;
    }
    counts.set(occurrence.page, (counts.get(occurrence.page) ?? 0) + 1);
    if (occurrence.objectId && occurrence.objectId === state.selectedObjectId) {
      selectedPages.add(occurrence.page);
    }
    if (related.has(occurrence.objectId)) {
      relatedPages.add(occurrence.page);
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
    button.classList.toggle("has-related", relatedPages.has(page));
    badge.hidden = count === 0;
    badge.textContent = String(count);
    button.setAttribute("aria-label", `Page ${page}${count ? `, ${count} mark${count === 1 ? "" : "s"}` : ""}${selectedPages.has(page) ? ", has the selected object" : ""}${relatedPages.has(page) ? ", has related objects" : ""}`);
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
  renderRelationList();
  renderTrace();
  syncOnexusLink();
  renderUnlinkedOccurrences();
  renderNotes();
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
  // Clicks on the overlay come from marks, handles, or the end of a draw or polygon.
  // The draw-ending click arrives after the new mark is selected and must not clear it.
  // composedPath() still holds the overlay when the draft shape was already removed.
  if (state.markMode || event.composedPath().includes(elements.overlay)) {
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
  viewHistory.clear();
  resetThumbnailCache();
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
      notes: state.notes,
      relations: state.relations,
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
    setStatus(`Project exported with ${state.objects.length} object${state.objects.length === 1 ? "" : "s"}, ${state.occurrences.length} occurrence${state.occurrences.length === 1 ? "" : "s"}, ${state.notes.length} note${state.notes.length === 1 ? "" : "s"}, and ${state.documents.length} PDF${state.documents.length === 1 ? "" : "s"}.`);
  } catch (error) {
    console.error(error);
    setSidecarMessage(`Export failed: ${error.message}`, true);
  }
}

async function importSidecar(file, parsed) {
  if (!file) {
    return;
  }

  try {
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
    state.notes = sidecar.notes;
    state.relations = sidecar.relations;
    state.revitData = null;
    state.selectedObjectId = null;
    state.selectedOccurrenceId = null;
    state.interaction = null;
    setRelateMode(null);
    setMarkMode(false);
    resetObjectHistory();
    viewHistory.clear();
    resetThumbnailCache();
    await activateDocument(importedActiveDocumentId);
    markObjectLayerSaved();
    const migrationNote = parsed.format === "obd-object-layer-v1"
      ? " and migrated from v1"
      : parsed.format === "obd-project-v2"
        ? " and migrated from v2"
        : parsed.format === "obd-project-v3"
          ? " and migrated from v3"
          : ["obd-project-v4", "objdraw-project-v4"].includes(parsed.format)
            ? " and migrated from v4; prior evidence text is now ordinary notes"
            : "";
    setSidecarMessage(`Imported ${file.name}${migrationNote}.`);
    const missingCount = state.documents.length - state.documentSessions.size;
    setStatus(`Restored ${state.documents.length} PDF${state.documents.length === 1 ? "" : "s"}, ${state.objects.length} object${state.objects.length === 1 ? "" : "s"}, ${state.occurrences.length} occurrence${state.occurrences.length === 1 ? "" : "s"}, ${state.notes.length} note${state.notes.length === 1 ? "" : "s"}, and ${state.relations.length} relation${state.relations.length === 1 ? "" : "s"}.${missingCount ? ` ${missingCount} PDF${missingCount === 1 ? " needs" : "s need"} relinking.` : ""}`);
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
  const noteCount = state.notes.filter((note) => note.occurrenceId === occurrenceId).length;
  if (noteCount > 0) {
    setStatus(`Remove ${noteCount} note${noteCount === 1 ? "" : "s"} linked to ${occurrence.id} before deleting the occurrence.`);
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
  if (event.target.dataset?.relationHandle) {
    startRelationDrag(event);
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
  if (state.relateFromObjectId) {
    if (occurrenceId) {
      pickRelationTarget(getOccurrence(occurrenceId)?.objectId ?? null);
      event.preventDefault();
    }
    return;
  }
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
  if (interaction?.type === "relate-drag" && interaction.pointerId === event.pointerId) {
    moveRelationDrag(event);
    return;
  }
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
  if (interaction.type === "relate-drag") {
    finishRelationDrag(event);
    event.preventDefault();
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
  setRelateMode(null);
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
  if (state.relateFromObjectId) {
    pickRelationTarget(occurrence.objectId);
    return;
  }
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

  const noteCount = state.notes.filter((note) => note.scope === "object" && note.objectId === object.id).length;
  if (noteCount > 0) {
    setStatus(`Remove ${noteCount} object note${noteCount === 1 ? "" : "s"} before deleting ${object.label} (${object.id}).`);
    return;
  }

  const occurrenceCount = getObjectOccurrences(state.occurrences, object.id).length;
  const relationCount = relationsForObject(state.relations, object.id).length;
  const relationWarning = relationCount
    ? `\n${relationCount} relation${relationCount === 1 ? "" : "s"} will be removed. Undo brings them back.`
    : "";
  const confirmed = globalThis.confirm(
    `Delete ${object.label} (${object.id})?\n\n${occurrenceCount} occurrence${occurrenceCount === 1 ? "" : "s"} will remain as unlinked marks.${relationWarning}`,
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
  state.relations = removeRelationsForObject(state.relations, object.id);
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

function addNoteFromForm(event) {
  event.preventDefault();
  try {
    const scope = elements.noteScope.value;
    const note = createNote(state.notes, {
      scope,
      objectId: scope === "object" ? state.selectedObjectId : null,
      occurrenceId: scope === "occurrence" ? state.selectedOccurrenceId : null,
      text: elements.noteText.value,
    });
    recordObjectMutation(`add ${note.id}`);
    state.notes.push(note);
    elements.noteText.value = "";
    refreshUi();
    elements.noteText.focus();
    setStatus(`${note.id} added as a ${note.scope} note.`);
  } catch (error) {
    setStatus(error.message);
    elements.noteText.setCustomValidity(error.message);
    elements.noteText.reportValidity();
    elements.noteText.setCustomValidity("");
  }
}

function importRevitData(file, parsed) {
  try {
    if (state.documents.length === 0) {
      throw new Error("Import the matching Object-Centric Drawing project first.");
    }
    const revitData = validateRevitData(parsed, state.objects, state.documents);
    state.revitData = revitData;
    refreshObjectUi();
    const parameterCount = revitData.objects.reduce(
      (sum, object) => sum + object.instanceParameters.length + object.typeParameters.length,
      0,
    );
    setSidecarMessage(`Imported ${file.name} as read-only Revit source data.`);
    setStatus(revitData.includesParameters
      ? `Loaded ${parameterCount} populated Revit parameter${parameterCount === 1 ? "" : "s"} for ${revitData.objects.length} object${revitData.objects.length === 1 ? "" : "s"}.`
      : `Loaded Revit identity for ${revitData.objects.length} object${revitData.objects.length === 1 ? "" : "s"}; this companion has no parameter snapshot.`);
  } catch (error) {
    console.error(error);
    setSidecarMessage(`Revit data import failed: ${error.message}. The current session was not changed.`, true);
    setStatus("The selected Revit companion was not imported.");
  } finally {
    elements.sidecarFile.value = "";
  }
}

async function importJsonFile(file) {
  if (!file) {
    return;
  }
  let parsed;
  try {
    parsed = JSON.parse(await file.text());
  } catch (error) {
    console.error(error);
    setSidecarMessage(`Import failed: ${error.message}. The current session was not changed.`, true);
    setStatus("The selected JSON file was not imported.");
    elements.sidecarFile.value = "";
    return;
  }
  if ([REVIT_DATA_FORMAT, LEGACY_REVIT_DATA_FORMAT].includes(parsed?.format)) {
    importRevitData(file, parsed);
    return;
  }
  await importSidecar(file, parsed);
}

async function handleNoteAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }
  const note = state.notes.find((entry) => entry.id === button.dataset.noteId);
  if (!note) {
    return;
  }
  if (button.dataset.action === "view-note-target") {
    closeNotes();
    if (note.scope === "occurrence") {
      await selectOccurrenceAndNavigate(note.occurrenceId);
    } else if (note.scope === "object") {
      await selectObjectAndNavigate(note.objectId);
    }
    return;
  }
  if (button.dataset.action === "save-note") {
    const text = elements.notesList.querySelector(`textarea[data-note-text="${CSS.escape(note.id)}"]`);
    try {
      if (text?.value.trim() === note.text) {
        setStatus(`${note.id} is unchanged.`);
        return;
      }
      recordObjectMutation(`edit ${note.id}`);
      state.notes = updateNote(state.notes, note.id, text?.value);
      refreshUi();
      setStatus(`${note.id} updated.`);
    } catch (error) {
      setStatus(error.message);
      text?.focus();
    }
    return;
  }
  if (button.dataset.action !== "remove-note") {
    return;
  }
  if (!globalThis.confirm(`Delete ${note.id}?\n\nUndo can restore it during this session.`)) {
    return;
  }
  recordObjectMutation(`delete ${note.id}`);
  state.notes = removeNote(state.notes, note.id);
  refreshUi();
  elements.addNote.focus();
  setStatus(`${note.id} deleted. Its target was preserved.`);
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
  if (state.relateFromObjectId) {
    if (state.interaction?.type === "relate-drag") {
      releasePointer(state.interaction.pointerId);
      state.interaction = null;
    }
    const wasRepeating = Boolean(state.relateRepeat);
    setRelateMode(null);
    setStatus(wasRepeating ? "Finished adding relations." : "Relating cancelled.");
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
  if (!hadAction && state.trace) {
    endTrace();
    return true;
  }
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
    // An open dialog handles its own Escape. It must not also end a trace or clear the selection.
    if (document.querySelector("dialog[open]")) {
      return;
    }
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
  if (action === "toggle-relations") {
    event.preventDefault();
    setShowAllRelations(!state.display.showAllRelations);
    return;
  }
  if (action === "start-relation") {
    event.preventDefault();
    startRelationFromSelection();
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
elements.openNotes.addEventListener("click", openNotes);
elements.closeNotes.addEventListener("click", closeNotes);
elements.notesDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeNotes();
});
elements.notesDialog.addEventListener("click", (event) => {
  if (event.target === elements.notesDialog) {
    closeNotes();
  }
});
elements.addNoteForm.addEventListener("submit", addNoteFromForm);
elements.noteText.addEventListener("input", () => elements.noteText.setCustomValidity(""));
elements.notesList.addEventListener("click", handleNoteAction);
elements.chooseSidecar.addEventListener("click", () => elements.sidecarFile.click());
elements.sidecarFile.addEventListener("change", (event) => importJsonFile(event.target.files?.[0]));
elements.revitPropertySearch.addEventListener("input", () => {
  renderRevitProperties(getObject(state.selectedObjectId));
});
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
  if (button && state.relateFromObjectId) {
    pickRelationTarget(button.dataset.objectId);
    return;
  }
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
elements.startRelation.addEventListener("click", startRelationFromSelection);
elements.removeRevitRelations.addEventListener("click", removeRevitRelations);
elements.toggleTrace.addEventListener("click", () => (state.trace ? endTrace() : startTrace()));
elements.endTrace.addEventListener("click", endTrace);
elements.exportOnexus.addEventListener("click", () => exportOnexusGraph());
elements.linkOnexus.addEventListener("click", () => {
  if (onexusLinkOpen() && onexusLink.ready) {
    onexusLink.window.focus();
    return;
  }
  openOnexusLink();
});
elements.onexusUrl.value = state.display.onexusUrl || defaultOnexusUrl();
elements.onexusUrl.addEventListener("change", () => {
  const value = elements.onexusUrl.value.trim();
  state.display.onexusUrl = value === defaultOnexusUrl() ? "" : value;
  saveDisplayPreferences();
});
globalThis.addEventListener("message", handleOnexusMessage);
elements.exportTraceOnexus.addEventListener("click", () => {
  const traced = tracedObjectIds();
  if (traced) {
    exportOnexusGraph([...traced]);
  }
});
elements.traceSteps.addEventListener("change", () => {
  if (state.trace) {
    state.trace.steps = Number(elements.traceSteps.value);
    refreshUi();
  }
});
elements.traceList.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-object-id]");
  if (button) {
    await selectObjectAndNavigate(button.dataset.objectId);
  }
});
elements.relationList.addEventListener("click", handleRelationListAction);
elements.showAllRelations.addEventListener("change", () => setShowAllRelations(elements.showAllRelations.checked));
elements.relationLabels.addEventListener("click", (event) => {
  const pill = event.target.closest("button[data-relation-id]");
  if (pill) {
    openRelationDialog({ id: pill.dataset.relationId });
  }
});
elements.pageSurface.addEventListener("pointermove", (event) => {
  if (!state.relateFromObjectId) {
    return;
  }
  lastRelationPointer = { x: event.clientX, y: event.clientY };
  updateRelationPreview(event.clientX, event.clientY);
});
elements.relationForm.addEventListener("submit", saveRelationDraft);
elements.saveRelationMore.addEventListener("click", (event) => saveRelationDraft(event, { addMore: true }));
elements.relationType.addEventListener("change", () => {
  setRelationError();
  renderRelationDraft();
});
elements.swapRelation.addEventListener("click", () => {
  if (relationDraft) {
    [relationDraft.from, relationDraft.to] = [relationDraft.to, relationDraft.from];
    setRelationError();
    renderRelationDraft();
  }
});
elements.deleteRelation.addEventListener("click", () => {
  const relationId = relationDraft?.id;
  closeRelationDialog();
  if (relationId) {
    deleteRelationById(relationId);
  }
});
elements.closeRelationDialog.addEventListener("click", closeRelationDialog);
elements.relationDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeRelationDialog();
});
// Close on a backdrop click only when the press also started there,
// so the click that picked the target cannot close the new dialog.
let relationBackdropPress = false;
elements.relationDialog.addEventListener("pointerdown", (event) => {
  relationBackdropPress = event.target === elements.relationDialog;
});
elements.relationDialog.addEventListener("click", (event) => {
  if (event.target === elements.relationDialog && relationBackdropPress) {
    closeRelationDialog();
  }
  relationBackdropPress = false;
});
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
