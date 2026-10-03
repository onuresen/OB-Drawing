function normalizedQuery(query) {
  return String(query ?? "").trim().toLocaleLowerCase();
}

export function indexPdfTextPage(textContent, pageNumber) {
  let text = "";
  let textDivIndex = -1;
  const ranges = [];
  for (const item of textContent?.items ?? []) {
    if (item?.str === undefined) {
      continue;
    }
    textDivIndex += 1;
    const value = String(item.str);
    if (!value) {
      continue;
    }
    if (text) {
      text += " ";
    }
    const start = text.length;
    text += value;
    ranges.push({
      textDivIndex,
      start,
      end: text.length,
    });
  }
  return {
    pageNumber,
    text,
    searchText: text.toLocaleLowerCase(),
    ranges,
  };
}

export async function buildPdfTextIndex(pdfDocument, onProgress = null) {
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
    const page = await pdfDocument.getPage(pageNumber);
    const textContent = await page.getTextContent({ includeMarkedContent: true });
    pages.push(indexPdfTextPage(textContent, pageNumber));
    onProgress?.(pageNumber, pdfDocument.numPages);
  }
  return pages;
}

export function findPdfTextMatches(indexedPages, query) {
  const needle = normalizedQuery(query);
  if (!needle) {
    return [];
  }

  const matches = [];
  for (const page of indexedPages) {
    let fromIndex = 0;
    while (fromIndex <= page.searchText.length - needle.length) {
      const start = page.searchText.indexOf(needle, fromIndex);
      if (start < 0) {
        break;
      }
      const end = start + needle.length;
      const segments = page.ranges
        .filter((range) => range.end > start && range.start < end)
        .map((range) => ({
          textDivIndex: range.textDivIndex,
          start: Math.max(start, range.start) - range.start,
          end: Math.min(end, range.end) - range.start,
        }));
      if (segments.length > 0) {
        matches.push({
          pageNumber: page.pageNumber,
          start,
          end,
          segments,
        });
      }
      fromIndex = end;
    }
  }
  return matches;
}

export function stepPdfMatchIndex(currentIndex, matchCount, direction) {
  if (matchCount <= 0) {
    return -1;
  }
  const current = Number.isInteger(currentIndex) ? currentIndex : -1;
  const step = direction < 0 ? -1 : 1;
  return (current + step + matchCount) % matchCount;
}
