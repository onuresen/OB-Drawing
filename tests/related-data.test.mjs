import test from "node:test";
import assert from "node:assert/strict";
import { filterParameters, queryTerms, relatedDataSources } from "../related-data.mjs";

const relations = [
  { id: "relation-001", type: "controls", from: "object-001", to: "object-002", label: "" },
  { id: "relation-002", type: "connectsTo", from: "object-002", to: "object-005", label: "", side: "from" },
  { id: "relation-003", type: "hostedBy", from: "object-002", to: "object-003", label: "" },
  { id: "relation-004", type: "connectsTo", from: "object-002", to: "object-004", label: "", side: "to" },
  { id: "relation-005", type: "takesDataFrom", from: "object-002", to: "object-004", label: "finish" },
  { id: "relation-006", type: "connectsTo", from: "object-009", to: "object-002", label: "" },
];

test("a door reads data from what it takes data from, opens to (into first), and is hosted on", () => {
  const sources = relatedDataSources(relations, "object-002");
  assert.deepEqual(sources.map((source) => source.relation.id), ["relation-005", "relation-004", "relation-002", "relation-003"]);
  assert.equal(sources[0].defaultQuery, "finish", "a takes-data-from note is the default filter");
  assert.equal(sources[1].defaultQuery, "");
  // Incoming relations and other types are not data sources for this object.
  assert.deepEqual(relatedDataSources(relations, "object-001"), []);
});

test("filters match names and values, with Japanese aliases for common words", () => {
  const parameters = [
    { name: "Floor Finish", displayValue: "Vinyl" },
    { name: "床仕上げ", displayValue: "長尺シート" },
    { name: "Area", displayValue: "24.5 m²" },
    { name: "Comments", displayValue: "fire door required" },
  ];
  assert.deepEqual(filterParameters(parameters, "finish").map((parameter) => parameter.name), ["Floor Finish", "床仕上げ"]);
  assert.deepEqual(filterParameters(parameters, "fire").map((parameter) => parameter.name), ["Comments"]);
  assert.equal(filterParameters(parameters, "").length, 4);
  assert.equal(filterParameters(parameters, "  ").length, 4);
  assert.deepEqual(queryTerms("Finish, area"), ["finish", "仕上", "area"]);
});
