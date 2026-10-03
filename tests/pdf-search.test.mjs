import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPdfTextIndex,
  findPdfTextMatches,
  indexPdfTextPage,
  stepPdfMatchIndex,
} from "../pdf-search.mjs";

test("page indexing retains PDF.js text-div identity while joining searchable text", () => {
  const page = indexPdfTextPage({
    items: [
      { type: "beginMarkedContent" },
      { str: "Door" },
      { str: "schedule" },
      { str: "" },
      { type: "endMarkedContent" },
      { str: "D-105" },
    ],
  }, 7);

  assert.equal(page.text, "Door schedule D-105");
  assert.deepEqual(page.ranges, [
    { textDivIndex: 0, start: 0, end: 4 },
    { textDivIndex: 1, start: 5, end: 13 },
    { textDivIndex: 3, start: 14, end: 19 },
  ]);
});

test("search is case-insensitive and maps a phrase across adjacent PDF text spans", () => {
  const pages = [indexPdfTextPage({
    items: [{ str: "Door" }, { str: "Schedule" }, { str: "D-105" }],
  }, 2)];

  const matches = findPdfTextMatches(pages, "door schedule");

  assert.equal(matches.length, 1);
  assert.equal(matches[0].pageNumber, 2);
  assert.deepEqual(matches[0].segments, [
    { textDivIndex: 0, start: 0, end: 4 },
    { textDivIndex: 1, start: 0, end: 8 },
  ]);
});

test("search orders non-overlapping results by page then reading order", () => {
  const pages = [
    indexPdfTextPage({ items: [{ str: "Door door" }] }, 1),
    indexPdfTextPage({ items: [{ str: "Window" }, { str: "door" }] }, 3),
  ];

  const matches = findPdfTextMatches(pages, "door");

  assert.deepEqual(matches.map((match) => match.pageNumber), [1, 1, 3]);
  assert.deepEqual(matches.map((match) => match.start), [0, 5, 7]);
  assert.deepEqual(findPdfTextMatches(pages, "   "), []);
});

test("PDF indexing extracts every page once and reports bounded progress", async () => {
  const requestedPages = [];
  const progress = [];
  const pdfDocument = {
    numPages: 3,
    async getPage(pageNumber) {
      requestedPages.push(pageNumber);
      return {
        async getTextContent(options) {
          assert.deepEqual(options, { includeMarkedContent: true });
          return { items: [{ str: `Page ${pageNumber}` }] };
        },
      };
    },
  };

  const pages = await buildPdfTextIndex(pdfDocument, (pageNumber, total) => {
    progress.push([pageNumber, total]);
  });

  assert.deepEqual(requestedPages, [1, 2, 3]);
  assert.deepEqual(progress, [[1, 3], [2, 3], [3, 3]]);
  assert.deepEqual(pages.map((page) => page.text), ["Page 1", "Page 2", "Page 3"]);
});

test("result navigation wraps in both directions", () => {
  assert.equal(stepPdfMatchIndex(-1, 4, 1), 0);
  assert.equal(stepPdfMatchIndex(3, 4, 1), 0);
  assert.equal(stepPdfMatchIndex(0, 4, -1), 3);
  assert.equal(stepPdfMatchIndex(2, 0, 1), -1);
});
