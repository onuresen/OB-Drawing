// Explicit object-to-object relations. Pure data rules; no DOM.
//
// Type keys follow the CDI relationship vocabulary (ontology/cdi-relationship-vocabulary.json),
// so a relation drawn here keeps its meaning in CDI and ONEXUS. `forward` reads from -> to,
// `inverse` reads to -> from. Undirected types read the same both ways.

export const RELATION_FAMILIES = Object.freeze([
  { key: "assembly", label: "Assembly" },
  { key: "spatial", label: "Space" },
  { key: "system", label: "System" },
  { key: "data", label: "Data" },
  { key: "general", label: "General" },
]);

export const RELATION_TYPES = Object.freeze([
  { key: "hostedBy", family: "assembly", forward: "hosted on", inverse: "hosts", directed: true },
  { key: "supportedBy", family: "assembly", forward: "supported by", inverse: "supports", directed: true },
  { key: "fixedTo", family: "assembly", forward: "fixed to", inverse: "has fixed", directed: true },
  { key: "penetrates", family: "assembly", forward: "passes through", inverse: "passed through by", directed: true },
  {
    key: "connectsTo",
    family: "spatial",
    forward: "opens to",
    inverse: "opened by",
    directed: true,
    // Revit's door To Room / From Room. "to" is the room the door opens into.
    sides: {
      to: { label: "Opens into (To Room)", forward: "opens into", inverse: "opened into by" },
      from: { label: "Opens from (From Room)", forward: "opens from", inverse: "opened from by" },
    },
  },
  { key: "inside", family: "spatial", forward: "inside", inverse: "contains", directed: true },
  { key: "adjacentTo", family: "spatial", forward: "next to", inverse: "next to", directed: false },
  { key: "controls", family: "system", forward: "controls", inverse: "controlled by", directed: true },
  { key: "serves", family: "system", forward: "serves", inverse: "served by", directed: true },
  { key: "communicatesWith", family: "system", forward: "talks to", inverse: "talks to", directed: false },
  { key: "belongsToSystem", family: "system", forward: "part of", inverse: "includes", directed: true },
  { key: "dependsOn", family: "system", forward: "depends on", inverse: "needed by", directed: true },
  { key: "takesDataFrom", family: "data", forward: "takes data from", inverse: "gives data to", directed: true },
  { key: "relatesTo", family: "general", forward: "related to", inverse: "related to", directed: false },
]);

export const DEFAULT_RELATION_TYPE = "relatesTo";
// Optional marker for relations a tool wrote rather than a person. Absent means hand-made.
export const RELATION_ORIGINS = Object.freeze(["revit"]);
export const MAXIMUM_RELATION_LABEL_LENGTH = 60;
export const RELATION_SIDES = Object.freeze(["to", "from"]);

const TYPES_BY_KEY = new Map(RELATION_TYPES.map((type) => [type.key, type]));

export function isRelationType(key) {
  return TYPES_BY_KEY.has(key);
}

export function relationType(key) {
  return TYPES_BY_KEY.get(key) ?? TYPES_BY_KEY.get(DEFAULT_RELATION_TYPE);
}

export function relationTypeGroups() {
  return RELATION_FAMILIES.map((family) => ({
    ...family,
    types: RELATION_TYPES.filter((type) => type.family === family.key),
  }));
}

// A side is optional and only exists on types that define sides.
export function normalizeRelationSide(type, side) {
  if (side === undefined || side === null || side === "") {
    return null;
  }
  if (!RELATION_SIDES.includes(side)) {
    throw new Error(`Unsupported relation side: ${side}.`);
  }
  return relationType(type).sides ? side : null;
}

export function normalizeRelationLabel(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, MAXIMUM_RELATION_LABEL_LENGTH);
}

export function nextRelationId(relations) {
  const highest = relations.reduce((maximum, relation) => {
    const match = /^relation-(\d+)$/.exec(relation.id);
    return match ? Math.max(maximum, Number(match[1])) : maximum;
  }, 0);
  return `relation-${String(highest + 1).padStart(3, "0")}`;
}

