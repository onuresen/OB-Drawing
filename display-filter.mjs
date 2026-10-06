import { OBJECT_CATEGORIES, objectCategoryLabel } from "./category-catalog.mjs";

// View-only filters for the object browser and the canvas.
// Nothing here changes objects or occurrences, and none of it is saved in the project file.

export const MARK_FOCUS_MODES = Object.freeze(["all", "dim-others", "selected-only"]);

export function createDisplayState() {
  return {
    query: "",
    hiddenCategories: new Set(),
    collapsedCategories: new Set(),
    markFocus: "all",
  };
}

const CATEGORY_ORDER = new Map(OBJECT_CATEGORIES.map((category, index) => [category.key, index]));

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

// Groups objects by category in catalogue order. A search query filters objects;
// categories with no matching object are left out. Each group keeps its full count too.
export function groupObjectsForBrowser(objects, query = "") {
  const normalized = normalizeQuery(query);
  const groups = new Map();
  for (const object of objects) {
    let group = groups.get(object.category);
    if (!group) {
      group = { category: object.category, label: objectCategoryLabel(object.category), total: 0, objects: [] };
      groups.set(object.category, group);
    }
    group.total += 1;
    if (objectMatchesQuery(object, normalized)) {
      group.objects.push(object);
    }
  }
  return [...groups.values()]
    .filter((group) => group.objects.length > 0)
    .sort((a, b) => (CATEGORY_ORDER.get(a.category) ?? Infinity) - (CATEGORY_ORDER.get(b.category) ?? Infinity)
      || a.label.localeCompare(b.label));
}

// "shown", "dimmed" or "hidden" for one mark on the canvas.
// The selected object's marks are always shown, so a filter can never hide what you are working on.
// Unlinked marks are always shown, because they still need an object.
export function occurrenceVisibility(occurrence, objectsById, display, selectedObjectId) {
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
