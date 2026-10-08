// Data an object reads from the objects it relates to. Pure; no DOM.
// Example: a door shows the finish of the rooms it opens into and from.
// View only: nothing here is copied into the door or saved.

// Which outgoing relations are data sources, in display order.
export const RELATED_DATA_TYPES = Object.freeze(["takesDataFrom", "connectsTo", "hostedBy"]);
const SIDE_ORDER = { to: 0, from: 1 };

// English words people type, and the Japanese Revit parameter words they mean.
const TERM_ALIASES = {
  finish: ["仕上"],
  fire: ["防火", "耐火"],
  acoustic: ["遮音"],
  sound: ["遮音"],
  height: ["高さ"],
  width: ["幅"],
  floor: ["床"],
  wall: ["壁"],
  ceiling: ["天井"],
  base: ["幅木"],
};

// One source per outgoing data relation. A relation's own label ("finish") is its default filter.
export function relatedDataSources(relations, objectId) {
  const typeOrder = new Map(RELATED_DATA_TYPES.map((type, index) => [type, index]));
  return relations
    .filter((relation) => relation.from === objectId && typeOrder.has(relation.type))
    .sort((a, b) => (typeOrder.get(a.type) - typeOrder.get(b.type))
      || ((SIDE_ORDER[a.side] ?? 2) - (SIDE_ORDER[b.side] ?? 2)))
    .map((relation) => ({ relation, objectId: relation.to, defaultQuery: relation.type === "takesDataFrom" ? relation.label : "" }));
}

export function queryTerms(query) {
  const words = String(query ?? "").toLocaleLowerCase().split(/[\s,]+/).filter(Boolean);
  return [...new Set(words.flatMap((word) => [word, ...(TERM_ALIASES[word] ?? [])]))];
}

// Parameters whose name or value contains any term. No terms means all.
export function filterParameters(parameters, query) {
  const terms = queryTerms(query);
  if (terms.length === 0) {
    return [...parameters];
  }
  return parameters.filter((parameter) => [parameter.name, parameter.displayValue]
    .some((text) => terms.some((term) => String(text ?? "").toLocaleLowerCase().includes(term))));
}