// The same pair with the same type is one relation. Undirected types ignore order.
export function findDuplicateRelation(relations, { type, from, to }, ignoreId = null) {
  const directed = relationType(type).directed;
  return relations.find((relation) => relation.id !== ignoreId
    && relation.type === type
    && ((relation.from === from && relation.to === to)
      || (!directed && relation.from === to && relation.to === from))) ?? null;
}

function requireValidRelation(relations, { type, from, to }, ignoreId = null) {
  if (!isRelationType(type)) {
    throw new Error(`Unsupported relation type: ${type}.`);
  }
  if (!from || !to) {
    throw new Error("A relation needs two objects.");
  }
  if (from === to) {
    throw new Error("An object cannot relate to itself.");
  }
  if (findDuplicateRelation(relations, { type, from, to }, ignoreId)) {
    throw new Error("This relation already exists.");
  }
}

// createdAt is optional in files: relations saved before it existed have an unknown age.
export function createRelation(relations, {
  type = DEFAULT_RELATION_TYPE,
  from,
  to,
  label = "",
  side = null,
  createdAt = new Date().toISOString(),
}) {
  requireValidRelation(relations, { type, from, to });
  if (Number.isNaN(Date.parse(createdAt))) {
    throw new Error("A relation requires a valid timestamp.");
  }
  const normalizedSide = normalizeRelationSide(type, side);
  return {
    id: nextRelationId(relations),
    type,
    from,
    to,
    label: normalizeRelationLabel(label),
    ...(normalizedSide ? { side: normalizedSide } : {}),
    createdAt,
  };
}

export function updateRelation(relations, relationId, { type, from, to, label, side }) {
  const current = relations.find((relation) => relation.id === relationId);
  if (!current) {
    throw new Error(`Unknown relation: ${relationId}.`);
  }
  const next = {
    ...current,
    type: type ?? current.type,
    from: from ?? current.from,
    to: to ?? current.to,
    label: label === undefined ? current.label : normalizeRelationLabel(label),
  };
  // A type without sides drops the side; otherwise keep it unless a new one is given.
  const nextSide = normalizeRelationSide(next.type, side === undefined ? current.side : side);
  delete next.side;
  if (nextSide) {
    next.side = nextSide;
  }
  requireValidRelation(relations, next, relationId);
  const unchanged = ["type", "from", "to", "label", "side"].every((key) => next[key] === current[key]);
  if (unchanged) {
    return relations;
  }
  // Once a person changes it, the relation is theirs, not the tool's.
  delete next.origin;
  return relations.map((relation) => (relation.id === relationId ? next : relation));
}

export function removeRelation(relations, relationId) {
  return relations.filter((relation) => relation.id !== relationId);
}

export function removeRelationsByOrigin(relations, origin) {
  return relations.filter((relation) => relation.origin !== origin);
}

export function removeRelationsForObject(relations, objectId) {
  return relations.filter((relation) => relation.from !== objectId && relation.to !== objectId);
}

// How a relation reads from one side. "CR-01 controls D-105" from CR-01,
// "D-105 controlled by CR-01" from D-105.
export function relationPhrase(relation, viewpointObjectId = relation.from) {
  const type = relationType(relation.type);
  const words = (relation.side && type.sides?.[relation.side]) || type;
  return viewpointObjectId === relation.to && relation.from !== relation.to ? words.inverse : words.forward;
}

// Every relation touching one object, seen from that object.
export function relationsForObject(relations, objectId) {
  return relations
    .filter((relation) => relation.from === objectId || relation.to === objectId)
    .map((relation) => ({
      relation,
      otherObjectId: relation.from === objectId ? relation.to : relation.from,
      outgoing: relation.from === objectId,
      phrase: relationPhrase(relation, objectId),
    }));
}

// Signed lanes for relations that share the same two objects, so their arcs never overlap.
// The sign is taken against one fixed direction per pair, so A→B and B→A also separate.
export function relationLanes(relations) {
  const counts = new Map();
  const lanes = new Map();
  for (const relation of relations) {
    const [first, second] = [relation.from, relation.to].sort();
    const key = `${first}|${second}`;
    const index = counts.get(key) ?? 0;
    counts.set(key, index + 1);
    const lane = (index % 2 === 0 ? 1 : -1) * (Math.floor(index / 2) + 1);
    lanes.set(relation.id, relation.from === first ? lane : -lane);
  }
  return lanes;
}

