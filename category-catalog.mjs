export const DEFAULT_OBJECT_CATEGORY = "doors";

const GROUP_DEFINITIONS = [
  ["Architecture", [
    ["doors", "Doors", "DR"],
    ["windows", "Windows", "WN"],
    ["walls", "Walls", "WL"],
    ["curtain-panels", "Curtain Panels", "CP"],
    ["curtain-wall-mullions", "Curtain Wall Mullions", "CM"],
    ["floors", "Floors", "FL"],
    ["roofs", "Roofs", "RF"],
    ["ceilings", "Ceilings", "CL"],
    ["stairs", "Stairs", "ST"],
    ["railings", "Railings", "RL"],
    ["ramps", "Ramps", "RP"],
    ["openings", "Openings", "OP"],
    ["furniture", "Furniture", "FR"],
    ["casework", "Casework", "CW"],
    ["generic-models", "Generic Models", "GM"],
    ["specialty-equipment", "Specialty Equipment", "SE"],
    ["signage", "Signage", "SG"],
  ]],
  ["Structure", [
    ["structural-columns", "Structural Columns", "SC"],
    ["structural-framing", "Structural Framing", "SF"],
    ["structural-foundations", "Structural Foundations", "FD"],
    ["structural-connections", "Structural Connections", "CN"],
    ["structural-rebar", "Structural Rebar", "RB"],
    ["area-reinforcement", "Area Reinforcement", "AR"],
    ["path-reinforcement", "Path Reinforcement", "PR"],
    ["fabric-reinforcement", "Fabric Reinforcement", "FB"],
    ["trusses", "Trusses", "TR"],
    ["structural-stiffeners", "Structural Stiffeners", "SS"],
    ["parts", "Parts", "PT"],
    ["assemblies", "Assemblies", "AS"],
  ]],
  ["Mechanical", [
    ["mechanical-equipment", "Mechanical Equipment", "ME"],
    ["ducts", "Ducts", "DU"],
    ["duct-fittings", "Duct Fittings", "DF"],
    ["duct-accessories", "Duct Accessories", "DA"],
    ["flex-ducts", "Flex Ducts", "FX"],
    ["air-terminals", "Air Terminals", "AT"],
    ["duct-insulations", "Duct Insulations", "DI"],
    ["duct-linings", "Duct Linings", "DL"],
  ]],
  ["Electrical", [
    ["electrical-equipment", "Electrical Equipment", "EE"],
    ["electrical-fixtures", "Electrical Fixtures", "EF"],
    ["lighting-fixtures", "Lighting Fixtures", "LF"],
    ["lighting-devices", "Lighting Devices", "LD"],
    ["cable-trays", "Cable Trays", "CT"],
    ["cable-tray-fittings", "Cable Tray Fittings", "CF"],
    ["conduits", "Conduits", "CD"],
    ["conduit-fittings", "Conduit Fittings", "CF"],
    ["wires", "Wires", "WR"],
    ["data-devices", "Data Devices", "DD"],
    ["communication-devices", "Communication Devices", "CO"],
    ["fire-alarm-devices", "Fire Alarm Devices", "FA"],
    ["security-devices", "Security Devices", "SD"],
    ["nurse-call-devices", "Nurse Call Devices", "NC"],
    ["telephone-devices", "Telephone Devices", "TD"],
  ]],
  ["Plumbing & Fire Protection", [
    ["plumbing-fixtures", "Plumbing Fixtures", "PF"],
    ["pipes", "Pipes", "PI"],
    ["pipe-fittings", "Pipe Fittings", "PF"],
    ["pipe-accessories", "Pipe Accessories", "PA"],
    ["flex-pipes", "Flex Pipes", "FP"],
    ["pipe-insulations", "Pipe Insulations", "PI"],
    ["sprinklers", "Sprinklers", "SP"],
  ]],
  ["Spatial", [
    ["rooms", "Rooms", "RM"],
    ["spaces", "Spaces", "SP"],
    ["areas", "Areas", "AR"],
    ["zones", "Zones", "ZN"],
  ]],
  ["Site & Landscape", [
    ["site", "Site", "SI"],
    ["topography", "Topography", "TP"],
    ["building-pads", "Building Pads", "BP"],
    ["parking", "Parking", "PK"],
    ["roads", "Roads", "RD"],
    ["planting", "Planting", "PL"],
    ["entourage", "Entourage", "EN"],
    ["property-lines", "Property Lines", "PR"],
  ]],
  ["Fabrication", [
    ["fabrication-ductwork", "Fabrication Ductwork", "FD"],
    ["fabrication-pipework", "Fabrication Pipework", "FP"],
    ["fabrication-containment", "Fabrication Containment", "FC"],
    ["fabrication-hangers", "Fabrication Hangers", "FH"],
  ]],
  ["Coordination & Other", [
    ["model-groups", "Model Groups", "MG"],
    ["masses", "Masses", "MS"],
    ["adaptive-components", "Adaptive Components", "AC"],
    ["linked-models", "Linked Models", "LM"],
    ["point-clouds", "Point Clouds", "PC"],
    ["other", "Other / Custom", "OT"],
  ]],
];

export const OBJECT_CATEGORY_GROUPS = Object.freeze(GROUP_DEFINITIONS.map(([label, categories]) => Object.freeze({
  label,
  categories: Object.freeze(categories.map(([key, categoryLabel, shortCode]) => Object.freeze({
    key,
    label: categoryLabel,
    shortCode,
    group: label,
  }))),
})));

export const OBJECT_CATEGORIES = Object.freeze(OBJECT_CATEGORY_GROUPS.flatMap((group) => group.categories));

const CATEGORY_BY_KEY = new Map(OBJECT_CATEGORIES.map((category) => [category.key, category]));

export function isObjectCategoryKey(key) {
  return CATEGORY_BY_KEY.has(key);
}

export function objectCategory(key) {
  return CATEGORY_BY_KEY.get(key) ?? null;
}

export function objectCategoryLabel(key) {
  return objectCategory(key)?.label ?? "Unknown category";
}

export function objectCategoryCode(key) {
  return objectCategory(key)?.shortCode ?? "OB";
}

export function filterObjectCategoryGroups(query) {
  const normalized = String(query ?? "").trim().toLocaleLowerCase();
  if (!normalized) {
    return OBJECT_CATEGORY_GROUPS;
  }
  return OBJECT_CATEGORY_GROUPS.map((group) => ({
    label: group.label,
    categories: group.categories.filter((category) => (
      category.label.toLocaleLowerCase().includes(normalized)
      || category.key.includes(normalized)
      || group.label.toLocaleLowerCase().includes(normalized)
    )),
  })).filter((group) => group.categories.length > 0);
}
