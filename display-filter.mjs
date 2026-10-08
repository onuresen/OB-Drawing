import { OBJECT_CATEGORIES, objectCategoryLabel } from "./category-catalog.mjs";

// View-only filters for the object browser and the canvas.
// Nothing here changes objects or occurrences, and none of it is saved in the project file.

export const MARK_FOCUS_MODES = Object.freeze(["all", "dim-others", "selected-only", "none"]);
export const GROUP_BY_MODES = Object.freeze(["category", "page", "none"]);

export function createDisplayState() {
  return {
    query: "",
    groupBy: "category",
    currentPageOnly: false,
    showLabels: false,
    showAllRelations: false,
    onexusUrl: "",
    showThumbnails: false,
    hiddenCategories: new Set(),
    collapsedGroups: new Set(),
    markFocus: "all",
  };
}

// Only the viewer's preferences are remembered, never what was hidden or searched.
export function displayPreferences(display) {
  return {
    groupBy: display.groupBy,
    currentPageOnly: display.currentPageOnly,
    showLabels: display.showLabels,
    showAllRelations: display.showAllRelations,
    onexusUrl: display.onexusUrl,
    showThumbnails: display.showThumbnails,
    markFocus: display.markFocus,
  };
}

export function applyDisplayPreferences(display, stored) {
  if (!stored || typeof stored !== "object") {
    return display;
  }
  if (GROUP_BY_MODES.includes(stored.groupBy)) {
    display.groupBy = stored.groupBy;
  }
  if (MARK_FOCUS_MODES.includes(stored.markFocus)) {
    display.markFocus = stored.markFocus;
  }
  display.currentPageOnly = stored.currentPageOnly === true;
  display.showLabels = stored.showLabels === true;
  display.showAllRelations = stored.showAllRelations === true;
  display.onexusUrl = typeof stored.onexusUrl === "string" ? stored.onexusUrl.slice(0, 500) : "";
  display.showThumbnails = stored.showThumbnails === true;
  return display;
}

const CATEGORY_ORDER = new Map(OBJECT_CATEGORIES.map((category, index) => [category.key, index]));
const LABEL_COLLATOR = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

// Natural order, so "D-9" comes before "D-10" and "3810" before "4055".
export function compareObjects(a, b) {
  return LABEL_COLLATOR.compare(a.label, b.label) || LABEL_COLLATOR.compare(a.id, b.id);
}

function normalizeQuery(query) {
  return String(query ?? "").trim().toLocaleLowerCase();
}

function objectMatchesQuery(object, query) {
  if (!query) {
    return true;
  }
  return [object.label, object.id, objectCategoryLabel(object.category)]
    .some((text) => String(text).toLocaleLowerCase().includes(query));
}

function pageKey(documentId, page) {
  return `${documentId}:${page}`;
}

// Groups objects for the browser.
//   groupBy "category": catalogue order, one group per category.
//   groupBy "page":     one group per PDF page; an object on several pages is in each of them.
//   groupBy "none":     one flat group.
// currentPage ({ documentId, page }) keeps only objects marked on that page.
// Each group reports its full size as total, and its visible objects in natural order.
export function groupObjectsForBrowser(objects, query = "", options = {}) {
  const {
    groupBy = "category",
    occurrences = [],
    documents = [],
    currentPage = null,
  } = options;
  const normalized = normalizeQuery(query);
  const pagesByObject = new Map();
  for (const occurrence of occurrences) {
    if (!occurrence.objectId) {
      continue;
    }
    const pages = pagesByObject.get(occurrence.objectId) ?? new Set();
    pages.add(pageKey(occurrence.documentId, occurrence.page));
    pagesByObject.set(occurrence.objectId, pages);
  }
  const onCurrentPage = (object) => !currentPage
    || Boolean(pagesByObject.get(object.id)?.has(pageKey(currentPage.documentId, currentPage.page)));

  const groups = new Map();
  const addTo = (key, describe, object, visible) => {
    let group = groups.get(key);
    if (!group) {
      group = { key, total: 0, objects: [], ...describe() };
      groups.set(key, group);
    }
    group.total += 1;
    if (visible) {
      group.objects.push(object);
    }
  };

  const documentOrder = new Map(documents.map((document, index) => [document.id, index]));
  const documentNames = new Map(documents.map((document) => [document.id, document.name]));

  for (const object of objects) {
    const visible = objectMatchesQuery(object, normalized) && onCurrentPage(object);
    if (groupBy === "none") {
      addTo("all", () => ({ label: "All objects", order: [0] }), object, visible);
    } else if (groupBy === "page") {
      const pages = [...(pagesByObject.get(object.id) ?? [])];
      if (pages.length === 0) {
        addTo("page:none", () => ({ label: "Not marked yet", order: [Infinity] }), object, visible);
      }
      for (const key of pages) {
        const separator = key.lastIndexOf(":");
        const documentId = key.slice(0, separator);
        const page = Number(key.slice(separator + 1));
        addTo(`page:${key}`, () => ({
          label: documents.length > 1 ? `${documentNames.get(documentId) ?? documentId} · p. ${page}` : `Page ${page}`,
          order: [documentOrder.get(documentId) ?? Infinity, page],
        }), object, visible);
      }
    } else {
      addTo(`category:${object.category}`, () => ({
        category: object.category,
        label: objectCategoryLabel(object.category),
        order: [CATEGORY_ORDER.get(object.category) ?? Infinity],
      }), object, visible);
    }
  }

  const compareOrder = (a, b) => {
    for (let index = 0; index < Math.max(a.order.length, b.order.length); index += 1) {
      const difference = (a.order[index] ?? 0) - (b.order[index] ?? 0);
      if (difference) {
        return difference;
      }
    }
    return a.label.localeCompare(b.label);
  };

  return [...groups.values()]
    .filter((group) => group.objects.length > 0)
    .sort(compareOrder)
    .map(({ order, ...group }) => ({ ...group, objects: group.objects.sort(compareObjects) }));
}

// "shown", "dimmed" or "hidden" for one mark on the canvas.
// "none" hides every mark, for reading the bare drawing.
// Otherwise the selected object's marks and unlinked marks are always shown,
// so a filter can never hide what you are working on or a mark that still needs an object.
export function occurrenceVisibility(occurrence, objectsById, display, selectedObjectId) {
  if (display.markFocus === "none") {
    return "hidden";
  }
  if (!occurrence.objectId) {
    return "shown";
  }
  if (occurrence.objectId === selectedObjectId) {
    return "shown";
  }
  const object = objectsById.get(occurrence.objectId);
  if (object && display.hiddenCategories.has(object.category)) {
    return "hidden";
  }
  if (selectedObjectId && display.markFocus === "selected-only") {
    return "hidden";
  }
  if (selectedObjectId && display.markFocus === "dim-others") {
    return "dimmed";
  }
  return "shown";
}

export function toggleSetMember(set, key) {
  const next = new Set(set);
  if (next.has(key)) {
    next.delete(key);
  } else {
    next.add(key);
  }
  return next;
}