// Chooses the closest pair of marks for drawing one relation on one page.
export function nearestOccurrencePair(fromOccurrences, toOccurrences) {
  let best = null;
  for (const first of fromOccurrences) {
    for (const second of toOccurrences) {
      const dx = (first.bounds.x + first.bounds.width / 2) - (second.bounds.x + second.bounds.width / 2);
      const dy = (first.bounds.y + first.bounds.height / 2) - (second.bounds.y + second.bounds.height / 2);
      const distance = dx * dx + dy * dy;
      if (!best || distance < best.distance) {
        best = { from: first, to: second, distance };
      }
    }
  }
  return best ? { from: best.from, to: best.to } : null;
}

// Where a ray from the box centre leaves the box, in pixels.
function boxExitFraction(halfWidth, halfHeight, dx, dy) {
  const fractions = [];
  if (dx !== 0) {
    fractions.push(halfWidth / Math.abs(dx));
  }
  if (dy !== 0) {
    fractions.push(halfHeight / Math.abs(dy));
  }
  return fractions.length ? Math.min(...fractions) : 0;
}

// A gentle arc between two marks, computed in pixels so the arrow keeps its shape,
// then returned in normalized page coordinates.
// `lane` separates several relations between the same two marks: 1, -1, 2, -2 …
// bend to alternating sides, each further out.
export function relationCurve(fromBounds, toBounds, pageSize, { gap = 4, arrowSize = 9, directed = true, lane = 1 } = {}) {
  const width = Math.max(1, pageSize.width);
  const height = Math.max(1, pageSize.height);
  const box = (bounds) => ({
    cx: (bounds.x + bounds.width / 2) * width,
    cy: (bounds.y + bounds.height / 2) * height,
    hw: (bounds.width / 2) * width + gap,
    hh: (bounds.height / 2) * height + gap,
  });
  const a = box(fromBounds);
  const b = box(toBounds);
  const dx = b.cx - a.cx;
  const dy = b.cy - a.cy;
  const length = Math.hypot(dx, dy);
  if (length < 1) {
    return null;
  }

  let startFraction = boxExitFraction(a.hw, a.hh, dx, dy);
  let endFraction = boxExitFraction(b.hw, b.hh, dx, dy);
  if (startFraction + endFraction >= 0.95) {
    // Overlapping or touching marks: run centre to centre.
    startFraction = 0;
    endFraction = 0;
  }
  const start = { x: a.cx + dx * startFraction, y: a.cy + dy * startFraction };
  const end = { x: b.cx - dx * endFraction, y: b.cy - dy * endFraction };
  const span = Math.hypot(end.x - start.x, end.y - start.y);
  const laneSize = Math.max(1, Math.abs(lane));
  const bend = Math.sign(lane || 1) * (Math.min(span * 0.16, 42) + 22 * (laneSize - 1));
  const control = {
    x: (start.x + end.x) / 2 - (dy / length) * bend,
    y: (start.y + end.y) / 2 + (dx / length) * bend,
  };
  const mid = {
    x: 0.25 * start.x + 0.5 * control.x + 0.25 * end.x,
    y: 0.25 * start.y + 0.5 * control.y + 0.25 * end.y,
  };

  let arrow = null;
  if (directed) {
    const tx = end.x - control.x;
    const ty = end.y - control.y;
    const tangent = Math.hypot(tx, ty) || 1;
    const ux = tx / tangent;
    const uy = ty / tangent;
    const back = { x: end.x - ux * arrowSize, y: end.y - uy * arrowSize };
    const side = arrowSize * 0.55;
    arrow = [
      end,
      { x: back.x - uy * side, y: back.y + ux * side },
      { x: back.x + uy * side, y: back.y - ux * side },
    ];
  }

  const normalize = (point) => ({ x: point.x / width, y: point.y / height });
  return {
    start: normalize(start),
    control: normalize(control),
    end: normalize(end),
    mid: normalize(mid),
    arrow: arrow ? arrow.map(normalize) : null,
  };
}

// A starting choice for the relation dialog, from the two categories only.
// It is a default the person confirms or changes, never a saved inference.
const OPENING_CATEGORIES = new Set(["doors", "windows", "openings", "curtain-panels"]);
const HOST_CATEGORIES = new Set(["walls", "floors", "roofs", "ceilings", "curtain-wall-mullions", "structural-framing", "structural-columns"]);
const SPACE_CATEGORIES = new Set(["rooms", "spaces", "areas", "zones"]);
const RUN_CATEGORIES = new Set(["pipes", "ducts", "conduits", "cable-trays", "flex-pipes", "flex-ducts"]);
const CONTROL_CATEGORIES = new Set(["security-devices", "lighting-devices", "data-devices", "communication-devices", "fire-alarm-devices", "electrical-fixtures"]);
const SERVICE_CATEGORIES = new Set(["mechanical-equipment", "air-terminals", "electrical-equipment", "lighting-fixtures", "plumbing-fixtures", "sprinklers"]);

function suggestDirected(fromCategory, toCategory) {
  if (OPENING_CATEGORIES.has(fromCategory) && HOST_CATEGORIES.has(toCategory)) {
    return "hostedBy";
  }
  if (OPENING_CATEGORIES.has(fromCategory) && SPACE_CATEGORIES.has(toCategory)) {
    return "connectsTo";
  }
  if (RUN_CATEGORIES.has(fromCategory) && HOST_CATEGORIES.has(toCategory)) {
    return "penetrates";
  }
  if (CONTROL_CATEGORIES.has(fromCategory) && (OPENING_CATEGORIES.has(toCategory) || SERVICE_CATEGORIES.has(toCategory))) {
    return "controls";
  }
  if (SERVICE_CATEGORIES.has(fromCategory) && SPACE_CATEGORIES.has(toCategory)) {
    return "serves";
  }
  if (CONTROL_CATEGORIES.has(fromCategory) && HOST_CATEGORIES.has(toCategory)) {
    return "fixedTo";
  }
  if (SPACE_CATEGORIES.has(toCategory) && !SPACE_CATEGORIES.has(fromCategory)) {
    return "inside";
  }
  if (SPACE_CATEGORIES.has(fromCategory) && SPACE_CATEGORIES.has(toCategory)) {
    return "adjacentTo";
  }
  return null;
}

// Returns the suggested type and whether the picked direction should be swapped,
// so "wall, then door" still suggests "door hosted on wall".
export function suggestRelationType(fromCategory, toCategory) {
  const forward = suggestDirected(fromCategory, toCategory);
  if (forward) {
    return { type: forward, swap: false };
  }
  const backward = suggestDirected(toCategory, fromCategory);
  if (backward) {
    return { type: backward, swap: relationType(backward).directed };
  }
  return { type: DEFAULT_RELATION_TYPE, swap: false };
}

export const MAXIMUM_TRACE_STEPS = 3;

// Objects reachable from one root within `steps` relations, in either direction.
// Each entry keeps the relation it was reached through, so the path can be explained.
export function traceRelations(relations, rootId, steps = 2) {
  const limit = Math.max(1, Math.min(MAXIMUM_TRACE_STEPS, Math.floor(steps)));
  const reached = new Map([[rootId, { objectId: rootId, step: 0, viaObjectId: null, relation: null }]]);
  let frontier = [rootId];
  for (let step = 1; step <= limit && frontier.length > 0; step += 1) {
    const next = [];
    for (const objectId of frontier) {
      for (const relation of relations) {
        const otherId = relation.from === objectId ? relation.to : relation.to === objectId ? relation.from : null;
        if (!otherId || reached.has(otherId)) {
          continue;
        }
        reached.set(otherId, { objectId: otherId, step, viaObjectId: objectId, relation });
        next.push(otherId);
      }
    }
    frontier = next;
  }
  return [...reached.values()];
}

// Objects directly related to one object, without the object itself.
export function relatedObjectIds(relations, objectId) {
  return new Set(relationsForObject(relations, objectId).map((entry) => entry.otherObjectId));
}
